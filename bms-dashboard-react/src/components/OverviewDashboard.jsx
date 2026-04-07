import React, { useMemo } from 'react'
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { CustomTooltip, StatCard } from './shared.jsx'

const SHOW_SOC_CORRECTION_DEMO = import.meta.env.VITE_ENABLE_SOC_CORRECTION_DEMO === 'true'

// Circular Gauge Component — uses viewBox so it scales with CSS width
const GAUGE_SIZE = 160
const CircularGauge = ({ value, max = 100, label, color }) => {
  const size = GAUGE_SIZE
  const strokeWidth = 12
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const safeValue = Math.min(Math.max(Number(value) || 0, 0), max)
  const percentage = safeValue / max
  const offset = circumference * (1 - percentage)
  const labelId = label.replace(/\s/g, '')

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: size, aspectRatio: '1 / 1' }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        height="100%"
        style={{ transform: 'rotate(-90deg)', display: 'block' }}
      >
        <defs>
          <linearGradient id={`gauge-gradient-${labelId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="50%" stopColor={color} stopOpacity="0.8" />
            <stop offset="100%" stopColor={color} stopOpacity="0.4" />
          </linearGradient>
          <filter id={`glow-${labelId}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={`url(#gauge-gradient-${labelId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          filter={`url(#glow-${labelId})`}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth + 8}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          opacity="0.15"
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
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
          fontSize: 'clamp(22px, 8vw, 45px)',
          fontWeight: 800,
          background: `linear-gradient(135deg, ${color} 0%, white 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1,
        }}>
          {safeValue.toFixed(1)}
        </span>
        <span style={{
          fontSize: 'clamp(9px, 2.5vw, 11px)',
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
  const socModels = current.socModels || {
    narx: Number(current.soc || 0),
    lstm: null,
    final: Number(current.soc || 0),
    delta: 0,
    corrected: false,
  }
  const hasData = (current.modules || []).some(m => m.connected)
  const isHealthy = hasData && current.voltage > 46
  const isWarning = hasData && current.voltage > 44 && current.voltage <= 46
  const isOffline = !hasData
  const socCorrectionApplied = socModels.corrected === true
  const socDeltaColor = socModels.delta > 0 ? '#00ff88' : socModels.delta < 0 ? '#ff9f43' : 'rgba(255,255,255,0.6)'
  
  // Prepare chart data with more points for smoother curves
  const historyData = useMemo(() => 
    (data.history || []).slice(-100).map((item, idx) => ({
      time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      soc: parseFloat(item.soc.toFixed(1)),
      current: parseFloat(item.current.toFixed(1)),
      temp: parseFloat(item.tempAvg.toFixed(1)),
      voltage: parseFloat((item.voltage || 0).toFixed(2)),
      socDelta: parseFloat((item.socCorrectionDelta || 0).toFixed(2)),
      socCorrected: Boolean(item.socCorrected),
    })), [data.history]
  )

  const cellVoltages = (current.modules || []).flatMap(m => (m.cells || []).map(c => c.voltage))
  const minCellV = cellVoltages.length > 0 ? Math.min(...cellVoltages) : 0
  const maxCellV = cellVoltages.length > 0 ? Math.max(...cellVoltages) : 0
  const deltaV = (maxCellV - minCellV) * 1000

  return (
    <div className="container" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Header */}
      <div className="overview-section-header" style={{
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
          {socModels.corrected && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              background: 'rgba(52, 152, 255, 0.12)',
              border: '1px solid rgba(52, 152, 255, 0.32)',
              borderRadius: '9999px',
            }}>
              <span style={{ fontSize: '12px' }}>🧠</span>
              <span style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#7cc4ff',
                letterSpacing: '0.3px',
              }}>
                LSTM correction active
              </span>
            </div>
          )}
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

      {/* SOC Model Blend Demonstration */}
      {socCorrectionApplied && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(52, 152, 255, 0.28)',
          borderRadius: '18px',
          padding: '16px 20px',
          marginBottom: '20px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
          }}>
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
              SOC model correction
            </span>
            <span style={{
              fontSize: '12px',
              color: '#7cc4ff',
              fontWeight: 600,
            }}>
              Applied
            </span>
          </div>

          <div className="soc-model-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: '12px',
          }}>
            {[
              {
              label: 'NARX',
              value: `${Number(socModels.narx || 0).toFixed(2)}%`,
              color: 'rgba(255,255,255,0.9)',
            }, {
              label: 'LSTM',
              value: socModels.lstm == null ? '—' : `${Number(socModels.lstm).toFixed(2)}%`,
              color: '#7cc4ff',
            }, {
              label: 'Final',
              value: `${Number(socModels.final || current.soc || 0).toFixed(2)}%`,
              color: '#00ff88',
            }, {
              label: 'Δ (LSTM-NARX)',
              value: `${socModels.delta >= 0 ? '+' : ''}${Number(socModels.delta || 0).toFixed(2)}%`,
              color: socDeltaColor,
            }].map((item) => (
              <div key={item.label} style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                padding: '10px 12px',
              }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginBottom: '6px', letterSpacing: '0.3px' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: item.color }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Gauges */}
      <div className="overview-gauges" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '24px',
        marginBottom: '32px',
      }}>
        <div className="overview-gauge-card" style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(20px)',
          border: socCorrectionApplied
            ? '1px solid rgba(52, 152, 255, 0.35)'
            : '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '24px',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transition: 'all 0.3s ease',
          animation: socCorrectionApplied ? 'soc-correction-flash 1.4s ease-in-out infinite' : 'none',
        }}>
          <CircularGauge value={current.soc} max={100} label="SOC %" color="#00ff88" />
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              State of Charge
            </div>
            {socCorrectionApplied && (
              <div style={{
                marginTop: '8px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#7cc4ff',
                letterSpacing: '0.2px',
              }}>
                SOC correction was applied by LSTM
              </div>
            )}
          </div>
        </div>

        <div className="overview-gauge-card" style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '24px',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <CircularGauge value={current.soh} max={100} label="SOH %" color="#3498ff" />
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              State of Health
            </div>
          </div>
        </div>

        <div className="overview-gauge-card" style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '24px',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <CircularGauge value={current.voltage} max={60} label="VOLTS" color="#a855f7" />
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Pack Voltage
            </div>
          </div>
        </div>

        <div className="overview-gauge-card" style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '24px',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <CircularGauge value={current.tempAvg} max={80} label="°C" color="#ff9f43" />
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Temperature
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="overview-stats" style={{
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

      {/* Optional demo: LSTM correction trend (removable via VITE_ENABLE_SOC_CORRECTION_DEMO=false) */}
      {SHOW_SOC_CORRECTION_DEMO && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(52, 152, 255, 0.22)',
          borderRadius: '24px',
          padding: '24px',
          marginBottom: '24px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '4px',
                height: '24px',
                background: 'linear-gradient(135deg, #7cc4ff 0%, #3498ff 100%)',
                borderRadius: '4px',
              }} />
              <span style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>
                SOC Correction Delta Trend
              </span>
            </div>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
              Δ = LSTM − NARX (%)
            </span>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={historyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
              <YAxis
                stroke="rgba(255,255,255,0.3)"
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                domain={['auto', 'auto']}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={(value) => <span style={{ color: 'rgba(255,255,255,0.7)' }}>{value}</span>} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="socDelta"
                name="Correction Δ %"
                stroke="#7cc4ff"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#7cc4ff', stroke: '#000', strokeWidth: 1.5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

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
