/**
 * Centralized Error Logging Service
 * Provides comprehensive error tracking, logging, and monitoring
 */

class ErrorLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000;
    this.subscribers = new Set();
    this.isEnabled = process.env.NODE_ENV !== 'test';
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
  }

  /**
   * Generate unique session ID
   * @returns {string}
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log an error with comprehensive metadata
   * @param {Error|string} error - Error object or message
   * @param {Object} context - Additional context information
   */
  log(error, context = {}) {
    if (!this.isEnabled) return;

    const timestamp = new Date().toISOString();
    const errorId = this.generateErrorId();
    const sessionDuration = Date.now() - this.startTime;

    // Extract error details
    const errorDetails = this.extractErrorDetails(error);

    // Create log entry
    const logEntry = {
      id: errorId,
      timestamp,
      sessionId: this.sessionId,
      sessionDuration,
      level: context.level || 'error',
      message: errorDetails.message,
      stack: errorDetails.stack,
      name: errorDetails.name,
      code: errorDetails.code,
      status: errorDetails.status,
      url: this.getCurrentUrl(),
      userAgent: navigator.userAgent,
      userId: this.getCurrentUserId(),
      context: {
        ...context,
        component: context.component || this.getComponentStack(),
        action: context.action || 'unknown',
        severity: this.calculateSeverity(error, context)
      },
      browserInfo: this.getBrowserInfo(),
      performanceInfo: this.getPerformanceInfo(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        apiBase: this.getApiBase()
      }
    };

    // Store log
    this.addLog(logEntry);

    // Notify subscribers
    this.notifySubscribers(logEntry);

    // Send to external service if configured
    this.sendToExternalService(logEntry);

    // Console output for development
    if (process.env.NODE_ENV === 'development') {
      this.logToConsole(logEntry);
    }

    return errorId;
  }

  /**
   * Extract detailed error information
   * @param {Error|string} error
   * @returns {Object}
   */
  extractErrorDetails(error) {
    if (typeof error === 'string') {
      return {
        name: 'StringError',
        message: error,
        stack: null,
        code: null,
        status: null
      };
    }

    return {
      name: error.name || 'UnknownError',
      message: error.message || 'Unknown error occurred',
      stack: error.stack,
      code: error.code || null,
      status: error.status || error.statusCode || null
    };
  }

  /**
   * Generate unique error ID
   * @returns {string}
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate error severity
   * @param {Error} error
   * @param {Object} context
   * @returns {string}
   */
  calculateSeverity(error, context) {
    // Critical errors that break core functionality
    if (context.component === 'AuthContext' || 
        context.action === 'login' || 
        context.action === 'loadModel') {
      return 'critical';
    }

    // Network and API errors
    if (error.message?.includes('Failed to fetch') || 
        error.message?.includes('Network Error') ||
        error.status >= 500) {
      return 'high';
    }

    // User validation errors
    if (error.status === 400 || error.status === 422) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Get current URL
   * @returns {string}
   */
  getCurrentUrl() {
    try {
      return window.location.href;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get current user ID from localStorage
   * @returns {string|null}
   */
  getCurrentUserId() {
    try {
      return localStorage.getItem('user_id') || null;
    } catch {
      return null;
    }
  }

  /**
   * Get API base URL
   * @returns {string}
   */
  getApiBase() {
    try {
      const apiConfig = require('../config/api.js');
      return apiConfig.getApiBaseUrl();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get browser information
   * @returns {Object}
   */
  getBrowserInfo() {
    try {
      return {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        screenResolution: `${screen.width}x${screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
    } catch {
      return {};
    }
  }

  /**
   * Get performance information
   * @returns {Object}
   */
  getPerformanceInfo() {
    try {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        loadTime: navigation ? navigation.loadEventEnd - navigation.loadEventStart : null,
        domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart : null,
        firstPaint: this.getFirstPaint(),
        memoryUsage: performance.memory ? {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        } : null
      };
    } catch {
      return {};
    }
  }

  /**
   * Get first paint timing
   * @returns {number|null}
   */
  getFirstPaint() {
    try {
      const paintEntries = performance.getEntriesByType('paint');
      const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
      return firstPaint ? firstPaint.startTime : null;
    } catch {
      return null;
    }
  }

  /**
   * Get component stack from error
   * @returns {string|null}
   */
  getComponentStack() {
    try {
      const error = new Error();
      return error.stack;
    } catch {
      return null;
    }
  }

  /**
   * Add log entry to storage
   * @param {Object} logEntry
   */
  addLog(logEntry) {
    this.logs.push(logEntry);
    
    // Maintain max logs limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  /**
   * Subscribe to error events
   * @param {Function} callback
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers
   * @param {Object} logEntry
   */
  notifySubscribers(logEntry) {
    this.subscribers.forEach(callback => {
      try {
        callback(logEntry);
      } catch (err) {
        console.warn('Error logger subscriber failed:', err);
      }
    });
  }

  /**
   * Send error to external monitoring service
   * @param {Object} logEntry
   */
  async sendToExternalService(logEntry) {
    const endpoint = process.env.VITE_ERROR_REPORTING_ENDPOINT;
    if (!endpoint) return;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry)
      });

      if (!response.ok) {
        console.warn('Failed to send error to external service:', response.status);
      }
    } catch (err) {
      console.warn('Error sending to external service:', err);
    }
  }

  /**
   * Log to console for development
   * @param {Object} logEntry
   */
  logToConsole(logEntry) {
    const { level, message, stack, context, severity } = logEntry;
    const emoji = this.getSeverityEmoji(severity);
    
    console.group(`${emoji} [${level.toUpperCase()}] ${message}`);
    console.log('Error ID:', logEntry.id);
    console.log('Context:', context);
    console.log('Stack:', stack);
    console.log('URL:', logEntry.url);
    console.log('User Agent:', logEntry.browserInfo.userAgent);
    console.groupEnd();
  }

  /**
   * Get severity emoji for console
   * @param {string} severity
   * @returns {string}
   */
  getSeverityEmoji(severity) {
    const emojis = {
      critical: '🚨',
      high: '⚠️',
      medium: '⚡',
      low: '💡'
    };
    return emojis[severity] || '❌';
  }

  /**
   * Get all logs
   * @param {Object} filters
   * @returns {Array}
   */
  getLogs(filters = {}) {
    let filteredLogs = [...this.logs];

    if (filters.level) {
      filteredLogs = filteredLogs.filter(log => log.level === filters.level);
    }

    if (filters.severity) {
      filteredLogs = filteredLogs.filter(log => log.context.severity === filters.severity);
    }

    if (filters.component) {
      filteredLogs = filteredLogs.filter(log => log.context.component === filters.component);
    }

    if (filters.since) {
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= new Date(filters.since));
    }

    return filteredLogs.slice().reverse(); // Most recent first
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Export logs for debugging
   * @param {string} format - 'json' or 'csv'
   * @returns {string}
   */
  exportLogs(format = 'json') {
    const logs = this.getLogs();

    if (format === 'csv') {
      const headers = ['id', 'timestamp', 'level', 'message', 'severity', 'component', 'action'];
      const csvContent = [
        headers.join(','),
        ...logs.map(log => [
          log.id,
          log.timestamp,
          log.level,
          `"${log.message.replace(/"/g, '""')}"`,
          log.context.severity,
          log.context.component,
          log.context.action
        ].join(','))
      ].join('\n');
      return csvContent;
    }

    return JSON.stringify(logs, null, 2);
  }

  /**
   * Get error statistics
   * @returns {Object}
   */
  getStatistics() {
    const logs = this.logs;
    const total = logs.length;

    const severityCounts = logs.reduce((acc, log) => {
      acc[log.context.severity] = (acc[log.context.severity] || 0) + 1;
      return acc;
    }, {});

    const componentCounts = logs.reduce((acc, log) => {
      acc[log.context.component] = (acc[log.context.component] || 0) + 1;
      return acc;
    }, {});

    const recentErrors = logs.filter(log => 
      Date.now() - new Date(log.timestamp).getTime() < 5 * 60 * 1000 // Last 5 minutes
    ).length;

    return {
      total,
      recent: recentErrors,
      severity: severityCounts,
      component: componentCounts,
      sessionDuration: Date.now() - this.startTime
    };
  }
}

// Create singleton instance
const errorLogger = new ErrorLogger();

// Convenience methods for different error types
export const logError = (error, context = {}) => {
  return errorLogger.log(error, { ...context, level: 'error' });
};

export const logWarning = (error, context = {}) => {
  return errorLogger.log(error, { ...context, level: 'warning' });
};

export const logInfo = (error, context = {}) => {
  return errorLogger.log(error, { ...context, level: 'info' });
};

export const getErrorLogs = (filters = {}) => errorLogger.getLogs(filters);
export const clearErrorLogs = () => errorLogger.clearLogs();
export const subscribeToErrors = (callback) => errorLogger.subscribe(callback);
export const exportErrorLogs = (format) => errorLogger.exportLogs(format);
export const getErrorStatistics = () => errorLogger.getStatistics();

export default errorLogger;