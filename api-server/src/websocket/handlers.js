/**
 * WebSocket handler for real-time updates
 */

import { queryPack, queryModules, queryCells, queryWireless, queryAlerts, queryContactors, queryHealth } from '../utils/influxdb.js';
import { transformCurrentData } from '../utils/transformers.js';

export function setupWebSocket(wss) {
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    // Send initial data
    sendCurrentData(ws);

    // Set up periodic updates (5 second interval)
    const interval = setInterval(() => {
      sendCurrentData(ws);
    }, 2000);

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      clearInterval(interval);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clearInterval(interval);
    });
  });
}

async function sendCurrentData(ws) {
  try {
    const [packData, moduleData, cellData, wirelessData, alertsData, contactorData, healthData] = await Promise.all([
      queryPack(),
      queryModules(),
      queryCells(),
      queryWireless(),
      queryAlerts(),
      queryContactors(),
      queryHealth(),
    ]);

    const data = transformCurrentData(packData, moduleData, cellData, wirelessData, alertsData, contactorData, healthData);

    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'pack_update',
        data,
        timestamp: new Date().toISOString(),
      }));
    }
  } catch (error) {
    console.error('Error sending WebSocket data:', error.message);
  }
}
