import React, { useState, useEffect, useCallback } from 'react';
import alertNotificationService from '../services/alertNotificationService';

/**
 * Settings Panel Component
 * Allows users to configure dashboard behavior
 */
export function SettingsPanel({ isOpen, onClose, settings, onSettingsChange }) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [notificationPermission, setNotificationPermission] = useState(
    alertNotificationService.getNotificationPermission()
  );

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (isOpen) {
      setNotificationPermission(alertNotificationService.getNotificationPermission());
    }
  }, [isOpen, settings]);

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSettingsChange(localSettings);
    // Persist to localStorage
    localStorage.setItem('bms-dashboard-settings', JSON.stringify(localSettings));
    onClose();
  };

  const handleReset = () => {
    const defaults = getDefaultSettings();
    setLocalSettings(defaults);
    onSettingsChange(defaults);
    localStorage.removeItem('bms-dashboard-settings');
  };

  const handleTestSound = useCallback(() => {
    alertNotificationService.updateSettings({
      ...localSettings,
      enableSoundAlerts: true,
    });
    alertNotificationService.testSound('warning');
  }, [localSettings]);

  const handleTestNotification = useCallback(async () => {
    alertNotificationService.updateSettings({
      ...localSettings,
      enableBrowserNotifications: true,
    });
    const ok = await alertNotificationService.testNotification();
    setNotificationPermission(alertNotificationService.getNotificationPermission());
    if (!ok) {
      console.warn('Browser notifications were not granted.');
    }
  }, [localSettings]);

  const permissionLabel =
    notificationPermission === 'granted'
      ? 'Granted'
      : notificationPermission === 'denied'
        ? 'Blocked'
        : notificationPermission === 'unsupported'
          ? 'Unsupported'
          : 'Not granted';

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
        width: '500px',
        maxHeight: '80vh',
        overflow: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0 }}>⚙️ Dashboard Settings</h2>
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

        {/* API URL */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
            API Server URL
          </label>
          <input
            type="text"
            value={localSettings.apiUrl}
            onChange={(e) => handleChange('apiUrl', e.target.value)}
            placeholder="http://localhost:3002"
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: 'var(--bg-tertiary, #3d3d4d)',
              border: '1px solid var(--border-color, #4d4d5d)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* Refresh Interval */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
            Refresh Interval: {localSettings.refreshInterval / 1000}s
          </label>
          <input
            type="range"
            min="1000"
            max="30000"
            step="1000"
            value={localSettings.refreshInterval}
            onChange={(e) => handleChange('refreshInterval', parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Notifications */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Notifications
          </h3>
          <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <input
              type="checkbox"
              checked={localSettings.enableSoundAlerts}
              onChange={(e) => handleChange('enableSoundAlerts', e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            Enable Sound Alerts
          </label>
          <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <input
              type="checkbox"
              checked={localSettings.enableBrowserNotifications}
              onChange={(e) => handleChange('enableBrowserNotifications', e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            Browser Notifications
          </label>
          <label style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={localSettings.criticalAlertsOnly}
              onChange={(e) => handleChange('criticalAlertsOnly', e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            Critical Alerts Only
          </label>

          <div style={{
            marginTop: '12px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>Browser Permission: {permissionLabel}</span>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button
              onClick={handleTestSound}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              Test Sound
            </button>
            <button
              onClick={handleTestNotification}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              Test Browser Notification
            </button>
          </div>
        </div>

        {/* Display */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Display
          </h3>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
            Chart History Points
          </label>
          <select
            value={localSettings.historyPoints}
            onChange={(e) => handleChange('historyPoints', parseInt(e.target.value))}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: 'var(--bg-tertiary, #3d3d4d)',
              border: '1px solid var(--border-color, #4d4d5d)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
            }}
          >
            <option value={50}>50 points (~4 min)</option>
            <option value={100}>100 points (~8 min)</option>
            <option value={200}>200 points (~16 min)</option>
            <option value={500}>500 points (~40 min)</option>
          </select>
        </div>

        {/* Thresholds */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Alert Thresholds
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                Low SOC Warning (%)
              </label>
              <input
                type="number"
                value={localSettings.lowSocThreshold}
                onChange={(e) => handleChange('lowSocThreshold', parseInt(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                High Temp Warning (°C)
              </label>
              <input
                type="number"
                value={localSettings.highTempThreshold}
                onChange={(e) => handleChange('highTempThreshold', parseInt(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button
            onClick={handleReset}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: 'var(--accent-green, #4ade80)',
              border: 'none',
              borderRadius: '4px',
              color: '#1e1e2e',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Get default settings
 */
export function getDefaultSettings() {
  return {
    apiUrl: import.meta.env.VITE_API_URL || 'http://bmsgateway.local:3002',
    refreshInterval: 5000,
    enableSoundAlerts: false,
    enableBrowserNotifications: false,
    criticalAlertsOnly: true,
    historyPoints: 100,
    lowSocThreshold: 20,
    highTempThreshold: 50,
  };
}

/**
 * Load settings from localStorage
 */
export function loadSettings() {
  try {
    const saved = localStorage.getItem('bms-dashboard-settings');
    if (saved) {
      return { ...getDefaultSettings(), ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Error loading settings:', e);
  }
  return getDefaultSettings();
}
