/**
 * InfluxDB client initialization and query utilities
 */

import { InfluxDB, Point } from '@influxdata/influxdb-client';
import { config } from '../config/environment.js';

const influxDB = new InfluxDB({ url: config.influxUrl, token: config.influxToken });
export const queryApi = influxDB.getQueryApi(config.influxOrg);
const writeApi = influxDB.getWriteApi(config.influxOrg, config.influxBucket, 'ms');
const alertWriteCooldownMs = Number(process.env.EVENT_WRITE_COOLDOWN_MS ?? 60000);
const recentAlertWrites = new Map();

/**
 * Execute InfluxDB query with retry logic
 */
async function withRetry(fn, maxRetries = 3, baseDelay = 500) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const delay = Math.min(baseDelay * Math.pow(2, attempt), 5000);
      console.warn(`Query attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export async function executeQuery(query) {
  return withRetry(() => {
    const results = [];
    return new Promise((resolve, reject) => {
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          results.push(tableMeta.toObject(row));
        },
        error(error) {
          reject(error);
        },
        complete() {
          resolve(results);
        },
      });
    });
  });
}

export async function queryPack() {
  return executeQuery(`
    from(bucket: "${config.influxBucket}")
      |> range(start: -1m)
      |> filter(fn: (r) => r._measurement == "pack_metrics")
      |> last()
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  `);
}

export async function queryModules() {
  return executeQuery(`
    from(bucket: "${config.influxBucket}")
      |> range(start: -30s)
      |> filter(fn: (r) => r._measurement == "module_metrics")
      |> last()
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  `);
}

export async function queryCells() {
  return executeQuery(`
    from(bucket: "${config.influxBucket}")
      |> range(start: -30s)
      |> filter(fn: (r) => r._measurement == "cell_metrics")
      |> last()
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  `);
}

export async function queryWireless() {
  return executeQuery(`
    from(bucket: "${config.influxBucket}")
      |> range(start: -30s)
      |> filter(fn: (r) => r._measurement == "wireless_health")
      |> last()
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  `);
}

export async function queryAlerts(range = '1h') {
  return executeQuery(`
    from(bucket: "${config.influxBucket}")
      |> range(start: -${range})
      |> filter(fn: (r) => r._measurement == "alerts")
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 50)
  `);
}

export async function queryContactors() {
  return executeQuery(`
    from(bucket: "${config.influxBucket}")
      |> range(start: -2m)
      |> filter(fn: (r) => r._measurement == "contactor_status")
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 1)
  `);
}

export async function queryHealth() {
  return executeQuery(`
    from(bucket: "${config.influxBucket}")
      |> range(start: -2m)
      |> filter(fn: (r) => r._measurement == "module_health")
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> group(columns: ["module_id"])
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 1)
  `);
}

export async function queryMasterState() {
  return executeQuery(`
    from(bucket: "${config.influxBucket}")
      |> range(start: -2m)
      |> filter(fn: (r) => r._measurement == "master_state")
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 1)
  `);
}

export async function writeDerivedAlerts(alerts = []) {
  if (!Array.isArray(alerts) || alerts.length === 0) return;

  const now = Date.now();

  alerts.forEach((alert) => {
    const timestamp = alert.timestamp || new Date().toISOString();
    const severity = String(alert.severity || 'info');
    const type = String(alert.type || 'unknown');
    const flag = String(alert.flag || 'derived_event');
    const message = String(alert.message || '');
    const source = String(alert.source || 'derived');
    const value = Number(alert.value ?? 0);
    const threshold = Number(alert.threshold ?? 0);
    const dedupeKey = `${severity}|${type}|${flag}|${message}`;
    const last = recentAlertWrites.get(dedupeKey) || 0;

    if (now - last < alertWriteCooldownMs) return;
    recentAlertWrites.set(dedupeKey, now);

    writeApi
      .writePoint(
        new Point('alerts')
          .tag('severity', severity)
          .tag('alert_type', type)
          .tag('flag', flag)
          .tag('source', source)
          .stringField('message', message)
          .floatField('value', Number.isFinite(value) ? value : 0)
          .floatField('threshold', Number.isFinite(threshold) ? threshold : 0)
          .timestamp(new Date(timestamp))
      );
  });

  try {
    await writeApi.flush();
  } catch (error) {
    console.warn('Failed to write derived alerts:', error.message);
  }

  // Keep in-memory dedupe map bounded
  if (recentAlertWrites.size > 2000) {
    const keepAfter = now - (alertWriteCooldownMs * 2);
    for (const [key, ts] of recentAlertWrites.entries()) {
      if (ts < keepAfter) recentAlertWrites.delete(key);
    }
  }
}
