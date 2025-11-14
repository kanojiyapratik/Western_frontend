/**
 * Automatic Error Recovery System
 * Provides intelligent error detection, automatic recovery, and graceful degradation
 */

import { logError, logWarning, logInfo } from './ErrorLogger.js';
import { getUserFriendlyError } from './ErrorMessageManager.js';

class ErrorRecoveryManager {
  constructor() {
    this.recoveryStrategies = new Map();
    this.activeRecoveries = new Map();
    this.recoveryHistory = new Map();
    this.fallbackSystems = new Map();
    this.isOnline = navigator.onLine;
    
    this.initializeRecoveryStrategies();
    this.initializeFallbackSystems();
    this.setupNetworkMonitoring();
    this.setupPerformanceMonitoring();
  }

  /**
   * Initialize recovery strategies for different error types
   */
  initializeRecoveryStrategies() {
    // Network connectivity recovery
    this.setRecoveryStrategy('NETWORK_OFFLINE', {
      name: 'Network Offline Recovery',
      detect: (error) => !navigator.onLine || error.message?.includes('Failed to fetch'),
      recover: async () => {
        return this.recoverFromOfflineState();
      },
      maxAttempts: Infinity,
      backoffDelay: 5000,
      description: 'Retry network requests when connection is restored'
    });

    // API timeout recovery
    this.setRecoveryStrategy('API_TIMEOUT', {
      name: 'API Timeout Recovery',
      detect: (error) => error.code === 'ECONNABORTED' || error.message?.includes('timeout'),
      recover: async (context) => {
        return this.recoverFromAPITimeout(context);
      },
      maxAttempts: 3,
      backoffDelay: 2000,
      description: 'Retry API calls with exponential backoff'
    });

    // Memory leak recovery
    this.setRecoveryStrategy('MEMORY_LEAK', {
      name: 'Memory Leak Recovery',
      detect: () => this.detectMemoryLeak(),
      recover: async () => {
        return this.recoverFromMemoryLeak();
      },
      maxAttempts: 1,
      backoffDelay: 0,
      description: 'Clean up memory and restart critical components'
    });

    // Component state corruption
    this.setRecoveryStrategy('STATE_CORRUPTION', {
      name: 'State Corruption Recovery',
      detect: (error, context) => {
        return context.component && this.detectStateCorruption(context.component);
      },
      recover: async (context) => {
        return this.recoverFromStateCorruption(context);
      },
      maxAttempts: 2,
      backoffDelay: 1000,
      description: 'Reset corrupted component state'
    });

    // Model loading errors
    this.setRecoveryStrategy('MODEL_LOAD_FAILED', {
      name: 'Model Load Recovery',
      detect: (error) => error.message?.includes('model') && error.message?.includes('load'),
      recover: async (context) => {
        return this.recoverFromModelLoadFailure(context);
      },
      maxAttempts: 3,
      backoffDelay: 3000,
      description: 'Retry model loading with fallback options'
    });

    // Authentication token refresh
    this.setRecoveryStrategy('TOKEN_EXPIRED', {
      name: 'Token Refresh Recovery',
      detect: (error) => error.status === 401 || error.message?.includes('token'),
      recover: async () => {
        return this.refreshAuthToken();
      },
      maxAttempts: 2,
      backoffDelay: 1000,
      description: 'Automatically refresh expired authentication tokens'
    });

    // Cache corruption
    this.setRecoveryStrategy('CACHE_CORRUPTION', {
      name: 'Cache Corruption Recovery',
      detect: (error) => {
        return error.message?.includes('cache') || error.message?.includes('storage');
      },
      recover: async () => {
        return this.recoverFromCacheCorruption();
      },
      maxAttempts: 1,
      backoffDelay: 0,
      description: 'Clear and rebuild corrupted caches'
    });

    // 3D renderer errors
    this.setRecoveryStrategy('RENDERER_ERROR', {
      name: 'Renderer Recovery',
      detect: (error) => {
        return error.message?.includes('webgl') || 
               error.message?.includes('renderer') ||
               error.message?.includes('three.js');
      },
      recover: async () => {
        return this.recoverFromRendererError();
      },
      maxAttempts: 2,
      backoffDelay: 2000,
      description: 'Restart 3D renderer with fallbacks'
    });
  }

