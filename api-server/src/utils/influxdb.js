/**
 * InfluxDB client initialization and query utilities
 */

import { InfluxDB } from '@influxdata/influxdb-client';
import { config } from '../config/environment.js';

const influxDB = new InfluxDB({ url: config.influxUrl, token: config.influxToken });
export const queryApi = influxDB.getQueryApi(config.influxOrg);

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
      |> range(start: -1m)
      |> filter(fn: (r) => r._measurement == "contactor_status")
      |> last()
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  `);
}

export async function queryHealth() {
  return executeQuery(`
    from(bucket: "${config.influxBucket}")
      |> range(start: -1m)
      |> filter(fn: (r) => r._measurement == "module_health")
      |> last()
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  `);
}
