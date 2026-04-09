#pragma once

// =============================================================================
// Sensing ESP32 Configuration
// =============================================================================
// Flash one per module. Change MODULE_ID / ESP_MDNS_NAME per board.

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
#define MODULE_ID       "M01"
#define NUM_CELLS       4
#define NUM_TEMPS       2

// ---------------- Current (hardcoded — no sensor) ----------------
#define HARDCODED_CURRENT_A   0.1f

// ---------------- General ----------------
#define PACKET_LOSS_WINDOW    20
#define LED_PIN               38

// ---------------- BQ76920 / sensing pins ----------------
#define SDA_PIN               17
#define SCL_PIN               18
#define BOOT_PIN              8
#define BQ_ADDR               0x18

#define THERM1_PIN            1
#define THERM2_PIN            2

#define SYS_CTRL1             0x04
#define VC1_HI                0x0C
#define VC2_HI                0x0E
#define VC3_HI                0x10
#define VC4_HI                0x12
#define VC5_HI                0x14
#define ADCGAIN1              0x50
#define ADCOFFSET             0x51
#define ADCGAIN2              0x59

// ---------------- Thermistor settings ----------------
#define VCC_MV                3300.0f
#define R_FIXED               10000.0f
#define R0                    10000.0f
#define T0_K                  298.15f
#define BETA                  3435.0f

// ---------------- Moving average ----------------
#define AVG_N                 8

// Read C1, C2, C3, and C5 (skip C4 because that tap is shorted)
static const uint8_t CELL_REGS[NUM_CELLS] = {VC1_HI, VC2_HI, VC3_HI, VC5_HI};
static const int CELL_LABELS[NUM_CELLS] = {1, 2, 3, 5};
static const int TEMP_PINS[NUM_TEMPS] = {THERM1_PIN, THERM2_PIN};

