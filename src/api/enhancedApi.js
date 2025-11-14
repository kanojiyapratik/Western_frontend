/**
 * Enhanced API Client with Retry Logic and Circuit Breaker
 * Provides robust error handling, automatic retries, and fault tolerance
 */

import axios from "axios";
import { getApiBaseUrl } from "../config/api.js";
import { logError, logWarning } from "../utils/ErrorLogger.js";

// Use centralized API URL resolution
function getApiBase() {
  return getApiBaseUrl();
}

// Circuit Breaker States
const CIRCUIT_STATES = {
  CLOSED: 'CLOSED',    // Normal operation
  OPEN: 'OPEN',        // Blocking requests
  HALF_OPEN: 'HALF_OPEN' // Testing if service recovered
};

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,      // Base delay in milliseconds
  maxDelay: 10000,      // Maximum delay in milliseconds
  backoffMultiplier: 2, // Exponential backoff multiplier
  jitter: true,         // Add random jitter to prevent thundering herd
  retryableStatuses: [408, 429, 502, 503, 504], // HTTP status codes to retry
  retryableErrors: [
    'NETWORK_ERROR',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'Failed to fetch',
    'Network Error',
    'Request timeout'
  ]
};

// Circuit Breaker configuration
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,        // Number of failures to open circuit
  successThreshold: 3,        // Number of successes to close circuit (from half-open)
  timeout: 30000,             // Time in ms to wait before trying half-open state
  monitoringPeriod: 60000     // Time period to monitor failures (1 minute)
};

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || CIRCUIT_BREAKER_CONFIG.failureThreshold;
    this.successThreshold = options.successThreshold || CIRCUIT_BREAKER_CONFIG.successThreshold;
    this.timeout = options.timeout || CIRCUIT_BREAKER_CONFIG.timeout;
    this.monitoringPeriod = options.monitoringPeriod || CIRCUIT_BREAKER_CONFIG.monitoringPeriod;
    
    this.state = CIRCUIT_STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;
    
    this.stats = {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      totalTimeouts: 0,
      stateChanges: []
    };
  }

  /**
   * Execute function with circuit breaker protection
   * @param {Function} fn - Function to execute
   * @returns {Promise}
   */
  async execute(fn) {
    this.stats.totalRequests++;
    
    if (this.state === CIRCUIT_STATES.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CIRCUIT_STATES.HALF_OPEN;
        this.logStateChange('HALF_OPEN', 'Circuit breaker reset timeout reached');
      } else {
        this.stats.totalTimeouts++;
        throw new Error(`Circuit breaker is OPEN. Next attempt at ${this.nextAttempt}`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful request
   */
  onSuccess() {
    this.stats.totalSuccesses++;
    
    if (this.state === CIRCUIT_STATES.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.reset();
      }
    } else if (this.state === CIRCUIT_STATES.CLOSED) {
      this.reset();
    }
  }

  /**
   * Handle failed request
   */
  onFailure() {
    this.stats.totalFailures++;
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CIRCUIT_STATES.CLOSED) {
      if (this.failureCount >= this.failureThreshold) {
        this.open();
      }
    } else if (this.state === CIRCUIT_STATES.HALF_OPEN) {
      this.open();
    }
  }

  /**
   * Open the circuit breaker
   */
  open() {
    this.state = CIRCUIT_STATES.OPEN;
    this.nextAttempt = Date.now() + this.timeout;
    this.logStateChange('OPEN', `Failure threshold reached: ${this.failureCount}`);
  }

  /**
   * Reset the circuit breaker
   */
  reset() {
    this.state = CIRCUIT_STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;
    this.logStateChange('CLOSED', 'Circuit breaker reset');
  }

  /**
   * Check if circuit breaker should attempt reset
   * @returns {boolean}
   */
  shouldAttemptReset() {
    return this.nextAttempt && Date.now() >= this.nextAttempt;
  }

  /**
   * Log state change
   * @param {string} newState
   * @param {string} reason
   */
  logStateChange(newState, reason) {
    const change = {
      from: this.state,
      to: newState,
      reason,
      timestamp: new Date().toISOString(),
      stats: { ...this.stats }
    };
    
    this.stats.stateChanges.push(change);
    this.state = newState;
    
    logWarning(`Circuit breaker state changed: ${change.from} -> ${change.to}`, {
      component: 'CircuitBreaker',
      action: 'stateChange',
      details: change
    });
  }

  /**
   * Get circuit breaker status
   * @returns {Object}
   */
  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt,
      stats: this.stats,
      isOpen: this.state === CIRCUIT_STATES.OPEN,
      isHalfOpen: this.state === CIRCUIT_STATES.HALF_OPEN,
      isClosed: this.state === CIRCUIT_STATES.CLOSED
    };
  }
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise}
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = RETRY_CONFIG.maxRetries,
    baseDelay = RETRY_CONFIG.baseDelay,
    maxDelay = RETRY_CONFIG.maxDelay,
    backoffMultiplier = RETRY_CONFIG.backoffMultiplier,
    jitter = RETRY_CONFIG.jitter,
    retryableStatuses = RETRY_CONFIG.retryableStatuses,
    retryableErrors = RETRY_CONFIG.retryableErrors
  } = options;

  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = isRetryableError(error, retryableStatuses, retryableErrors);
      
      if (!isRetryable || attempt > maxRetries) {
        logError(`Non-retryable error or max retries exceeded`, {
          component: 'APIClient',
          action: 'retry',
          attempt,
          maxRetries,
          error: error.message
        });
        break;
      }

      // Calculate delay with exponential backoff and jitter
      const baseDelayMs = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
      const delay = Math.min(baseDelayMs, maxDelay);
      const jitterMs = jitter ? Math.random() * delay * 0.1 : 0;
      const finalDelay = delay + jitterMs;

      logWarning(`Request failed, retrying in ${Math.round(finalDelay)}ms (attempt ${attempt}/${maxRetries + 1})`, {
        component: 'APIClient',
        action: 'retry',
        attempt,
        maxRetries,
        delay: finalDelay,
        error: error.message
      });

      await sleep(finalDelay);
    }
  }

  throw lastError;
}

