import React from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts'
import { CustomTooltip, StatCard } from './shared.jsx'

// Signal Strength Indicator
const SignalStrengthIndicator = ({ rssi, size = 'md' }) => {
  const bars = 5
  const getActiveBars = (rssi) => {
    if (rssi >= -50) return 5
    if (rssi >= -60) return 4
    if (rssi >= -70) return 3
    if (rssi >= -80) return 2
    return 1
  }
  
  const activeBars = getActiveBars(rssi)
  const sizeConfig = {
    sm: { height: 20, width: 3, gap: 2 },
    md: { height: 30, width: 4, gap: 3 },
    lg: { height: 40, width: 5, gap: 4 },
  }
  
  const { height, width, gap } = sizeConfig[size]
  const color = activeBars >= 4 ? '#00ff88' : activeBars >= 3 ? '#ffd93d' : activeBars >= 2 ? '#ff9f43' : '#ff4757'
  
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: `${gap}px` }}>
      {[...Array(bars)].map((_, i) => (
        <div
          key={i}
          style={{
            width: `${width}px`,
            height: `${((i + 1) / bars) * height}px`,
            borderRadius: '2px',
            background: i < activeBars ? color : 'rgba(255,255,255,0.1)',
            boxShadow: i < activeBars ? `0 0 8px ${color}60` : 'none',
            transition: 'all 0.3s ease',
          }}
        />
      ))}
    </div>
  )
}

// Module Health Card
const ModuleHealthCard = ({ module, index }) => {
  const rssiColor = module.rssi > -65 ? '#00ff88' : module.rssi > -75 ? '#ff9f43' : '#ff4757'
  const lossColor = module.packetLoss < 1 ? '#00ff88' : module.packetLoss < 3 ? '#ff9f43' : '#ff4757'
  const healthScore = Math.max(0, 100 - module.packetLoss * 10 - Math.max(0, (-module.rssi - 60) * 2))
  
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: '16px',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-4px)'
      e.currentTarget.style.boxShadow = '0 10px 40px rgba(0, 255, 136, 0.1)'
      e.currentTarget.style.borderColor = 'rgba(0, 255, 136, 0.2)'
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)'
      e.currentTarget.style.boxShadow = 'none'
      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)'
    }}
    >
      {/* Gradient bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: healthScore > 80 
          ? 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)'
          : healthScore > 50 
          ? 'linear-gradient(135deg, #ff9f43 0%, #ff6b35 100%)'
          : 'linear-gradient(135deg, #ff4757 0%, #ff2d4a 100%)',
      }} />
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <div style={{
            fontSize: '16px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.9)',
            marginBottom: '4px',
          }}>
            {module.id}
          </div>
          <div style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.4)',
          }}>
            Health Score: <span style={{ color: healthScore > 80 ? '#00ff88' : healthScore > 50 ? '#ff9f43' : '#ff4757', fontWeight: 600 }}>{healthScore.toFixed(0)}%</span>
          </div>
        </div>
        <SignalStrengthIndicator rssi={module.rssi} />
      </div>
      
      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
            RSSI
          </div>
          <div style={{
            fontSize: '20px',
            fontWeight: 700,
            color: rssiColor,
            fontFamily: '"JetBrains Mono", monospace',
          }}>
            {module.rssi.toFixed(0)}<span style={{ fontSize: '12px', opacity: 0.7 }}>dBm</span>
          </div>
        </div>
        
        <div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
            Packet Loss
          </div>
          <div style={{
            fontSize: '20px',
            fontWeight: 700,
            color: lossColor,
            fontFamily: '"JetBrains Mono", monospace',
          }}>
            {module.packetLoss.toFixed(2)}<span style={{ fontSize: '12px', opacity: 0.7 }}>%</span>
          </div>
        </div>
        
        <div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
            Latency
          </div>
          <div style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'rgba(255,255,255,0.7)',
          }}>
            {module.latency.toFixed(1)}ms
          </div>
        </div>
        
        <div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
            Status
          </div>
          <span className={`badge badge-${healthScore > 80 ? 'success' : healthScore > 50 ? 'warning' : 'error'}`}>
            {healthScore > 80 ? 'EXCELLENT' : healthScore > 50 ? 'FAIR' : 'POOR'}
          </span>
        </div>
      </div>
      
      {/* Quality Bar */}
      <div style={{ marginTop: '16px' }}>
        <div style={{
          height: '4px',
          borderRadius: '2px',
          background: 'rgba(255,255,255,0.1)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${healthScore}%`,
            borderRadius: '2px',
            background: healthScore > 80 
              ? 'linear-gradient(90deg, #00ff88 0%, #00cc6a 100%)'
              : healthScore > 50 
              ? 'linear-gradient(90deg, #ff9f43 0%, #ff6b35 100%)'
              : 'linear-gradient(90deg, #ff4757 0%, #ff2d4a 100%)',
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>
    </div>
  )
}

