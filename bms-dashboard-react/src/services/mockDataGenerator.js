/**
 * Mock Data Generator - Simulates realistic BMS telemetry
 * Matches the hardware architecture:
 *   - 3 modules: M01 (4 cells), M02 (4 cells), M03 (4 cells)
 *   - 12 cells total, 6 temperature sensors (2 per module)
 *   - Contactor states: Positive, Negative, Precharge
 *   - Module health tracking with heartbeat timeout
 */

const MODULE_TOPOLOGY = [
  { id: 'M01', numCells: 4, cellOffset: 0 },
  { id: 'M02', numCells: 4, cellOffset: 4 },
  { id: 'M03', numCells: 4, cellOffset: 8 },
];

export class BatterySimulator {
  constructor() {
    this.numModules = 3;
    this.soc = 50;
    this.soh = 95;
    this.current = 0;
    this.voltage = 48;
    this.tempAvg = 25;
    this.ambientTemp = 20;
    this.cycleCount = 0;
    this.lastUpdateTime = Date.now();

    this.hoursElapsed = 0;
    this.chargingPhase = true;
    this.phaseStartTime = Date.now();

    // Contactor state
    this.contactors = {
      positive: 'Closed',
      negative: 'Closed',
      precharge: 'Open',
    };
    this._prechargeSequenceStep = -1; // -1 = inactive
    this._sequenceTimer = 0;

    // Initialize 3 modules with correct cell counts
    this.modules = MODULE_TOPOLOGY.map((topo, idx) => ({
      id: topo.id,
      voltage: 4.0 + Math.random() * 0.1,
      current: 0,
      tempAvg: 25 + Math.random() * 3,
      temp1: 25 + Math.random() * 2,
      temp2: 25.5 + Math.random() * 2,
      deltaV: Math.random() * 0.02,
      balancing: false,
      rssi: -55 - idx * 3 - Math.random() * 10,
      packetLoss: Math.random() * 2,
      latency: 20 + Math.random() * 30,
      healthStatus: 'Healthy',
      lastSeenMs: 0,
      _unhealthyCountdown: 0,
      numCells: topo.numCells,
      cells: Array.from({ length: topo.numCells }, (_, cIdx) => ({
        id: `C${topo.cellOffset + cIdx + 1}`,
        voltage: 3.7 + Math.random() * 0.1,
        temp: 25 + Math.random() * 3,
        soc: 50 + Math.random() * 20,
      })),
    }));

    this.alerts = [];
  }

  update(deltaTime = 5000) {
    this.hoursElapsed += deltaTime / 3600000;

    const cyclePhase = (this.hoursElapsed % 24) / 24;

    if (cyclePhase < 0.4) {
      this.chargingPhase = true;
      const chargeProgress = cyclePhase / 0.4;
      this.soc = 20 + chargeProgress * 60;
      this.current = 50 - Math.random() * 10;
    } else if (cyclePhase < 0.7) {
      this.chargingPhase = false;
      const dischargeProgress = (cyclePhase - 0.4) / 0.3;
      this.soc = 80 - dischargeProgress * 50;
      this.current = -(40 + Math.random() * 10);
    } else {
      this.soc = 30 + Math.random() * 5;
      this.current = Math.random() * 2 - 1;
    }

    this.voltage = 47 + (this.soc / 100) * 1.2 + (Math.random() - 0.5) * 0.2;

    const targetTemp = this.ambientTemp + Math.abs(this.current) * 0.05;
    this.tempAvg += (targetTemp - this.tempAvg) * 0.1 + (Math.random() - 0.5) * 0.5;
    this.tempAvg = Math.max(15, Math.min(60, this.tempAvg));

    if (Math.random() < 0.001) {
      this.soh -= 0.01;
    }

    // Update contactors
    this._updateContactors();

    // Update modules
    this.modules.forEach((module, idx) => {
      module.voltage = 3.7 + (this.soc / 100) * 0.5 + (Math.random() - 0.5) * 0.05;
      module.current = this.current / this.numModules;
      module.tempAvg = this.tempAvg + (Math.random() - 0.5) * 2;
      module.temp1 = module.tempAvg + (Math.random() - 0.5) * 0.5;
      module.temp2 = module.tempAvg + 0.5 + (Math.random() - 0.5) * 0.5;

      // Update cells
      module.cells.forEach((cell) => {
        cell.voltage = module.voltage + (Math.random() - 0.5) * 0.03;
        cell.temp = module.tempAvg + (Math.random() - 0.5) * 1;
        cell.soc = this.soc + (Math.random() - 0.5) * 5;
      });

      // Delta V
      const voltages = module.cells.map(c => c.voltage);
      module.deltaV = Math.max(...voltages) - Math.min(...voltages);
      module.balancing = module.deltaV > 0.05;

      // Wireless metrics
      if (Math.random() < 0.01) {
        module.rssi = Math.max(-95, module.rssi - Math.random() * 15);
        module.packetLoss = Math.min(15, module.packetLoss + Math.random() * 5);
      } else {
        const baseRssi = -55 - idx * 3;
        module.rssi = module.rssi * 0.95 + baseRssi * 0.05;
        module.packetLoss = Math.max(0.1, module.packetLoss * 0.98);
      }
      module.latency = Math.max(10, module.latency * 0.95 + 15 * 0.05);

      // Module health
      if (module._unhealthyCountdown > 0) {
        module._unhealthyCountdown--;
        module.lastSeenMs += 5000;
        module.healthStatus = module.lastSeenMs > 10000 ? 'Unhealthy' : 'Healthy';
      } else {
        module.lastSeenMs = Math.floor(Math.random() * 500);
        module.healthStatus = 'Healthy';
        if (Math.random() < 0.001) {
          module._unhealthyCountdown = Math.floor(Math.random() * 5) + 2;
        }
      }
    });

    this.alerts = this._generateAlerts();
    this.lastUpdateTime = Date.now();
  }

