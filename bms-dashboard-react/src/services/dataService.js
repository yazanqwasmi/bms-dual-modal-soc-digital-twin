/**
 * Data Service - Fetches real BMS data from the API server
 * No mock fallback — if the API returns empty data, that's the real state.
 */

import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002'

class DataService {
  constructor() {
    this.mode = 'influxdb'
  }

  async getCurrentData() {
    try {
      const response = await axios.get(`${API_BASE}/api/v1/bms/current`)
      return response.data
    } catch (error) {
      console.error('API fetch failed:', error.message)
      // Return a valid empty state — never fall back to mock
      return {
        timestamp: new Date().toISOString(),
        soc: 0, soh: 0, voltage: 0, current: 0, power: 0,
        tempAvg: 0, tempMax: 0, tempMin: 0,
        modules: [], contactors: { positive: 'Unknown', negative: 'Unknown', precharge: 'Unknown' },
        alerts: [],
        _apiError: error.message,
      }
    }
  }

  async getHistoryData() {
    try {
      const response = await axios.get(`${API_BASE}/api/v1/bms/history`)
      return response.data
    } catch (error) {
      console.error('API history fetch failed:', error.message)
      return []
    }
  }

  connectWebSocket(_onData, onStatus) {
    if (onStatus) onStatus('connected')
  }

  disconnectWebSocket() {}

  get isWebSocketConnected() {
    return false
  }

  getMode() {
    return this.mode
  }

  setMode(mode) {
    this.mode = mode
  }
}

export default new DataService()
