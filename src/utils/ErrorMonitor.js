/**
 * Error Tracking and Monitoring Utilities
 * Provides real-time error monitoring, alerting, and performance tracking
 */

import { subscribeToErrors, getErrorLogs, getErrorStatistics } from './ErrorLogger.js';

class ErrorMonitor {
  constructor() {
    this.alerts = new Map();
    this.thresholds = new Map();
    this.subscribers = new Set();
    this.metrics = {
      errors: new Map(),
      performance: new Map(),
      usage: new Map()
    };
    this.alertingEnabled = true;
    this.monitoringInterval = null;
    
    this.initializeThresholds();
    this.startMonitoring();
    this.subscribeToErrors();
  }

  /**
   * Initialize default monitoring thresholds
   */
  initializeThresholds() {
    // Error rate thresholds (errors per minute)
    this.setThreshold('errorRate', {
      warning: 10,
      critical: 25,
      window: 60000 // 1 minute
    });

    // Component-specific error thresholds
    this.setThreshold('componentErrors', {
      AuthContext: { warning: 3, critical: 5, window: 300000 }, // 5 minutes
      Experience: { warning: 5, critical: 10, window: 600000 }, // 10 minutes
      APIClient: { warning: 8, critical: 15, window: 300000 }
    });

    // Performance thresholds
    this.setThreshold('loadTime', {
      warning: 3000, // 3 seconds
      critical: 10000, // 10 seconds
      window: 60000
    });

    this.setThreshold('apiResponseTime', {
      warning: 2000, // 2 seconds
      critical: 5000, // 5 seconds
      window: 60000
    });

    // Memory usage thresholds (MB)
    this.setThreshold('memoryUsage', {
      warning: 100,
      critical: 200,
      window: 300000
    });
  }

  /**
   * Set monitoring threshold for a metric
   * @param {string} metric - Metric name
   * @param {Object} threshold - Threshold configuration
   */
  setThreshold(metric, threshold) {
    this.thresholds.set(metric, {
      ...threshold,
      lastCheck: Date.now(),
      history: []
    });
  }

