# BMS System Runbook — E2E Startup Guide

## Prerequisites

- Mac and Raspberry Pi both connected to the same network (e.g. phone hotspot)
- Docker Desktop running on Mac
- Pi hostname set to `bmsgateway` with avahi broadcasting `bmsgateway.local`

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
cd ~/bms/api-server
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
cd ~/bms/rpi-receiver
INFLUXDB_URL=http://<MAC_IP>:8086 \
INFLUXDB_TOKEN=bms-super-secret-token \
INFLUXDB_ORG=bms-org \
INFLUXDB_BUCKET=bms-telemetry \
python3 receiver.py
```

You should see `Sensing data written for M01: 4 cells` every ~3s once the ESP32 is powered.

---

## 5. Mac — Start dashboard

```bash
cd /Users/yazanqwasmi/BWF/bms-dashboard-react
npm run dev
```

Open [http://localhost:5174](http://localhost:5174) in your browser.

The dashboard fetches from `http://bmsgateway.local:3002` (set in `.env.local`).

---

## Quick health checks

| Component       | Check                                              |
|-----------------|----------------------------------------------------|
| mDNS            | `ping -c 2 bmsgateway.local`                       |
| InfluxDB        | `curl http://localhost:8086/ping`                  |
| api-server      | `curl http://bmsgateway.local:3002/health`         |
| rpi-receiver    | Watch Pi terminal for `Sensing data written` logs  |
| Dashboard       | http://localhost:5174                              |

---

## Notes

- `nvm use 16` is required on the Pi — Node 20 doesn't work due to old glibc (Debian Buster).
- The Pi's `.env` uses `INFLUXDB_ADMIN_TOKEN` but api-server expects `INFLUXDB_TOKEN` — always export both or alias one to the other.
- If port 3002 is already in use on the Pi: `kill $(lsof -t -i:3002)`
- InfluxDB data persists in the Docker volume `influxdb-data` across restarts.
