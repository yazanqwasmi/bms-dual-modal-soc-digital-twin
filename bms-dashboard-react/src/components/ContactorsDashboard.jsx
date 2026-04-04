import React, { useMemo } from 'react'

function ContactorIndicator({ label, state, icon }) {
  const isClosed = state === 'Closed'
  const isUnknown = state === 'Unknown' || !state
  const color = isUnknown ? '#999' : isClosed ? '#00ff88' : '#ff4757'
  const bgColor = isUnknown ? 'rgba(150, 150, 150, 0.05)' : isClosed ? 'rgba(0, 255, 136, 0.08)' : 'rgba(255, 71, 87, 0.08)'
  const borderColor = isUnknown ? 'rgba(150, 150, 150, 0.15)' : isClosed ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 71, 87, 0.2)'

  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '16px',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
      minWidth: '180px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Glow effect */}
      <div style={{
        position: 'absolute',
        top: '-20px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '80px',
        height: '80px',
        background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
        borderRadius: '50%',
      }} />

      <div style={{ fontSize: '32px', position: 'relative' }}>{icon}</div>

      <div style={{
        fontSize: '14px',
        fontWeight: 600,
        color: 'rgba(255, 255, 255, 0.8)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {label}
      </div>

      {/* State indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 20px',
        borderRadius: '20px',
        background: `${color}15`,
        border: `1px solid ${color}30`,
      }}>
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 8px ${color}80`,
          animation: isClosed ? 'none' : 'pulse 2s infinite',
        }} />
        <span style={{
          fontSize: '15px',
          fontWeight: 700,
          color: color,
        }}>
          {state || 'Unknown'}
        </span>
      </div>

      {/* Circuit line visual */}
      <div style={{
        width: '60%',
        height: '3px',
        borderRadius: '3px',
        background: isClosed
          ? `linear-gradient(90deg, transparent, ${color}, transparent)`
          : `repeating-linear-gradient(90deg, ${color}40 0px, ${color}40 6px, transparent 6px, transparent 12px)`,
        transition: 'all 0.3s ease',
      }} />
    </div>
  )
}

