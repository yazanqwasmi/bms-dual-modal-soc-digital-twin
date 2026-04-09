/**
 * BMS Sensing ESP32 Firmware
 * ==========================
 * Reads cell voltages from BQ76920 + temperatures from thermistors,
 * builds a JSON payload, and POSTs to the Raspberry Pi receiver.
 *
 * One sensing ESP per battery module.
 * NOTE: physical Cell 4 tap is skipped; transmitted cells are C1, C2, C3, C5.
 */

#include <Arduino.h>
#include <Wire.h>
#include <math.h>
#include <ArduinoJson.h>
#include "config.h"
#include "wifi_utils.h"
#include "narx_inference.h"

// ---- Packet loss tracking ----
static bool _sendHistory[PACKET_LOSS_WINDOW] = {false};
static int  _sendHistoryIdx = 0;
static int  _sendHistoryCount = 0;
static unsigned long lastLatencyMs = 0;

// ---- Moving average buffers ----
float cellBuf[NUM_CELLS][AVG_N] = {0};
float tempBuf[NUM_TEMPS][AVG_N] = {0};
int avgIndex = 0;
bool avgFilled = false;

// ---- Forward declarations ----
void pulseBoot();
uint8_t readByte(uint8_t reg);
uint16_t readWord(uint8_t reg);
float readCellmV(uint8_t regHi, int gain, int offset);
float readThermistorC(int pin);
void blinkLED(int times, int delayMs);
float getPacketLoss();
void recordSendResult(bool success);
void addToAverage(float value, float *buf);
float getAverage(float *buf);
void enableBQADC();

// ---- Setup ----
void setup() {
    Serial.begin(115200);
    delay(1000);

    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);

    Wire.begin(SDA_PIN, SCL_PIN, 100000);

    analogReadResolution(12);
    analogSetAttenuation(ADC_11db);

    pulseBoot();
    enableBQADC();

    Serial.println("=================================");
    Serial.println("BMS Sensing ESP32");
    Serial.printf("  Module: %s\n", MODULE_ID);
    Serial.printf("  Cells sent: C1 C2 C3 C5\n");
    Serial.printf("  Temps: %d\n", NUM_TEMPS);
    Serial.println("=================================");

    connectWiFi();
    narx_init();
    blinkLED(3, 200);
}

// ---- Main loop ----
void loop() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi disconnected, reconnecting...");
        connectWiFi();
    }

    uint8_t g1 = readByte(ADCGAIN1);
    uint8_t g2 = readByte(ADCGAIN2);
    int8_t offset = (int8_t)readByte(ADCOFFSET);
    uint8_t gainCode = (((g1 >> 2) & 0x03) << 3) | ((g2 >> 5) & 0x07);
    int gain = 365 + gainCode;

    for (int i = 0; i < NUM_CELLS; i++) {
        float cellmV = readCellmV(CELL_REGS[i], gain, offset);
        addToAverage(cellmV, cellBuf[i]);
    }

    for (int i = 0; i < NUM_TEMPS; i++) {
        float tempC = readThermistorC(TEMP_PINS[i]);
        addToAverage(tempC, tempBuf[i]);
    }

    float cells[NUM_CELLS];
    float temps[NUM_TEMPS];
    float moduleVoltage = 0.0f;

    for (int i = 0; i < NUM_CELLS; i++) {
        float avgCellmV = getAverage(cellBuf[i]);
        cells[i] = avgCellmV / 1000.0f;
        moduleVoltage += cells[i];
    }

    for (int i = 0; i < NUM_TEMPS; i++) {
        temps[i] = getAverage(tempBuf[i]);
    }

    float current = HARDCODED_CURRENT_A;

    int32_t rssi = WiFi.RSSI();
    float packetLoss = getPacketLoss();
    unsigned long sendStart = millis();

    JsonDocument doc;
    doc["module_id"] = MODULE_ID;

    JsonArray cellsArr = doc["cells"].to<JsonArray>();
    for (int i = 0; i < NUM_CELLS; i++) {
        cellsArr.add(round(cells[i] * 10000.0f) / 10000.0f);
    }

    JsonArray cellLabelsArr = doc["cell_labels"].to<JsonArray>();
    for (int i = 0; i < NUM_CELLS; i++) {
        cellLabelsArr.add(CELL_LABELS[i]);
    }

    JsonArray tempsArr = doc["temps"].to<JsonArray>();
    for (int i = 0; i < NUM_TEMPS; i++) {
        tempsArr.add(round(temps[i] * 100.0f) / 100.0f);
    }

    doc["module_voltage"] = round(moduleVoltage * 1000.0f) / 1000.0f;
    doc["current"] = round(current * 100.0f) / 100.0f;
    doc["timestamp_ms"] = millis();
    doc["rssi"] = rssi;
    doc["packet_loss"] = round(packetLoss * 100.0f) / 100.0f;
    doc["latency_ms"] = lastLatencyMs;

    // NARX SOC estimation — model trained on 6 cells but hardware has 4.
    // Synthesize 6-cell pack voltage by duplicating cells[0] and cells[1].
    float syntheticPackV = moduleVoltage + cells[0] + cells[1];
    float soc_estimate = narx_predict(syntheticPackV, current, temps[0]);
    doc["soc_estimate"] = round(soc_estimate * 100.0f) / 100.0f;

    String jsonStr;
    serializeJson(doc, jsonStr);

    Serial.printf("[%s] ", MODULE_ID);
    for (int i = 0; i < NUM_CELLS; i++) {
        Serial.printf("C%d=%.3fV ", CELL_LABELS[i], cells[i]);
    }
    Serial.printf("T1=%.1fC T2=%.1fC I=%.2fA RSSI=%ddBm Loss=%.1f%% -> ",
                  temps[0], temps[1], current, rssi, packetLoss);

    bool ok = sendData(jsonStr, "/api/sensing");
    lastLatencyMs = millis() - sendStart;
    recordSendResult(ok);

    if (ok) {
        Serial.printf("OK (%lums)\n", lastLatencyMs);
        blinkLED(1, 100);
    } else {
        Serial.printf("FAIL (%lums)\n", lastLatencyMs);
        Serial.println(jsonStr);
        blinkLED(5, 50);  // Rapid blink on error
    }

    avgIndex++;
    if (avgIndex >= AVG_N) {
        avgIndex = 0;
        avgFilled = true;
    }

    delay(SEND_INTERVAL);
}