/**
 * Check if error is retryable
 * @param {Error} error - Error object
 * @param {Array} retryableStatuses - HTTP status codes to retry
 * @param {Array} retryableErrors - Error types to retry
 * @returns {boolean}
 */
function isRetryableError(error, retryableStatuses, retryableErrors) {
  // Check HTTP status codes
  if (error.response) {
    const status = error.response.status;
    if (retryableStatuses.includes(status)) {
      return true;
    }
  }

  // Check error types and messages
  const errorMessage = error.message?.toLowerCase() || '';
  const errorName = error.name?.toLowerCase() || '';
  
  return retryableErrors.some(retryableError => {
    const lowerRetryable = retryableError.toLowerCase();
    return errorMessage.includes(lowerRetryable) || 
           errorName.includes(lowerRetryable) ||
           error.code === retryableError;
  });
}

/**
 * Sleep function for delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Create axios instance with enhanced configuration
const api = axios.create({
  get baseURL() { return getApiBase(); },
  timeout: 30000, // 30 seconds timeout
});

// Create circuit breaker instance
const circuitBreaker = new CircuitBreaker();

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Add request ID for tracking
  config.headers['X-Request-ID'] = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return config;
});

// Enhanced response interceptor with error categorization
api.interceptors.response.use(
  (response) => {
    // Log successful requests in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        requestId: response.config.headers['X-Request-ID']
      });
    }
    return response;
  },
  async (error) => {
    const { config, response, message } = error;
    
    // Categorize error
    const errorCategory = categorizeError(error);
    
    // Log error with detailed context
    logError(`API Request Failed: ${message}`, {
      component: 'APIClient',
      action: 'request',
      category: errorCategory,
      method: config?.method?.toUpperCase(),
      url: config?.url,
      status: response?.status,
      statusText: response?.statusText,
      requestId: config?.headers?.['X-Request-ID'],
      data: config?.data,
      responseData: response?.data
    });

    // Handle specific HTTP status codes
    if (response?.status === 401) {
      // Unauthorized - clear token and redirect
      localStorage.removeItem("token");
      if (window.location.pathname !== '/') {
        window.location.href = "/";
      }
    } else if (response?.status === 403) {
      // Forbidden - user doesn't have permission
      logWarning('Access forbidden', {
        component: 'APIClient',
        action: 'authorization',
        userId: localStorage.getItem('user_id')
      });
    } else if (response?.status >= 500) {
      // Server error - could trigger circuit breaker
      logError('Server error occurred', {
        component: 'APIClient',
        action: 'serverError',
        status: response.status,
        url: config?.url
      });
    }

    return Promise.reject(error);
  }
);

/**
 * Categorize error for better handling
 * @param {Error} error
 * @returns {string}
 */
function categorizeError(error) {
  if (error.response) {
    const status = error.response.status;
    if (status === 401) return 'AUTHENTICATION';
    if (status === 403) return 'AUTHORIZATION';
    if (status === 404) return 'NOT_FOUND';
    if (status === 422) return 'VALIDATION';
    if (status >= 400 && status < 500) return 'CLIENT_ERROR';
    if (status >= 500) return 'SERVER_ERROR';
  }
  
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') return 'NETWORK';
  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') return 'TIMEOUT';
  if (error.message?.includes('Failed to fetch') || error.message?.includes('Network Error')) return 'NETWORK';
  
  return 'UNKNOWN';
}

// Enhanced request method with circuit breaker and retry logic
const enhancedRequest = async (config) => {
  return await circuitBreaker.execute(async () => {
    return await retryWithBackoff(async () => {
      return await api.request(config);
    });
  });
};

// Specific HTTP methods with enhanced error handling
export const enhancedGet = (url, config = {}) => {
  return enhancedRequest({ method: 'GET', url, ...config });
};

export const enhancedPost = (url, data = {}, config = {}) => {
  return enhancedRequest({ method: 'POST', url, data, ...config });
};

export const enhancedPut = (url, data = {}, config = {}) => {
  return enhancedRequest({ method: 'PUT', url, data, ...config });
};

export const enhancedPatch = (url, data = {}, config = {}) => {
  return enhancedRequest({ method: 'PATCH', url, data, ...config });
};

export const enhancedDelete = (url, config = {}) => {
  return enhancedRequest({ method: 'DELETE', url, ...config });
};

// Health check with circuit breaker status
export const getHealthStatus = async () => {
  try {
    const response = await enhancedGet('/health');
    return {
      status: 'healthy',
      circuitBreaker: circuitBreaker.getStatus(),
      data: response.data
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      circuitBreaker: circuitBreaker.getStatus(),
      error: error.message
    };
  }
};

// Reset circuit breaker (admin function)
export const resetCircuitBreaker = () => {
  circuitBreaker.reset();
  logInfo('Circuit breaker manually reset', {
    component: 'APIClient',
    action: 'reset'
  });
};

// Get circuit breaker status
export const getCircuitBreakerStatus = () => circuitBreaker.getStatus();

// Export enhanced API client
export {
  api as enhancedApi,
  circuitBreaker,
  retryWithBackoff,
  categorizeError
};

export default api;