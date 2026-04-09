/**
 * Derived event flags / alerts from telemetry snapshot and history points.
 */

const DEFAULT_THRESHOLDS = {
  socWarning: Number(process.env.EVENT_SOC_WARNING ?? 20),
  socCritical: Number(process.env.EVENT_SOC_CRITICAL ?? 10),
  tempWarning: Number(process.env.EVENT_TEMP_WARNING ?? 50),
  tempCritical: Number(process.env.EVENT_TEMP_CRITICAL ?? 60),
  voltageWarning: Number(process.env.EVENT_VOLTAGE_WARNING ?? 36),
  voltageCritical: Number(process.env.EVENT_VOLTAGE_CRITICAL ?? 33),
  packetLossWarning: Number(process.env.EVENT_PACKET_LOSS_WARNING ?? 30),
  packetLossCritical: Number(process.env.EVENT_PACKET_LOSS_CRITICAL ?? 60),
  rssiWarning: Number(process.env.EVENT_RSSI_WARNING ?? -85),
  rssiCritical: Number(process.env.EVENT_RSSI_CRITICAL ?? -95),
  moduleOfflineMsWarning: Number(process.env.EVENT_MODULE_OFFLINE_WARNING_MS ?? 10000),
  moduleOfflineMsCritical: Number(process.env.EVENT_MODULE_OFFLINE_CRITICAL_MS ?? 30000),
};

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function createAlert({ timestamp, severity, type, flag, message, value, threshold, source = 'derived' }) {
  return {
    timestamp: timestamp || new Date().toISOString(),
    severity,
    type,
    flag,
    message,
    value,
    threshold,
    source,
  };
}

export function deriveHistoryAlerts(point, thresholds = DEFAULT_THRESHOLDS) {
  const timestamp = point._time || point.timestamp || new Date().toISOString();
  const alerts = [];

  const soc = asNumber(point.soc_final ?? point.soc);
  if (soc <= thresholds.socCritical) {
    alerts.push(createAlert({
      timestamp,
      severity: 'critical',
      type: 'soc',
      flag: 'soc_low_critical',
      message: `Critical low SOC (${soc.toFixed(1)}%)`,
      value: soc,
      threshold: thresholds.socCritical,
    }));
  } else if (soc <= thresholds.socWarning) {
    alerts.push(createAlert({
      timestamp,
      severity: 'warning',
      type: 'soc',
      flag: 'soc_low_warning',
      message: `Low SOC (${soc.toFixed(1)}%)`,
      value: soc,
      threshold: thresholds.socWarning,
    }));
  }

  const maxTemp = asNumber(point.max_temp);
  if (maxTemp >= thresholds.tempCritical) {
    alerts.push(createAlert({
      timestamp,
      severity: 'critical',
      type: 'temp',
      flag: 'temperature_high_critical',
      message: `Critical high temperature (${maxTemp.toFixed(1)}°C)`,
      value: maxTemp,
      threshold: thresholds.tempCritical,
    }));
  } else if (maxTemp >= thresholds.tempWarning) {
    alerts.push(createAlert({
      timestamp,
      severity: 'warning',
      type: 'temp',
      flag: 'temperature_high_warning',
      message: `High temperature (${maxTemp.toFixed(1)}°C)`,
      value: maxTemp,
      threshold: thresholds.tempWarning,
    }));
  }

  const voltage = asNumber(point.total_voltage);
  if (voltage <= thresholds.voltageCritical && voltage > 0) {
    alerts.push(createAlert({
      timestamp,
      severity: 'critical',
      type: 'voltage',
      flag: 'pack_voltage_low_critical',
      message: `Critical low pack voltage (${voltage.toFixed(2)}V)`,
      value: voltage,
      threshold: thresholds.voltageCritical,
    }));
  } else if (voltage <= thresholds.voltageWarning && voltage > 0) {
    alerts.push(createAlert({
      timestamp,
      severity: 'warning',
      type: 'voltage',
      flag: 'pack_voltage_low_warning',
      message: `Low pack voltage (${voltage.toFixed(2)}V)`,
      value: voltage,
      threshold: thresholds.voltageWarning,
    }));
  }

  return alerts;
}

