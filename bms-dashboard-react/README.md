# 🔋 BMS Dashboard React

A professional, modular Battery Management System telemetry dashboard built with React + Vite. Features realistic mock data generation with easy pipeline integration.

## ⚡ Quick Start

```bash
cd bms-dashboard-react
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## 📊 Features

✅ **4 Professional Dashboards:**
- BMS Overview (SOC, SOH, voltage, power, temps)
- Cells & Modules (per-cell monitoring, balancing status)
- Wireless Health (RSSI, packet loss, latency)
- Logs & Events (alert history, filtering)

✅ **Realistic Mock Data:**
- Daily charge/discharge cycles
- Cell-to-cell voltage variations  
- Temperature correlations
- Wireless signal degradation
- 2% anomaly injection

✅ **Pipeline-Ready Architecture:**
- Modular data service layer
- Switch between mock data and real APIs with 1 line change
- Designed for easy backend integration

✅ **Professional UI:**
- Professional dark theme
- Responsive charts (Recharts)
- Real-time updates every 5 seconds
- Interactive filters and selectors

## 🏗 Project Structure

```
bms-dashboard-react/
├── src/
│   ├── main.jsx                    # App entry point
│   ├── App.jsx                     # Main app component (routing)
│   ├── styles/
│   │   └── global.css             # Dark theme styles
│   ├── components/
│   │   ├── OverviewDashboard.jsx
│   │   ├── CellsModulesDashboard.jsx
│   │   ├── WirelessHealthDashboard.jsx
│   │   └── LogsEventsDashboard.jsx
│   └── services/
│       ├── dataService.js         # API abstraction layer ⭐
│       └── mockDataGenerator.js   # Battery simulator
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

## 🔄 Switching Data Sources

Currently running with **mock data** for development/demo.

### Use Real InfluxDB Data

Set environment variable before running:

```bash
# .env or command line
VITE_USE_REAL_DATA=true
VITE_INFLUXDB_URL=http://localhost:8086
npm run dev
```

Or edit `src/services/dataService.js`:

```javascript
const useRealData = true  // Switch this
```

### Adding Real Backend API

The data service is abstraction-ready. To connect real data:

1. **Create backend endpoint** (Express, FastAPI, etc.):
   ```javascript
   GET /api/v1/bms/current  → Returns current BMS snapshot
   GET /api/v1/bms/history  → Returns historical data
   ```

2. **Expected data format** (match mock structure):
   ```json
   {
     "timestamp": "2026-01-04T12:30:45Z",
     "soc": 75.5,
     "soh": 95.2,
     "voltage": 48.15,
     "current": -25.3,
     "power": -1215.45,
     "tempAvg": 28.5,
     "cycleCount": 1240,
     "modules": [
       {
         "id": "M1",
         "voltage": 4.02,
         "current": -2.1,
         "tempAvg": 28.1,
         "deltaV": 0.025,
         "balancing": false,
         "rssi": -58.3,
         "packetLoss": 1.2,
         "latency": 28.5,
         "cells": [...]
       }
     ],
     "alerts": [...]
   }
   ```

3. **The frontend automatically adapts** - same UI works with both mock and real data!

## 📡 Integration with Docker Stack

Connect this React app to your existing InfluxDB stack:

```bash
# From /Users/yazanqwasmi/BWF/

# Terminal 1: Keep Docker stack running
docker compose up -d

# Terminal 2: Run React app (in bms-dashboard-react/)
npm install
VITE_USE_REAL_DATA=true npm run dev
```

The React app will:
- Fetch live data from Docker InfluxDB
- Fetch live data from Docker InfluxDB via the API server
- Run standalone (no Docker dependency)

## 🎮 Development

```bash
# Install dependencies
npm install

# Dev server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📈 Building Your Pipeline

### Step 1: Deploy React App
```bash
npm run build
# Deploy `dist/` folder to your server
```

### Step 2: Create Backend Service
```python
# Example: Python FastAPI backend
from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI()

@app.get("/api/v1/bms/current")
async def get_current_bms():
    # Query your real sensors/InfluxDB
    return {
        "timestamp": datetime.now(),
        "soc": get_soc(),
        "voltage": get_pack_voltage(),
        # ... etc
    }
```

### Step 3: Connect React App
```bash
VITE_USE_REAL_DATA=true VITE_INFLUXDB_URL=https://your-api.com npm run build
```

## 🎨 Customization

### Change Update Rate
Edit `src/App.jsx`:
```javascript
// From 5000ms (5 seconds)
}, 5000)

// To 1000ms (1 second)
}, 1000)
```

### Modify Chart Colors
Edit `src/styles/global.css`:
```css
:root {
  --accent-green: #10b981;    /* Change these */
  --accent-red: #ef4444;
  /* ... */
}
```

### Add New Metrics
1. Update `mockDataGenerator.js` to generate new field
2. Add chart to relevant dashboard component
3. Automatic updates with real data (no changes needed!)

## 🔌 API Reference (for backend implementation)

### GET `/api/v1/bms/current`

Returns latest BMS snapshot:

```json
{
  "timestamp": "ISO 8601",
  "soc": number (0-100),
  "soh": number (0-100),
  "voltage": number (volts),
  "current": number (amps, negative=discharging),
  "power": number (watts),
  "tempAvg": number (celsius),
  "cycleCount": number,
  "modules": [
    {
      "id": "M1-M12",
      "voltage": number,
      "current": number,
      "tempAvg": number,
      "tempMax": number,
      "deltaV": number (volts),
      "balancing": boolean,
      "rssi": number (dBm),
      "packetLoss": number (%),
      "latency": number (ms),
      "cells": [
        {
          "id": "C1-C96",
          "voltage": number,
          "temp": number,
          "soc": number
        }
      ]
    }
  ],
  "alerts": [
    {
      "timestamp": "ISO 8601",
      "severity": "critical|warning|info",
      "type": "voltage|temp|wireless|soc|soh",
      "message": string,
      "value": number,
      "threshold": number
    }
  ]
}
```

### GET `/api/v1/bms/history?range=1h`

Returns historical data array (same structure as `current`, but array of snapshots).

## 🚀 Deployment Options

### Option 1: Static Hosting (GitHub Pages, Netlify, Vercel)
```bash
npm run build
# Deploy dist/ folder
```

### Option 2: Self-hosted with Express Backend
```javascript
// server.js
const express = require('express')
const app = express()

app.use(express.static('dist'))
app.get('/api/v1/bms/*', yourApiHandler)

app.listen(3000)
```

### Option 3: Docker Container
```dockerfile
FROM node:18 AS build
WORKDIR /app
COPY . .
RUN npm install && npm run build

FROM node:18
WORKDIR /app
COPY --from=build /app/dist ./public
# ... add API server code
EXPOSE 3000
CMD ["npm", "start"]
```

## 🛠 Troubleshooting

**No data appearing:**
- Check browser console for errors
- Verify `npm install` completed
- Ensure mock data mode is active (default)

**Switch to real data not working:**
- Verify backend API is running at `VITE_INFLUXDB_URL`
- Check API response format matches schema
- Look at network tab in browser DevTools

**Charts not updating:**
- Clear browser cache
- Check browser console for JS errors
- Verify data service is being called

## 📦 Dependencies

- **react** - UI framework
- **recharts** - Professional charts
- **axios** - HTTP requests (for real APIs)
- **vite** - Lightning-fast build tool

## 📄 License

MIT

---

Built for real-world BMS telemetry. Ready for production pipelines.
