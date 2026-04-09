/**
 * Alert Notification Service
 * Handles sound alerts and browser notifications for BMS events
 */

class AlertNotificationService {
  constructor() {
    this.soundEnabled = false;
    this.browserNotificationsEnabled = false;
    this.criticalOnly = true;
    this.lastAlertIds = new Set();
    this.audioContext = null;
  }

  getNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  async requestNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    if (Notification.permission === 'granted') return 'granted';

    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (error) {
      console.warn('Notification permission request failed:', error);
      return Notification.permission || 'default';
    }
  }

  ensureAudioContext() {
    if (typeof window === 'undefined') return null;
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  playTone(frequency, type = 'sine', gain = 0.1, duration = 0.2, atTime = null) {
    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    const start = atTime ?? ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;
    gainNode.gain.value = gain;

    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  /**
   * Update notification settings
   */
  updateSettings(settings) {
    this.soundEnabled = settings.enableSoundAlerts || false;
    this.browserNotificationsEnabled = settings.enableBrowserNotifications || false;
    this.criticalOnly = settings.criticalAlertsOnly !== false;
    
    // Request browser notification permission if enabled
    if (this.browserNotificationsEnabled) {
      this.requestNotificationPermission();
    }
  }

  /**
   * Process new alerts and trigger notifications
   */
  processAlerts(alerts) {
    if (!alerts || alerts.length === 0) return;

    const newAlerts = alerts.filter(alert => {
      const alertId = `${alert.timestamp}-${alert.type}-${alert.message}`;
      if (this.lastAlertIds.has(alertId)) return false;
      this.lastAlertIds.add(alertId);
      return true;
    });

    // Keep set from growing infinitely
    if (this.lastAlertIds.size > 500) {
      const idsArray = Array.from(this.lastAlertIds);
      this.lastAlertIds = new Set(idsArray.slice(-250));
    }

    // Filter by severity if needed
    const alertsToNotify = this.criticalOnly 
      ? newAlerts.filter(a => a.severity === 'critical')
      : newAlerts;

    if (alertsToNotify.length === 0) return;

    // Trigger notifications
    alertsToNotify.forEach(alert => {
      if (this.soundEnabled) {
        this.playAlertSound(alert.severity);
      }
      if (this.browserNotificationsEnabled) {
        this.showBrowserNotification(alert);
      }
    });
  }

  /**
   * Play alert sound based on severity
   */
  playAlertSound(severity) {
    try {
      // Different sounds for different severities
      switch (severity) {
        case 'critical':
          // Pulse pattern
          {
            const ctx = this.ensureAudioContext();
            if (!ctx) return;
            const base = ctx.currentTime;
            for (let i = 0; i < 3; i++) {
              this.playTone(880, 'square', 0.2, 0.1, base + (i * 0.2));
            }
          }
          return;
        case 'warning':
          this.playTone(440, 'triangle', 0.2, 0.2);
          break;
        case 'info':
          this.playTone(330, 'sine', 0.1, 0.2);
          break;
        default:
          this.playTone(440, 'sine', 0.1, 0.2);
      }
    } catch (error) {
      console.warn('Could not play alert sound:', error);
    }
  }

  /**
   * Show browser notification
   */
  showBrowserNotification(alert) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      const icon = alert.severity === 'critical' ? '🚨' : 
                   alert.severity === 'warning' ? '⚠️' : 'ℹ️';
      
      new Notification(`${icon} BMS Alert - ${alert.severity.toUpperCase()}`, {
        body: alert.message,
        icon: '/favicon.ico',
        tag: `bms-${alert.type}`, // Prevents duplicate notifications
        requireInteraction: alert.severity === 'critical',
      });
    } catch (error) {
      console.warn('Could not show notification:', error);
    }
  }

  /**
   * Test sound alert
   */
  testSound(severity = 'warning') {
    this.playAlertSound(severity);
  }

  /**
   * Test browser notification
   */
  async testNotification() {
    if (this.getNotificationPermission() !== 'granted') {
      const permission = await this.requestNotificationPermission();
      if (permission !== 'granted') return false;
    }

    this.showBrowserNotification({
      severity: 'info',
      type: 'test',
      message: 'This is a test notification from BMS Dashboard',
    });
    return true;
  }
}

export const alertNotificationService = new AlertNotificationService();
export default alertNotificationService;