  /**
   * Initialize fallback systems
   */
  initializeFallbackSystems() {
    // API fallback system
    this.setFallbackSystem('API_FALLBACK', {
      name: 'API Fallback System',
      primary: () => this.getPrimaryAPIEndpoint(),
      fallbacks: [
        () => this.getSecondaryAPIEndpoint(),
        () => this.getCacheAPIEndpoint(),
        () => this.getOfflineAPIEndpoint()
      ],
      healthCheck: async (endpoint) => this.checkEndpointHealth(endpoint)
    });

    // Model loading fallback system
    this.setFallbackSystem('MODEL_FALLBACK', {
      name: 'Model Loading Fallback',
      primary: (modelName) => this.getPrimaryModelSource(modelName),
      fallbacks: [
        (modelName) => this.getCachedModelSource(modelName),
        (modelName) => this.getPlaceholderModelSource(modelName),
        (modelName) => this.getDefaultModelSource(modelName)
      ],
      healthCheck: async (source) => this.checkModelSourceHealth(source)
    });

    // Storage fallback system
    this.setFallbackSystem('STORAGE_FALLBACK', {
      name: 'Storage Fallback',
      primary: () => localStorage,
      fallbacks: [
        () => sessionStorage,
        () => this.getInMemoryStorage(),
        () => this.getCookieStorage()
      ],
      healthCheck: async (storage) => this.checkStorageHealth(storage)
    });
  }

  /**
   * Attempt automatic recovery of an error
   * @param {Error} error - The error to recover from
   * @param {Object} context - Error context
   * @returns {Promise<Object>}
   */
  async attemptRecovery(error, context = {}) {
    const errorId = this.generateErrorId(error, context);
    
    // Check if recovery is already in progress
    if (this.activeRecoveries.has(errorId)) {
      logWarning('Recovery already in progress for this error', {
        component: 'ErrorRecoveryManager',
        action: 'attemptRecovery',
        errorId
      });
      return this.activeRecoveries.get(errorId);
    }

    // Create recovery promise
    const recoveryPromise = this.performRecovery(error, context);
    this.activeRecoveries.set(errorId, recoveryPromise);

    try {
      const result = await recoveryPromise;
      this.activeRecoveries.delete(errorId);
      this.recordSuccessfulRecovery(errorId, context, result);
      
      logInfo('Automatic recovery successful', {
        component: 'ErrorRecoveryManager',
        action: 'attemptRecovery',
        errorId,
        strategy: result.strategy
      });
      
      return result;
    } catch (recoveryError) {
      this.activeRecoveries.delete(errorId);
      this.recordFailedRecovery(errorId, context, recoveryError);
      
      logError('Automatic recovery failed', {
        component: 'ErrorRecoveryManager',
        action: 'attemptRecovery',
        errorId,
        recoveryError: recoveryError.message
      });
      
      return {
        success: false,
        error: recoveryError,
        strategy: null,
        attempts: 0
      };
    }
  }

