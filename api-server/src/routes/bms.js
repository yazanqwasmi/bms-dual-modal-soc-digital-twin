/**
 * BMS data routes (current status, history, etc.)
 */

import { executeQuery, queryContactors, queryHealth } from '../utils/influxdb.js';
import { fetchCurrentSnapshot } from '../utils/snapshot.js';
import { config } from '../config/environment.js';
import { deriveHistoryAlerts, mergeAlerts } from '../utils/eventFlags.js';

/**
 * Get current pack status
 */
export async function getCurrentStatus(req, res) {
  try {
    const response = await fetchCurrentSnapshot();
    res.json(response);
  } catch (error) {
    console.error('Error fetching current data:', error);
    res.status(500).json({ error: 'Failed to fetch current data', details: error.message });
  }
}

/**
 * Get historical data for charts
 */
export async function getHistory(req, res) {
  try {
    const range = req.query.range || '1h';
    const aggregateWindow = req.query.window || '30s';

    const query = `
      from(bucket: "${config.influxBucket}")
        |> range(start: -${range})
        |> filter(fn: (r) => r._measurement == "pack_metrics")
        |> filter(fn: (r) => r._field != "soc_corrected")
        |> aggregateWindow(every: ${aggregateWindow}, fn: mean, createEmpty: false)
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> sort(columns: ["_time"])
    `;

    const historyData = await executeQuery(query);
    const response = historyData.map(row => ({
      timestamp: row._time,
      soc: row.soc || 0,
      socNarx: row.soc_narx,
      socLstm: row.soc_lstm,
      socFinal: row.soc_final,
      socCorrectionDelta: row.soc_correction_delta,
      socCorrected: row.soc_corrected,
      soh: row.soh || 0,
      voltage: row.total_voltage || 0,
      current: row.current || 0,
      power: row.power_kw || 0,
      tempAvg: row.avg_temp || 0,
      tempMax: row.max_temp || 0,
      tempMin: row.min_temp || 0,
      alerts: deriveHistoryAlerts(row),
    }));

    res.json(response);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history', details: error.message });
  }
}

/**
 * Get module-specific history
 */
export async function getModuleHistory(req, res) {
  try {
    const { moduleId } = req.params;
    const range = req.query.range || '1h';

    const query = `
      from(bucket: "${config.influxBucket}")
        |> range(start: -${range})
        |> filter(fn: (r) => r._measurement == "module_metrics" and r.module_id == "${moduleId}")
        |> aggregateWindow(every: 30s, fn: mean, createEmpty: false)
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> sort(columns: ["_time"])
    `;

    const data = await executeQuery(query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching module history:', error);
    res.status(500).json({ error: 'Failed to fetch module history', details: error.message });
  }
}

/**
 * Get alerts with filtering
 */
export async function getAlerts(req, res) {
  try {
    const { severity, type, range = '24h', limit = 100 } = req.query;

    let filterClause = 'r._measurement == "alerts"';
    if (severity) filterClause += ` and r.severity == "${severity}"`;
    if (type) filterClause += ` and r.alert_type == "${type}"`;

    const query = `
      from(bucket: "${config.influxBucket}")
        |> range(start: -${range})
        |> filter(fn: (r) => ${filterClause})
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: ${limit})
    `;

    const data = await executeQuery(query);

    // Fallback: derive alerts from pack history if no explicit alerts are present
    if (!data || data.length === 0) {
      const fallbackQuery = `
        from(bucket: "${config.influxBucket}")
          |> range(start: -${range})
          |> filter(fn: (r) => r._measurement == "pack_metrics")
          |> aggregateWindow(every: 30s, fn: mean, createEmpty: false)
          |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
          |> sort(columns: ["_time"], desc: true)
          |> limit(n: ${limit})
      `;

      const fallbackRows = await executeQuery(fallbackQuery);
      const derived = fallbackRows.flatMap((row) => deriveHistoryAlerts(row));
      const filtered = derived.filter((alert) => {
        if (severity && alert.severity !== severity) return false;
        if (type && alert.type !== type) return false;
        return true;
      });

      return res.json(mergeAlerts([], filtered).slice(0, Number(limit)));
    }

    return res.json(mergeAlerts(data, []));
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts', details: error.message });
  }
}

/**
 * Export data as CSV or JSON
 */
export async function exportData(req, res) {
  try {
    const { measurement = 'pack_metrics', range = '24h', format = 'csv' } = req.query;

    const query = `
      from(bucket: "${config.influxBucket}")
        |> range(start: -${range})
        |> filter(fn: (r) => r._measurement == "${measurement}")
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> sort(columns: ["_time"])
    `;

    const data = await executeQuery(query);

    if (format === 'csv') {
      if (data.length === 0) {
        return res.status(404).send('No data found');
      }

      const headers = Object.keys(data[0]).filter(k => !k.startsWith('_') || k === '_time');
      let csv = headers.join(',') + '\n';

      data.forEach(row => {
        const values = headers.map(h => {
          const val = row[h];
          return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
        });
        csv += values.join(',') + '\n';
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=bms-${measurement}-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data', details: error.message });
  }
}

/**
 * Get contactor status and module health
 */
export async function getContactors(req, res) {
  try {
    const [contactorData, healthData] = await Promise.all([
      queryContactors(),
      queryHealth(),
    ]);

    const contactor = contactorData[0] || {};
    const moduleHealth = healthData.map(h => ({
      moduleId: h.module_id,
      status: h.status || 'Unknown',
      lastSeenMs: h.last_seen_ms || 0,
      timestamp: h._time,
    }));

    res.json({
      contactors: {
        positive: contactor.positive || 'Unknown',
        negative: contactor.negative || 'Unknown',
        precharge: contactor.precharge || 'Unknown',
        timestamp: contactor._time,
      },
      moduleHealth,
    });
  } catch (error) {
    console.error('Error fetching contactor data:', error);
    res.status(500).json({ error: 'Failed to fetch contactor data', details: error.message });
  }
}

/**
 * Get system statistics
 */
export async function getStats(req, res) {
  try {
    const query = `
      from(bucket: "${config.influxBucket}")
        |> range(start: -24h)
        |> filter(fn: (r) => r._measurement == "pack_metrics")
        |> group(columns: ["_field"])
        |> reduce(
          fn: (r, accumulator) => ({
            min: if r._value < accumulator.min then r._value else accumulator.min,
            max: if r._value > accumulator.max then r._value else accumulator.max,
            sum: accumulator.sum + r._value,
            count: accumulator.count + 1.0
          }),
          identity: {min: 999999.0, max: -999999.0, sum: 0.0, count: 0.0}
        )
        |> map(fn: (r) => ({r with avg: r.sum / r.count}))
    `;

    const data = await executeQuery(query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
  }
}
