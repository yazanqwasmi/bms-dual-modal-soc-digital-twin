import React, { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts'

// Custom Tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  
  return (
    <div style={{
      background: 'rgba(20, 20, 30, 0.95)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      padding: '12px 16px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginBottom: '8px' }}>
        {label}
      </div>
      {payload.map((entry, index) => (
        <div key={index} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: index < payload.length - 1 ? '4px' : 0,
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: entry.color,
            boxShadow: `0 0 10px ${entry.color}`,
          }} />
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
            {entry.name}:
          </span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: '12px' }}>
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// Alert Card Component
const AlertCard = ({ alert }) => {
  const getSeverityConfig = (severity) => {
    switch (severity) {
      case 'critical':
        return { color: '#ff4757', bg: 'rgba(255, 71, 87, 0.1)', icon: '🚨' }
      case 'warning':
        return { color: '#ff9f43', bg: 'rgba(255, 159, 67, 0.1)', icon: '⚠️' }
      default:
        return { color: '#00d4ff', bg: 'rgba(0, 212, 255, 0.1)', icon: 'ℹ️' }
    }
  }
  
  const getTypeIcon = (type) => {
    switch (type) {
      case 'voltage': return '⚡'
      case 'temp': return '🌡️'
      case 'wireless': return '📡'
      case 'soc': return '🔋'
      default: return '📋'
    }
  }
  
  const config = getSeverityConfig(alert.severity)
  
  return (
    <div style={{
      background: config.bg,
      border: `1px solid ${config.color}30`,
      borderRadius: '16px',
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '16px',
      transition: 'all 0.2s ease',
      animation: 'fadeIn 0.3s ease-out',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateX(8px)'
      e.currentTarget.style.borderColor = `${config.color}60`
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateX(0)'
      e.currentTarget.style.borderColor = `${config.color}30`
    }}
    >
      {/* Icon */}
      <div style={{
        fontSize: '24px',
        flexShrink: 0,
      }}>
        {config.icon}
      </div>
      
      {/* Content */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span className={`badge badge-${alert.severity === 'critical' ? 'error' : alert.severity}`}>
            {alert.severity.toUpperCase()}
          </span>
          <span style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.5)',
            fontFamily: '"JetBrains Mono", monospace',
          }}>
            {getTypeIcon(alert.type)} {alert.type.toUpperCase()}
          </span>
        </div>
        
        <div style={{
          fontSize: '14px',
          color: 'rgba(255,255,255,0.9)',
          marginBottom: '8px',
          fontWeight: 500,
        }}>
          {alert.message}
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          fontSize: '12px',
          color: 'rgba(255,255,255,0.5)',
        }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            Value: <span style={{ color: config.color }}>{alert.value}</span>
          </span>
          <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            Threshold: {alert.threshold}
          </span>
        </div>
      </div>
      
      {/* Time */}
      <div style={{
        fontSize: '11px',
        color: 'rgba(255,255,255,0.4)',
        fontFamily: '"JetBrains Mono", monospace',
        flexShrink: 0,
      }}>
        {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
    </div>
  )
}

// Stat Card
const StatCard = ({ value, label, icon, color }) => (
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
    e.currentTarget.style.transform = 'translateY(-2px)'
    e.currentTarget.style.borderColor = `${color}40`
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = 'translateY(0)'
    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)'
  }}
  >
    {/* Top accent */}
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '3px',
      background: `linear-gradient(135deg, ${color} 0%, ${color}99 100%)`,
    }} />
    
    {/* Background glow */}
    <div style={{
      position: 'absolute',
      top: '-20px',
      right: '-20px',
      width: '80px',
      height: '80px',
      background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
      pointerEvents: 'none',
    }} />
    
    <div style={{ fontSize: '24px', marginBottom: '12px' }}>{icon}</div>
    
    <div style={{
      fontSize: '32px',
      fontWeight: 800,
      color,
      fontFamily: '"JetBrains Mono", monospace',
      marginBottom: '4px',
    }}>
      {value}
    </div>
    
    <div style={{
      fontSize: '12px',
      color: 'rgba(255,255,255,0.5)',
      textTransform: 'uppercase',
      letterSpacing: '1px',
    }}>
      {label}
    </div>
  </div>
)

