# Event Flag Catalog

This document defines normalized event flags emitted by the API server.

## Source

Derived in [api-server/src/utils/eventFlags.js](api-server/src/utils/eventFlags.js).
Persisted to InfluxDB `alerts` measurement by [api-server/src/utils/influxdb.js](api-server/src/utils/influxdb.js).

## Fields

Each alert/event uses:

- `timestamp`
- `severity` (`critical`, `warning`, `info`)
- `type` (`soc`, `temp`, `voltage`, `wireless`, `module_health`, `contactors`, ...)
- `flag` (stable machine-readable identifier)
- `message`
- `value`
- `threshold`
- `source` (`derived` or `influx`)

## Current Flags

### SOC
- `soc_low_critical`: SOC <= `EVENT_SOC_CRITICAL` (default 10)
- `soc_low_warning`: SOC <= `EVENT_SOC_WARNING` (default 20)

### Temperature
- `temperature_high_critical`: max temp >= `EVENT_TEMP_CRITICAL` (default 60)
- `temperature_high_warning`: max temp >= `EVENT_TEMP_WARNING` (default 50)

### Pack Voltage
- `pack_voltage_low_critical`: voltage <= `EVENT_VOLTAGE_CRITICAL` (default 33)
- `pack_voltage_low_warning`: voltage <= `EVENT_VOLTAGE_WARNING` (default 36)

### Module Health
- `module_disconnected`: module health state is `Disconnected`
- `module_unhealthy`: module health state is `Unhealthy`
- `module_timeout_critical`: `lastSeenMs` >= `EVENT_MODULE_OFFLINE_CRITICAL_MS` (default 30000)
- `module_timeout_warning`: `lastSeenMs` >= `EVENT_MODULE_OFFLINE_WARNING_MS` (default 10000)

### Wireless
- `wireless_packet_loss_critical`: packet loss >= `EVENT_PACKET_LOSS_CRITICAL` (default 60)
- `wireless_packet_loss_warning`: packet loss >= `EVENT_PACKET_LOSS_WARNING` (default 30)
- `wireless_rssi_critical`: RSSI <= `EVENT_RSSI_CRITICAL` (default -95)
- `wireless_rssi_warning`: RSSI <= `EVENT_RSSI_WARNING` (default -85)

### Contactors
- `contactor_not_closed`: positive or negative contactor state is not `Closed`

## Tuning Thresholds

Set these on the API server host (Pi):

- `EVENT_SOC_WARNING`
- `EVENT_SOC_CRITICAL`
- `EVENT_TEMP_WARNING`
- `EVENT_TEMP_CRITICAL`
- `EVENT_VOLTAGE_WARNING`
- `EVENT_VOLTAGE_CRITICAL`
- `EVENT_PACKET_LOSS_WARNING`
- `EVENT_PACKET_LOSS_CRITICAL`
- `EVENT_RSSI_WARNING`
- `EVENT_RSSI_CRITICAL`
- `EVENT_MODULE_OFFLINE_WARNING_MS`
- `EVENT_MODULE_OFFLINE_CRITICAL_MS`
- `EVENT_WRITE_COOLDOWN_MS`

## Notes

- If explicit alerts are missing in InfluxDB, `/api/v1/bms/alerts` falls back to derived events from `pack_metrics`.
- The dashboard Logs & Events tab supports filtering by severity, type, and source.
