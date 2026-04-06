#pragma once

// =============================================================================
// Sensing ESP32 Configuration
// =============================================================================
// Flash one per module. Change MODULE_ID and NUM_CELLS per board.

// Wi-Fi credentials
#define WIFI_SSID       "BMS_Network"
#define WIFI_PASSWORD   "BMS_Network"

// Raspberry Pi receiver endpoint
#define RPI_HOST        "bmsgateway.local"
#define RPI_PORT        5000
#define SEND_INTERVAL   2000  // ms between transmissions

// This board's mDNS hostname (for diagnostics/discovery)
#define ESP_MDNS_NAME   "bms-sensing-m01"

// Module identity — CHANGE PER BOARD
// Board 1: MODULE_ID="M01", NUM_CELLS=4
// Board 2: MODULE_ID="M02", NUM_CELLS=4
// Board 3: MODULE_ID="M03", NUM_CELLS=4
#define MODULE_ID       "M01"
#define NUM_CELLS       4
#define NUM_TEMPS       2

// ADC pin mappings for cell voltage sensing
// Adjust based on your voltage divider network and wiring
static const int CELL_ADC_PINS[4] = {36, 39, 34, 35};  // GPIO pins (ADC1)

// NTC thermistor pins
static const int TEMP_ADC_PINS[2] = {33, 25};  // GPIO pins (ADC1)

// NTC thermistor parameters (Steinhart-Hart)
#define NTC_SERIES_RESISTOR   10000.0  // 10k ohm series resistor
#define NTC_NOMINAL_RESISTANCE 10000.0 // 10k ohm at 25C
#define NTC_NOMINAL_TEMP      25.0
#define NTC_B_COEFFICIENT     3950.0

// Voltage divider ratio (if using resistor divider for cell voltage)
// V_cell = V_adc * DIVIDER_RATIO
#define VOLTAGE_DIVIDER_RATIO 2.0  // e.g., 10k/10k divider = 2:1

// ADC calibration
#define ADC_RESOLUTION   4095.0
#define ADC_REF_VOLTAGE  3.3

// Current sensor (Hall-effect or shunt-based, e.g. ACS712)
// Output voltage at zero current is ADC_REF_VOLTAGE/2 (1.65V)
// Sensitivity: 66mV/A for ACS712-30A variant
#define CURRENT_ADC_PIN       26           // GPIO pin for current sensor
#define CURRENT_SENSITIVITY   0.066f       // V/A (ACS712-30A)
#define CURRENT_ZERO_OFFSET   (ADC_REF_VOLTAGE / 2.0f)  // Midpoint = 0A

// Packet loss tracking window
#define PACKET_LOSS_WINDOW    20  // Track last N send attempts

// Status LED
#define LED_PIN          2  // Built-in LED on most ESP32 boards
