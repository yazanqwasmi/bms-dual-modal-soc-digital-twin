/**
 * Shared components used across multiple dashboards.
 */

// Custom Tooltip for Recharts
export const CustomTooltip = ({ active, payload, label }) => {
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

// Color map shared by StatCard variants
const COLOR_MAP = {
  green:  { gradient: 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)', glow: 'rgba(0, 255, 136, 0.2)',  dim: 'rgba(0, 255, 136, 0.1)' },
  blue:   { gradient: 'linear-gradient(135deg, #3498ff 0%, #0066ff 100%)', glow: 'rgba(52, 152, 255, 0.2)', dim: 'rgba(52, 152, 255, 0.1)' },
  orange: { gradient: 'linear-gradient(135deg, #ff9f43 0%, #ff6b35 100%)', glow: 'rgba(255, 159, 67, 0.2)', dim: 'rgba(255, 159, 67, 0.1)' },
  red:    { gradient: 'linear-gradient(135deg, #ff4757 0%, #ff2d4a 100%)', glow: 'rgba(255, 71, 87, 0.2)',  dim: 'rgba(255, 71, 87, 0.1)' },
  purple: { gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', glow: 'rgba(168, 85, 247, 0.2)', dim: 'rgba(168, 85, 247, 0.1)' },
  cyan:   { gradient: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)', glow: 'rgba(0, 212, 255, 0.2)',  dim: 'rgba(0, 212, 255, 0.1)' },
  yellow: { gradient: 'linear-gradient(135deg, #ffd93d 0%, #ffb800 100%)', glow: 'rgba(255, 217, 61, 0.2)', dim: 'rgba(255, 217, 61, 0.1)' },
}

/**
 * Stat card with gradient top bar and optional trend indicator.
 *
 * Props (all optional except value/label or value/title):
 *   label | title  — card label (label takes priority)
 *   value           — displayed value
 *   unit            — unit suffix
 *   icon            — emoji / element
 *   color           — key of COLOR_MAP, or a raw CSS color string for WirelessHealth variant
 *   trend           — numeric; positive = up arrow, negative = down arrow
 *   subtitle        — secondary text below value
 */
export const StatCard = ({ label, title, value, unit, icon, color, trend, subtitle }) => {
  const displayLabel = label ?? title

  // Supports either a named color key (OverviewDashboard style) or a raw CSS color
  // string (WirelessHealthDashboard passes hex/rgba directly).
  const namedColors = COLOR_MAP[color]

  if (namedColors) {
    // Full-featured variant used by OverviewDashboard
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
        e.currentTarget.style.boxShadow = `0 20px 40px rgba(0,0,0,0.3), 0 0 30px ${namedColors.glow}`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)'
        e.currentTarget.style.boxShadow = 'none'
      }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: namedColors.gradient }} />
        <div style={{
          position: 'absolute', top: '-50%', right: '-20%',
          width: '150px', height: '150px',
          background: `radial-gradient(circle, ${namedColors.dim} 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{ fontSize: '24px', marginBottom: '12px', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.3))' }}>
          {icon}
        </div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>
          {displayLabel}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{
            fontSize: '32px', fontWeight: 800,
            background: namedColors.gradient,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            lineHeight: 1, fontFeatureSettings: '"tnum" 1',
          }}>
            {value}
          </span>
          {unit && <span style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.5)' }}>{unit}</span>}
        </div>
        {(subtitle || trend) && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)' }}>
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

  // Raw-color variant used by WirelessHealthDashboard and LogsEventsDashboard
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: '20px',
      padding: '24px',
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
      <div style={{
        position: 'absolute', top: '-50%', right: '-50%',
        width: '150px', height: '150px',
        background: `radial-gradient(circle, ${color}10 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ fontSize: '28px', marginBottom: '16px' }}>{icon}</div>
      <div style={{
        fontSize: '36px', fontWeight: 800, marginBottom: '4px',
        fontFamily: '"JetBrains Mono", monospace',
        background: `linear-gradient(135deg, ${color} 0%, ${color}99 100%)`,
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>
        {value}<span style={{ fontSize: '18px', opacity: 0.8 }}>{unit}</span>
      </div>
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px' }}>
        {displayLabel}
      </div>
      {trend && (
        <div style={{ marginTop: '12px', fontSize: '12px', color: trend > 0 ? '#ff4757' : '#00ff88', display: 'flex', alignItems: 'center', gap: '4px' }}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}% from avg
        </div>
      )}
    </div>
  )
}
