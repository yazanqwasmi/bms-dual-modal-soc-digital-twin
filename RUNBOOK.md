# BMS System Runbook — E2E Startup Guide

## Prerequisites

- Mac and Raspberry Pi both connected to the same network (e.g. phone hotspot)
- Docker Desktop running on Mac
- Pi hostname set to `bmsgateway` with avahi broadcasting `bmsgateway.local`
- Dashboard and API are hosted on the Pi (do not run dashboard locally on the Mac)

---

## 1. Pi — One-time hostname setup (only needed once)

SSH into the Pi or open a terminal on it:

```bash
sudo hostnamectl set-hostname bmsgateway
echo "127.0.1.1 bmsgateway" | sudo tee -a /etc/hosts
sudo systemctl enable --now avahi-daemon
sudo systemctl restart avahi-daemon
```

Verify from the Mac:
```bash
ping -c 2 bmsgateway.local
# Should resolve to 192.168.232.72 (or current Pi IP)
```

---

## 2. Mac — Start InfluxDB

```bash
docker run -d \
  --name bms-influxdb \
  -p 8086:8086 \
  -e DOCKER_INFLUXDB_INIT_MODE=setup \
  -e DOCKER_INFLUXDB_INIT_USERNAME=admin \
  -e DOCKER_INFLUXDB_INIT_PASSWORD=adminpassword \
  -e DOCKER_INFLUXDB_INIT_ORG=bms-org \
  -e DOCKER_INFLUXDB_INIT_BUCKET=bms-telemetry \
  -e DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=bms-super-secret-token \
  influxdb:2.7
```

If the container already exists from a previous run:
```bash
docker start bms-influxdb
```

Verify:
```bash
curl http://localhost:8086/ping   # expects HTTP 204
```

Find your Mac's IP on the shared network (needed for Pi services):
```bash
ipconfig getifaddr en0
```

---

## 3. Pi — Start api-server

Open a terminal on the Pi:

```bash
nvm use 16
cd ~/BWF/api-server
export $(cat ../.env | grep -v '^#' | xargs)
export INFLUXDB_TOKEN=$INFLUXDB_ADMIN_TOKEN
export INFLUXDB_URL=http://<MAC_IP>:8086
node server.js
```

Replace `<MAC_IP>` with the IP from step 2 (e.g. `192.168.232.115`).

Verify from Mac:
```bash
curl http://bmsgateway.local:3002/health
# expects: {"status":"healthy","influxdb":"connected",...}
```

---

## 4. Pi — Start rpi-receiver

Open a second terminal on the Pi:

```bash
cd ~/BWF/rpi-receiver
INFLUXDB_URL=http://<MAC_IP>:8086 \
INFLUXDB_TOKEN=bms-super-secret-token \
INFLUXDB_ORG=bms-org \
INFLUXDB_BUCKET=bms-telemetry \
python3 receiver.py
```

You should see `Sensing data written for M01: 4 cells` every ~3s once the ESP32 is powered.

---

## 5. Pi — Start dashboard

```bash
cd ~/BWF/bms-dashboard-react
npm install
npm run build

# Serve built dashboard from API server static mount
# (api-server serves ../bms-dashboard-react/dist)
cd ~/BWF/api-server
sudo systemctl restart bms-api
```

Open [http://bmsgateway.local:3002](http://bmsgateway.local:3002) in your browser.

---

## Pi-only deployment checklist (recommended)

Run this on the Pi whenever code changes are deployed.

### A) Update code on Pi

```bash
cd ~/BWF
git pull
```

### B) Build dashboard on Pi

```bash
cd ~/BWF/bms-dashboard-react
npm ci || npm install
npm run build
```

### C) Install/update API dependencies on Pi

```bash
cd ~/BWF/api-server
npm ci || npm install
```

### D) Restart services in order

```bash
sudo systemctl restart bms-api
sudo systemctl restart bms-receiver || true
```

### E) Verify service status

```bash
sudo systemctl --no-pager --full status bms-api | head -n 40
sudo systemctl --no-pager --full status bms-receiver | head -n 40 || true
curl -sS http://localhost:3002/health
```

### F) Runtime validation

- Open [http://bmsgateway.local:3002](http://bmsgateway.local:3002)
- Go to Logs & Events and confirm alerts include `flag` and `source`
- Confirm websocket updates continue every ~2s

---

## Systemd env update (Pi)

If you change event thresholds, update the API service environment and restart:

```bash
sudo systemctl edit bms-api
```

Add overrides like:

```ini
[Service]
Environment="EVENT_SOC_WARNING=20"
Environment="EVENT_SOC_CRITICAL=10"
Environment="EVENT_TEMP_WARNING=50"
Environment="EVENT_TEMP_CRITICAL=60"
Environment="EVENT_VOLTAGE_WARNING=36"
Environment="EVENT_VOLTAGE_CRITICAL=33"
Environment="EVENT_PACKET_LOSS_WARNING=30"
Environment="EVENT_PACKET_LOSS_CRITICAL=60"
Environment="EVENT_RSSI_WARNING=-85"
Environment="EVENT_RSSI_CRITICAL=-95"
Environment="EVENT_MODULE_OFFLINE_WARNING_MS=10000"
Environment="EVENT_MODULE_OFFLINE_CRITICAL_MS=30000"
Environment="EVENT_WRITE_COOLDOWN_MS=60000"
```

Then apply:

```bash
sudo systemctl daemon-reload
sudo systemctl restart bms-api
```

---

## Quick health checks

| Component       | Check                                              |
|-----------------|----------------------------------------------------|
| mDNS            | `ping -c 2 bmsgateway.local`                       |
| InfluxDB        | `curl http://localhost:8086/ping`                  |
| api-server      | `curl http://bmsgateway.local:3002/health`         |
| rpi-receiver    | Watch Pi terminal for `Sensing data written` logs  |
| Dashboard       | http://bmsgateway.local:3002                       |

---

## Event flag tuning (Pi)

Optional API-server environment variables:

```bash
EVENT_SOC_WARNING=20
EVENT_SOC_CRITICAL=10
EVENT_TEMP_WARNING=50
EVENT_TEMP_CRITICAL=60
EVENT_VOLTAGE_WARNING=36
EVENT_VOLTAGE_CRITICAL=33
EVENT_PACKET_LOSS_WARNING=30
EVENT_PACKET_LOSS_CRITICAL=60
EVENT_RSSI_WARNING=-85
EVENT_RSSI_CRITICAL=-95
EVENT_MODULE_OFFLINE_WARNING_MS=10000
EVENT_MODULE_OFFLINE_CRITICAL_MS=30000
EVENT_WRITE_COOLDOWN_MS=60000
```

See [EVENT_FLAGS.md](EVENT_FLAGS.md) for the full catalog.

---

## Notes

- `nvm use 16` is required on the Pi — Node 20 doesn't work due to old glibc (Debian Buster).
- The Pi's `.env` uses `INFLUXDB_ADMIN_TOKEN` but api-server expects `INFLUXDB_TOKEN` — always export both or alias one to the other.
- If port 3002 is already in use on the Pi: `kill $(lsof -t -i:3002)`
- InfluxDB data persists in the Docker volume `influxdb-data` across restarts.
