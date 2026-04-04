# BMS Telemetry Dashboard

Professional Battery Management System monitoring platform with real-time visualization, REST API, and hardware integration support.

![Stack](https://img.shields.io/badge/Stack-InfluxDB%20%2B%20React-blue)
![Docker](https://img.shields.io/badge/Docker-Compose-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Quick Start

```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit .env with your credentials (defaults work for local dev)

# 2. Start the entire stack
docker compose up -d

# 3. Wait ~60 seconds for initialization and history backfill, then open:
#    React Dashboard: http://localhost:3000
#    API Server:      http://localhost:3002/health
#    InfluxDB:        http://localhost:8086
```

## Architecture

```
 Hardware Layer                         Edge / Cloud Layer
 ──────────────                         ──────────────────

 ┌──────────────┐   ┌──────────────┐
 │ Battery M01  │   │ Sensing ESP  │──┐
 │ 5 cells      │──►│ (ADC + NTC)  │  │
 │ 2 temps      │   └──────────────┘  │  Wi-Fi   ┌──────────────┐
 ├──────────────┤   ┌──────────────┐  │  (JSON)  │  Raspberry   │
 │ Battery M02  │   │ Sensing ESP  │──┼─────────►│  Pi Receiver │──write──►  InfluxDB 2.7
 │ 5 cells      │──►│ (ADC + NTC)  │  │  HTTP    │  (Flask)     │           :8086
 │ 2 temps      │   └──────────────┘  │  POST    │  :5000       │           7-day retention
 ├──────────────┤   ┌──────────────┐  │          └──────────────┘           bms-telemetry
 │ Battery M03  │   │ Sensing ESP  │──┘                                         │
 │ 4 cells      │──►│ (ADC + NTC)  │                                            │
 │ 2 temps      │   └──────────────┘                                   Flux queries
 └──────────────┘                                                            │
                    ┌──────────────┐                                         ▼
  Contactors ──────►│ Master ESP   │──Wi-Fi──►  RPi Receiver       API Server ◄──REST/WS──► React Dashboard
  Pos/Neg/Pre       │ (GPIO sense) │                               (Express)                (React 18+Vite)
                    │ Health: 10s  │                               :3002                    :3000
                    └──────────────┘                               3x retry                 Recharts
                                                                   30s timeout              Dark theme

 ┌──── Docker Compose (Development) ────────────────────────────────────────────────────────┐
 │  Mock Generator ──write──►  InfluxDB  ◄──query── API Server ◄──REST/WS──► Dashboard     │
 │  (Python 3.11)              :8086                 :3002                    :3000          │
 │  3 modules, 14 cells                                                                     │
 │  2s intervals                                                                            │
 └──────────────────────────────────────────────────────────────────────────────────────────┘
```

## Battery Topology

| Module | Cells | Temps | Cell IDs |
|--------|-------|-------|----------|
| **M01** | 5 | 2 | C01 - C05 |
| **M02** | 5 | 2 | C06 - C10 |
| **M03** | 4 | 2 | C11 - C14 |
| **Total** | **14** | **6** | **C01 - C14** |

## Services

| Service | Technology | Port | Description |
|---------|-----------|------|-------------|
| **InfluxDB** | InfluxDB 2.7 | 8086 | Time-series database, 7-day retention |
| **API Server** | Node.js 20 / Express | 3002 | REST + WebSocket bridge with retry logic |
| **React Dashboard** | React 18 / Vite 5 | 3000 | Interactive monitoring UI with Recharts |
| **Mock Generator** | Python 3.11 | -- | Simulates 3-module battery pack (14 cells) at 2s intervals |
| **RPi Receiver** | Python 3.11 / Flask | 5000 | Wi-Fi receiver for ESP32 JSON payloads (hardware deployment) |
| **CAN Reader** | Python 3.11 | -- | Optional CAN bus bridge (not in Docker) |
| **ESP32 Firmware** | Arduino / PlatformIO | -- | Sensing + Master board firmware |

## Dashboards

### React Dashboard (port 3000)

| Tab | Description |
|-----|-------------|
| **Overview** | Pack status KPIs and trends |
| **Cells & Modules** | Detailed module/cell analysis with heat map |
| **Wireless Health** | Communication metrics and signal quality |
| **Contactors** | Contactor states and module health status |
| **Logs & Events** | Alert timeline and event logs |
| **Settings** | Configuration panel |
| **Data Export** | CSV/JSON export |

## API Endpoints

Base URL: `http://localhost:3002`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check (verifies InfluxDB connectivity) |
| GET | `/api/v1/bms/current` | Latest pack, module, cell, wireless, contactor, and alert data |
| GET | `/api/v1/bms/history?range=1h&window=30s` | Historical pack metrics |
| GET | `/api/v1/bms/modules/:moduleId/history?range=1h` | Module-specific trends |
| GET | `/api/v1/bms/contactors` | Current contactor states and module health |
| GET | `/api/v1/bms/alerts?severity=critical&range=24h` | Filterable alert log |
| GET | `/api/v1/bms/export?measurement=pack_metrics&format=csv` | Data export |
| GET | `/api/v1/bms/stats` | 24h statistics and aggregations |
| WS  | `/ws` | Real-time pack updates (2s interval) |

## Data Schema

### InfluxDB Measurements

| Measurement | Tags | Key Fields |
|-------------|------|------------|
| `pack_metrics` | `pack_id` | `total_voltage`, `current`, `power_kw`, `soc`, `soh`, `avg_temp`, `min_temp`, `max_temp`, `delta_v_mv` |
| `module_metrics` | `pack_id`, `module_id` | `voltage`, `num_cells`, `min_cell_v`, `max_cell_v`, `delta_v_mv`, `avg_temp`, `temp_1`, `temp_2`, `balancing_active` |
| `cell_metrics` | `pack_id`, `module_id`, `cell_id` | `voltage`, `temperature`, `balance_current` |
| `wireless_health` | `pack_id`, `module_id` | `rssi`, `packet_loss`, `latency_ms`, `packets_rx` |
| `contactor_status` | `pack_id` | `positive`, `negative`, `precharge` (Open/Closed) |
| `module_health` | `pack_id`, `module_id` | `status` (Healthy/Unhealthy), `last_seen_ms` |
| `alerts` | `pack_id`, `alert_type`, `severity`, `source` | `message`, `value`, `threshold` |

## Configuration

### Environment Variables

All secrets and configuration are managed through `.env` (see `.env.example`):

```bash
# InfluxDB
INFLUXDB_INIT_USERNAME=admin
INFLUXDB_INIT_PASSWORD=changeme
INFLUXDB_ADMIN_TOKEN=changeme-generate-a-real-token
INFLUXDB_ORG=bms-org
INFLUXDB_BUCKET=bms-telemetry
```

### Mock Generator Settings

Configured via `docker-compose.yml` environment:

| Variable | Default | Description |
|----------|---------|-------------|
| `WRITE_INTERVAL` | `2` | Data generation interval (seconds) |
| `NUM_MODULES` | `3` | Number of battery modules |
| `ANOMALY_PROBABILITY` | `0.02` | Anomaly injection rate (0-1) |
| `GENERATE_HISTORY_HOURS` | `48` | Hours of historical data to backfill on startup |

## Hardware Setup

### ESP32 Boards

**Sensing ESP (x3, one per module):**

1. Install PlatformIO
2. Edit `esp32-firmware/sensing/src/config.h`:
   - Set `WIFI_SSID`, `WIFI_PASSWORD`
   - Set `RPI_HOST` to your Raspberry Pi IP
   - Set `MODULE_ID` and `NUM_CELLS` per board (M01=5, M02=5, M03=4)
   - Map `CELL_ADC_PINS` and `TEMP_ADC_PINS` to your wiring
3. Flash: `cd esp32-firmware && pio run -e sensing -t upload`

**Master ESP (x1):**

1. Edit `esp32-firmware/master/src/config.h`:
   - Set WiFi credentials and RPi IP
   - Map `PIN_CONTACTOR_*` to your GPIO wiring
2. Flash: `cd esp32-firmware && pio run -e master -t upload`

### Raspberry Pi Receiver

```bash
# On the Raspberry Pi
cd rpi-receiver
pip install -r requirements.txt

# Set environment variables
export INFLUXDB_URL=http://localhost:8086
export INFLUXDB_TOKEN=your-token-here

# Run
python3 receiver.py
```

Test with manual HTTP POST:
```bash
curl -X POST http://<RPI_IP>:5000/api/sensing \
  -H 'Content-Type: application/json' \
  -d '{"module_id":"M01","cells":[3.7,3.71,3.69,3.70,3.68],"temps":[25.1,25.3],"module_voltage":18.48}'
```

## Project Structure

```
.
├── docker-compose.yml              # Service orchestration
├── .env.example                    # Environment variable template
├── .gitignore                      # Git exclusions
├── README.md                       # This file
├── api-server/
│   ├── Dockerfile                  # Node 20 Alpine
│   ├── package.json                # Express, InfluxDB client, ws
│   └── server.js                   # REST API + WebSocket bridge
├── bms-dashboard-react/
│   ├── Dockerfile                  # Multi-stage: Node build -> Nginx
│   ├── package.json                # React 18, Vite 5, Recharts
│   └── src/
│       ├── components/             # 8 dashboard components
│       │   ├── OverviewDashboard.jsx
│       │   ├── CellsModulesDashboard.jsx
│       │   ├── WirelessHealthDashboard.jsx
│       │   ├── ContactorsDashboard.jsx
│       │   ├── LogsEventsDashboard.jsx
│       │   ├── SettingsPanel.jsx
│       │   ├── DataExportPanel.jsx
│       │   └── ErrorBoundary.jsx
│       └── services/               # API client, mock data, notifications
├── can-reader/
│   ├── can_to_influxdb.py          # CAN-to-InfluxDB bridge
│   └── requirements.txt            # python-can, influxdb-client
├── esp32-firmware/
│   ├── platformio.ini              # PlatformIO project config
│   ├── sensing/src/
│   │   ├── config.h                # Per-board WiFi + pin config
│   │   └── main.cpp                # ADC reads, JSON build, HTTP POST
│   └── master/src/
│       ├── config.h                # WiFi + contactor pin config
│       └── main.cpp                # GPIO reads, health tracking, HTTP POST
├── mock-generator/
│   ├── Dockerfile                  # Python 3.11 slim
│   ├── requirements.txt            # influxdb-client, numpy
│   └── generator.py                # 3-module battery simulation engine
└── rpi-receiver/
    ├── Dockerfile                  # Python 3.11 slim + Flask
    ├── requirements.txt            # flask, influxdb-client, numpy
    ├── config.py                   # Configuration + topology constants
    ├── validators.py               # JSON payload validation
    ├── influx_writer.py            # InfluxDB write layer
    └── receiver.py                 # Flask HTTP server (main entry)
```

## Security

- All secrets externalized to `.env` (never committed to version control)
- `.gitignore` prevents `.env` from being tracked
- `INFLUXDB_TOKEN` is required with no fallback -- services fail clearly if not set
- ESP32 WiFi credentials stored in `config.h` (not committed -- add to `.gitignore`)

## Resilience

| Component | Feature | Details |
|-----------|---------|---------|
| **Mock Generator** | Connection retry | 10 attempts with exponential backoff (up to 60s) |
| | Write buffering | Failed points buffered in memory (capped at 10k) |
| | Error recovery | Exponential backoff on runtime errors (up to 120s) |
| | Health check | Heartbeat file for Docker health monitoring |
| **RPi Receiver** | Validation | JSON schema + range validation on all payloads |
| | Pack aggregation | Computes pack_metrics when all modules report |
| | Health tracking | Monitors per-ESP last-seen timestamps |
| **CAN Reader** | CAN bus reconnect | 10 retry attempts with exponential backoff |
| | Write retry | 3 attempts per flush with backoff |
| | Buffer management | Capped at 5k points to prevent OOM |
| **API Server** | Query retry | 3 attempts with exponential backoff (500ms base) |
| | Health endpoint | Verifies InfluxDB connectivity, returns 503 if down |
| | Request timeout | 30-second timeout on all requests |
| **Docker** | Service health checks | All services monitored with configurable intervals |
| | Restart policy | `unless-stopped` on all containers |
| | Dependency ordering | Services wait for upstream health before starting |

## Development

```bash
# View logs
docker compose logs -f              # All services
docker compose logs -f api-server   # Specific service

# Restart with fresh data
docker compose down -v
docker compose up -d

# Access InfluxDB CLI
docker compose exec influxdb influx

# Run React dashboard in dev mode (hot reload)
cd bms-dashboard-react && npm run dev
```

## Troubleshooting

### API returns 503 Unhealthy
- InfluxDB may still be initializing -- check: `docker compose ps`
- Verify `.env` has correct `INFLUXDB_ADMIN_TOKEN`
- Check API logs: `docker compose logs api-server`

### Services fail to start
- Ensure `.env` file exists (copy from `.env.example`)
- `INFLUXDB_TOKEN` is required -- services exit if missing
- Check dependency health: `docker compose ps`

### React dashboard shows no data
- Verify API is reachable: `curl http://localhost:3002/health`
- Check `VITE_API_URL` is set correctly in docker-compose.yml
- Browser console may show CORS or connection errors

## License

MIT License - feel free to use for your BMS projects.
