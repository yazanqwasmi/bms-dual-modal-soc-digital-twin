/**
 * Shared helper: fetch and transform the current BMS snapshot.
 * Used by both the REST route (bms.js) and the WebSocket handler.
 */

import {
  queryPack, queryModules, queryCells,
  queryWireless, queryAlerts, queryContactors, queryHealth, queryMasterState, writeDerivedAlerts,
} from './influxdb.js';
import { transformCurrentData } from './transformers.js';
import { deriveRealtimeAlerts, mergeAlerts } from './eventFlags.js';

export async function fetchCurrentSnapshot() {
  const [packData, moduleData, cellData, wirelessData, alertsData, contactorData, healthData, masterStateData] = await Promise.all([
    queryPack(),
    queryModules(),
    queryCells(),
    queryWireless(),
    queryAlerts(),
    queryContactors(),
    queryHealth(),
    queryMasterState(),
  ]);

  const transformed = transformCurrentData(packData, moduleData, cellData, wirelessData, alertsData, contactorData, healthData, masterStateData);
  const derivedAlerts = deriveRealtimeAlerts(transformed);
  await writeDerivedAlerts(derivedAlerts);

  return {
    ...transformed,
    alerts: mergeAlerts(transformed.alerts, derivedAlerts),
  };
}