  _updateContactors() {
    // Occasionally trigger precharge sequence
    if (this._prechargeSequenceStep === -1 && Math.random() < 0.0003) {
      this._prechargeSequenceStep = 0;
      this._sequenceTimer = 0;
    }

    if (this._prechargeSequenceStep >= 0) {
      this._sequenceTimer++;
      if (this._prechargeSequenceStep === 0) {
        this.contactors.positive = 'Open';
        this.contactors.negative = 'Open';
        this.contactors.precharge = 'Closed';
        if (this._sequenceTimer > 3) {
          this._prechargeSequenceStep = 1;
          this._sequenceTimer = 0;
        }
      } else if (this._prechargeSequenceStep === 1) {
        this.contactors.negative = 'Closed';
        if (this._sequenceTimer > 2) {
          this._prechargeSequenceStep = 2;
          this._sequenceTimer = 0;
        }
      } else if (this._prechargeSequenceStep === 2) {
        this.contactors.positive = 'Closed';
        this.contactors.precharge = 'Open';
        this._prechargeSequenceStep = -1;
      }
    }
  }

  _generateAlerts() {
    const alerts = [];

    if (this.soc < 20) {
      alerts.push({
        timestamp: new Date(),
        severity: 'critical',
        type: 'soc',
        message: 'Low SOC - Battery depleting',
        value: this.soc.toFixed(1),
        threshold: 20,
      });
    }

    if (this.tempAvg > 50) {
      alerts.push({
        timestamp: new Date(),
        severity: 'warning',
        type: 'temp',
        message: 'High temperature detected',
        value: this.tempAvg.toFixed(1),
        threshold: 50,
      });
    }

    this.modules.forEach((module) => {
      if (module.rssi < -85) {
        alerts.push({
          timestamp: new Date(),
          severity: 'warning',
          type: 'wireless',
          message: `Low RSSI on ${module.id}`,
          value: module.rssi.toFixed(1),
          threshold: -85,
        });
      }

      if (module.deltaV > 0.1) {
        alerts.push({
          timestamp: new Date(),
          severity: 'info',
          type: 'voltage',
          message: `High cell imbalance on ${module.id}`,
          value: (module.deltaV * 1000).toFixed(1),
          threshold: 100,
        });
      }

      if (module.healthStatus === 'Unhealthy') {
        alerts.push({
          timestamp: new Date(),
          severity: 'critical',
          type: 'wireless',
          message: `${module.id} heartbeat timeout`,
          value: module.lastSeenMs,
          threshold: 10000,
        });
      }
    });

    return alerts.slice(0, 10);
  }

  getSnapshot() {
    return {
      timestamp: new Date(),
      soc: this.soc,
      soh: this.soh,
      voltage: this.voltage,
      current: this.current,
      power: (this.voltage * this.current) / 1000,
      tempAvg: this.tempAvg,
      cycleCount: this.cycleCount,
      modules: this.modules.map(m => ({
        ...m,
        _unhealthyCountdown: undefined,
      })),
      contactors: { ...this.contactors },
      alerts: this.alerts,
    };
  }
}

export function createMockDataGenerator() {
  const simulator = new BatterySimulator();
  const history = [];

  return {
    getData: () => {
      simulator.update();
      const snapshot = simulator.getSnapshot();
      history.push(snapshot);

      if (history.length > 1000) {
        history.shift();
      }

      return {
        current: snapshot,
        history: history.slice(),
      };
    },

    getHistory: () => history.slice(),

    reset: () => {
      history.length = 0;
    },
  };
}
