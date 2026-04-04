import React, { useMemo } from 'react'
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// Circular Gauge Component
const CircularGauge = ({ value, max = 100, label, color, size = 160 }) => {
  const strokeWidth = 14
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const safeValue = Math.min(Math.max(Number(value) || 0, 0), max)
  const percentage = safeValue / max
  const offset = circumference * (1 - percentage)
  
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={`gauge-gradient-${label.replace(/\s/g, '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="50%" stopColor={color} stopOpacity="0.8" />
            <stop offset="100%" stopColor={color} stopOpacity="0.4" />
          </linearGradient>
          <filter id={`glow-${label.replace(/\s/g, '')}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#gauge-gradient-${label.replace(/\s/g, '')})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          filter={`url(#glow-${label.replace(/\s/g, '')})`}
          style={{ 
            transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
        {/* Glow effect circle (behind) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth + 8}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          opacity="0.15"
          style={{ 
            transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </svg>
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{
          fontSize: size / 4,
          fontWeight: 800,
          background: `linear-gradient(135deg, ${color} 0%, white 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1,
        }}>
          {safeValue.toFixed(1)}
        </span>
        <span style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.5)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginTop: 4,
        }}>
          {label}
        </span>
      </div>
    </div>
  )
}

// Stat Card Component
const StatCard = ({ label, value, unit, icon, color, trend, subtitle }) => {
  const colorMap = {
    green: { gradient: 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)', glow: 'rgba(0, 255, 136, 0.2)', dim: 'rgba(0, 255, 136, 0.1)' },
    blue: { gradient: 'linear-gradient(135deg, #3498ff 0%, #0066ff 100%)', glow: 'rgba(52, 152, 255, 0.2)', dim: 'rgba(52, 152, 255, 0.1)' },
    orange: { gradient: 'linear-gradient(135deg, #ff9f43 0%, #ff6b35 100%)', glow: 'rgba(255, 159, 67, 0.2)', dim: 'rgba(255, 159, 67, 0.1)' },
    red: { gradient: 'linear-gradient(135deg, #ff4757 0%, #ff2d4a 100%)', glow: 'rgba(255, 71, 87, 0.2)', dim: 'rgba(255, 71, 87, 0.1)' },
    purple: { gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', glow: 'rgba(168, 85, 247, 0.2)', dim: 'rgba(168, 85, 247, 0.1)' },
    cyan: { gradient: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)', glow: 'rgba(0, 212, 255, 0.2)', dim: 'rgba(0, 212, 255, 0.1)' },
    yellow: { gradient: 'linear-gradient(135deg, #ffd93d 0%, #ffb800 100%)', glow: 'rgba(255, 217, 61, 0.2)', dim: 'rgba(255, 217, 61, 0.1)' },
  }
  
  const colors = colorMap[color] || colorMap.green

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.02)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: '16px',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
      cursor: 'default',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-4px)'
      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'
      e.currentTarget.style.boxShadow = `0 20px 40px rgba(0,0,0,0.3), 0 0 30px ${colors.glow}`
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)'
      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)'
      e.currentTarget.style.boxShadow = 'none'
    }}
    >
      {/* Top gradient line */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: colors.gradient,
      }} />
      
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        right: '-20%',
        width: '150px',
        height: '150px',
        background: `radial-gradient(circle, ${colors.dim} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Icon */}
      <div style={{
        fontSize: '24px',
        marginBottom: '12px',
        filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.3))',
      }}>
        {icon}
      </div>

      {/* Label */}
      <div style={{
        fontSize: '11px',
        fontWeight: 600,
        color: 'rgba(255, 255, 255, 0.4)',
        textTransform: 'uppercase',
        letterSpacing: '1.5px',
        marginBottom: '8px',
      }}>
        {label}
      </div>

      {/* Value */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '4px',
      }}>
        <span style={{
          fontSize: '32px',
          fontWeight: 800,
          background: colors.gradient,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1,
          fontFeatureSettings: '"tnum" 1',
        }}>
          {value}
        </span>
        {unit && (
          <span style={{
            fontSize: '14px',
            fontWeight: 500,
            color: 'rgba(255, 255, 255, 0.5)',
          }}>
            {unit}
          </span>
        )}
      </div>

      {/* Subtitle or trend */}
      {(subtitle || trend) && (
        <div style={{
          marginTop: '8px',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.4)',
        }}>
          {trend && (
            <span style={{ color: trend > 0 ? '#00ff88' : '#ff4757', marginRight: '4px' }}>
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
          {subtitle}
        </div>
      )}
    </div>
  )
}

// Custom Tooltip for Charts
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

export function OverviewDashboard({ data }) {
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
  const hasData = (current.modules || []).some(m => m.connected)
  const isHealthy = hasData && current.voltage > 46
  const isWarning = hasData && current.voltage > 44 && current.voltage <= 46
  const isOffline = !hasData
  
  // Prepare chart data with more points for smoother curves
  const historyData = useMemo(() => 
    (data.history || []).slice(-100).map((item, idx) => ({
      time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      soc: parseFloat(item.soc.toFixed(1)),
      current: parseFloat(item.current.toFixed(1)),
      temp: parseFloat(item.tempAvg.toFixed(1)),
      voltage: parseFloat((item.voltage || 0).toFixed(2)),
    })), [data.history]
  )

  const cellVoltages = (current.modules || []).flatMap(m => (m.cells || []).map(c => c.voltage))
  const minCellV = cellVoltages.length > 0 ? Math.min(...cellVoltages) : 0
  const maxCellV = cellVoltages.length > 0 ? Math.max(...cellVoltages) : 0
  const deltaV = (maxCellV - minCellV) * 1000

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
            Battery Pack Overview
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
            Real-time monitoring • 3 Modules • 12 Cells
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: isOffline ? 'rgba(150, 150, 150, 0.1)' : isHealthy ? 'rgba(0, 255, 136, 0.1)' : isWarning ? 'rgba(255, 159, 67, 0.1)' : 'rgba(255, 71, 87, 0.1)',
            border: `1px solid ${isOffline ? 'rgba(150, 150, 150, 0.3)' : isHealthy ? 'rgba(0, 255, 136, 0.3)' : isWarning ? 'rgba(255, 159, 67, 0.3)' : 'rgba(255, 71, 87, 0.3)'}`,
            borderRadius: '9999px',
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isOffline ? '#999' : isHealthy ? '#00ff88' : isWarning ? '#ff9f43' : '#ff4757',
              boxShadow: isOffline ? 'none' : `0 0 15px ${isHealthy ? '#00ff88' : isWarning ? '#ff9f43' : '#ff4757'}`,
              animation: isOffline ? 'none' : 'pulse-dot 2s infinite',
            }} />
            <span style={{
              fontSize: '13px',
              fontWeight: 600,
              color: isOffline ? '#999' : isHealthy ? '#00ff88' : isWarning ? '#ff9f43' : '#ff4757',
            }}>
              {isOffline ? 'No Data' : isHealthy ? 'Healthy' : isWarning ? 'Warning' : 'Critical'}
            </span>
          </div>
          <div style={{ textAlign: 'right', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
            <div>Last update</div>
            <div style={{ color: 'rgba(255,255,255,0.7)' }}>
              {new Date(current.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {/* Main Gauges */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '24px',
        marginBottom: '32px',
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '24px',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transition: 'all 0.3s ease',
        }}>
          <CircularGauge value={current.soc} max={100} label="SOC %" color="#00ff88" size={180} />
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              State of Charge
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '24px',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <CircularGauge value={current.soh} max={100} label="SOH %" color="#3498ff" size={180} />
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              State of Health
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '24px',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <CircularGauge value={current.voltage} max={60} label="VOLTS" color="#a855f7" size={180} />
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Pack Voltage
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '24px',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <CircularGauge value={current.tempAvg} max={80} label="°C" color="#ff9f43" size={180} />
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Temperature
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px',
        marginBottom: '32px',
      }}>
        <StatCard

          label="Current"
          value={current.current.toFixed(1)}
          unit="A"
          color={current.current > 0 ? 'orange' : 'cyan'}
          subtitle={current.current > 0 ? 'Discharging' : 'Charging'}
        />
        <StatCard

          label="Power"
          value={(current.power / 1000).toFixed(2)}
          unit="kW"
          color="purple"
        />
        <StatCard

          label="Cell Range"
          value={`${minCellV.toFixed(3)} - ${maxCellV.toFixed(3)}`}
          unit="V"
          color="blue"
        />
        <StatCard

          label="Delta-V"
          value={deltaV.toFixed(1)}
          unit="mV"
          color={deltaV > 50 ? 'red' : deltaV > 30 ? 'orange' : 'green'}
        />
      </div>

      {/* Charts Section */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '24px',
        padding: '24px',
        marginBottom: '24px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '4px',
              height: '24px',
              background: 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)',
              borderRadius: '4px',
            }} />
            <span style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.9)',
            }}>
              SOC & Current History
            </span>
          </div>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
            Last 8 minutes
          </span>
        </div>
        
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={historyData}>
            <defs>
              <linearGradient id="socGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00ff88" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#00ff88" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="currentGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3498ff" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3498ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis 
              dataKey="time" 
              stroke="rgba(255,255,255,0.3)" 
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <YAxis 
              yAxisId="left"
              stroke="rgba(255,255,255,0.3)" 
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="rgba(255,255,255,0.3)" 
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) => <span style={{ color: 'rgba(255,255,255,0.7)' }}>{value}</span>}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="soc"
              name="SOC %"
              stroke="#00ff88"
              strokeWidth={2}
              fill="url(#socGradient)"
              dot={false}
              activeDot={{ r: 6, fill: '#00ff88', stroke: '#000', strokeWidth: 2 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="current"
              name="Current A"
              stroke="#3498ff"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: '#3498ff', stroke: '#000', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Two Column Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
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
              background: 'linear-gradient(135deg, #ff9f43 0%, #ff6b35 100%)',
              borderRadius: '4px',
            }} />
            <span style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
              Temperature Trend
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={historyData}>
              <defs>
                <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff9f43" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#ff9f43" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
              <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="temp"
                name="Temp °C"
                stroke="#ff9f43"
                strokeWidth={2}
                fill="url(#tempGradient)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

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
              Voltage Trend
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={historyData}>
              <defs>
                <linearGradient id="voltGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
              <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="voltage"
                name="Voltage V"
                stroke="#a855f7"
                strokeWidth={2}
                fill="url(#voltGradient)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alerts Section */}
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
            background: alerts.length > 0 
              ? 'linear-gradient(135deg, #ff4757 0%, #ff2d4a 100%)' 
              : 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)',
            borderRadius: '4px',
          }} />
          <span style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            Active Alerts
          </span>
          {alerts.length > 0 && (
            <span style={{
              background: 'rgba(255, 71, 87, 0.2)',
              color: '#ff4757',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
            }}>
              {alerts.length}
            </span>
          )}
        </div>
        
        {alerts.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: 'rgba(255,255,255,0.4)',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
            <div style={{ fontSize: '16px', color: '#00ff88' }}>All Systems Normal</div>
            <div style={{ fontSize: '13px', marginTop: '8px' }}>No active alerts at this time</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {alerts.slice(0, 5).map((alert, idx) => (
              <div 
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  background: alert.severity === 'critical' 
                    ? 'rgba(255, 71, 87, 0.1)' 
                    : alert.severity === 'warning'
                    ? 'rgba(255, 159, 67, 0.1)'
                    : 'rgba(52, 152, 255, 0.1)',
                  border: `1px solid ${
                    alert.severity === 'critical' 
                      ? 'rgba(255, 71, 87, 0.2)' 
                      : alert.severity === 'warning'
                      ? 'rgba(255, 159, 67, 0.2)'
                      : 'rgba(52, 152, 255, 0.2)'
                  }`,
                  borderRadius: '12px',
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: alert.severity === 'critical' 
                    ? 'rgba(255, 71, 87, 0.2)' 
                    : alert.severity === 'warning'
                    ? 'rgba(255, 159, 67, 0.2)'
                    : 'rgba(52, 152, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                }}>
                  {alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>{alert.message}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                    {new Date(alert.timestamp).toLocaleTimeString()} • Value: {alert.value}
                  </div>
                </div>
                <span className={`badge badge-${alert.severity}`}>
                  {alert.severity.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
