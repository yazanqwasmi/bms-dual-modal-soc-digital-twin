/**
 * Health check route
 */

import { executeQuery } from '../utils/influxdb.js';
import { config } from '../config/environment.js';

export async function getHealth(req, res) {
  try {
    const healthQuery = `
      from(bucket: "${config.influxBucket}")
        |> range(start: -10s)
        |> filter(fn: (r) => r._measurement == "pack_metrics")
        |> count()
        |> limit(n: 1)
    `;
    await executeQuery(healthQuery);
    res.json({
      status: 'healthy',
      influxdb: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      influxdb: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