void pulseBoot() {
    pinMode(BOOT_PIN, OUTPUT);
    digitalWrite(BOOT_PIN, LOW);
    delay(100);
    digitalWrite(BOOT_PIN, HIGH);
    delay(500);
    digitalWrite(BOOT_PIN, LOW);
    delay(500);
}

uint8_t readByte(uint8_t reg) {
    Wire.beginTransmission(BQ_ADDR);
    Wire.write(reg);
    Wire.endTransmission(false);
    Wire.requestFrom(BQ_ADDR, (uint8_t)1);
    return Wire.available() ? Wire.read() : 0;
}

uint16_t readWord(uint8_t reg) {
    Wire.beginTransmission(BQ_ADDR);
    Wire.write(reg);
    Wire.endTransmission(false);
    Wire.requestFrom(BQ_ADDR, (uint8_t)2);

    uint8_t hi = 0;
    uint8_t lo = 0;
    if (Wire.available()) hi = Wire.read();
    if (Wire.available()) lo = Wire.read();

    return ((hi & 0x3F) << 8) | lo;
}

float readCellmV(uint8_t regHi, int gain, int offset) {
    uint16_t raw = readWord(regHi);
    return (raw * gain / 1000.0f) + offset;
}

float readThermistorC(int pin) {
    int mv = analogReadMilliVolts(pin);

    if (mv <= 0) return -999.0f;
    if (mv >= (int)VCC_MV - 1) return -999.0f;

    float rTherm = R_FIXED * ((float)mv / (VCC_MV - (float)mv));
    float tempK = 1.0f / ((1.0f / T0_K) + (log(rTherm / R0) / BETA));
    return tempK - 273.15f;
}

void addToAverage(float value, float *buf) {
    buf[avgIndex] = value;
}

float getAverage(float *buf) {
    int count = avgFilled ? AVG_N : (avgIndex + 1);
    float sum = 0.0f;

    for (int i = 0; i < count; i++) {
        sum += buf[i];
    }

    return sum / count;
}

void enableBQADC() {
    uint8_t val = readByte(SYS_CTRL1);
    Wire.beginTransmission(BQ_ADDR);
    Wire.write(SYS_CTRL1);
    Wire.write(val | 0x10);
    Wire.endTransmission();
}

// ---- LED blink helper ----
void blinkLED(int times, int delayMs) {
    for (int i = 0; i < times; i++) {
        digitalWrite(LED_PIN, HIGH);
        delay(delayMs);
        digitalWrite(LED_PIN, LOW);
        delay(delayMs);
    }
}

// ---- Record outcome of a send attempt into the rolling window ----
void recordSendResult(bool success) {
    _sendHistory[_sendHistoryIdx] = success;
    _sendHistoryIdx = (_sendHistoryIdx + 1) % PACKET_LOSS_WINDOW;
    if (_sendHistoryCount < PACKET_LOSS_WINDOW) {
        _sendHistoryCount++;
    }
}

// ---- Compute packet loss % over the rolling window ----
float getPacketLoss() {
    if (_sendHistoryCount == 0) return 0.0f;
    int failures = 0;
    for (int i = 0; i < _sendHistoryCount; i++) {
        if (!_sendHistory[i]) failures++;
    }
    return (failures * 100.0f) / _sendHistoryCount;
}
