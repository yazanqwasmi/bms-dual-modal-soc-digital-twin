/**
 * BMS Master ESP32 Firmware
 * =========================
 * Monitors contactor states via GPIO and tracks module health
 * via heartbeat timeouts. POSTs status to the Raspberry Pi receiver.
 *
 * Contactor sensing: Digital GPIO reads (HIGH = Closed, LOW = Open)
 * Module health: Tracks last-seen timestamps per sensing ESP.
 *   In a full implementation, sensing ESPs would broadcast a UDP
 *   heartbeat that this master listens for. For now, the RPi receiver
 *   tracks per-ESP last-seen times and the master reports GPIO-derived
 *   contactor states.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ESPmDNS.h>
#include <ArduinoJson.h>
#include "config.h"

// Module last-seen timestamps (milliseconds, from millis())
unsigned long moduleLastSeen[NUM_MODULES] = {0, 0, 0};

// ---- Forward declarations ----
void connectWiFi();
const char* readContactor(int pin);
void updateModuleHealth();
bool sendData(const String& json);
void blinkLED(int times, int delayMs);

// ---- Setup ----
void setup() {
    Serial.begin(115200);
    delay(1000);

    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);

    // Configure contactor sense pins as inputs with pull-down
    pinMode(PIN_CONTACTOR_POSITIVE, INPUT_PULLDOWN);
    pinMode(PIN_CONTACTOR_NEGATIVE, INPUT_PULLDOWN);
    pinMode(PIN_CONTACTOR_PRECHARGE, INPUT_PULLDOWN);

    Serial.println("=================================");
    Serial.println("BMS Master ESP32");
    Serial.printf("  Modules tracked: %d\n", NUM_MODULES);
    Serial.printf("  Health timeout: %dms\n", HEALTH_TIMEOUT_MS);
    Serial.println("=================================");

    connectWiFi();

    // Initialize module last-seen to current time
    unsigned long now = millis();
    for (int i = 0; i < NUM_MODULES; i++) {
        moduleLastSeen[i] = now;
    }

    blinkLED(3, 200);
}

// ---- Main loop ----
void loop() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi disconnected, reconnecting...");
        connectWiFi();
    }

    // Read contactor states
    const char* posState = readContactor(PIN_CONTACTOR_POSITIVE);
    const char* negState = readContactor(PIN_CONTACTOR_NEGATIVE);
    const char* preState = readContactor(PIN_CONTACTOR_PRECHARGE);

    // Update module health
    updateModuleHealth();

    // Build JSON payload
    JsonDocument doc;

    JsonObject contactors = doc["contactors"].to<JsonObject>();
    contactors["positive"] = posState;
    contactors["negative"] = negState;
    contactors["precharge"] = preState;

    JsonObject health = doc["module_health"].to<JsonObject>();
    unsigned long now = millis();
    for (int i = 0; i < NUM_MODULES; i++) {
        unsigned long elapsed = now - moduleLastSeen[i];
        health[MODULE_IDS[i]] = (elapsed < HEALTH_TIMEOUT_MS) ? "Healthy" : "Unhealthy";
    }

    doc["timestamp_ms"] = now;

    String jsonStr;
    serializeJson(doc, jsonStr);

    // Send to RPi
    Serial.printf("Contactors: +%s/-%s/P%s | Health: ", posState, negState, preState);
    for (int i = 0; i < NUM_MODULES; i++) {
        unsigned long elapsed = now - moduleLastSeen[i];
        Serial.printf("%s=%s ", MODULE_IDS[i], (elapsed < HEALTH_TIMEOUT_MS) ? "OK" : "FAIL");
    }
    Serial.print("-> ");

    if (sendData(jsonStr)) {
        Serial.println("OK");
        blinkLED(1, 100);
    } else {
        Serial.println("FAIL");
        blinkLED(5, 50);
    }

    delay(SEND_INTERVAL);
}

// ---- WiFi connection ----
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
        if (!MDNS.begin(ESP_MDNS_NAME)) {
            Serial.println("mDNS init failed");
        } else {
            Serial.printf("mDNS responder started: http://%s.local\n", ESP_MDNS_NAME);
        }
    } else {
        Serial.println("\nWiFi connection failed. Will retry.");
    }
}

// ---- Read contactor GPIO ----
const char* readContactor(int pin) {
    return digitalRead(pin) == HIGH ? "Closed" : "Open";
}

// ---- Module health tracking ----
void updateModuleHealth() {
    // In a full implementation, this would listen for UDP heartbeats
    // from sensing ESPs and update moduleLastSeen[] accordingly.
    //
    // For now, the master assumes all modules are reporting to the RPi
    // and the RPi receiver handles per-ESP last-seen tracking.
    // This firmware just reads contactor GPIO states.
    //
    // To add heartbeat listening:
    //   1. Sensing ESPs broadcast a UDP packet to a known port
    //   2. Master listens on that port and updates moduleLastSeen[]
    //   3. Health is determined by elapsed time since last heartbeat
}

// ---- HTTP POST to Raspberry Pi ----
bool sendData(const String& json) {
    HTTPClient http;
    String url = String("http://") + RPI_HOST + ":" + String(RPI_PORT) + "/api/master";

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
