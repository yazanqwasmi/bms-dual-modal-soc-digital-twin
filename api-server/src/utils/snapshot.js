/**
 * Shared helper: fetch and transform the current BMS snapshot.
 * Used by both the REST route (bms.js) and the WebSocket handler.
 */

import {
  queryPack, queryModules, queryCells,
  queryWireless, queryAlerts, queryContactors, queryHealth,
} from './influxdb.js';
import { transformCurrentData } from './transformers.js';

export async function fetchCurrentSnapshot() {
  const [packData, moduleData, cellData, wirelessData, alertsData, contactorData, healthData] = await Promise.all([
    queryPack(),
    queryModules(),
    queryCells(),
    queryWireless(),
    queryAlerts(),
    queryContactors(),
    queryHealth(),
  ]);

  return transformCurrentData(packData, moduleData, cellData, wirelessData, alertsData, contactorData, healthData);
}