function ModuleHealthCard({ module }) {
  const isDisconnected = module.healthStatus === 'Disconnected' || module.connected === false
  const isHealthy = !isDisconnected && module.healthStatus === 'Healthy'
  const statusColor = isDisconnected ? '#999' : isHealthy ? '#00ff88' : '#ff4757'

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.02)',
      border: `1px solid ${isHealthy ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 71, 87, 0.3)'}`,
      borderRadius: '14px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{
          fontSize: '18px',
          fontWeight: 700,
          color: '#fff',
        }}>
          {module.id}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          borderRadius: '12px',
          background: `${statusColor}15`,
          border: `1px solid ${statusColor}30`,
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: statusColor,
            boxShadow: `0 0 6px ${statusColor}60`,
          }} />
          <span style={{
            fontSize: '12px',
            fontWeight: 600,
            color: statusColor,
          }}>
            {module.healthStatus || 'Unknown'}
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
      }}>
        <StatItem label="Cells" value={module.numCells || module.cells?.length || '?'} unit="" />
        <StatItem label="Last Seen" value={module.lastSeenMs != null ? module.lastSeenMs : '?'} unit="ms" warn={module.lastSeenMs > 5000} />
        <StatItem label="RSSI" value={module.rssi?.toFixed(0) || '?'} unit="dBm" warn={module.rssi < -80} />
        <StatItem label="Pkt Loss" value={typeof module.packetLoss === 'number' ? module.packetLoss.toFixed(1) : '?'} unit="%" warn={module.packetLoss > 5} />
      </div>

      {/* Voltage bar */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '6px',
        }}>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Module Voltage</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#00d4ff' }}>
            {typeof module.voltage === 'number' ? module.voltage.toFixed(2) : '?'}V
          </span>
        </div>
        <div style={{
          height: '4px',
          borderRadius: '4px',
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, ((module.voltage || 3.7) - 3.0) / 1.2 * 100))}%`,
            background: 'linear-gradient(90deg, #00d4ff, #00ff88)',
            borderRadius: '4px',
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>
    </div>
  )
}

function StatItem({ label, value, unit, warn }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      borderRadius: '8px',
      padding: '8px 10px',
    }}>
      <div style={{
        fontSize: '10px',
        color: 'rgba(255,255,255,0.4)',
        marginBottom: '2px',
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '16px',
        fontWeight: 700,
        color: warn ? '#ff9f43' : '#fff',
      }}>
        {value}<span style={{ fontSize: '11px', fontWeight: 400, color: 'rgba(255,255,255,0.4)', marginLeft: '2px' }}>{unit}</span>
      </div>
    </div>
  )
}

export function ContactorsDashboard({ data, settings }) {
  const current = data?.current
  const contactors = current?.contactors || {}
  const modules = current?.modules || []

  const anyConnected = useMemo(() =>
    modules.some(m => m.connected),
    [modules]
  )
  const allHealthy = useMemo(() =>
    anyConnected && modules.filter(m => m.connected).every(m => m.healthStatus === 'Healthy'),
    [modules, anyConnected]
  )

  const allContactorsClosed = contactors.positive === 'Closed' &&
    contactors.negative === 'Closed' &&
    contactors.precharge === 'Open'

  const systemStatus = !anyConnected ? 'offline' : !allHealthy ? 'fault' : allContactorsClosed ? 'normal' : 'precharge'
  const statusConfig = {
    normal: { color: '#00ff88', label: 'System Normal', icon: '✓' },
    precharge: { color: '#ffd93d', label: 'Precharge Active', icon: '⟳' },
    fault: { color: '#ff4757', label: 'Module Fault Detected', icon: '!' },
    offline: { color: '#999', label: 'All Modules Disconnected', icon: '○' },
  }
  const status = statusConfig[systemStatus]

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '32px' }}>
      {/* System Status Banner */}
      <div style={{
        background: `${status.color}08`,
        border: `1px solid ${status.color}25`,
        borderRadius: '16px',
        padding: '20px 28px',
        marginBottom: '28px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          background: `${status.color}15`,
          border: `1px solid ${status.color}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
          fontWeight: 800,
          color: status.color,
        }}>
          {status.icon}
        </div>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>
            Contactor & Health Status
          </div>
          <div style={{ fontSize: '13px', color: status.color, fontWeight: 500, marginTop: '2px' }}>
            {status.label}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
            Pack Configuration
          </div>
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', fontWeight: 500, marginTop: '2px' }}>
            3 Modules / 12 Cells / 6 Temps
          </div>
        </div>
      </div>

      {/* Contactor States */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '16px',
        padding: '28px',
        marginBottom: '28px',
      }}>
        <h3 style={{
          fontSize: '15px',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.6)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '24px',
          margin: '0 0 24px 0',
        }}>
          Contactors
        </h3>

        {/* Circuit-style layout */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0',
          position: 'relative',
        }}>
          {/* Pack - label */}
          <div style={{
            padding: '12px 20px',
            background: 'rgba(0, 212, 255, 0.08)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            borderRadius: '12px',
            color: '#00d4ff',
            fontSize: '13px',
            fontWeight: 600,
            textAlign: 'center',
          }}>
            PACK +
          </div>

          {/* Connecting line */}
          <div style={{
            width: '30px',
            height: '3px',
            background: contactors.positive === 'Closed'
              ? 'linear-gradient(90deg, #00d4ff, #00ff88)'
              : 'rgba(255,255,255,0.1)',
          }} />

          <ContactorIndicator label="Positive" state={contactors.positive} icon="⊕" />

          <div style={{
            width: '30px',
            height: '3px',
            background: contactors.positive === 'Closed' && contactors.negative === 'Closed'
              ? 'linear-gradient(90deg, #00ff88, #00ff88)'
              : 'rgba(255,255,255,0.1)',
          }} />

          <ContactorIndicator label="Negative" state={contactors.negative} icon="⊖" />

          <div style={{
            width: '30px',
            height: '3px',
            background: contactors.negative === 'Closed'
              ? 'linear-gradient(90deg, #00ff88, #00d4ff)'
              : 'rgba(255,255,255,0.1)',
          }} />

          <div style={{
            padding: '12px 20px',
            background: 'rgba(0, 212, 255, 0.08)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            borderRadius: '12px',
            color: '#00d4ff',
            fontSize: '13px',
            fontWeight: 600,
            textAlign: 'center',
          }}>
            LOAD
          </div>
        </div>

        {/* Precharge below */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: '24px',
        }}>
          <ContactorIndicator label="Precharge" state={contactors.precharge} icon="⚡" />
        </div>
      </div>

      {/* Module Health */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '16px',
        padding: '28px',
      }}>
        <h3 style={{
          fontSize: '15px',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.6)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          margin: '0 0 24px 0',
        }}>
          Module Health
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
        }}>
          {modules.map((module) => (
            <ModuleHealthCard key={module.id} module={module} />
          ))}
        </div>

        {modules.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: 'rgba(255,255,255,0.3)',
            fontSize: '14px',
          }}>
            No module data available
          </div>
        )}
      </div>
    </div>
  )
}
