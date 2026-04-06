#pragma once
/**
 * Shared WiFi + HTTP helpers for master and sensing ESP32 boards.
 * Both boards define WIFI_SSID, WIFI_PASSWORD, ESP_MDNS_NAME, RPI_HOST,
 * RPI_PORT, and LED_PIN in their own config.h before including this file.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ESPmDNS.h>

inline void connectWiFi() {
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

// endpoint — e.g. "/api/master" or "/api/sensing"
inline bool sendData(const String& json, const char* endpoint) {
    HTTPClient http;
    String url = String("http://") + RPI_HOST + ":" + String(RPI_PORT) + endpoint;

    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(5000);

    int httpCode = http.POST(json);
    http.end();

    return httpCode == 200;
}
