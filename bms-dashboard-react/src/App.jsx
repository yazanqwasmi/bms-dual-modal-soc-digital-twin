import React, { useState, useEffect } from 'react'
import dataService from './services/dataService'
import alertNotificationService from './services/alertNotificationService'
import ErrorBoundary from './components/ErrorBoundary'
import { OverviewDashboard } from './components/OverviewDashboard'
import { CellsModulesDashboard } from './components/CellsModulesDashboard'
import { WirelessHealthDashboard } from './components/WirelessHealthDashboard'
import { LogsEventsDashboard } from './components/LogsEventsDashboard'
import { SettingsPanel, loadSettings } from './components/SettingsPanel'
import { DataExportPanel } from './components/DataExportPanel'
import { ContactorsDashboard } from './components/ContactorsDashboard'

// Navigation Tab Component
function NavTab({ active, icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="nav-tab-btn"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        padding: '9px 14px',
        borderRadius: '10px',
        border: 'none',
        background: active
          ? 'linear-gradient(135deg, rgba(0, 255, 136, 0.15) 0%, rgba(0, 255, 136, 0.05) 100%)'
          : 'transparent',
        color: active ? '#00ff88' : 'rgba(255, 255, 255, 0.5)',
        fontSize: '13px',
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)'
        }
      }}
    >
      {active && (
        <div style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: '3px',
          height: '60%',
          background: 'linear-gradient(180deg, #00ff88 0%, #00cc6a 100%)',
          borderRadius: '0 4px 4px 0',
        }} />
      )}
      <span style={{ fontSize: '15px' }}>{icon}</span>
      <span className="nav-tab-label">{label}</span>
    </button>
  )
}

// Action Button Component
function ActionButton({ icon, label, onClick, variant = 'default' }) {
  const variants = {
    default: {
      bg: 'rgba(255, 255, 255, 0.03)',
      border: 'rgba(255, 255, 255, 0.08)',
      hoverBg: 'rgba(255, 255, 255, 0.06)',
      color: 'rgba(255, 255, 255, 0.7)',
    },
    primary: {
      bg: 'rgba(0, 255, 136, 0.1)',
      border: 'rgba(0, 255, 136, 0.2)',
      hoverBg: 'rgba(0, 255, 136, 0.15)',
      color: '#00ff88',
    },
  }
  
  const style = variants[variant]
  
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        borderRadius: '9px',
        border: `1px solid ${style.border}`,
        background: style.bg,
        color: style.color,
        fontSize: '12px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = style.hoverBg
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = style.bg
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

// Connection Status Badge
function ConnectionBadge({ status }) {
  const configs = {
    connected: { color: '#00ff88', label: 'Connected', icon: '●' },
    connecting: { color: '#ffd93d', label: 'Connecting...', icon: '○' },
    error: { color: '#ff4757', label: 'Disconnected', icon: '●' },
  }
  
  const config = configs[status] || configs.error
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 11px',
      borderRadius: '20px',
      background: `${config.color}10`,
      border: `1px solid ${config.color}30`,
    }}>
      <span style={{ 
        color: config.color, 
        fontSize: '10px',
        animation: status === 'connecting' ? 'pulse 2s infinite' : status === 'connected' ? 'pulse 3s infinite' : 'none',
      }}>
        {config.icon}
      </span>
      <span style={{ fontSize: '12px', fontWeight: 500, color: config.color }}>
        {config.label}
      </span>
    </div>
  )
}

