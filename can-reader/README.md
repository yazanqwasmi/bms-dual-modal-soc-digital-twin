# CAN Bus to InfluxDB Bridge

Reads CAN frames from a Raspberry Pi CAN HAT and writes BMS telemetry to InfluxDB.

## CAN Protocol

Based on the BMS CAN specification:

| CAN ID | Signal | Data |
|--------|--------|------|
| `0x500` | Pack Summary | Voltage (2B), Current (2B), Avg Temp (2B), Parity (2B) |
| `0x510-0x518` | Module Voltages | 4 modules per frame (2 bytes each) |
| `0x520-0x528` | Module Temperatures | 4 modules per frame (2 bytes each) |

**Total: 35 modules**

## Hardware Setup

### Raspberry Pi with CAN HAT (MCP2515-based)

1. **Enable SPI** in raspi-config:
   ```bash
   sudo raspi-config
   # Interface Options -> SPI -> Enable
   ```

2. **Add CAN overlay** to `/boot/config.txt`:
   ```
   dtoverlay=mcp2515-can0,oscillator=16000000,interrupt=25
   ```
   
   > Adjust `oscillator` (8000000 or 16000000) and `interrupt` pin based on your HAT

3. **Reboot** the Pi:
   ```bash
   sudo reboot
   ```

4. **Bring up CAN interface**:
   ```bash
   sudo ip link set can0 up type can bitrate 500000
   ```

5. **Verify interface**:
   ```bash
   ip link show can0
   candump can0  # Should show CAN traffic if connected
   ```

## Installation

```bash
# Install system dependencies (Raspberry Pi OS)
sudo apt-get update
sudo apt-get install -y python3-pip can-utils

# Install Python dependencies
pip3 install -r requirements.txt
```

## Configuration

Set environment variables or edit defaults in the script:

| Variable | Default | Description |
|----------|---------|-------------|
| `INFLUXDB_URL` | `http://localhost:8086` | InfluxDB server URL |
| `INFLUXDB_TOKEN` | `bms-super-secret-token` | Authentication token |
| `INFLUXDB_ORG` | `bms-org` | Organization name |
| `INFLUXDB_BUCKET` | `bms-telemetry` | Data bucket |
| `CAN_INTERFACE` | `can0` | CAN interface name |
| `CAN_BITRATE` | `500000` | CAN bus speed |

## Usage

```bash
# Set InfluxDB server address (your Docker host)
export INFLUXDB_URL="http://192.168.1.100:8086"

# Run the bridge
python3 can_to_influxdb.py
```

## Running as a Service

Create `/etc/systemd/system/bms-can-bridge.service`:

```ini
[Unit]
Description=BMS CAN to InfluxDB Bridge
After=network.target

[Service]
Type=simple
User=pi
Environment="INFLUXDB_URL=http://192.168.1.100:8086"
Environment="INFLUXDB_TOKEN=bms-super-secret-token"
ExecStartPre=/sbin/ip link set can0 up type can bitrate 500000
ExecStart=/usr/bin/python3 /home/pi/can-reader/can_to_influxdb.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable bms-can-bridge
sudo systemctl start bms-can-bridge
sudo systemctl status bms-can-bridge
```

## Data Scaling

The script auto-detects voltage and temperature scaling. If values look incorrect, adjust the scaling in `_parse_module_voltages()` and `_parse_module_temps()`:

```python
# Voltage scaling options:
voltage = raw_voltage * 0.001  # If raw is in mV
voltage = raw_voltage * 0.01   # If 0.01V/bit
voltage = raw_voltage * 0.1    # If 0.1V/bit (matches 0x500)

# Temperature scaling options:
temperature = raw_temp         # Raw °C
temperature = raw_temp * 0.1   # If 0.1°C/bit
temperature = raw_temp - 40    # If offset-encoded
```

## Testing Without Hardware

Use `can-utils` to simulate CAN traffic:

```bash
# Terminal 1: Start virtual CAN
sudo modprobe vcan
sudo ip link add dev vcan0 type vcan
sudo ip link set up vcan0
export CAN_INTERFACE=vcan0

# Terminal 2: Send test frames
cansend vcan0 500#01F4001E00C80000  # Pack: 50.0V, 3.0A, 20.0°C
cansend vcan0 510#0D480D480D480D48  # Modules 1-4: 3.4V each
cansend vcan0 520#00190019001900BE  # Modules 1-4: 25°C each
```
