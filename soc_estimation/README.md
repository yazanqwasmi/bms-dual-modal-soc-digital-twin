# SOC Estimation — Dual ML Models

Two machine learning models for lithium-ion battery State of Charge (SOC) estimation:

| Model | Location | Parameters | Target |
|-------|----------|-----------|--------|
| NARX | `narx/` | 449 | ESP32 edge inference |
| LSTM | `lstm/` | 2,713 | Cloud Docker inference |

Both are trained on the LG-E66 battery dataset (685K samples, 6 drive cycles, 0°C and 25°C).

---

## Prerequisites

```bash
pip install tensorflow>=2.15.0 pandas>=2.0.0 numpy>=1.24.0 \
            openpyxl>=3.1.0 scikit-learn>=1.3.0 matplotlib>=3.7.0
```

Verify the dataset directory is in the project root:
```
BWF/LG-E66 Module Data-AVL/
├── HWCUST 25C/
├── HWFET 25C/
├── HWGRADE 0C/
├── HWGRADE 25C/
├── US06 0C/
└── US06 25C/
```

Run all commands from the project root (`BWF/`).

---

## Step 1 — Train the NARX model

```bash
python -m soc_estimation.narx.narx_model
```

Outputs:
- `soc_estimation/narx/narx_soc_model.h5` — trained weights
- `soc_estimation/shared/scaler_params.json` — normalization parameters
- `soc_estimation/narx/narx_results.png` — test set predictions plot

---

## Step 2 — Export NARX weights to C

```bash
python -m soc_estimation.narx.narx_export
```

Outputs (copy these into `esp32-firmware/sensing/src/`):
- `soc_estimation/narx/narx_weights.h` — weight/bias arrays + normalization defines
- `soc_estimation/narx/narx_inference.h` — public API header
- `soc_estimation/narx/narx_inference.c` — pure C inference implementation

Compile check (host):
```bash
gcc -Wall -Wextra -std=c99 -lm soc_estimation/narx/narx_inference.c -o /dev/null
```

---

## Step 3 — Train the LSTM model

```bash
python -m soc_estimation.lstm.lstm_model
```

Outputs:
- `soc_estimation/lstm/lstm_soc_model.h5` — trained weights
- `soc_estimation/lstm/lstm_results.png` — test set predictions plot

> Note: `scaler_params.json` is shared between both models. Training NARX first
> writes this file; LSTM training will reuse it from cache.

---

## Step 4 — Build and run the LSTM Docker container

Copy the trained model and scaler into the lstm directory before building:
```bash
cp soc_estimation/lstm/lstm_soc_model.h5   soc_estimation/lstm/model/
cp soc_estimation/shared/scaler_params.json soc_estimation/lstm/model/
```

Build and run:
```bash
docker build -t bms-lstm-inference soc_estimation/lstm/
docker run -p 5001:5001 \
  -v "$(pwd)/soc_estimation/lstm/model:/app/model:ro" \
  bms-lstm-inference
```

Or use Docker Compose (adds the service to the full BMS stack):
```bash
docker-compose up lstm-inference
```

---

## Step 5 — Test the LSTM API endpoint

Health check:
```bash
curl http://localhost:5001/health
# {"status": "healthy", "model_loaded": true, "param_count": 2713}
```

SOC prediction (replace arrays with 30 real sensor readings):
```bash
curl -X POST http://localhost:5001/predict \
  -H "Content-Type: application/json" \
  -d '{
    "voltage":     [24.1, 24.0, 23.9, 23.8, 23.7, 23.6, 23.5, 23.4, 23.3, 23.2,
                    23.1, 23.0, 22.9, 22.8, 22.7, 22.6, 22.5, 22.4, 22.3, 22.2,
                    22.1, 22.0, 21.9, 21.8, 21.7, 21.6, 21.5, 21.4, 21.3, 21.2],
    "current":     [-5.0, -5.1, -5.0, -4.9, -5.2, -5.1, -5.0, -5.1, -5.0, -4.8,
                    -5.0, -5.1, -5.2, -5.0, -4.9, -5.1, -5.0, -5.0, -5.1, -5.0,
                    -5.0, -5.1, -5.0, -4.9, -5.0, -5.1, -5.0, -5.0, -5.1, -5.0],
    "temperature": [25.0, 25.1, 25.1, 25.2, 25.2, 25.3, 25.3, 25.4, 25.4, 25.5,
                    25.5, 25.6, 25.6, 25.7, 25.7, 25.8, 25.8, 25.9, 25.9, 26.0,
                    26.0, 26.1, 26.1, 26.2, 26.2, 26.3, 26.3, 26.4, 26.4, 26.5]
  }'
# {"soc": 72.34, "model": "lstm_v1"}
```

---

## Architecture

### NARX (ESP32 edge)

```
Input (18): [V(t-4..t), I(t-4..t), T(t-4..t), SOC_pred(t-3..t-1)]
     |
Dense(16, ReLU)   304 params
     |
Dense(8,  ReLU)   136 params
     |
Dense(1,  linear)   9 params
     |
Output: SOC(t) normalized [0, 1]  ->  denormalize -> SOC %
```

The C inference (`narx_inference.c`) maintains internal circular buffers for the
sliding window and autoregressive SOC feedback. Call `narx_init()` once in `setup()`
and `narx_predict(voltage, current, temperature)` every second in `loop()`.

**ESP32 memory:** ~1.8 KB flash (weights) + ~168 bytes RAM (buffers).

### LSTM (Cloud Docker)

```
Input (30, 3): sequence of [V, I, T] for the last 30 seconds
     |
LSTM(24 units)  2,688 params
     |
Dense(1, linear)   25 params
     |
Output: SOC normalized [0, 1]  ->  denormalize -> SOC %
```

---

## Data Split

| Set | Cycles | ~Samples |
|-----|--------|---------|
| Train | US06 25C (cells 1-6) + HWGRADE 0C (cells 1-4) | 177K |
| Val | HWGRADE 0C (cells 5-6) + HWGRADE 25C (cells 1-3) | 80K |
| Test | HWFET 25C + HWCUST 25C + US06 0C + HWGRADE 25C (cells 4-6) | 428K |

Split is by drive cycle — no data leakage between train and test.
Both temperatures (0°C and 25°C) are represented in training.

---

## File Structure

```
soc_estimation/
├── data/
│   ├── preprocess.py          # shared data pipeline
│   └── cache/                 # parquet cache (auto-generated)
├── narx/
│   ├── narx_model.py          # train + evaluate
│   ├── narx_export.py         # export weights → C
│   ├── narx_weights.h         # generated: C weight arrays
│   ├── narx_inference.h       # generated: public C API
│   ├── narx_inference.c       # generated: pure C inference
│   ├── narx_soc_model.h5      # generated: trained model
│   └── narx_results.png       # generated: test plot
├── lstm/
│   ├── lstm_model.py          # train + evaluate
│   ├── lstm_inference_server.py  # Flask REST API
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── lstm_soc_model.h5      # generated: trained model
│   └── lstm_results.png       # generated: test plot
└── shared/
    └── scaler_params.json     # generated: normalization params
```
