#pragma once

// =============================================================================
// Master ESP32 Configuration
// =============================================================================
// Monitors contactor states and tracks module health via heartbeats.

// Wi-Fi credentials
#define WIFI_SSID       "BMS_Network"
#define WIFI_PASSWORD   "BMS_Network"

// Raspberry Pi receiver endpoint
#define RPI_HOST        "192.168.205.72"
#define RPI_PORT        5000
#define SEND_INTERVAL   2000  // ms between transmissions

// Contactor GPIO pins (digital input — HIGH = Closed, LOW = Open)
#define PIN_CONTACTOR_POSITIVE   4
#define PIN_CONTACTOR_NEGATIVE   16
#define PIN_CONTACTOR_PRECHARGE  17

// Module health tracking
#define NUM_MODULES     3
static const char* MODULE_IDS[NUM_MODULES] = {"M01", "M02", "M03"};
#define HEALTH_TIMEOUT_MS  10000  // 10s — mark module Unhealthy if no heartbeat

// Status LED
#define LED_PIN         2
