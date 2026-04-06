# BMS Telemetry Dashboard - Comprehensive System Analysis

## Executive Summary

This is a production-ready Battery Management System (BMS) telemetry platform with a dual-model SOC estimation architecture, real-time monitoring dashboard, and hardware integration support. The system ingests data from distributed ESP32 sensing boards, aggregates it through a centralized RPi receiver, stores in InfluxDB, and provides both edge-based (NARX) and cloud-based (LSTM) state-of-charge estimation.

---

## 1. Cloud API Endpoints & Data Flow

### 1.1 API Server (Express.js Node 20)
**Port:** 3002  
**Repository:** `/api-server`

#### REST Endpoints

| Method | Endpoint | Parameters | Returns | Purpose |
|--------|----------|-----------|---------|---------|
| GET | `/health` | - | `{status}` | InfluxDB health check |
| GET | `/api/v1/bms/current` | - | `{soc, soh, voltage, current, modules[], contactors}` | Latest pack state |
| GET | `/api/v1/bms/history` | `range=1h` (default), `window=30s` | Array of pack metrics | Historical trends with aggregation window |
| GET | `/api/v1/bms/modules/:moduleId/history` | `range=1h` | Module-specific metrics over time | Module voltage/temp trends |
| GET | `/api/v1/bms/alerts` | `severity`, `type`, `range=24h`, `limit=100` | Alert objects with severity/type filtering | Filterable alert log |
| GET | `/api/v1/bms/export` | `measurement` (default: pack_metrics), `range=24h`, `format=csv` | CSV or JSON | Data export for analysis |
| GET | `/api/v1/bms/contactors` | - | `{contactors: {positive, negative, precharge}, moduleHealth[]}` | Contactor states + module health |
| GET | `/api/v1/bms/stats` | - | Min/max/avg aggregates for 24h window | Statistical summary |
| WS | `/ws` | - | JSON updates every 2s | Real-time pack updates (2000ms interval) |

#### InfluxDB Data Retrieval Pattern
All endpoints use the InfluxDB Flux query API with a standardized flow:

1. **queryApi.queryRows()** - Async query execution with callbacks
2. **tableMeta.toObject()** - Convert row to JavaScript object
3. **Aggregation** - Window functions (mean, min, max) for time-series
4. **Pivot** - Transform from row-based to column-based format
5. **Transform** - Custom transformers map raw InfluxDB schema to API response

#### Key Query Features
- **3-attempt retry** with exponential backoff (500ms base, 5s max)
- **30-second request timeout** on all endpoints
- **Aggregation windows** configurable (default 30s for history queries)
- **Time ranges** in Go duration format (`-1h`, `-24h`)

