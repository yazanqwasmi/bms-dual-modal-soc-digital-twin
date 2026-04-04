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

  /**
   * Update notification settings
   */
  updateSettings(settings) {
    this.soundEnabled = settings.enableSoundAlerts || false;
    this.browserNotificationsEnabled = settings.enableBrowserNotifications || false;
    this.criticalOnly = settings.criticalAlertsOnly !== false;
    
    // Request browser notification permission if enabled
    if (this.browserNotificationsEnabled && 'Notification' in window) {
      Notification.requestPermission();
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
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      const ctx = this.audioContext;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Different sounds for different severities
      switch (severity) {
        case 'critical':
          oscillator.frequency.value = 880; // A5 - high pitch
          oscillator.type = 'square';
          gainNode.gain.value = 0.3;
          // Pulse pattern
          for (let i = 0; i < 3; i++) {
            setTimeout(() => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.value = 880;
              osc.type = 'square';
              gain.gain.value = 0.2;
              osc.start();
              osc.stop(ctx.currentTime + 0.1);
            }, i * 200);
          }
          return;
        case 'warning':
          oscillator.frequency.value = 440; // A4 - medium pitch
          oscillator.type = 'triangle';
          gainNode.gain.value = 0.2;
          break;
        case 'info':
          oscillator.frequency.value = 330; // E4 - low pitch
          oscillator.type = 'sine';
          gainNode.gain.value = 0.1;
          break;
        default:
          oscillator.frequency.value = 440;
          oscillator.type = 'sine';
          gainNode.gain.value = 0.1;
      }

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.2);
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
  testNotification() {
    this.showBrowserNotification({
      severity: 'info',
      type: 'test',
      message: 'This is a test notification from BMS Dashboard',
    });
  }
}

export const alertNotificationService = new AlertNotificationService();
export default alertNotificationService;
