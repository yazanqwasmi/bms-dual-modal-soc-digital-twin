/**
 * BMS API Server - Modular Entry Point
 * Bridge between InfluxDB and React Dashboard
 * Provides REST API and WebSocket real-time updates
 */

import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';

import { config } from './src/config/environment.js';
import { requestTimeout, errorHandler } from './src/middleware/index.js';
import { getHealth } from './src/routes/health.js';
import { 
  getCurrentStatus, getHistory, getModuleHistory, 
  getAlerts, exportData, getContactors, getStats 
} from './src/routes/bms.js';
import { setupWebSocket } from './src/websocket/handlers.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// ============================================
// Middleware
// ============================================

app.use(cors());
app.use(express.json());
app.use(requestTimeout);

// ============================================
// Routes
// ============================================

// Health check
app.get('/health', getHealth);

// BMS API v1
app.get('/api/v1/bms/current', getCurrentStatus);
app.get('/api/v1/bms/history', getHistory);
app.get('/api/v1/bms/modules/:moduleId/history', getModuleHistory);
app.get('/api/v1/bms/alerts', getAlerts);
app.get('/api/v1/bms/export', exportData);
app.get('/api/v1/bms/contactors', getContactors);
app.get('/api/v1/bms/stats', getStats);

// ============================================
// WebSocket
// ============================================

setupWebSocket(wss);

// ============================================
// Error Handling
// ============================================

app.use(errorHandler);

// ============================================
// Start Server
// ============================================

server.listen(config.port, () => {
  console.log(`BMS API Server running on port ${config.port}`);
  console.log(`   REST API: http://localhost:${config.port}/api/v1/bms`);
  console.log(`   WebSocket: ws://localhost:${config.port}/ws`);
  console.log(`   InfluxDB: ${config.influxUrl}`);
  console.log(`   Environment: ${config.nodeEnv}`);
});