  /**
   * Start monitoring processes
   */
  startMonitoring() {
    // Monitor every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.checkThresholds();
      this.cleanupOldMetrics();
      this.generatePeriodicReport();
    }, 30000);

    // Monitor page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseMonitoring();
      } else {
        this.resumeMonitoring();
      }
    });

    // Monitor beforeunload for session end reporting
    window.addEventListener('beforeunload', () => {
      this.generateSessionReport();
    });
  }

  /**
   * Subscribe to error logger events
   */
  subscribeToErrors() {
    subscribeToErrors((logEntry) => {
      this.trackError(logEntry);
    });
  }

  /**
   * Track an error occurrence
   * @param {Object} errorLog - Error log entry
   */
  trackError(errorLog) {
    const now = Date.now();
    const { component, severity, action } = errorLog.context;
    
    // Track error metrics
    this.incrementMetric('errors', `${component}_${severity}`, now);
    this.incrementMetric('errors', `action_${action}`, now);
    this.incrementMetric('errors', `severity_${severity}`, now);
    
    // Track component-specific metrics
    if (!this.metrics.componentErrors.has(component)) {
      this.metrics.componentErrors.set(component, []);
    }
    this.metrics.componentErrors.get(component).push({
      timestamp: now,
      severity,
      action,
      errorId: errorLog.id
    });

    // Check immediate alerts for critical errors
    if (severity === 'critical') {
      this.triggerAlert('critical_error', {
        component,
        action,
        errorId: errorLog.id,
        message: errorLog.message,
        timestamp: now
      });
    }
  }

  /**
   * Track performance metric
   * @param {string} metric - Metric name
   * @param {number} value - Performance value in milliseconds
   * @param {Object} context - Additional context
   */
  trackPerformance(metric, value, context = {}) {
    const now = Date.now();
    
    if (!this.metrics.performance.has(metric)) {
      this.metrics.performance.set(metric, []);
    }
    
    this.metrics.performance.get(metric).push({
      value,
      timestamp: now,
      ...context
    });

    // Check performance thresholds
    this.checkPerformanceThreshold(metric, value);
  }

  /**
   * Track API response time
   * @param {string} endpoint - API endpoint
   * @param {number} duration - Response time in milliseconds
   * @param {number} statusCode - HTTP status code
   * @param {Object} context - Additional context
   */
  trackApiResponse(endpoint, duration, statusCode, context = {}) {
    const now = Date.now();
    
    if (!this.metrics.apiResponse.has(endpoint)) {
      this.metrics.apiResponse.set(endpoint, []);
    }
    
    this.metrics.apiResponse.get(endpoint).push({
      duration,
      statusCode,
      timestamp: now,
      ...context
    });

    this.trackPerformance('apiResponseTime', duration, { endpoint, statusCode });
    
    if (statusCode >= 400) {
      this.incrementMetric('errors', `api_${statusCode}`, now);
    }
  }

  /**
   * Track user interaction
   * @param {string} action - User action
   * @param {Object} context - Action context
   */
  trackUserAction(action, context = {}) {
    const now = Date.now();
    
    if (!this.metrics.usage.has(action)) {
      this.metrics.usage.set(action, []);
    }
    
    this.metrics.usage.get(action).push({
      timestamp: now,
      ...context
    });

    // Track session duration
    if (action === 'session_start') {
      this.sessionStartTime = now;
    } else if (action === 'session_end') {
      this.trackSessionDuration(now - this.sessionStartTime);
    }
  }

  /**
   * Track session duration
   * @param {number} duration - Session duration in milliseconds
   */
  trackSessionDuration(duration) {
    if (!this.metrics.sessionDuration) {
      this.metrics.sessionDuration = [];
    }
    this.metrics.sessionDuration.push({
      duration,
      timestamp: Date.now()
    });
  }

  /**
   * Check performance thresholds
   * @param {string} metric - Metric name
   * @param {number} value - Current value
   */
  checkPerformanceThreshold(metric, value) {
    const threshold = this.thresholds.get(metric);
    if (!threshold) return;

    const now = Date.now();
    const recentValues = this.getRecentValues(metric, threshold.window);
    
    if (recentValues.length > 0) {
      const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      
      if (avgValue >= threshold.critical) {
        this.triggerAlert('performance_critical', {
          metric,
          average: avgValue,
          current: value,
          threshold: threshold.critical
        });
      } else if (avgValue >= threshold.warning) {
        this.triggerAlert('performance_warning', {
          metric,
          average: avgValue,
          current: value,
          threshold: threshold.warning
        });
      }
    }
  }

  /**
   * Get recent values for a metric within time window
   * @param {string} metric - Metric name
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Array}
   */
  getRecentValues(metric, windowMs) {
    const now = Date.now();
    const data = this.metrics.performance.get(metric) || [];
    
    return data
      .filter(entry => now - entry.timestamp <= windowMs)
      .map(entry => entry.value);
  }

  /**
   * Check all thresholds
   */
  checkThresholds() {
    this.thresholds.forEach((threshold, metric) => {
      if (metric.includes('Error')) {
        this.checkErrorThreshold(metric, threshold);
      } else {
        this.checkPerformanceThreshold(metric, this.getCurrentValue(metric));
      }
    });
  }

  /**
   * Check error rate thresholds
   * @param {string} metric - Error metric
   * @param {Object} threshold - Threshold configuration
   */
  checkErrorThreshold(metric, threshold) {
    const now = Date.now();
    const recentErrors = this.getErrorCount(metric, threshold.window);
    
    if (recentErrors >= threshold.critical) {
      this.triggerAlert('error_rate_critical', {
        metric,
        count: recentErrors,
        threshold: threshold.critical,
        window: threshold.window
      });
    } else if (recentErrors >= threshold.warning) {
      this.triggerAlert('error_rate_warning', {
        metric,
        count: recentErrors,
        threshold: threshold.warning,
        window: threshold.window
      });
    }
  }

  /**
   * Get error count for a metric within time window
   * @param {string} metric - Error metric
   * @param {number} windowMs - Time window in milliseconds
   * @returns {number}
   */
  getErrorCount(metric, windowMs) {
    const now = Date.now();
    const component = metric.includes('_') ? metric.split('_')[0] : metric;
    
    const componentErrors = this.metrics.componentErrors.get(component) || [];
    return componentErrors.filter(error => now - error.timestamp <= windowMs).length;
  }

  /**
   * Get current value for performance metric
   * @param {string} metric - Metric name
   * @returns {number}
   */
  getCurrentValue(metric) {
    const data = this.metrics.performance.get(metric) || [];
    return data.length > 0 ? data[data.length - 1].value : 0;
  }

  /**
   * Trigger an alert
   * @param {string} type - Alert type
   * @param {Object} data - Alert data
   */
  triggerAlert(type, data) {
    if (!this.alertingEnabled) return;

    const alertId = `${type}_${Date.now()}`;
    const alert = {
      id: alertId,
      type,
      timestamp: Date.now(),
      data,
      acknowledged: false
    };

    this.alerts.set(alertId, alert);
    this.notifySubscribers('alert', alert);

    // Auto-dismiss non-critical alerts after 5 minutes
    if (!type.includes('critical')) {
      setTimeout(() => {
        this.dismissAlert(alertId);
      }, 300000);
    }

    // Log alert
    console.warn(`🚨 Alert: ${type}`, data);
  }

  /**
   * Dismiss an alert
   * @param {string} alertId - Alert ID
   */
  dismissAlert(alertId) {
    this.alerts.delete(alertId);
    this.notifySubscribers('alertDismissed', { alertId });
  }

  /**
   * Acknowledge an alert
   * @param {string} alertId - Alert ID
   */
  acknowledgeAlert(alertId) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.notifySubscribers('alertAcknowledged', alert);
    }
  }

  /**
   * Get active alerts
   * @param {Object} filters - Filter options
   * @returns {Array}
   */
  getActiveAlerts(filters = {}) {
    let alerts = Array.from(this.alerts.values());
    
    if (filters.type) {
      alerts = alerts.filter(alert => alert.type.includes(filters.type));
    }
    
    if (filters.unacknowledgedOnly) {
      alerts = alerts.filter(alert => !alert.acknowledged);
    }
    
    return alerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get monitoring statistics
   * @returns {Object}
   */
  getStatistics() {
    const errorStats = getErrorStatistics();
    const now = Date.now();
    
    return {
      errors: {
        ...errorStats,
        rate: this.calculateErrorRate(60000), // Last minute
        components: this.getComponentErrorSummary()
      },
      performance: {
        apiResponseTime: this.getAverageMetric('apiResponseTime', 300000),
        loadTime: this.getAverageMetric('loadTime', 300000),
        memoryUsage: this.getCurrentMemoryUsage()
      },
      usage: {
        sessionCount: this.metrics.sessionDuration?.length || 0,
        averageSessionDuration: this.getAverageSessionDuration(),
        activeUsers: this.getActiveUserCount()
      },
      alerts: {
        active: this.getActiveAlerts().length,
        critical: this.getActiveAlerts().filter(a => a.type.includes('critical')).length,
        unacknowledged: this.getActiveAlerts({ unacknowledgedOnly: true }).length
      },
      uptime: {
        startTime: this.sessionStartTime,
        current: now,
        duration: now - (this.sessionStartTime || now)
      }
    };
  }

  /**
   * Calculate error rate
   * @param {number} windowMs - Time window in milliseconds
   * @returns {number}
   */
  calculateErrorRate(windowMs) {
    const now = Date.now();
    let totalErrors = 0;
    
    this.metrics.componentErrors.forEach((errors) => {
      totalErrors += errors.filter(error => now - error.timestamp <= windowMs).length;
    });
    
    return totalErrors / (windowMs / 60000); // Errors per minute
  }

  /**
   * Get component error summary
   * @returns {Object}
   */
  getComponentErrorSummary() {
    const summary = {};
    const now = Date.now();
    
    this.metrics.componentErrors.forEach((errors, component) => {
      const recentErrors = errors.filter(error => now - error.timestamp <= 300000); // 5 minutes
      summary[component] = {
        total: recentErrors.length,
        critical: recentErrors.filter(e => e.severity === 'critical').length,
        high: recentErrors.filter(e => e.severity === 'high').length,
        medium: recentErrors.filter(e => e.severity === 'medium').length,
        low: recentErrors.filter(e => e.severity === 'low').length
      };
    });
    
    return summary;
  }

  /**
   * Get average value for a metric
   * @param {string} metric - Metric name
   * @param {number} windowMs - Time window in milliseconds
   * @returns {number}
   */
  getAverageMetric(metric, windowMs) {
    const values = this.getRecentValues(metric, windowMs);
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  /**
   * Get current memory usage
   * @returns {number}
   */
  getCurrentMemoryUsage() {
    if (performance.memory) {
      return Math.round(performance.memory.usedJSHeapSize / 1024 / 1024); // MB
    }
    return 0;
  }

  /**
   * Get average session duration
   * @returns {number}
   */
  getAverageSessionDuration() {
    if (!this.metrics.sessionDuration || this.metrics.sessionDuration.length === 0) {
      return 0;
    }
    
    const totalDuration = this.metrics.sessionDuration.reduce((sum, session) => sum + session.duration, 0);
    return Math.round(totalDuration / this.metrics.sessionDuration.length / 60000); // Minutes
  }

  /**
   * Get active user count (estimated)
   * @returns {number}
   */
  getActiveUserCount() {
    const now = Date.now();
    const fiveMinutesAgo = now - 300000;
    
    let activeUsers = new Set();
    
    this.metrics.usage.forEach((actions) => {
      actions.forEach(action => {
        if (action.timestamp >= fiveMinutesAgo && action.userId) {
          activeUsers.add(action.userId);
        }
      });
    });
    
    return activeUsers.size;
  }

  /**
   * Generate periodic monitoring report
   */
  generatePeriodicReport() {
    const stats = this.getStatistics();
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Monitoring Report:', stats);
    }
    
    // Send to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendMonitoringReport(stats);
    }
    
    this.notifySubscribers('report', stats);
  }

  /**
   * Generate session end report
   */
  generateSessionReport() {
    const stats = this.getStatistics();
    const report = {
      ...stats,
      sessionEnd: new Date().toISOString(),
      sessionType: 'normal' // Could be 'crash', 'timeout', etc.
    };
    
    this.notifySubscribers('sessionEnd', report);
    
    if (process.env.NODE_ENV === 'production') {
      this.sendMonitoringReport(report);
    }
  }

  /**
   * Send monitoring report to external service
   * @param {Object} report - Monitoring report
   */
  async sendMonitoringReport(report) {
    try {
      const endpoint = process.env.VITE_MONITORING_ENDPOINT;
      if (!endpoint) return;
      
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'monitoring_report',
          data: report,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.warn('Failed to send monitoring report:', error);
    }
  }

  /**
   * Increment metric counter
   * @param {string} category - Metric category
   * @param {string} key - Metric key
   * @param {number} timestamp - Timestamp
   */
  incrementMetric(category, key, timestamp) {
    if (!this.metrics[category].has(key)) {
      this.metrics[category].set(key, []);
    }
    this.metrics[category].get(key).push(timestamp);
  }

  /**
   * Clean up old metrics
   */
  cleanupOldMetrics() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    this.metrics.performance.forEach((data, key) => {
      const filtered = data.filter(entry => now - entry.timestamp <= maxAge);
      this.metrics.performance.set(key, filtered);
    });
    
    this.metrics.componentErrors.forEach((errors, component) => {
      const filtered = errors.filter(error => now - error.timestamp <= maxAge);
      this.metrics.componentErrors.set(component, filtered);
    });
  }

  /**
   * Subscribe to monitoring events
   * @param {string} event - Event type
   * @param {Function} callback - Callback function
   */
  subscribe(event, callback) {
    this.subscribers.add({ event, callback });
    return () => this.subscribers.delete({ event, callback });
  }

  /**
   * Notify subscribers
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  notifySubscribers(event, data) {
    this.subscribers.forEach(subscriber => {
      if (subscriber.event === event) {
        try {
          subscriber.callback(data);
        } catch (error) {
          console.warn('Monitoring subscriber error:', error);
        }
      }
    });
  }

  /**
   * Pause monitoring (when page is hidden)
   */
  pauseMonitoring() {
    this.monitoringActive = false;
  }

  /**
   * Resume monitoring (when page becomes visible)
   */
  resumeMonitoring() {
    this.monitoringActive = true;
    this.generatePeriodicReport();
  }

  /**
   * Enable/disable alerting
   * @param {boolean} enabled - Whether alerting is enabled
   */
  setAlertingEnabled(enabled) {
    this.alertingEnabled = enabled;
  }

  /**
   * Destroy monitoring instance
   */
  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.subscribers.clear();
    this.alerts.clear();
  }
}

// Create singleton instance
const errorMonitor = new ErrorMonitor();

// Convenience tracking functions
export const trackError = (errorLog) => errorMonitor.trackError(errorLog);
export const trackPerformance = (metric, value, context) => errorMonitor.trackPerformance(metric, value, context);
export const trackApiResponse = (endpoint, duration, statusCode, context) => 
  errorMonitor.trackApiResponse(endpoint, duration, statusCode, context);
export const trackUserAction = (action, context) => errorMonitor.trackUserAction(action, context);

export const getMonitoringStatistics = () => errorMonitor.getStatistics();
export const getActiveAlerts = (filters) => errorMonitor.getActiveAlerts(filters);
export const dismissAlert = (alertId) => errorMonitor.dismissAlert(alertId);
export const acknowledgeAlert = (alertId) => errorMonitor.acknowledgeAlert(alertId);

export const subscribeToMonitoring = (event, callback) => errorMonitor.subscribe(event, callback);
export const setAlertingEnabled = (enabled) => errorMonitor.setAlertingEnabled(enabled);

export default errorMonitor;