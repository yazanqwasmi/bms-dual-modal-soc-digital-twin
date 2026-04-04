/**
 * Hardware topology and data transformation utilities
 */

/**
 * Known hardware topology — always return these modules
 */
export const MODULE_TOPOLOGY = [
  { id: 'M01', numCells: 5, cellIds: ['C01','C02','C03','C04','C05'] },
  { id: 'M02', numCells: 5, cellIds: ['C06','C07','C08','C09','C10'] },
  { id: 'M03', numCells: 4, cellIds: ['C11','C12','C13','C14'] },
];

/**
 * Transform raw InfluxDB data into dashboard format
 */
export function transformCurrentData(packData, moduleData, cellData, wirelessData, alertsData, contactorData, healthData) {
  const pack = packData[0] || {};

  // Seed the module map with all known modules (Disconnected by default)
  const moduleMap = new Map();
  MODULE_TOPOLOGY.forEach(topo => {
    moduleMap.set(topo.id, {
      id: topo.id,
      voltage: 0,
      tempAvg: 0,
      deltaV: 0,
      balancing: false,
      numCells: topo.numCells,
      healthStatus: 'Disconnected',
      lastSeenMs: 0,
      rssi: 0,
      packetLoss: 100,
      latency: 0,
      connected: false,
      cells: topo.cellIds.map(cid => ({
        id: cid,
        voltage: 0,
        temp: 0,
        soc: 0,
      })),
    });
  });

  // Overlay real module data from InfluxDB
  moduleData.forEach(m => {
    const mod = moduleMap.get(m.module_id);
    if (mod) {
      mod.voltage = m.voltage || 0;
      mod.tempAvg = m.avg_temp || 0;
      mod.deltaV = (m.delta_v_mv || 0) / 1000;
      mod.balancing = m.balancing_active || false;
      mod.numCells = m.num_cells || mod.numCells;
      mod.connected = true;
      mod.healthStatus = 'Healthy';
    }
  });

  // Overlay real cell data
  cellData.forEach(c => {
    const mod = moduleMap.get(c.module_id);
    if (mod) {
      const cell = mod.cells.find(cell => cell.id === c.cell_id);
      if (cell) {
        cell.voltage = c.voltage || 0;
        cell.temp = c.temperature || 0;
        cell.soc = c.soc || 0;
      }
    }
  });

  // Overlay wireless data
  wirelessData.forEach(w => {
    const mod = moduleMap.get(w.module_id);
    if (mod) {
      mod.rssi = w.rssi || 0;
      mod.packetLoss = w.packet_loss || 0;
      mod.latency = w.latency_ms || 0;
    }
  });

  // Overlay module health data (don't override connected if sensing data exists)
  (healthData || []).forEach(h => {
    const mod = moduleMap.get(h.module_id);
    if (mod) {
      mod.healthStatus = mod.connected ? 'Healthy' : (h.status || mod.healthStatus);
      mod.lastSeenMs = h.last_seen_ms || 0;
    }
  });

  // Transform contactor data
  const contactor = ((contactorData || [])[0]) || {};
  const contactors = {
    positive: contactor.positive || 'Unknown',
    negative: contactor.negative || 'Unknown',
    precharge: contactor.precharge || 'Unknown',
  };

  // Transform alerts
  const alerts = (alertsData || []).map(a => ({
    timestamp: a._time,
    severity: a.severity || 'info',
    type: a.alert_type || 'unknown',
    message: a.message || '',
    value: a.value || 0,
    threshold: a.threshold || 0,
  }));

  return {
    timestamp: pack._time || new Date().toISOString(),
    soc: pack.soc || 0,
    soh: pack.soh || 0,
    voltage: pack.total_voltage || 0,
    current: pack.current || 0,
    power: (pack.power_kw || 0) * 1000,
    tempAvg: pack.avg_temp || 0,
    tempMax: pack.max_temp || 0,
    tempMin: pack.min_temp || 0,
    modules: Array.from(moduleMap.values()),
    contactors,
    alerts,
  };
}