  /**
   * Perform the actual recovery process
   * @param {Error} error - The original error
   * @param {Object} context - Error context
   * @returns {Promise<Object>}
   */
  async performRecovery(error, context) {
    // Find applicable recovery strategies
    const applicableStrategies = this.findApplicableStrategies(error, context);
    
    if (applicableStrategies.length === 0) {
      throw new Error('No applicable recovery strategy found');
    }

    let bestStrategy = applicableStrategies[0];
    let result = null;
    let attempts = 0;

    for (const strategy of applicableStrategies) {
      attempts = 0;
      
      while (attempts < strategy.maxAttempts) {
        attempts++;
        
        try {
          logInfo(`Attempting recovery with strategy: ${strategy.name}`, {
            component: 'ErrorRecoveryManager',
            action: 'performRecovery',
            strategy: strategy.name,
            attempt: attempts
          });

          result = await strategy.recover(context);
          
          if (result && result.success !== false) {
            return {
              success: true,
              strategy: strategy.name,
              attempts,
              result,
              context
            };
          }
        } catch (strategyError) {
          logWarning(`Recovery strategy ${strategy.name} failed on attempt ${attempts}`, {
            component: 'ErrorRecoveryManager',
            action: 'performRecovery',
            strategy: strategy.name,
            attempt: attempts,
            error: strategyError.message
          });
        }

        // Wait before next attempt
        if (attempts < strategy.maxAttempts) {
          const delay = strategy.backoffDelay * Math.pow(2, attempts - 1);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`All recovery strategies failed after ${attempts} attempts`);
  }

  /**
   * Find applicable recovery strategies for an error
   * @param {Error} error - The error
   * @param {Object} context - Error context
   * @returns {Array}
   */
  findApplicableStrategies(error, context) {
    const applicable = [];
    
    for (const [strategyId, strategy] of this.recoveryStrategies.entries()) {
      try {
        if (strategy.detect(error, context)) {
          applicable.push(strategy);
        }
      } catch (detectError) {
        logWarning(`Error detecting strategy applicability: ${strategyId}`, {
          component: 'ErrorRecoveryManager',
          action: 'findApplicableStrategies',
          detectError: detectError.message
        });
      }
    }
    
    return applicable.sort((a, b) => {
      // Sort by priority (strategy name could include priority info)
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Network connectivity recovery
   */
  async recoverFromOfflineState() {
    if (!navigator.onLine) {
      // Wait for online event
      return new Promise((resolve) => {
        const onOnline = () => {
          window.removeEventListener('online', onOnline);
          resolve({
            success: true,
            action: 'waited_for_connection',
            message: 'Connection restored'
          });
        };
        window.addEventListener('online', onOnline);
        
        // Timeout after 30 seconds
        setTimeout(() => {
          window.removeEventListener('online', onOnline);
          resolve({
            success: false,
            action: 'timeout',
            message: 'Connection not restored within timeout'
          });
        }, 30000);
      });
    }

    return {
      success: true,
      action: 'connection_check',
      message: 'Connection is available'
    };
  }

  /**
   * API timeout recovery
   */
  async recoverFromAPITimeout(context) {
    // Try alternative API endpoint
    const fallbackEndpoints = this.getFallbackSystem('API_FALLBACK');
    if (fallbackEndpoints) {
      for (const endpoint of fallbackEndpoints.fallbacks) {
        try {
          const health = await fallbackEndpoints.healthCheck(endpoint());
          if (health.healthy) {
            // Switch to fallback endpoint
            this.switchToEndpoint(endpoint);
            return {
              success: true,
              action: 'switched_endpoint',
              endpoint: endpoint(),
              message: 'Switched to backup API endpoint'
            };
          }
        } catch (error) {
          logWarning('Fallback endpoint health check failed', error);
        }
      }
    }

    return {
      success: false,
      action: 'no_fallback',
      message: 'No healthy fallback endpoints available'
    };
  }

  /**
   * Memory leak recovery
   */
  async recoverFromMemoryLeak() {
    const memoryUsage = this.getMemoryUsage();
    
    if (memoryUsage > 100) { // 100MB threshold
      // Clear caches
      this.clearAllCaches();
      
      // Force garbage collection if available
      if (window.gc) {
        window.gc();
      }
      
      // Clean up event listeners
      this.cleanupEventListeners();
      
      return {
        success: true,
        action: 'memory_cleanup',
        memoryBefore: memoryUsage,
        memoryAfter: this.getMemoryUsage(),
        message: 'Memory cleaned up successfully'
      };
    }

    return {
      success: false,
      action: 'no_memory_issue',
      message: 'No significant memory usage detected'
    };
  }

  /**
   * State corruption recovery
   */
  async recoverFromStateCorruption(context) {
    const { component } = context;
    
    // Reset component state
    if (window.reactDevTools) {
      // Force component remount if React DevTools is available
      const key = `${component}_recovery_${Date.now()}`;
      this.forceComponentRemount(component, key);
    }
    
    // Clear component-specific caches
    this.clearComponentCache(component);
    
    return {
      success: true,
      action: 'state_reset',
      component,
      message: `State reset for component: ${component}`
    };
  }

  /**
   * Model load failure recovery
   */
  async recoverFromModelLoadFailure(context) {
    const { modelName } = context;
    
    // Try fallback model sources
    const modelFallback = this.getFallbackSystem('MODEL_FALLBACK');
    if (modelFallback) {
      for (const fallbackSource of modelFallback.fallbacks) {
        try {
          const source = fallbackSource(modelName);
          const health = await modelFallback.healthCheck(source);
          if (health.healthy) {
            return {
              success: true,
              action: 'switched_model_source',
              modelName,
              source,
              message: `Switched to fallback model source for: ${modelName}`
            };
          }
        } catch (error) {
          logWarning(`Model fallback ${modelName} failed`, error);
        }
      }
    }

    return {
      success: false,
      action: 'no_model_fallback',
      message: `No fallback model available for: ${modelName}`
    };
  }

  /**
   * Token refresh recovery
   */
  async refreshAuthToken() {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        return {
          success: true,
          action: 'token_refreshed',
          message: 'Authentication token refreshed successfully'
        };
      }

      throw new Error('Token refresh failed');
    } catch (error) {
      // If refresh fails, redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
      
      return {
        success: false,
        action: 'logout_required',
        message: 'Authentication failed, please log in again'
      };
    }
  }

  /**
   * Cache corruption recovery
   */
  async recoverFromCacheCorruption() {
    const storageFallback = this.getFallbackSystem('STORAGE_FALLBACK');
    
    for (const storage of storageFallback.fallbacks) {
      try {
        const health = await storageFallback.healthCheck(storage());
        if (health.healthy) {
          // Migrate data to new storage
          await this.migrateStorageData(storage());
          
          return {
            success: true,
            action: 'storage_migrated',
            storage: storage().constructor.name,
            message: 'Data migrated to healthy storage'
          };
        }
      } catch (error) {
        logWarning('Storage health check failed', error);
      }
    }

    return {
      success: false,
      action: 'no_healthy_storage',
      message: 'No healthy storage available'
    };
  }

  /**
   * Renderer error recovery
   */
  async recoverFromRendererError() {
    // Try to restart Three.js renderer
    if (window.THREE && window.THREE.WebGLRenderer) {
      // Dispose of existing renderer
      if (window.renderer) {
        window.renderer.dispose();
      }
      
      // Create new renderer with fallback settings
      try {
        const newRenderer = new window.THREE.WebGLRenderer({
          antialias: false, // Disable antialias for compatibility
          alpha: false,
          preserveDrawingBuffer: false
        });
        
        window.renderer = newRenderer;
        
        return {
          success: true,
          action: 'renderer_restarted',
          message: '3D renderer restarted successfully'
        };
      } catch (error) {
        logError('Failed to restart renderer', error);
      }
    }

    // Fallback to 2D mode if available
    return {
      success: false,
      action: 'no_3d_fallback',
      message: '3D rendering unavailable, consider 2D fallback'
    };
  }

  // Helper methods for fallback systems

  getPrimaryAPIEndpoint() {
    return process.env.VITE_API_BASE || 'http://localhost:5000';
  }

  getSecondaryAPIEndpoint() {
    return 'https://backup-api.yourapp.com';
  }

  getCacheAPIEndpoint() {
    return '/api/cache';
  }

  getOfflineAPIEndpoint() {
    return '/api/offline';
  }

  async checkEndpointHealth(endpoint) {
    try {
      const response = await fetch(`${endpoint}/health`, { 
        method: 'GET',
        timeout: 5000 
      });
      return { healthy: response.ok, status: response.status };
    } catch {
      return { healthy: false, status: 0 };
    }
  }

  switchToEndpoint(endpoint) {
    // Update API configuration
    if (window.updateApiBase) {
      window.updateApiBase(endpoint());
    }
  }

  getPrimaryModelSource(modelName) {
    return `/models/${modelName}.glb`;
  }

  getCachedModelSource(modelName) {
    return `/cache/models/${modelName}.glb`;
  }

  getPlaceholderModelSource(modelName) {
    return '/models/placeholder.glb';
  }

  getDefaultModelSource(modelName) {
    return '/models/default.glb';
  }

  async checkModelSourceHealth(source) {
    try {
      const response = await fetch(source, { method: 'HEAD' });
      return { healthy: response.ok, status: response.status };
    } catch {
      return { healthy: false, status: 0 };
    }
  }

  getInMemoryStorage() {
    const memoryStorage = new Map();
    return {
      getItem: (key) => memoryStorage.get(key),
      setItem: (key, value) => memoryStorage.set(key, value),
      removeItem: (key) => memoryStorage.delete(key),
      clear: () => memoryStorage.clear()
    };
  }

  getCookieStorage() {
    return {
      getItem: (key) => {
        const match = document.cookie.match(new RegExp('(^| )' + key + '=([^;]+)'));
        return match ? decodeURIComponent(match[2]) : null;
      },
      setItem: (key, value) => {
        document.cookie = `${key}=${encodeURIComponent(value)}; path=/`;
      },
      removeItem: (key) => {
        document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      },
      clear: () => {
        document.cookie.split(";").forEach(c => {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
      }
    };
  }

  async checkStorageHealth(storage) {
    try {
      const testKey = 'health_check';
      storage.setItem(testKey, 'test');
      const retrieved = storage.getItem(testKey);
      storage.removeItem(testKey);
      return { healthy: retrieved === 'test' };
    } catch {
      return { healthy: false };
    }
  }

  async migrateStorageData(targetStorage) {
    // Migrate data from current storage to target storage
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        try {
          const value = localStorage.getItem(key);
          targetStorage.setItem(key, value);
        } catch (error) {
          logWarning(`Failed to migrate ${key}`, error);
        }
      }
    } catch (error) {
      logError('Storage migration failed', error);
    }
  }

  // Detection methods

  detectMemoryLeak() {
    const memory = this.getMemoryUsage();
    return memory > 100; // 100MB threshold
  }

  detectStateCorruption(component) {
    // Check if component has inconsistent state
    const corruptionIndicators = [
      component.includes('undefined'),
      component.includes('null'),
      component.length > 100 // Unusually long component names
    ];
    
    return corruptionIndicators.some(indicator => indicator);
  }

  getMemoryUsage() {
    if (performance.memory) {
      return Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
    }
    return 0;
  }

  // Utility methods

  setRecoveryStrategy(strategyId, strategy) {
    this.recoveryStrategies.set(strategyId, strategy);
  }

  setFallbackSystem(systemId, system) {
    this.fallbackSystems.set(systemId, system);
  }

  getFallbackSystem(systemId) {
    return this.fallbackSystems.get(systemId);
  }

  generateErrorId(error, context) {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${context.component || 'unknown'}`;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cleanup methods

  clearAllCaches() {
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
  }

  cleanupEventListeners() {
    // Remove duplicate event listeners (this is a simplified version)
    if (window._eventListeners) {
      window._eventListeners.forEach(listener => {
        listener.element.removeEventListener(listener.event, listener.handler);
      });
      window._eventListeners = [];
    }
  }

  forceComponentRemount(component, key) {
    // Force React component remount by changing key
    if (window.forceComponentRemount) {
      window.forceComponentRemount(component, key);
    }
  }

  clearComponentCache(component) {
    // Clear component-specific cache entries
    Object.keys(localStorage).forEach(key => {
      if (key.includes(component)) {
        localStorage.removeItem(key);
      }
    });
  }

  // Monitoring setup

  setupNetworkMonitoring() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      logInfo('Network connection restored', {
        component: 'ErrorRecoveryManager',
        action: 'networkChange'
      });
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      logWarning('Network connection lost', {
        component: 'ErrorRecoveryManager',
        action: 'networkChange'
      });
    });
  }

  setupPerformanceMonitoring() {
    // Monitor memory usage periodically
    setInterval(() => {
      const memoryUsage = this.getMemoryUsage();
      if (memoryUsage > 150) { // 150MB threshold
        logWarning('High memory usage detected', {
          component: 'ErrorRecoveryManager',
          action: 'memoryCheck',
          memoryUsage
        });
        
        // Trigger memory cleanup
        this.recoverFromMemoryLeak();
      }
    }, 60000); // Check every minute
  }

  // Record keeping

  recordSuccessfulRecovery(errorId, context, result) {
    const record = {
      errorId,
      context,
      result,
      timestamp: Date.now(),
      status: 'success'
    };

    if (!this.recoveryHistory.has(context.component)) {
      this.recoveryHistory.set(context.component, []);
    }
    
    this.recoveryHistory.get(context.component).push(record);
  }

  recordFailedRecovery(errorId, context, error) {
    const record = {
      errorId,
      context,
      error: error.message,
      timestamp: Date.now(),
      status: 'failed'
    };

    if (!this.recoveryHistory.has(context.component)) {
      this.recoveryHistory.set(context.component, []);
    }
    
    this.recoveryHistory.get(context.component).push(record);
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStatistics() {
    const stats = {};
    
    for (const [component, records] of this.recoveryHistory.entries()) {
      const successful = records.filter(r => r.status === 'success').length;
      const failed = records.filter(r => r.status === 'failed').length;
      
      stats[component] = {
        total: records.length,
        successful,
        failed,
        successRate: successful / (successful + failed) * 100
      };
    }
    
    return {
      totalComponents: Object.keys(stats).length,
      totalRecoveries: Object.values(stats).reduce((sum, stat) => sum + stat.total, 0),
      componentStats: stats,
      activeRecoveries: this.activeRecoveries.size
    };
  }
}

// Create singleton instance
const errorRecoveryManager = new ErrorRecoveryManager();

// Convenience functions
export const attemptAutomaticRecovery = (error, context = {}) => 
  errorRecoveryManager.attemptRecovery(error, context);

export const getRecoveryStatistics = () => 
  errorRecoveryManager.getRecoveryStatistics();

export const setRecoveryStrategy = (strategyId, strategy) => 
  errorRecoveryManager.setRecoveryStrategy(strategyId, strategy);

export const setFallbackSystem = (systemId, system) => 
  errorRecoveryManager.setFallbackSystem(systemId, system);

export default errorRecoveryManager;