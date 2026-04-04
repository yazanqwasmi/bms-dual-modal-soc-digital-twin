/**
 * Environment configuration
 */

function requireEnv(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) {
    console.error(`ERROR: Required environment variable ${name} is not set`);
    process.exit(1);
  }
  return value;
}

export const config = {
  port: process.env.PORT || 3002,
  influxUrl: requireEnv('INFLUXDB_URL', 'http://localhost:8086'),
  influxToken: requireEnv('INFLUXDB_TOKEN'),
  influxOrg: requireEnv('INFLUXDB_ORG', 'bms-org'),
  influxBucket: requireEnv('INFLUXDB_BUCKET', 'bms-telemetry'),
  nodeEnv: process.env.NODE_ENV || 'development',
};
