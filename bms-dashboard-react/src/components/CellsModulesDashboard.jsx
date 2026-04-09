import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell
} from 'recharts'
import { CustomTooltip } from './shared.jsx'
import dataService from '../services/dataService.js'

// Cell Voltage Heat Map Cell
const CellVoltageCell = ({ cell, isSelected, onClick }) => {
  const voltage = cell.voltage
  const noData = voltage === 0
  const minV = 3.2
  const maxV = 4.2
  const idealV = 3.65
  const normalizedV = noData ? 0 : Math.max(0, Math.min(1, (voltage - minV) / (maxV - minV)))
  const distFromIdeal = noData ? 1 : Math.abs(voltage - idealV)

  // Color based on distance from ideal 3.65V
  const getColor = (v) => {
    if (noData) return '#555'
    if (distFromIdeal < 0.05) return '#00ff88'   // within ±50mV → green
    if (distFromIdeal < 0.15) return '#00d4ff'   // within ±150mV → cyan
    if (distFromIdeal < 0.30) return '#ffd93d'   // within ±300mV → yellow
    if (v < 0.2) return '#ff4757'                // very low → red
    return '#ff9f43'                             // far from ideal → orange
  }

  const color = getColor(normalizedV)
  
  return (
    <div 
      onClick={onClick}
      style={{
        width: '100%',
        aspectRatio: '1',
        borderRadius: '8px',
        background: `rgba(${normalizedV > 0.5 ? '0, 255, 136' : '255, 71, 87'}, ${0.1 + normalizedV * 0.2})`,
        border: isSelected ? `2px solid ${color}` : '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)'
        e.currentTarget.style.boxShadow = `0 0 20px ${color}40`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Glow effect */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at center, ${color}20 0%, transparent 70%)`,
      }} />
      
      <span style={{
        fontSize: '10px',
        color: 'rgba(255,255,255,0.5)',
        position: 'relative',
        zIndex: 1,
      }}>
        {cell.id}
      </span>
      <span style={{
        fontSize: '12px',
        fontWeight: 700,
        color: color,
        position: 'relative',
        zIndex: 1,
        textShadow: `0 0 10px ${color}`,
      }}>
        {voltage.toFixed(3)}V
      </span>
      <span style={{
        fontSize: '9px',
        color: 'rgba(255,255,255,0.4)',
        position: 'relative',
        zIndex: 1,
      }}>
        {cell.temp.toFixed(1)}°C
      </span>
    </div>
  )
}

// Module Card Component
const ModuleCard = ({ module, isSelected, onClick }) => {
  const isConnected = module.connected !== false
  const isHealthy = isConnected && module.deltaV < 0.05

  return (
    <div
      onClick={onClick}
      style={{
        padding: '16px',
        background: !isConnected
          ? 'rgba(100, 100, 100, 0.08)'
          : isSelected
          ? 'rgba(0, 255, 136, 0.1)'
          : 'rgba(255, 255, 255, 0.02)',
        border: !isConnected
          ? '1px solid rgba(100, 100, 100, 0.2)'
          : isSelected
          ? '1px solid rgba(0, 255, 136, 0.3)'
          : '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '16px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
        opacity: isConnected ? 1 : 0.6,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
          e.currentTarget.style.transform = 'translateY(-2px)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = isConnected ? 'rgba(255, 255, 255, 0.02)' : 'rgba(100, 100, 100, 0.08)'
          e.currentTarget.style.transform = 'translateY(0)'
        }
      }}
    >
      {/* Top indicator */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: !isConnected
          ? 'linear-gradient(135deg, #666 0%, #444 100%)'
          : isSelected
          ? 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)'
          : isHealthy
          ? 'linear-gradient(135deg, #3498ff 0%, #0066ff 100%)'
          : 'linear-gradient(135deg, #ff9f43 0%, #ff6b35 100%)',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{
          fontSize: '14px',
          fontWeight: 700,
          color: !isConnected ? '#999' : isSelected ? '#00ff88' : 'rgba(255,255,255,0.9)',
        }}>
          {module.id}
        </span>
        {!isConnected ? (
          <span style={{
            fontSize: '9px',
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: '9999px',
            background: 'rgba(150, 150, 150, 0.2)',
            color: '#999',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Disconnected
          </span>
        ) : module.balancing ? (
          <span style={{
            fontSize: '9px',
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: '9999px',
            background: 'rgba(255, 159, 67, 0.2)',
            color: '#ff9f43',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Balancing
          </span>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>Voltage</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: isConnected ? '#fff' : '#666' }}>{module.voltage.toFixed(2)}V</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>Temp</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: isConnected ? '#fff' : '#666' }}>{module.tempAvg.toFixed(1)}°C</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>Delta-V</div>
          <div style={{
            fontSize: '14px',
            fontWeight: 600,
            color: !isConnected ? '#666' : module.deltaV * 1000 > 50 ? '#ff4757' : module.deltaV * 1000 > 30 ? '#ff9f43' : '#00ff88',
          }}>
            {(module.deltaV * 1000).toFixed(1)}mV
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>RSSI</div>
          <div style={{
            fontSize: '14px',
            fontWeight: 600,
            color: !isConnected ? '#666' : module.rssi > -65 ? '#00ff88' : module.rssi > -75 ? '#ff9f43' : '#ff4757',
          }}>
            {isConnected ? `${module.rssi.toFixed(0)}dBm` : '—'}
          </div>
        </div>
      </div>
    </div>
  )
}

export function CellsModulesDashboard({ data }) {
  const [selectedModuleId, setSelectedModuleId] = useState(null)
  const [moduleHistory, setModuleHistory] = useState([])

  const modules = (data.current?.modules) || []

  useEffect(() => {
    if (!modules.length) {
      setSelectedModuleId(null)
      return
    }
    const selectedStillExists = selectedModuleId && modules.some((m) => m.id === selectedModuleId)
    if (!selectedStillExists) {
      const firstConnected = modules.find((m) => m.connected !== false)
      setSelectedModuleId((firstConnected || modules[0]).id)
    }
  }, [modules, selectedModuleId])

  useEffect(() => {
    if (!selectedModuleId) return
    let cancelled = false
    dataService.getModuleHistory(selectedModuleId).then((rows) => {
      if (cancelled) return
      setModuleHistory(rows)
    })
    return () => { cancelled = true }
  }, [selectedModuleId])

  if (!data.current) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div className="skeleton" style={{ width: '200px', height: '24px', margin: '0 auto 16px' }} />
        <div className="skeleton" style={{ width: '300px', height: '16px', margin: '0 auto' }} />
      </div>
    )
  }

  const selectedModuleIndex = selectedModuleId
    ? modules.findIndex((m) => m.id === selectedModuleId)
    : 0
  const module = selectedModuleIndex >= 0 ? modules[selectedModuleIndex] : modules[0]

  if (!module) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
        No module data available
      </div>
    )
  }

  // Prepare module comparison data
  const moduleComparisonData = modules.map((m) => ({
    name: m.id,
    voltage: parseFloat((m.voltage || 0).toFixed(3)),
    deltaV: parseFloat(((m.deltaV || 0) * 1000).toFixed(1)),
    temp: parseFloat((m.tempAvg || 0).toFixed(1)),
  }))

  // Prepare cell voltage data for bar chart
  const cellVoltageData = (module.cells || []).map((c) => ({
    name: c.id,
    voltage: parseFloat((c.voltage || 0).toFixed(4)),
    temp: parseFloat((c.temp || 0).toFixed(1)),
  }))

  // History data from module-specific API endpoint
  const historyData = moduleHistory.slice(-60).map((row) => ({
    time: new Date(row._time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    voltage: parseFloat((row.voltage || 0).toFixed(3)),
    temp: parseFloat((row.avg_temp || 0).toFixed(1)),
    deltaV: parseFloat((row.delta_v_mv || 0).toFixed(1)),
  }))

  // Get voltage colors for bar chart
  const getVoltageColor = (voltage) => {
    if (voltage < 3.4) return '#ff4757'
    if (voltage < 3.6) return '#ff9f43'
    if (voltage > 4.1) return '#ff4757'
    return '#00ff88'
  }

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
            Cells & Modules
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
            {modules.length} Modules • {modules.reduce((sum, m) => sum + (m.cells || []).length, 0)} Cells Total
          </p>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '12px 20px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>Selected</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#00ff88' }}>{module.id}</div>
          </div>
          <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>Cells</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{module.cells.length}</div>
          </div>
        </div>
      </div>

      {/* Module Grid Selector */}
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
            background: 'linear-gradient(135deg, #3498ff 0%, #0066ff 100%)',
            borderRadius: '4px',
          }} />
          <span style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            Module Selection
          </span>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
        }}>
          {modules.map((m, idx) => (
            <ModuleCard
              key={m.id || idx}
              module={m}
              isSelected={selectedModuleId === m.id}
              onClick={() => setSelectedModuleId(m.id)}
            />
          ))}
        </div>
      </div>

      {/* Selected Module Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px',
        marginBottom: '24px',
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px',
          padding: '20px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)',
          }} />
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
            Module Voltage
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {module.voltage.toFixed(3)}V
          </div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px',
          padding: '20px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(135deg, #ff9f43 0%, #ff6b35 100%)',
          }} />
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
            Temperature
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #ff9f43 0%, #ff6b35 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {module.tempAvg.toFixed(1)}°C
          </div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px',
          padding: '20px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: module.deltaV * 1000 > 50 
              ? 'linear-gradient(135deg, #ff4757 0%, #ff2d4a 100%)'
              : 'linear-gradient(135deg, #3498ff 0%, #0066ff 100%)',
          }} />
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
            Delta-V
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: 800,
            background: module.deltaV * 1000 > 50 
              ? 'linear-gradient(135deg, #ff4757 0%, #ff2d4a 100%)'
              : 'linear-gradient(135deg, #3498ff 0%, #0066ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {(module.deltaV * 1000).toFixed(1)}mV
          </div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px',
          padding: '20px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: module.balancing 
              ? 'linear-gradient(135deg, #ff9f43 0%, #ff6b35 100%)'
              : 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)',
          }} />
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
            Balancing
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: 800,
            color: module.balancing ? '#ff9f43' : '#00ff88',
          }}>
            {module.balancing ? 'ACTIVE' : 'IDLE'}
          </div>
        </div>
      </div>

      {/* Cell Heat Map */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '24px',
        padding: '24px',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '4px',
              height: '24px',
              background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
              borderRadius: '4px',
            }} />
            <span style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
              {module.id} - Cell Voltage Heat Map
            </span>
          </div>
          
          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ff4757' }} />
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Low</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ffd93d' }} />
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Normal</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#00ff88' }} />
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Optimal</span>
            </div>
          </div>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gap: '12px',
        }}>
          {(module.cells || []).map((cell, idx) => (
            <CellVoltageCell key={idx} cell={cell} />
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Cell Voltages Bar Chart */}
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
              Cell Voltages
            </span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={cellVoltageData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="name" 
                stroke="rgba(255,255,255,0.3)" 
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
              />
              <YAxis 
                stroke="rgba(255,255,255,0.3)" 
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="voltage" name="Voltage V" radius={[4, 4, 0, 0]}>
                {cellVoltageData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getVoltageColor(entry.voltage)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Module History */}
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
              background: 'linear-gradient(135deg, #3498ff 0%, #0066ff 100%)',
              borderRadius: '4px',
            }} />
            <span style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
              {module.id} History
            </span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={historyData}>
              <defs>
                <linearGradient id="moduleVoltGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3498ff" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3498ff" stopOpacity={0} />
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
                dataKey="voltage"
                name="Voltage V"
                stroke="#3498ff"
                strokeWidth={2}
                fill="url(#moduleVoltGradient)"
                dot={false}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="temp"
                name="Temp °C"
                stroke="#ff9f43"
                strokeWidth={2}
                fill="none"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* All Modules Comparison */}
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
            background: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)',
            borderRadius: '4px',
          }} />
          <span style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            All Modules Comparison
          </span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={moduleComparisonData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
            <YAxis yAxisId="left" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
            <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar yAxisId="left" dataKey="voltage" name="Voltage V" fill="#00ff88" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="right" dataKey="deltaV" name="Delta-V mV" fill="#ff9f43" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cell Details Table */}
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
            background: 'linear-gradient(135deg, #ffd93d 0%, #ffb800 100%)',
            borderRadius: '4px',
          }} />
          <span style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            {module.id} - Cell Details
          </span>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Cell</th>
                <th>Voltage (V)</th>
                <th>Temperature (°C)</th>
                <th>SOC (%)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {module.cells.map((cell, idx) => {
                const isLowVoltage = cell.voltage < 3.4
                const isHighVoltage = cell.voltage > 4.1
                const isHighTemp = cell.temp > 45
                const status = isLowVoltage || isHighVoltage || isHighTemp ? 'warning' : 'healthy'
                
                return (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{cell.id}</td>
                    <td style={{ 
                      color: isLowVoltage || isHighVoltage ? '#ff4757' : '#00ff88',
                      fontFamily: '"JetBrains Mono", monospace',
                    }}>
                      {cell.voltage.toFixed(4)}
                    </td>
                    <td style={{ 
                      color: isHighTemp ? '#ff9f43' : 'rgba(255,255,255,0.7)',
                      fontFamily: '"JetBrains Mono", monospace',
                    }}>
                      {cell.temp.toFixed(1)}
                    </td>
                    <td style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                      {cell.soc.toFixed(1)}
                    </td>
                    <td>
                      <span className={`badge badge-${status === 'healthy' ? 'success' : 'warning'}`}>
                        {status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
