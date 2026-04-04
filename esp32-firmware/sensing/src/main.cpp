/**
 * BMS Sensing ESP32 Firmware
 * ==========================
 * Reads cell voltages and temperatures from ADC pins,
 * builds a JSON payload, and POSTs to the Raspberry Pi receiver.
 *
 * One sensing ESP per battery module.
 * Configure MODULE_ID and NUM_CELLS in config.h per board.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "config.h"
// #include "narx_inference.h"  // TEMPORARILY DISABLED FOR TESTING

// ---- Packet loss tracking ----
static bool _sendHistory[PACKET_LOSS_WINDOW] = {false};
static int  _sendHistoryIdx = 0;
static int  _sendHistoryCount = 0;

// ---- Forward declarations ----
void connectWiFi();
float readCellVoltage(int pin);
float readTemperature(int pin);
float readCurrent(int pin);
bool sendData(const String& json);
void blinkLED(int times, int delayMs);
float getPacketLoss();
void recordSendResult(bool success);

// ---- Setup ----
void setup() {
    Serial.begin(115200);
    delay(1000);

    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);

    Serial.println("=================================");
    Serial.println("BMS Sensing ESP32");
    Serial.printf("  Module: %s\n", MODULE_ID);
    Serial.printf("  Cells: %d\n", NUM_CELLS);
    Serial.printf("  Temps: %d\n", NUM_TEMPS);
    Serial.println("=================================");

    // Configure ADC
    analogReadResolution(12);
    analogSetAttenuation(ADC_11db);  // Full 0-3.3V range

    connectWiFi();
    // narx_init();    // TEMPORARILY DISABLED FOR TESTING
    blinkLED(3, 200);  // Signal successful boot
}

// ---- Main loop ----
void loop() {
    // Reconnect WiFi if dropped
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi disconnected, reconnecting...");
        connectWiFi();
    }

    // Read cell voltages
    float cells[NUM_CELLS];
    float moduleVoltage = 0.0;
    for (int i = 0; i < NUM_CELLS; i++) {
        cells[i] = readCellVoltage(CELL_ADC_PINS[i]);
        moduleVoltage += cells[i];
    }

    // Read temperatures
    float temps[NUM_TEMPS];
    for (int i = 0; i < NUM_TEMPS; i++) {
        temps[i] = readTemperature(TEMP_ADC_PINS[i]);
    }

    // Read current (positive = discharging, negative = charging)
    float current = readCurrent(CURRENT_ADC_PIN);

    // Wireless metrics (sampled just before send)
    int32_t rssi = WiFi.RSSI();
    float packetLoss = getPacketLoss();
    static unsigned long lastLatencyMs = 0;  // latency from the previous cycle
    unsigned long sendStart = millis();

    // Build JSON payload
    JsonDocument doc;
    doc["module_id"] = MODULE_ID;

    JsonArray cellsArr = doc["cells"].to<JsonArray>();
    for (int i = 0; i < NUM_CELLS; i++) {
        cellsArr.add(round(cells[i] * 10000.0) / 10000.0);  // 4 decimal places
    }

    JsonArray tempsArr = doc["temps"].to<JsonArray>();
    for (int i = 0; i < NUM_TEMPS; i++) {
        tempsArr.add(round(temps[i] * 100.0) / 100.0);  // 2 decimal places
    }

    doc["module_voltage"] = round(moduleVoltage * 1000.0) / 1000.0;
    doc["current"]        = round(current * 100.0f) / 100.0f;  // 2 decimal places, Amps
    doc["timestamp_ms"]   = millis();

    // Wireless health metrics
    doc["rssi"]           = rssi;
    doc["packet_loss"]    = round(packetLoss * 100.0f) / 100.0f;
    doc["latency_ms"]     = lastLatencyMs;  // round-trip from the previous cycle

    // NARX edge SOC estimate -- TEMPORARILY DISABLED FOR TESTING
    // float soc_estimate = narx_predict(moduleVoltage, current, temps[0]);
    float soc_estimate = -1.0f;  // placeholder: ML disabled
    doc["soc_estimate"] = soc_estimate;

    String jsonStr;
    serializeJson(doc, jsonStr);

    // Send to RPi and record latency
    Serial.printf("[%s] V=%.2fV I=%.2fA T1=%.1fC SOC=%.1f%% RSSI=%ddBm Loss=%.1f%% -> ",
                  MODULE_ID, moduleVoltage, current, temps[0], soc_estimate, rssi, packetLoss);

    bool ok = sendData(jsonStr);
    lastLatencyMs = millis() - sendStart;  // stored for next cycle's payload
    recordSendResult(ok);

    if (ok) {
        Serial.printf("OK (%lums)\n", lastLatencyMs);
        blinkLED(1, 100);
    } else {
        Serial.printf("FAIL (%lums)\n", lastLatencyMs);
        blinkLED(5, 50);  // Rapid blink on error
    }

    delay(SEND_INTERVAL);
}

// ---- WiFi connection with retry ----
void connectWiFi() {
    Serial.printf("Connecting to WiFi '%s'", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\nConnected! IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println("\nWiFi connection failed. Will retry on next loop.");
    }
}

// ---- Read cell voltage from ADC pin ----
float readCellVoltage(int pin) {
    // Average multiple readings for stability
    long sum = 0;
    for (int i = 0; i < 16; i++) {
        sum += analogRead(pin);
        delayMicroseconds(100);
    }
    float adcValue = sum / 16.0;

    // Convert ADC value to voltage
    float voltage = (adcValue / ADC_RESOLUTION) * ADC_REF_VOLTAGE * VOLTAGE_DIVIDER_RATIO;

    return voltage;
}

// ---- Read temperature from NTC thermistor ----
float readTemperature(int pin) {
    long sum = 0;
    for (int i = 0; i < 16; i++) {
        sum += analogRead(pin);
        delayMicroseconds(100);
    }
    float adcValue = sum / 16.0;

    if (adcValue <= 0 || adcValue >= ADC_RESOLUTION) {
        return -999.0;  // Invalid reading
    }

    // Calculate resistance of NTC
    float resistance = NTC_SERIES_RESISTOR / ((ADC_RESOLUTION / adcValue) - 1.0);

    // Steinhart-Hart equation (simplified B-parameter)
    float steinhart = log(resistance / NTC_NOMINAL_RESISTANCE);
    steinhart /= NTC_B_COEFFICIENT;
    steinhart += 1.0 / (NTC_NOMINAL_TEMP + 273.15);
    float tempC = (1.0 / steinhart) - 273.15;

    return tempC;
}

// ---- HTTP POST to Raspberry Pi ----
bool sendData(const String& json) {
    HTTPClient http;
    String url = String("http://") + RPI_HOST + ":" + String(RPI_PORT) + "/api/sensing";

    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(5000);

    int httpCode = http.POST(json);
    http.end();

    return httpCode == 200;
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

// ---- Read current from Hall-effect sensor (e.g. ACS712) ----
float readCurrent(int pin) {
    long sum = 0;
    for (int i = 0; i < 16; i++) {
        sum += analogRead(pin);
        delayMicroseconds(100);
    }
    float adcValue = sum / 16.0;
    float voltage = (adcValue / ADC_RESOLUTION) * ADC_REF_VOLTAGE;
    // Positive = discharging, negative = charging
    return (voltage - CURRENT_ZERO_OFFSET) / CURRENT_SENSITIVITY;
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
