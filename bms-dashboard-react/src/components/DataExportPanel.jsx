import React, { useState } from 'react';

/**
 * Data Export Component
 * Allows users to export BMS data in various formats
 */
export function DataExportPanel({ isOpen, onClose, apiUrl }) {
  const [exportConfig, setExportConfig] = useState({
    measurement: 'pack_metrics',
    timeRange: '24h',
    format: 'csv',
  });
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const url = `${apiUrl}/api/v1/bms/export?measurement=${exportConfig.measurement}&range=${exportConfig.timeRange}&format=${exportConfig.format}`;
      
      if (exportConfig.format === 'csv') {
        // Download as file
        const response = await fetch(url);
        if (!response.ok) throw new Error('Export failed');
        
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `bms-${exportConfig.measurement}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
      } else {
        // Open JSON in new tab
        window.open(url, '_blank');
      }
    } catch (err) {
      setError(err.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: 'var(--bg-secondary, #2d2d3d)',
        borderRadius: '8px',
        padding: '24px',
        width: '400px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0 }}>📥 Export Data</h2>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '24px',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'rgba(255, 107, 107, 0.2)',
            border: '1px solid #ff6b6b',
            borderRadius: '4px',
            padding: '10px',
            marginBottom: '16px',
            color: '#ff6b6b',
          }}>
            {error}
          </div>
        )}

        {/* Data Type */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
            Data Type
          </label>
          <select
            value={exportConfig.measurement}
            onChange={(e) => setExportConfig(prev => ({ ...prev, measurement: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
            }}
          >
            <option value="pack_metrics">Pack Metrics</option>
            <option value="module_metrics">Module Metrics</option>
            <option value="cell_metrics">Cell Metrics</option>
            <option value="wireless_health">Wireless Health</option>
            <option value="alerts">Alerts</option>
          </select>
        </div>

        {/* Time Range */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
            Time Range
          </label>
          <select
            value={exportConfig.timeRange}
            onChange={(e) => setExportConfig(prev => ({ ...prev, timeRange: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
            }}
          >
            <option value="1h">Last 1 Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
        </div>

        {/* Format */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
            Format
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="radio"
                checked={exportConfig.format === 'csv'}
                onChange={() => setExportConfig(prev => ({ ...prev, format: 'csv' }))}
                style={{ marginRight: '8px' }}
              />
              CSV
            </label>
            <label style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="radio"
                checked={exportConfig.format === 'json'}
                onChange={() => setExportConfig(prev => ({ ...prev, format: 'json' }))}
                style={{ marginRight: '8px' }}
              />
              JSON
            </label>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: isExporting ? 'var(--bg-tertiary)' : 'var(--accent-green, #4ade80)',
            border: 'none',
            borderRadius: '4px',
            color: isExporting ? 'var(--text-secondary)' : '#1e1e2e',
            cursor: isExporting ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
          }}
        >
          {isExporting ? '⏳ Exporting...' : '📥 Download'}
        </button>
      </div>
    </div>
  );
}