export function WirelessHealthDashboard({ data }) {
  if (!data.current) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div className="skeleton" style={{ width: '200px', height: '24px', margin: '0 auto 16px' }} />
        <div className="skeleton" style={{ width: '300px', height: '16px', margin: '0 auto' }} />
      </div>
    )
  }

  const { current } = data

  // Calculate overall metrics (guard against empty/disconnected modules)
  const modules = current.modules || []
  const connectedModules = modules.filter(m => m.connected)
  const modCount = connectedModules.length || 1
  const avgRssi = connectedModules.reduce((sum, m) => sum + (m.rssi || 0), 0) / modCount
  const avgPacketLoss = connectedModules.reduce((sum, m) => sum + (m.packetLoss || 0), 0) / modCount
  const avgLatency = connectedModules.reduce((sum, m) => sum + (m.latency || 0), 0) / modCount
  const worstRssi = connectedModules.length > 0 ? Math.min(...connectedModules.map(m => m.rssi || 0)) : 0
  const maxPacketLoss = connectedModules.length > 0 ? Math.max(...connectedModules.map(m => m.packetLoss || 0)) : 0

  // Prepare history data (history items are pack-level, no per-module breakdown)
  const historyData = (data.history || []).slice(-60).map((item) => ({
    time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    avgRssi: Math.abs(avgRssi).toFixed(1),
    avgLoss: avgPacketLoss.toFixed(2),
    avgLatency: avgLatency.toFixed(1),
  }))

  // Radar chart data
  const radarData = modules.map((m, idx) => ({
    subject: m.id,
    signalQuality: Math.max(0, 100 + m.rssi + 50),
    reliability: Math.max(0, 100 - m.packetLoss * 20),
    fullMark: 100,
  }))

  return (
    <div className="container" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px',
      }}>
        <div>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 800,
            marginBottom: '8px',
            background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Wireless Health
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
            Monitor RF signal quality and packet transmission metrics
          </p>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 20px',
          background: avgPacketLoss < 1 ? 'rgba(0, 255, 136, 0.1)' : avgPacketLoss < 3 ? 'rgba(255, 159, 67, 0.1)' : 'rgba(255, 71, 87, 0.1)',
          border: `1px solid ${avgPacketLoss < 1 ? 'rgba(0, 255, 136, 0.2)' : avgPacketLoss < 3 ? 'rgba(255, 159, 67, 0.2)' : 'rgba(255, 71, 87, 0.2)'}`,
          borderRadius: '12px',
        }}>
          <SignalStrengthIndicator rssi={avgRssi} size="lg" />
          <div style={{ marginLeft: '8px' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Network Status</div>
            <div style={{ 
              fontSize: '16px', 
              fontWeight: 700, 
              color: avgPacketLoss < 1 ? '#00ff88' : avgPacketLoss < 3 ? '#ff9f43' : '#ff4757',
            }}>
              {avgPacketLoss < 1 ? 'Excellent' : avgPacketLoss < 3 ? 'Fair' : 'Poor'}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px',
        marginBottom: '24px',
      }}>
        <StatCard 
          title="Average RSSI"
          value={avgRssi.toFixed(0)}
          unit="dBm"
          icon="📶"
          color={avgRssi > -65 ? '#00ff88' : avgRssi > -75 ? '#ff9f43' : '#ff4757'}
        />
        <StatCard 
          title="Packet Loss"
          value={avgPacketLoss.toFixed(2)}
          unit="%"
          icon="📦"
          color={avgPacketLoss < 1 ? '#00ff88' : avgPacketLoss < 3 ? '#ff9f43' : '#ff4757'}
        />
        <StatCard 
          title="Avg Latency"
          value={avgLatency.toFixed(1)}
          unit="ms"
          icon="⏱️"
          color={avgLatency < 50 ? '#00ff88' : avgLatency < 100 ? '#ff9f43' : '#ff4757'}
        />
        <StatCard 
          title="Max Packet Loss"
          value={maxPacketLoss.toFixed(2)}
          unit="%"
          icon="⚠️"
          color={maxPacketLoss < 2 ? '#00ff88' : maxPacketLoss < 5 ? '#ff9f43' : '#ff4757'}
        />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Signal History */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '24px',
          padding: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{
              width: '4px',
              height: '24px',
              background: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)',
              borderRadius: '4px',
            }} />
            <span style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
              Network History
            </span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={historyData}>
              <defs>
                <linearGradient id="rssiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#00d4ff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff4757" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#ff4757" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
              <YAxis yAxisId="left" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="avgRssi"
                name="RSSI |dBm|"
                stroke="#00d4ff"
                strokeWidth={2}
                fill="url(#rssiGradient)"
                dot={false}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="avgLoss"
                name="Packet Loss %"
                stroke="#ff4757"
                strokeWidth={2}
                fill="url(#lossGradient)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Radar Chart */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '24px',
          padding: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{
              width: '4px',
              height: '24px',
              background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
              borderRadius: '4px',
            }} />
            <span style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
              Module Radar
            </span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
              <PolarRadiusAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} />
              <Radar 
                name="Signal Quality" 
                dataKey="signalQuality" 
                stroke="#00ff88" 
                fill="#00ff88" 
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Radar 
                name="Reliability" 
                dataKey="reliability" 
                stroke="#00d4ff" 
                fill="#00d4ff" 
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Module Health Cards Grid */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '24px',
        padding: '24px',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            width: '4px',
            height: '24px',
            background: 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)',
            borderRadius: '4px',
          }} />
          <span style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            Module Signal Status
          </span>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
        }}>
          {modules.map((module, idx) => (
            <ModuleHealthCard key={idx} module={module} index={idx} />
          ))}
        </div>
      </div>

      {/* Connection Quality Legend */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '16px',
        padding: '20px',
        display: 'flex',
        justifyContent: 'center',
        gap: '48px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{
                width: '4px',
                height: `${i * 5}px`,
                borderRadius: '2px',
                background: '#00ff88',
              }} />
            ))}
          </div>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
            Excellent (-50 dBm or better)
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                width: '4px',
                height: `${i * 5 + 5}px`,
                borderRadius: '2px',
                background: '#ff9f43',
              }} />
            ))}
            {[4, 5].map(i => (
              <div key={i} style={{
                width: '4px',
                height: `${i * 5}px`,
                borderRadius: '2px',
                background: 'rgba(255,255,255,0.1)',
              }} />
            ))}
          </div>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
            Fair (-70 to -80 dBm)
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px' }}>
            <div style={{
              width: '4px',
              height: '5px',
              borderRadius: '2px',
              background: '#ff4757',
            }} />
            {[2, 3, 4, 5].map(i => (
              <div key={i} style={{
                width: '4px',
                height: `${i * 5}px`,
                borderRadius: '2px',
                background: 'rgba(255,255,255,0.1)',
              }} />
            ))}
          </div>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
            Poor (-80 dBm or worse)
          </span>
        </div>
      </div>
    </div>
  )
}