#### WebSocket Implementation
- **Connection handler** sends initial data + establishes 2000ms polling interval
- **sendCurrentData()** fetches all 7 measurement types in parallel (Promise.all)
- **Broadcast** sends pack_update message JSON to connected clients
- **Automatic retry** on query failures (logs but doesn't crash)

### 1.2 Data Schema in InfluxDB

**Database:** `bms-telemetry` (7-day retention via InfluxDB initialization)  
**Organization:** `bms-org`

#### Measurements & Fields

**pack_metrics** (aggregated across all modules)
- Tags: `pack_id` (usually "pack_01")
- Fields: `total_voltage` (V), `current` (A), `power_kw`, `soc` (%), `soh` (%), `avg_temp` (°C), `min_temp`, `max_temp`, `min_cell_v`, `max_cell_v`, `delta_v_mv`

**module_metrics** (per-module voltage/temp)
- Tags: `pack_id`, `module_id` (M01, M02, M03)
- Fields: `voltage` (V), `num_cells`, `min_cell_v`, `max_cell_v`, `delta_v_mv`, `avg_temp`, `temp_1`, `temp_2`, `balancing_active`

**cell_metrics** (per-cell detail)
- Tags: `pack_id`, `module_id`, `cell_id` (C01-C12)
- Fields: `voltage` (V), `temperature` (°C), `soc`, `balance_current` (A)

**wireless_health** (module radio metrics)
- Tags: `pack_id`, `module_id`
- Fields: `rssi` (dBm), `packet_loss` (%), `latency_ms`, `packets_rx`

**contactor_status** (power contactors)
- Tags: `pack_id`
- Fields: `positive` (Open/Closed), `negative`, `precharge`

**module_health** (module connection status)
- Tags: `pack_id`, `module_id`
- Fields: `status` (Healthy/Unhealthy/Disconnected), `last_seen_ms`

**alerts** (threshold violations)
- Tags: `pack_id`, `alert_type`, `severity` (info/warning/critical), `source`
- Fields: `message` (string), `value` (numeric), `threshold`

### 1.3 Data Flow Diagram

```
┌─────────────────────┐
│ Hardware (ESP32 x3) │ (Sensing boards + Master contactors)
└──────────┬──────────┘
           │ Wi-Fi JSON POST
           ▼
┌─────────────────────┐
│  RPi Receiver       │ (Flask, port 5000 - not in Docker)
│  - Validation       │
│  - Pack aggregation │
│  - Writes points    │
└──────────┬──────────┘
           │ InfluxDB write
           ▼
┌─────────────────────┐
│  InfluxDB 2.7       │ (port 8086)
│  7-day retention    │
└──────────┬──────────┘
           │ Flux queries (3x retry)
           ▼
┌─────────────────────┐
│  API Server (port   │ (Express REST + WebSocket)
│  3002)              │
└──────────┬──────────┘
      ┌────┴─────┬──────────┐
      │           │          │
      ▼ REST      ▼ WS       ▼ LSTM query
  React App    Dashboard   SOC inference
  (port 3000)   live feed  (port 5001)
```

---

## 2. SOC Estimation Models

### 2.1 NARX Model (Edge - ESP32)

**Location:** `soc_estimation/narx/`  
**Deployment:** Compiled into ESP32 firmware (pure C inference)  
**Parameters:** 449 (dense1: 18→16, dense2: 16→8, output: 8→1)  
**Training Size:** 2000-3000 parameters budget

#### Architecture
```
Input (18) ──► Dense1 (16, ReLU) ──► Dense2 (8, ReLU) ──► Output (1, linear)
```

#### Input Features (18 total)
- Voltage window [t-5..t]: 5 values (N=5)
- Current window [t-5..t]: 5 values (N=5)
- Temperature window [t-5..t]: 5 values (N=5)
- SOC feedback buffer [t-3..t-1]: 3 values (M=3) - teacher forcing

#### Inference Pipeline (ESP32)
1. Normalize voltage, current, temperature with scaler params
2. Append to circular buffers (each: 5 samples)
3. Concatenate: `[v_win | i_win | t_win | soc_feedback]`
4. Forward pass: Dense1 (ReLU) → Dense2 (ReLU) → Output (linear)
5. Clamp to [0, 1] normalized range
6. Shift SOC feedback buffer: drop oldest, append new prediction
7. Denormalize: `soc_pct = soc_norm * (max - min) + min`
8. Return SOC percentage [0.0, 100.0]

#### Export Process
- **narx_export.py** converts trained Keras model to pure C
- Generates:
  - `narx_weights.h` - Weight arrays + normalization defines
  - `narx_inference.h` - Public C API
  - `narx_inference.c` - ~340-line C implementation
- Copy to `esp32-firmware/sensing/src/`
- Numerical verification ensures Keras output matches C output within 1e-5

#### Teacher Forcing Strategy
- During training: SOC feedback uses ground-truth labels
- During edge inference: SOC feedback uses model's own predictions (autoregressive)
- Cloud LSTM corrections reset the feedback buffer to prevent drift
- `narx_reset(cloud_soc_percent)` called when RPi sends LSTM update

#### Normalization Parameters (scaler_params.json)
```json
{
  "voltage": {"min": 16.5, "max": 25.33},
  "current": {"min": -178.3, "max": 117.92},
  "temperature": {"min": 3.28, "max": 30.0},
  "soc": {"min": 0.0, "max": 100.0}
}
```

### 2.2 LSTM Model (Cloud - Docker Port 5001)

**Location:** `soc_estimation/lstm/`  
**Deployment:** Flask REST API on port 5001  
**Parameters:** 2,713 (LSTM: 24 units, Dense: 1)  
**Training Size:** 2000-3000 parameters budget

#### Architecture
```
Input sequence (T=30, 3 features) ──► LSTM(24) ──► Dense(1, linear)
```

#### Input Features (30-step sequence)
- Voltage [t-30..t]: 30 values
- Current [t-30..t]: 30 values
- Temperature [t-30..t]: 30 values
- Input shape: (batch, 30, 3)

#### Training Details
- **Optimizer:** Adam (learning_rate=0.001)
- **Loss:** MSE
- **Batch size:** 128
- **Epochs:** 150 (early stop patience=15)
- **Callbacks:**
  - EarlyStopping on val_loss (patience=15)
  - ReduceLROnPlateau (factor=0.5, patience=7)

#### Inference Endpoint

**POST /predict**
```json
{
  "voltage": [16.5, 16.6, ..., 25.3],  // 30 values
  "current": [0.0, -50.5, ..., 100.0], // 30 values
  "temperature": [25.1, 25.2, ..., 22.0] // 30 values
}
```

Response:
```json
{
  "soc": 72.45,        // Percentage [0.0, 100.0]
  "model": "lstm_v1"
}
```

#### Inference Process (Flask)
1. Validate JSON + field lengths (must be 30)
2. Normalize features using scaler params
3. Build input tensor shape (1, 30, 3)
4. Model.predict() → normalized output [0, 1]
5. Clamp to [0.0, 1.0]
6. Denormalize: `soc_pct = norm_val * (100 - 0) + 0`
7. Clamp percentage to [0.0, 100.0]
8. Return rounded to 2 decimals

### 2.3 Data Preprocessing Pipeline

**Location:** `soc_estimation/data/preprocess.py`

#### Dataset: LG-E66 Module Data-AVL
- **Samples:** 685K total
- **Drive cycles:** 6 types (US06, HWFET, HWGRADE, HWCUST)
- **Temperatures:** 0°C and 25°C variants
- **Cells:** 6 individual cells per cycle

#### Columns per File
- `RecordingTime` - Timestamp (seconds)
- `ACT_U` - Pack voltage (V)
- `ACT_I` - Pack current (A)
- `High Temperature` or `CP7 (cooling plate)` - Cell temperature
- `Cell_SOC_{cell_id}_pct` - Per-cell SOC label

#### Train/Val/Test Split Strategy
**Training:** 4 drive cycles with all temperature variants + cells
- US06 25C (cells 1-6)
- US06 0C (cells 1-4)
- HWGRADE 0C (cells 1-4)
- HWCUST 25C (cells 1-4)
- HWGRADE 25C (cells 1-3)

**Validation:** Held-out cells from training cycles
- HWGRADE 0C (cells 5-6)
- HWCUST 25C (cells 5-6)
- US06 0C (cells 5-6)
- HWGRADE 25C (cells 4-5)

**Test:** Completely unseen drive cycle (HWFET highway profile)
- HWFET 25C (cells 1-6) - longest highway profile
- HWGRADE 25C (cell 6)

#### Data Cleaning
1. **Voltage anomalies:** Filter rows where voltage < 2.0V or > 30.0V
2. **SOC clamping:** Clamp to [0, 100]%
3. **Forward fill:** Interpolate rows after anomaly removal

#### Normalization (MinMax)
```
normalized = (x - min) / (max - min + 1e-8)
```
Fitted on training data only; applied to all splits.

#### Windowing for NARX
For each timestep t:
```
X[idx] = [V(t-5)..V(t), I(t-5)..I(t), T(t-5)..T(t), SOC(t-3)..SOC(t-1)]
y[idx] = SOC(t)
```
Output shape: (samples, 18), labels (samples,)

#### Windowing for LSTM
For each timestep t:
```
X[idx] = [[V(t-30)..V(t)], [I(t-30)..I(t)], [T(t-30)..T(t)]]
y[idx] = SOC(t)
```
Output shape: (samples, 30, 3), labels (samples,)

#### Scaler Persistence
All models load from `soc_estimation/shared/scaler_params.json` at inference time.

---

## 3. React Dashboard

### 3.1 Architecture

**Location:** `bms-dashboard-react/`  
**Port:** 3000 (Docker - Nginx)  
**Technologies:** React 18 + Vite 5 + Recharts + Axios

#### Component Hierarchy
```
App.jsx (Main orchestrator)
├── OverviewDashboard.jsx (Default tab)
│   ├── CircularGauge (SOC, SOH, Voltage, Temp)
│   ├── StatCard (Current, Power, Cell Range, Delta-V)
│   ├── Charts (SOC/Current, Temp Trend, Voltage Trend)
│   └── Alerts section
├── CellsModulesDashboard.jsx (Detailed cell/module view)
├── WirelessHealthDashboard.jsx (RSSI, packet loss, latency)
├── ContactorsDashboard.jsx (Contactor states + module health)
├── LogsEventsDashboard.jsx (Alert timeline)
├── SettingsPanel.jsx (Refresh rate, data source, thresholds)
├── DataExportPanel.jsx (CSV/JSON export)
└── ErrorBoundary.jsx (Error handling)
```

### 3.2 Data Service (Axios)

**File:** `src/services/dataService.js`

```javascript
API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002'

// Methods:
getCurrentData()      // GET /api/v1/bms/current
getHistoryData()      // GET /api/v1/bms/history
connectWebSocket(onData, onStatus)  // WS /ws real-time stream
getMode()             // Returns 'influxdb' or 'mock'
setMode(mode)         // Switch between data sources
```

**Fallback Strategy:**
- If API request fails, returns empty valid state (all zeros)
- Never overwrites good data with error responses
- Dashboard displays "No Data" state when modules are disconnected

### 3.3 Data Display Patterns

**Overview Dashboard:**
- Circular gauges for SOC, SOH, voltage, temperature (animated)
- Stat cards with gradient backgrounds for current, power, cell range, delta-V
- 2-axis area chart: SOC % (left) vs Current A (right)
- Separate temp/voltage trend charts
- Alert section with severity badges (critical/warning/info)

**Chart Configuration:**
- **Data window:** Last 100 points (auto-scrolling)
- **Refresh:** WebSocket stream for live updates (~2s cadence) + configurable REST polling (default 5s)
- **History polling:** Every 15s (separate interval)
- **Aggregation:** Client-side; server provides 30s windows
- **Animations:** 0.8s ease cubic-bezier on gauge updates

**Responsive Layout:**
- 4-column grid for gauges
- 4-column grid for stat cards
- 1-2 column grids for charts (responsive to screen size)
- Mobile: Stack to single column

### 3.4 Color Theme & Styling

**Dark mode:** Base `#0a0a0f` + `#12121a`  
**Accent colors:**
- Green: `#00ff88` (healthy, positive)
- Orange: `#ff9f43` (warning)
- Red: `#ff4757` (critical)
- Blue: `#3498ff` (info, secondary)
- Purple: `#a855f7` (power)

**Glassmorphism:**
- Frosted glass effect: `backdrop-filter: blur(20px)`
- Transparent backgrounds with `rgba(255,255,255,0.02)`
- Gradient borders: `rgba(255,255,255,0.06)`

---

## 4. CAN Reader (Optional Hardware Bridge)

**File:** `can-reader/can_to_influxdb.py`  
**Dependencies:** python-can, influxdb-client

### 4.1 CAN Protocol

**Hardware:** Raspberry Pi with MCP2515 CAN HAT (500 kbps)

#### Message Format

| CAN ID | Data Bytes | Interpretation |
|--------|-----------|-----------------|
| 0x500 | 1-2: Pack voltage (0.1V/bit, BE uint16)<br/>3-4: Pack current (0.1A/bit, BE int16, signed)<br/>5-6: Avg temp (0.1°C/bit or raw)<br/>7-8: Reserved | Pack-level metrics |
| 0x510-0x518 | 0-1: Module[0] voltage<br/>2-3: Module[1] voltage<br/>...<br/>6-7: Module[3] voltage | Module voltages (4 per frame) |
| 0x520-0x528 | Same layout | Module temperatures (4 per frame) |

**Modules:** 35 total (9 frames × 4 per frame = 36 slots; last slot unused)

### 4.2 Data Processing

**Parser (BMSDataParser):**
1. Unpack struct from raw bytes (big-endian)
2. Apply voltage/temp scaling (auto-detects range)
3. Compute power: `(voltage × current) / 1000`
4. Find min/max cell voltages from stored module data
5. Calculate delta_v: `(max - min) × 1000` (mV)

**Writer (InfluxDBWriter):**
- Batched writes: flush on buffer size ≥ 50 points OR ≥ 1s elapsed
- Retry: 3 attempts with exponential backoff (1s base, 10s max)
- Buffer overflow protection: cap at 5000 points if write fails
- Synchronous write API (no async)

### 4.3 Resilience
- CAN bus reconnection: 10 attempts with exponential backoff (up to 60s)
- InfluxDB connection retry: 10 attempts before failure
- Log summary: status update every 10 seconds

---

## 5. Data Preprocessing & Feature Engineering

### 5.1 Normalization Pipeline

**Input:** Raw sensor measurements (voltage, current, temperature)  
**Method:** MinMax scaling to [0, 1]

```python
normalized = (x - min) / (max - min + 1e-8)
```

**Min/Max ranges (from LG-E66 training data):**
- Voltage: 16.5V - 25.33V
- Current: -178.3A to +117.92A (negative = discharge)
- Temperature: 3.28°C - 30.0°C
- SOC: 0% - 100%

### 5.2 Feature Windows

**NARX features:** 5-step sensor window + 3-step SOC feedback
- Captures short-term dynamics
- Teacher-forced (supervised learning)
- Autoregressive at inference (uses own predictions)

**LSTM features:** 30-step sensor window
- Captures longer temporal dependencies
- RNN memory handles autoregressive nature
- Sequence-to-scalar (only final SOC label)

### 5.3 Data Validation

**Voltage anomalies:** Filter rows with voltage < 2V or > 30V  
**SOC bounds:** Clamp to [0, 100]%  
**Missing data:** Forward-fill interpolation  
**Outliers:** Removed; no explicit outlier detection beyond voltage bounds

---

## 6. Deployment Architecture

### 6.1 Docker Compose Services

**Base image versions:**
- InfluxDB 2.7
- Node.js 20-alpine (API)
- Python 3.11-slim (LSTM, mock generator)
- Nginx alpine (dashboard reverse proxy)

#### Service Startup Order
1. InfluxDB (waits for /ping health)
2. Mock Generator (optional; depends on InfluxDB healthy and requires `./mock-generator` build context)
3. API Server (depends on InfluxDB healthy)
4. Dashboard (no dependencies, serves on port 3000)
5. LSTM Inference (optional, mounts trained model)

#### Health Checks
- **InfluxDB:** curl /ping (10s interval, 5 retries)
- **Mock Generator:** timestamp file in /tmp (15s interval)
- **API:** HTTP /health probe via container healthcheck command (15s interval, start_period 10s)
- **LSTM:** urllib request to /health (15s interval, start_period 30s)

### 6.2 Environment Configuration

**Required variables:**
```bash
INFLUXDB_INIT_USERNAME
INFLUXDB_INIT_PASSWORD
INFLUXDB_ADMIN_TOKEN     # No fallback; services exit if missing
INFLUXDB_ORG             # Default: bms-org
INFLUXDB_BUCKET          # Default: bms-telemetry
DASHBOARD_API_URL        # Default: http://localhost:3002
```

**Optional (mock generator):**
```bash
WRITE_INTERVAL=5         # Seconds between data generation
NUM_MODULES=3            # Module count
ANOMALY_PROBABILITY=0.02 # Threshold violation injection rate
GENERATE_HISTORY_HOURS=48 # Backfill on startup
```

### 6.3 Volume Mounts

| Service | Mount | Purpose |
|---------|-------|---------|
| InfluxDB | `/var/lib/influxdb2` | Persistent timeseries data |
| InfluxDB | `/etc/influxdb2` | Config + auth tokens |
| LSTM | `/app/model/lstm_soc_model.keras` | Trained model (read-only) |
| LSTM | `/app/model/scaler_params.json` | Normalization params |

### 6.4 Network

- **BRIDGE mode** (default docker-compose)
- Services communicate via hostnames (service name as DNS)
- External access: localhost ports 3000, 3002, 5001, 8086
- Dashboard (port 3000) → API (http://api-server:3002 internal)

---

## 7. Inference Pipelines

### 7.1 NARX Edge Inference (Realtime)

```
Every 1 second (async task on ESP32):
1. Read ADC: voltage_V, current_A, temperature_C
2. Call narx_predict(v, i, t)
   a. Normalize inputs with NORM_*_MIN/MAX constants
   b. Append to circular buffers [5 samples each]
   c. Build flat vector [v_win | i_win | t_win | soc_buf]
   d. Dense1: matrix multiply + ReLU
   e. Dense2: matrix multiply + ReLU
   f. Output: matrix multiply (linear)
   g. Clamp to [0, 1]
   h. Shift soc_buf; append new normalized prediction
   i. Denormalize to percentage
3. Publish SOC via JSON over Wi-Fi
4. On cloud LSTM update: narx_reset(cloud_soc) ← reset feedback buffer

Response time: <10ms (simple feedforward, no layers)
Memory: ~168 bytes RAM (5+5+5+3 floats), ~1.8 KB flash (weights)
```

### 7.2 LSTM Cloud Inference (Batch)

```
On demand (Flask endpoint):
1. Client sends: {"voltage": [...30], "current": [...30], "temperature": [...30]}
2. validate_json()
   - Check field presence and array length (must be exactly 30)
3. normalize_feature() for each field
   - (value - min) / (max - min)
4. Build tensor: np.stack([v_norm, i_norm, t_norm], axis=-1)[np.newaxis, ...]
   - Shape: (1, 30, 3)
5. model.predict(seq, verbose=0)
   - LSTM(24 units) processes sequence
   - Dense(1) outputs normalized value
6. Clamp to [0, 1]
7. denormalize_soc()
   - norm_val * (100.0 - 0.0) + 0.0
8. Return {"soc": rounded_percent, "model": "lstm_v1"}

Response time: 50-150ms (GPU inference, TensorFlow Lite or CPU)
Memory: ~5-10 MB (model + TensorFlow overhead)
```

### 7.3 Integration Pattern (Edge + Cloud)

```
Edge ESP32 (every 1s):
├─ NARX prediction → estimate local SOC
├─ Publish over Wi-Fi
│
RPi Receiver (10Hz aggregation):
├─ Collect ESP payloads from all 3 modules
├─ When pack complete: aggregate into pack_metrics
├─ Write to InfluxDB
│
Cloud (every 30s, async):
├─ Fetch last 30 samples from InfluxDB
├─ Call LSTM inference server (port 5001)
├─ Return authoritative SOC
│
Dashboard (every 2s):
├─ Display latest pack_metrics.soc (NARX or LSTM, whichever newer)
├─ Chart last 100 history points
└─ Alert on threshold violations
```

---

## 8. Performance Characteristics

### 8.1 Throughput

| Component | Rate | Interval |
|-----------|------|----------|
| Hardware (3 ESP32s) | ~3 readings/sec per board = 9/sec | 333ms per board |
| RPi Receiver | ~10 aggregations/sec | 100ms between packs |
| InfluxDB | Batched writes (50-point buffer) | ~5s typical |
| API REST queries | 3x retry, exponential backoff | 500ms-5s timeout |
| WebSocket broadcast | 2-second interval | 2000ms tick |
| Dashboard refresh | WS live updates + configurable REST polling | Default 5000ms REST poll |
| LSTM inference | On-demand (async) | 50-150ms response |

### 8.2 Latency

- **Edge NARX:** <10ms per prediction (pure C)
- **Cloud LSTM:** 50-150ms per request (TensorFlow)
- **API round-trip:** 100-500ms (InfluxDB query + retry)
- **Dashboard update:** 2-5 seconds (WebSocket + history polling)

### 8.3 Storage

- **InfluxDB retention:** 7 days (configured in docker-compose)
- **NARX model:** 1.8 KB flash, 168 B RAM
- **LSTM model:** ~5-10 MB (trained weights + TF runtime)
- **Mock generator:** ~10 GB/month at 3 modules, 12 cells, 5s intervals

---

## 9. Fault Tolerance & Resilience

### 9.1 Connection Retry Logic

**Mock Generator:**
- 10 retry attempts on InfluxDB failure
- Exponential backoff: min(2^n * base, 60s)
- Buffer up to 10k points in memory
- Capped buffer on persistent failure

**API Server:**
- 3 retries per InfluxDB query
- Exponential backoff: min(base * 2^n, 5s)
- 30-second global request timeout
- Returns 503 on InfluxDB down

**CAN Reader:**
- 10 CAN bus reconnection attempts
- 3 write retries with backoff
- 5k point buffer cap

**RPi Receiver:**
- Connection retry on startup (10 attempts)
- Per-write retry: 3 attempts
- Health monitoring per ESP32 (last_seen_ms)

### 9.2 Graceful Degradation

- Dashboard works with partial data (modules can be disconnected)
- API returns empty valid state on query failure (not crashes)
- NARX continues running without cloud LSTM (uses internal feedback)
- WebSocket fallback: REST polling every 5 seconds
- Mock generator substitutes real data if hardware unavailable

### 9.3 Monitoring

- All services have health checks (Docker health status)
- InfluxDB retention: automatic deletion of old data
- Mock generator: timestamp file for liveness check
- API: `/health` endpoint verifies InfluxDB reachability
- LSTM: `/health` returns model_loaded + param_count

---

## 10. Key Implementation Files Summary

| File | Purpose | Lines | Language |
|------|---------|-------|----------|
| `api-server/server.js` | Express setup, routes, WebSocket | 75 | JavaScript |
| `api-server/src/routes/bms.js` | BMS REST endpoints (7 handlers) | 233 | JavaScript |
| `api-server/src/utils/influxdb.js` | InfluxDB client + query helpers | 116 | JavaScript |
| `api-server/src/utils/transformers.js` | Data transformation + module topology | 124 | JavaScript |
| `can-reader/can_to_influxdb.py` | CAN protocol parsing + InfluxDB writer | 482 | Python |
| `soc_estimation/lstm/lstm_model.py` | LSTM training script | 154 | Python |
| `soc_estimation/lstm/lstm_inference_server.py` | Flask inference API | 119 | Python |
| `soc_estimation/narx/narx_model.py` | NARX training script | 247 | Python |
| `soc_estimation/narx/narx_export.py` | NARX → C code generator | 420 | Python |
| `soc_estimation/data/preprocess.py` | Data pipeline (LG-E66 dataset) | 347 | Python |
| `bms-dashboard-react/src/App.jsx` | React main orchestrator | 515 | JavaScript/JSX |
| `bms-dashboard-react/src/components/OverviewDashboard.jsx` | Overview tab UI | 774 | JavaScript/JSX |
| `bms-dashboard-react/src/services/dataService.js` | Axios data client | 63 | JavaScript |

---

## 11. Summary: System Characteristics

**Architecture:** Distributed edge computing + cloud SOC estimation  
**Real-time:** Yes (2-5s dashboard update latency)  
**Scalability:** Fixed 3 modules × 12 cells; extendable to N modules  
**Reliability:** 3-retry logic throughout; graceful degradation  
**Data persistence:** InfluxDB 7-day retention  
**Model deployment:** NARX on ESP32 (C), LSTM in Docker (Flask)  
**Dashboard:** React 18 + Recharts, dark theme, responsive  
**Hardware:** ESP32 (sensing + master), RPi (aggregation), optional CAN reader  
**Training data:** LG-E66 (685K samples, 6 drive cycles, 0°C/25°C)  
**Inference speed:** NARX <10ms, LSTM 50-150ms  

This is a production-ready system suitable for battery research, EV BMS validation, and energy storage monitoring.