export function deriveRealtimeAlerts(snapshot, thresholds = DEFAULT_THRESHOLDS) {
  const alerts = [];

  alerts.push(...deriveHistoryAlerts({
    _time: snapshot.timestamp,
    soc_final: snapshot.soc,
    max_temp: snapshot.tempMax,
    total_voltage: snapshot.voltage,
  }, thresholds));

  (snapshot.modules || []).forEach((module) => {
    const moduleId = module.id || 'unknown';

    if (module.healthStatus === 'Disconnected') {
      alerts.push(createAlert({
        timestamp: snapshot.timestamp,
        severity: 'critical',
        type: 'module_health',
        flag: 'module_disconnected',
        message: `${moduleId} disconnected`,
        value: module.lastSeenMs || 0,
        threshold: thresholds.moduleOfflineMsCritical,
      }));
    } else if (module.healthStatus === 'Unhealthy') {
      alerts.push(createAlert({
        timestamp: snapshot.timestamp,
        severity: 'warning',
        type: 'module_health',
        flag: 'module_unhealthy',
        message: `${moduleId} unhealthy`,
        value: module.lastSeenMs || 0,
        threshold: thresholds.moduleOfflineMsWarning,
      }));
    }

    if (asNumber(module.lastSeenMs, 0) >= thresholds.moduleOfflineMsCritical) {
      alerts.push(createAlert({
        timestamp: snapshot.timestamp,
        severity: 'critical',
        type: 'module_health',
        flag: 'module_timeout_critical',
        message: `${moduleId} timeout (${asNumber(module.lastSeenMs)}ms)`,
        value: asNumber(module.lastSeenMs),
        threshold: thresholds.moduleOfflineMsCritical,
      }));
    } else if (asNumber(module.lastSeenMs, 0) >= thresholds.moduleOfflineMsWarning) {
      alerts.push(createAlert({
        timestamp: snapshot.timestamp,
        severity: 'warning',
        type: 'module_health',
        flag: 'module_timeout_warning',
        message: `${moduleId} delayed (${asNumber(module.lastSeenMs)}ms)`,
        value: asNumber(module.lastSeenMs),
        threshold: thresholds.moduleOfflineMsWarning,
      }));
    }

    if (asNumber(module.packetLoss) >= thresholds.packetLossCritical) {
      alerts.push(createAlert({
        timestamp: snapshot.timestamp,
        severity: 'critical',
        type: 'wireless',
        flag: 'wireless_packet_loss_critical',
        message: `${moduleId} critical packet loss (${asNumber(module.packetLoss).toFixed(1)}%)`,
        value: asNumber(module.packetLoss),
        threshold: thresholds.packetLossCritical,
      }));
    } else if (asNumber(module.packetLoss) >= thresholds.packetLossWarning) {
      alerts.push(createAlert({
        timestamp: snapshot.timestamp,
        severity: 'warning',
        type: 'wireless',
        flag: 'wireless_packet_loss_warning',
        message: `${moduleId} high packet loss (${asNumber(module.packetLoss).toFixed(1)}%)`,
        value: asNumber(module.packetLoss),
        threshold: thresholds.packetLossWarning,
      }));
    }

    if (asNumber(module.rssi) <= thresholds.rssiCritical && asNumber(module.rssi) !== 0) {
      alerts.push(createAlert({
        timestamp: snapshot.timestamp,
        severity: 'critical',
        type: 'wireless',
        flag: 'wireless_rssi_critical',
        message: `${moduleId} critical RSSI (${asNumber(module.rssi)} dBm)`,
        value: asNumber(module.rssi),
        threshold: thresholds.rssiCritical,
      }));
    } else if (asNumber(module.rssi) <= thresholds.rssiWarning && asNumber(module.rssi) !== 0) {
      alerts.push(createAlert({
        timestamp: snapshot.timestamp,
        severity: 'warning',
        type: 'wireless',
        flag: 'wireless_rssi_warning',
        message: `${moduleId} weak RSSI (${asNumber(module.rssi)} dBm)`,
        value: asNumber(module.rssi),
        threshold: thresholds.rssiWarning,
      }));
    }
  });

  if (snapshot.contactors) {
    const { positive, negative } = snapshot.contactors;
    if (positive !== 'Closed' || negative !== 'Closed') {
      alerts.push(createAlert({
        timestamp: snapshot.timestamp,
        severity: 'warning',
        type: 'contactors',
        flag: 'contactor_not_closed',
        message: `Contactor state P:${positive || 'Unknown'} N:${negative || 'Unknown'}`,
        value: 1,
        threshold: 0,
      }));
    }
  }

  return alerts;
}

export function mergeAlerts(existingAlerts = [], derivedAlerts = []) {
  const output = [];
  const seen = new Set();

  [...existingAlerts, ...derivedAlerts].forEach((alert) => {
    const normalized = {
      timestamp: alert.timestamp || alert._time || new Date().toISOString(),
      severity: alert.severity || 'info',
      type: alert.type || alert.alert_type || 'unknown',
      flag: alert.flag || null,
      message: alert.message || '',
      value: alert.value ?? 0,
      threshold: alert.threshold ?? 0,
      source: alert.source || 'influx',
    };

    const key = `${normalized.timestamp}|${normalized.severity}|${normalized.type}|${normalized.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    output.push(normalized);
  });

  output.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return output;
}