function App() {
  const [data, setData] = useState({ current: null, history: [] })
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [settings, setSettings] = useState(loadSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('connecting')

  const applyApiBase = (apiUrl) => {
    if (dataService && typeof dataService.setApiBase === 'function') {
      dataService.setApiBase(apiUrl)
      return
    }

    // Backward compatibility with older/bundled service shapes
    if (dataService && typeof dataService === 'object' && 'apiBase' in dataService) {
      const normalized = (typeof apiUrl === 'string' ? apiUrl : '').replace(/\/+$/, '')
      dataService.apiBase = normalized || 'http://bmsgateway.local:3002'
    }
  }

  // Sync API URL on mount from persisted settings
  useEffect(() => {
    applyApiBase(settings.apiUrl)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize notification service with settings
  useEffect(() => {
    alertNotificationService.updateSettings(settings)
  }, [settings])

  // WebSocket for real-time current data + REST polling for history
  useEffect(() => {
    let historyInterval = null
    let currentInterval = null
    let reconnectTimer = null
    let ws = null
    let wsConnected = false
    let isUnmounted = false

    const applyCurrentData = (newData) => {
      // Don't overwrite good data with an empty/error response
      if (!newData || (Array.isArray(newData.modules) && newData.modules.length === 0 && newData._apiError)) {
        return
      }
      setData(prev => ({ ...prev, current: newData }))
      setLoading(false)
      setError(null)
      if (newData?.alerts) {
        alertNotificationService.processAlerts(newData.alerts)
      }
    }

    const connectWebSocket = () => {
      try {
        setConnectionStatus('connecting')
        const wsUrl = dataService.getWebSocketUrl()
        ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          wsConnected = true
          if (!isUnmounted) {
            setConnectionStatus('connected')
            setError(null)
          }
        }

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data)
            if (payload?.type === 'pack_update' && payload?.data) {
              applyCurrentData(payload.data)
            }
          } catch (parseError) {
            console.error('WebSocket message parse error:', parseError)
          }
        }

        ws.onerror = (err) => {
          console.error('WebSocket error:', err)
        }

        ws.onclose = () => {
          wsConnected = false
          if (isUnmounted) return
          setConnectionStatus('error')
          reconnectTimer = setTimeout(connectWebSocket, 3000)
        }
      } catch (err) {
        console.error('WebSocket connection failed:', err)
        wsConnected = false
        if (!isUnmounted) {
          setConnectionStatus('error')
          reconnectTimer = setTimeout(connectWebSocket, 3000)
        }
      }
    }

    // Initial fetch via REST (current + history)
    const fetchInitial = async () => {
      try {
        const [newData, historyData] = await Promise.all([
          dataService.getCurrentData(),
          dataService.getHistoryData(),
        ])
        setData({ current: newData, history: historyData })
        setLoading(false)
        setError(null)
        if (newData?.alerts) {
          alertNotificationService.processAlerts(newData.alerts)
        }
      } catch (err) {
        console.error('Initial data fetch error:', err)
        setError(err.message)
        setLoading(false)
      }
    }

    fetchInitial()

    connectWebSocket()

    // Poll current snapshot
    const fetchCurrent = async () => {
      if (wsConnected) return
      try {
        const currentData = await dataService.getCurrentData()
        applyCurrentData(currentData)
      } catch (err) {
        console.error('Current data fetch error:', err)
      }
    }
    currentInterval = setInterval(fetchCurrent, settings.refreshInterval)

    // Poll history less frequently (every 15s) since WebSocket handles current
    const fetchHistory = async () => {
      try {
        const historyData = await dataService.getHistoryData()
        setData(prev => ({ ...prev, history: historyData }))
      } catch (err) {
        console.error('History fetch error:', err)
      }
    }
    historyInterval = setInterval(fetchHistory, 15000)

    return () => {
      isUnmounted = true
      if (currentInterval) clearInterval(currentInterval)
      if (historyInterval) clearInterval(historyInterval)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close()
      }
    }
  }, [settings.refreshInterval, settings.apiUrl])

  const handleSettingsChange = (newSettings) => {
    setSettings(newSettings)
    applyApiBase(newSettings.apiUrl)
    alertNotificationService.updateSettings(newSettings)
  }

  if (loading) {
    return (
      <div style={{ 
        background: 'linear-gradient(135deg, #0a0a0f 0%, #12121a 50%, #0a0a0f 100%)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#e0e0e0'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '72px', 
            marginBottom: '24px',
            animation: 'pulse 2s infinite',
          }}>⚡</div>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 700,
            marginBottom: '12px',
            background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            BMS Telemetry Dashboard
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
            Initializing systems...
          </p>
          <div style={{
            marginTop: '32px',
            width: '200px',
            height: '3px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '3px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: '50%',
              height: '100%',
              background: 'linear-gradient(90deg, #00ff88, #00cc6a)',
              borderRadius: '3px',
              animation: 'shimmer 1.5s infinite',
            }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary fallbackMessage="Dashboard crashed. Please refresh the page.">
      <div style={{ 
        background: 'linear-gradient(135deg, #0a0a0f 0%, #12121a 50%, #0a0a0f 100%)',
        minHeight: '100vh',
        position: 'relative',
      }}>
        {/* Animated Background Grid */}
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        {/* Header */}
        <header style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(10, 10, 15, 0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}>
          <div
            className="app-header-inner"
            style={{
              maxWidth: '1600px',
              margin: '0 auto',
              padding: '12px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            {/* Logo & Brand — on mobile this row also holds the settings icon */}
            <div className="app-header-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.2) 0%, rgba(0, 255, 136, 0.05) 100%)',
                  border: '1px solid rgba(0, 255, 136, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '19px',
                }}>
                  ⚡
                </div>
                <div>
                  <h1 style={{
                    fontSize: '17px',
                    fontWeight: 800,
                    margin: 0,
                    background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}>
                    BMS Dashboard
                  </h1>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                    Battery Telemetry System
                  </div>
                </div>
              </div>

              <ConnectionBadge status={connectionStatus} />

              {/* Mobile-only settings button */}
              <button
                className="app-header-mobile-settings"
                onClick={() => setShowSettings(true)}
                style={{
                  display: 'none',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '18px',
                  cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                ⚙️
              </button>
            </div>

            {/* Navigation Tabs */}
            <nav
              className="app-header-nav"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                padding: '4px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.04)',
              }}
            >
              <NavTab
                active={activeTab === 'overview'}
                icon="📊"
                label="Overview"
                onClick={() => setActiveTab('overview')}
              />
              <NavTab
                active={activeTab === 'cells'}
                icon="🔋"
                label="Cells & Modules"
                onClick={() => setActiveTab('cells')}
              />
              <NavTab
                active={activeTab === 'wireless'}
                icon="📡"
                label="Wireless"
                onClick={() => setActiveTab('wireless')}
              />
              <NavTab
                active={activeTab === 'contactors'}
                icon="🔌"
                label="Contactors"
                onClick={() => setActiveTab('contactors')}
              />
              <NavTab
                active={activeTab === 'logs'}
                icon="📋"
                label="Events"
                onClick={() => setActiveTab('logs')}
              />
            </nav>

            {/* Action Buttons */}
            <div className="app-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ActionButton
                icon="📥"
                label="Export"
                onClick={() => setShowExport(true)}
              />
              <ActionButton
                icon="⚙️"
                label="Settings"
                onClick={() => setShowSettings(true)}
              />
              <div style={{
                padding: '6px 11px',
                borderRadius: '8px',
                background: 'rgba(0, 255, 136, 0.1)',
                border: '1px solid rgba(0, 255, 136, 0.2)',
                fontSize: '12px',
                fontWeight: 500,
                color: '#00ff88',
              }}>
                🔌 Live Data
              </div>
            </div>
          </div>
        </header>

        {/* Error Banner */}
        {error && (
          <div style={{
            background: 'rgba(255, 71, 87, 0.1)',
            borderBottom: '1px solid rgba(255, 71, 87, 0.2)',
            padding: '12px 32px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
          }}>
            <span style={{ fontSize: '16px' }}>⚠️</span>
            <span style={{ color: '#ff4757', fontSize: '14px' }}>
              Connection Error: {error}
            </span>
            <span style={{ 
              fontSize: '12px', 
              color: 'rgba(255,255,255,0.4)',
              padding: '4px 10px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '4px',
            }}>
              Retrying every {settings.refreshInterval / 1000}s
            </span>
          </div>
        )}

        {/* Main Content */}
        <main style={{ position: 'relative', zIndex: 1 }}>
          <ErrorBoundary fallbackMessage="This dashboard component encountered an error.">
            {activeTab === 'overview' && <OverviewDashboard data={data} settings={settings} />}
            {activeTab === 'cells' && <CellsModulesDashboard data={data} settings={settings} />}
            {activeTab === 'wireless' && <WirelessHealthDashboard data={data} settings={settings} />}
            {activeTab === 'contactors' && <ContactorsDashboard data={data} settings={settings} />}
            {activeTab === 'logs' && <LogsEventsDashboard data={data} settings={settings} />}
          </ErrorBoundary>
        </main>

        {/* Footer */}
        <footer style={{
          padding: '24px 32px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.3)',
          fontSize: '12px',
        }}>
          <div>BMS Telemetry Dashboard v2.0 • Built with React + Recharts</div>
        </footer>

        {/* Modals */}
        <SettingsPanel
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          settings={settings}
          onSettingsChange={handleSettingsChange}
        />
        <DataExportPanel
          isOpen={showExport}
          onClose={() => setShowExport(false)}
          apiUrl={settings.apiUrl}
        />
      </div>
    </ErrorBoundary>
  )
}

export default App