// Filter Button
const FilterButton = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      padding: '8px 16px',
      borderRadius: '8px',
      border: active ? '1px solid rgba(0, 255, 136, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
      background: active ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 255, 255, 0.02)',
      color: active ? '#00ff88' : 'rgba(255,255,255,0.6)',
      fontSize: '13px',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    }}
    onMouseEnter={(e) => {
      if (!active) {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
        e.currentTarget.style.color = 'rgba(255,255,255,0.8)'
      }
    }}
    onMouseLeave={(e) => {
      if (!active) {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'
        e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
      }
    }}
  >
    {children}
  </button>
)

export function LogsEventsDashboard({ data }) {
  const [severityFilter, setSeverityFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  if (!data.current) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div className="skeleton" style={{ width: '200px', height: '24px', margin: '0 auto 16px' }} />
        <div className="skeleton" style={{ width: '300px', height: '16px', margin: '0 auto' }} />
      </div>
    )
  }

  const { current } = data
  const alerts = current.alerts || []

  // Filter alerts
  const filteredAlerts = alerts.filter((alert) => {
    const severityMatch = severityFilter === 'all' || alert.severity === severityFilter
    const typeMatch = typeFilter === 'all' || alert.type === typeFilter
    return severityMatch && typeMatch
  })

  // Count by severity
  const severityCounts = {
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    info: alerts.filter(a => a.severity === 'info').length,
  }

  // Pie chart data
  const severityData = [
    { name: 'Critical', value: severityCounts.critical, fill: '#ff4757' },
    { name: 'Warning', value: severityCounts.warning, fill: '#ff9f43' },
    { name: 'Info', value: severityCounts.info, fill: '#00d4ff' },
  ].filter(d => d.value > 0)

  // Timeline data (history items don't carry per-item alerts)
  const timelineData = (data.history || []).slice(-30).map((item) => ({
    time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    critical: (item.alerts || []).filter(a => a.severity === 'critical').length,
    warning: (item.alerts || []).filter(a => a.severity === 'warning').length,
    info: (item.alerts || []).filter(a => a.severity === 'info').length,
  }))

  // Type breakdown
  const typeBreakdown = {}
  alerts.forEach((alert) => {
    typeBreakdown[alert.type] = (typeBreakdown[alert.type] || 0) + 1
  })

  const typeData = Object.entries(typeBreakdown).map(([type, count], idx) => ({
    name: type.charAt(0).toUpperCase() + type.slice(1),
    value: count,
    fill: ['#00ff88', '#00d4ff', '#ffd93d', '#ff9f43', '#a855f7'][idx % 5],
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
            Logs & Events
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
            System alerts, diagnostics, and event history
          </p>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 20px',
          background: severityCounts.critical > 0 
            ? 'rgba(255, 71, 87, 0.1)' 
            : severityCounts.warning > 0 
            ? 'rgba(255, 159, 67, 0.1)' 
            : 'rgba(0, 255, 136, 0.1)',
          border: `1px solid ${severityCounts.critical > 0 
            ? 'rgba(255, 71, 87, 0.2)' 
            : severityCounts.warning > 0 
            ? 'rgba(255, 159, 67, 0.2)' 
            : 'rgba(0, 255, 136, 0.2)'}`,
          borderRadius: '12px',
        }}>
          <span style={{ fontSize: '20px' }}>
            {severityCounts.critical > 0 ? '🚨' : severityCounts.warning > 0 ? '⚠️' : '✅'}
          </span>
          <div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>System Status</div>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: 700, 
              color: severityCounts.critical > 0 ? '#ff4757' : severityCounts.warning > 0 ? '#ff9f43' : '#00ff88',
            }}>
              {severityCounts.critical > 0 ? 'Attention Required' : severityCounts.warning > 0 ? 'Warnings Active' : 'All Systems Normal'}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px',
        marginBottom: '24px',
      }}>
        <StatCard 
          value={severityCounts.critical}
          label="Critical (1h)"
          icon="🚨"
          color="#ff4757"
        />
        <StatCard 
          value={severityCounts.warning}
          label="Warnings (1h)"
          icon="⚠️"
          color="#ff9f43"
        />
        <StatCard 
          value={severityCounts.info}
          label="Info (1h)"
          icon="ℹ️"
          color="#00d4ff"
        />
        <StatCard 
          value={alerts.length}
          label="Total Events"
          icon="📊"
          color="#00ff88"
        />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Timeline */}
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
              Alert Timeline
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={timelineData}>
              <defs>
                <linearGradient id="criticalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff4757" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#ff4757" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="warningGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff9f43" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#ff9f43" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="infoGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#00d4ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
              <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="critical" name="Critical" stackId="1" stroke="#ff4757" fill="url(#criticalGrad)" />
              <Area type="monotone" dataKey="warning" name="Warning" stackId="1" stroke="#ff9f43" fill="url(#warningGrad)" />
              <Area type="monotone" dataKey="info" name="Info" stackId="1" stroke="#00d4ff" fill="url(#infoGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Severity Pie */}
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
              background: 'linear-gradient(135deg, #ff4757 0%, #ff2d4a 100%)',
              borderRadius: '4px',
            }} />
            <span style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
              By Severity
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={severityData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {severityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '12px' }}>
            {severityData.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.fill }} />
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Type Pie */}
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
              background: 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)',
              borderRadius: '4px',
            }} />
            <span style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
              By Type
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={typeData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {typeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '12px' }}>
            {typeData.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.fill }} />
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Severity
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <FilterButton active={severityFilter === 'all'} onClick={() => setSeverityFilter('all')}>All</FilterButton>
            <FilterButton active={severityFilter === 'critical'} onClick={() => setSeverityFilter('critical')}>Critical</FilterButton>
            <FilterButton active={severityFilter === 'warning'} onClick={() => setSeverityFilter('warning')}>Warning</FilterButton>
            <FilterButton active={severityFilter === 'info'} onClick={() => setSeverityFilter('info')}>Info</FilterButton>
          </div>
        </div>
        
        <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.1)' }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Type
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <FilterButton active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>All</FilterButton>
            <FilterButton active={typeFilter === 'voltage'} onClick={() => setTypeFilter('voltage')}>Voltage</FilterButton>
            <FilterButton active={typeFilter === 'temp'} onClick={() => setTypeFilter('temp')}>Temp</FilterButton>
            <FilterButton active={typeFilter === 'wireless'} onClick={() => setTypeFilter('wireless')}>Wireless</FilterButton>
            <FilterButton active={typeFilter === 'soc'} onClick={() => setTypeFilter('soc')}>SOC</FilterButton>
          </div>
        </div>
        
        <div style={{ marginLeft: 'auto', fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
          Showing <span style={{ color: '#00ff88', fontWeight: 600 }}>{filteredAlerts.length}</span> events
        </div>
      </div>

      {/* Event List */}
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
            Event Log
          </span>
        </div>
        
        {filteredAlerts.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '48px 20px',
            color: 'rgba(255,255,255,0.4)',
          }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>✅</span>
            <div style={{ fontSize: '16px', fontWeight: 500, color: 'rgba(255,255,255,0.6)' }}>
              No events matching filters
            </div>
            <div style={{ fontSize: '13px', marginTop: '8px' }}>
              Try adjusting your filter criteria
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxHeight: '500px',
            overflowY: 'auto',
          }}>
            {filteredAlerts.map((alert, idx) => (
              <AlertCard key={idx} alert={alert} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
