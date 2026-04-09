/**
 * Data Service - Fetches real BMS data from the API server
 * Live API only (no mock/demo mode)
 */

import axios from 'axios'

// Empty string = relative URLs (goes through same-origin Nginx proxy).
// Fallback to localhost:3002 only for local dev without Docker.
const API_BASE = import.meta.env.VITE_API_URL ?? ''

class DataService {
  constructor() {
    this.apiBase = API_BASE
  }

  normalizeApiBase(url) {
    if (!url || typeof url !== 'string') return API_BASE
    return url.replace(/\/+$/, '')
  }

  setApiBase(url) {
    this.apiBase = this.normalizeApiBase(url)
  }

  getWebSocketUrl() {
    const base = this.normalizeApiBase(this.apiBase)
    if (!base) {
      // Relative mode: derive from current page origin (works with any tunnel URL)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${protocol}//${window.location.host}/ws`
    }
    try {
      const parsed = new URL(base)
      const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${protocol}//${parsed.host}/ws`
    } catch {
      return 'ws://localhost:3002/ws'
    }
  }

  async getCurrentData() {
    try {
      const response = await axios.get(`${this.apiBase}/api/v1/bms/current`)
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
      const response = await axios.get(`${this.apiBase}/api/v1/bms/history`)
      return response.data
    } catch (error) {
      console.error('API history fetch failed:', error.message)
      return []
    }
  }

  async getModuleHistory(moduleId, range = '1h') {
    try {
      const response = await axios.get(`${this.apiBase}/api/v1/bms/modules/${moduleId}/history`, {
        params: { range },
      })
      return response.data
    } catch (error) {
      console.error('API module history fetch failed:', error.message)
      return []
    }
  }

  getMode() {
    return 'influxdb'
  }
}

export default new DataService()
