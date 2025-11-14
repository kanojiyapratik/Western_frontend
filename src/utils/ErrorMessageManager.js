/**
 * User-Friendly Error Message System
 * Translates technical errors into user-friendly messages with actionable guidance
 */

import { logError } from './ErrorLogger.js';

class ErrorMessageManager {
  constructor() {
    this.messageTemplates = new Map();
    this.fallbackMessages = new Map();
    this.userContext = {
      isLoggedIn: false,
      userRole: 'guest',
      currentPage: '',
      userAgent: navigator.userAgent
    };
    
    this.initializeMessageTemplates();
  }

  /**
   * Initialize message templates for different error types
   */
  initializeMessageTemplates() {
    // Authentication errors
    this.setMessageTemplate('AUTH_INVALID_CREDENTIALS', {
      userMessage: 'Invalid email or password. Please check your credentials and try again.',
      technicalMessage: 'Authentication failed: Invalid credentials provided',
      action: 'Check email and password, ensure caps lock is off',
      showRetry: true,
      showSupport: false,
      severity: 'medium'
    });

    this.setMessageTemplate('AUTH_TOKEN_EXPIRED', {
      userMessage: 'Your session has expired. Please log in again to continue.',
      technicalMessage: 'JWT token has expired',
      action: 'Redirect to login page',
      showRetry: false,
      showSupport: false,
      severity: 'low'
    });

    this.setMessageTemplate('AUTH_INSUFFICIENT_PERMISSIONS', {
      userMessage: 'You don\'t have permission to access this resource.',
      technicalMessage: 'User lacks required permissions',
      action: 'Contact administrator for access rights',
      showRetry: false,
      showSupport: true,
      severity: 'medium'
    });

    // Network errors
    this.setMessageTemplate('NETWORK_CONNECTION_FAILED', {
      userMessage: 'Unable to connect to the server. Please check your internet connection.',
      technicalMessage: 'Network connection failed',
      action: 'Check internet connection and try again',
      showRetry: true,
      showSupport: false,
      severity: 'high'
    });

    this.setMessageTemplate('NETWORK_TIMEOUT', {
      userMessage: 'The request is taking longer than expected. Please try again.',
      technicalMessage: 'Request timeout',
      action: 'Retry request or check network speed',
      showRetry: true,
      showSupport: false,
      severity: 'medium'
    });

    this.setMessageTemplate('NETWORK_SERVER_ERROR', {
      userMessage: 'Our servers are experiencing issues. Please try again in a few moments.',
      technicalMessage: 'Server returned 5xx error',
      action: 'Wait and retry, or contact support if persistent',
      showRetry: true,
      showSupport: true,
      severity: 'high'
    });

    // Validation errors
    this.setMessageTemplate('VALIDATION_REQUIRED_FIELD', {
      userMessage: 'Please fill in all required fields.',
      technicalMessage: 'Required field validation failed',
      action: 'Complete all required fields',
      showRetry: false,
      showSupport: false,
      severity: 'low'
    });

    this.setMessageTemplate('VALIDATION_INVALID_EMAIL', {
      userMessage: 'Please enter a valid email address.',
      technicalMessage: 'Email format validation failed',
      action: 'Enter email in format: user@example.com',
      showRetry: false,
      showSupport: false,
      severity: 'low'
    });

    this.setMessageTemplate('VALIDATION_FILE_TOO_LARGE', {
      userMessage: 'The file you selected is too large. Please choose a smaller file.',
      technicalMessage: 'File size exceeds upload limit',
      action: 'Select a file smaller than the size limit',
      showRetry: false,
      showSupport: false,
      severity: 'medium'
    });

    // Model/3D errors
    this.setMessageTemplate('MODEL_LOAD_FAILED', {
      userMessage: 'Unable to load the 3D model. The file may be corrupted or in an unsupported format.',
      technicalMessage: '3D model loading failed',
      action: 'Check file format (GLB/GLTF) and try again',
      showRetry: true,
      showSupport: true,
      severity: 'high'
    });

    this.setMessageTemplate('MODEL_TEXTURE_FAILED', {
      userMessage: 'Unable to apply the texture. Please try a different image file.',
      technicalMessage: 'Texture application failed',
      action: 'Use a valid image file (JPG, PNG)',
      showRetry: true,
      showSupport: false,
      severity: 'medium'
    });

    this.setMessageTemplate('MODEL_RENDER_FAILED', {
      userMessage: 'The 3D viewer encountered an error. Please refresh the page and try again.',
      technicalMessage: '3D rendering failed',
      action: 'Refresh page and retry',
      showRetry: true,
      showSupport: true,
      severity: 'high'
    });

    // Upload errors
    this.setMessageTemplate('UPLOAD_FAILED', {
      userMessage: 'Upload failed. Please check your file and try again.',
      technicalMessage: 'File upload failed',
      action: 'Verify file format and size, then retry',
      showRetry: true,
      showSupport: false,
      severity: 'medium'
    });

    this.setMessageTemplate('UPLOAD_STORAGE_FULL', {
      userMessage: 'Storage limit reached. Please delete some files or contact support.',
      technicalMessage: 'Storage quota exceeded',
      action: 'Free up storage space',
      showRetry: false,
      showSupport: true,
      severity: 'high'
    });

    // API errors
    this.setMessageTemplate('API_ENDPOINT_NOT_FOUND', {
      userMessage: 'The requested page or resource could not be found.',
      technicalMessage: 'API endpoint returned 404',
      action: 'Check the URL or navigate back',
      showRetry: false,
      showSupport: false,
      severity: 'medium'
    });

    this.setMessageTemplate('API_RATE_LIMITED', {
      userMessage: 'Too many requests. Please wait a moment before trying again.',
      technicalMessage: 'Rate limit exceeded',
      action: 'Wait before making more requests',
      showRetry: true,
      showSupport: false,
      severity: 'low'
    });

    // System errors
    this.setMessageTemplate('SYSTEM_MAINTENANCE', {
      userMessage: 'The system is currently undergoing maintenance. Please try again later.',
      technicalMessage: 'System maintenance mode',
      action: 'Wait for maintenance to complete',
      showRetry: true,
      showSupport: false,
      severity: 'high'
    });

    this.setMessageTemplate('SYSTEM_OVERLOADED', {
      userMessage: 'The system is busy right now. Please try again in a few minutes.',
      technicalMessage: 'System overloaded',
      action: 'Wait and retry later',
      showRetry: true,
      showSupport: false,
      severity: 'medium'
    });

    // Setup fallback messages
    this.fallbackMessages.set('development', {
      userMessage: 'An unexpected error occurred. Our team has been notified.',
      technicalMessage: 'Unhandled error with no template',
      action: 'Check console for details and report if persistent',
      showRetry: true,
      showSupport: true,
      severity: 'medium'
    });

    this.fallbackMessages.set('production', {
      userMessage: 'Something went wrong. Please try refreshing the page.',
      technicalMessage: 'Unhandled error in production',
      action: 'Refresh the page or try again later',
      showRetry: true,
      showSupport: true,
      severity: 'medium'
    });
  }

  /**
   * Set a message template
   * @param {string} errorCode - Error code
   * @param {Object} template - Message template
   */
  setMessageTemplate(errorCode, template) {
    this.messageTemplates.set(errorCode, {
      ...template,
      id: errorCode
    });
  }

  /**
   * Get user-friendly error message
   * @param {Error|string} error - Error object or message
   * @param {Object} context - Additional context
   * @returns {Object}
   */
  getErrorMessage(error, context = {}) {
    const errorInfo = this.extractErrorInfo(error);
    const errorCode = this.determineErrorCode(errorInfo, context);
    const template = this.messageTemplates.get(errorCode) || this.getFallbackTemplate();
    
    // Customize message based on user context
    const customizedMessage = this.customizeMessage(template, errorInfo, context);
    
    // Log the error for monitoring
    this.logErrorForMonitoring(error, errorCode, context);
    
    return {
      ...customizedMessage,
      id: errorCode,
      timestamp: new Date().toISOString(),
      errorInfo: {
        ...errorInfo,
        stack: process.env.NODE_ENV === 'development' ? errorInfo.stack : undefined
      },
      context: {
        ...context,
        userAgent: this.userContext.userAgent,
        page: this.userContext.currentPage,
        isLoggedIn: this.userContext.isLoggedIn
      }
    };
  }

  /**
   * Extract error information from error object or string
   * @param {Error|string} error
   * @returns {Object}
   */
  extractErrorInfo(error) {
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
      status: error.status || error.statusCode || null,
      response: error.response || null,
      originalError: error.originalError || null
    };
  }

  /**
   * Determine error code based on error information and context
   * @param {Object} errorInfo - Extracted error information
   * @param {Object} context - Error context
   * @returns {string}
   */
  determineErrorCode(errorInfo, context) {
    const { message, status, code, name, response } = errorInfo;
    const lowerMessage = message.toLowerCase();

    // Authentication errors
    if (status === 401 || lowerMessage.includes('unauthorized') || lowerMessage.includes('invalid token')) {
      return 'AUTH_TOKEN_EXPIRED';
    }
    
    if (status === 403 || lowerMessage.includes('forbidden') || lowerMessage.includes('permission')) {
      return 'AUTH_INSUFFICIENT_PERMISSIONS';
    }
    
    if (lowerMessage.includes('invalid') && lowerMessage.includes('password')) {
      return 'AUTH_INVALID_CREDENTIALS';
    }

    // Network errors
    if (lowerMessage.includes('failed to fetch') || lowerMessage.includes('network error')) {
      return 'NETWORK_CONNECTION_FAILED';
    }
    
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return 'NETWORK_TIMEOUT';
    }
    
    if (status >= 500) {
      return 'NETWORK_SERVER_ERROR';
    }

    // Validation errors
    if (lowerMessage.includes('required') || lowerMessage.includes('must be provided')) {
      return 'VALIDATION_REQUIRED_FIELD';
    }
    
    if (lowerMessage.includes('email') && lowerMessage.includes('invalid')) {
      return 'VALIDATION_INVALID_EMAIL';
    }
    
    if (lowerMessage.includes('file too large') || lowerMessage.includes('size limit')) {
      return 'VALIDATION_FILE_TOO_LARGE';
    }

    // Model/3D errors
    if (lowerMessage.includes('model') && lowerMessage.includes('load')) {
      return 'MODEL_LOAD_FAILED';
    }
    
    if (lowerMessage.includes('texture') || lowerMessage.includes('material')) {
      return 'MODEL_TEXTURE_FAILED';
    }
    
    if (lowerMessage.includes('render') || lowerMessage.includes('scene')) {
      return 'MODEL_RENDER_FAILED';
    }

    // Upload errors
    if (lowerMessage.includes('upload') && lowerMessage.includes('fail')) {
      return 'UPLOAD_FAILED';
    }
    
    if (lowerMessage.includes('storage') || lowerMessage.includes('quota') || lowerMessage.includes('limit')) {
      return 'UPLOAD_STORAGE_FULL';
    }

    // API errors
    if (status === 404 || lowerMessage.includes('not found')) {
      return 'API_ENDPOINT_NOT_FOUND';
    }
    
    if (status === 429 || lowerMessage.includes('rate limit')) {
      return 'API_RATE_LIMITED';
    }

    // System errors
    if (lowerMessage.includes('maintenance')) {
      return 'SYSTEM_MAINTENANCE';
    }
    
    if (lowerMessage.includes('overload') || lowerMessage.includes('busy')) {
      return 'SYSTEM_OVERLOADED';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Get fallback template for unknown errors
   * @returns {Object}
   */
  getFallbackTemplate() {
    const environment = process.env.NODE_ENV === 'development' ? 'development' : 'production';
    return this.fallbackMessages.get(environment);
  }

  /**
   * Customize message based on user context
   * @param {Object} template - Message template
   * @param {Object} errorInfo - Error information
   * @param {Object} context - Error context
   * @returns {Object}
   */
  customizeMessage(template, errorInfo, context) {
    let customized = { ...template };

    // Customize based on user role
    if (this.userContext.userRole === 'admin') {
      customized.userMessage += ' (Administrator)';
    }

    // Customize based on current page
    if (this.userContext.currentPage) {
      customized.context = {
        ...customized.context,
        page: this.userContext.currentPage
      };
    }

    // Add specific details from error
    if (errorInfo.status) {
      customized.technicalDetails = `HTTP Status: ${errorInfo.status}`;
    }

    if (errorInfo.code) {
      customized.technicalDetails = `${customized.technicalDetails || ''} | Error Code: ${errorInfo.code}`;
    }

    // Add retry information for network errors
    if (template.showRetry && context.attempt) {
      customized.retryInfo = {
        attempt: context.attempt,
        maxAttempts: context.maxAttempts || 3,
        nextRetryIn: this.calculateNextRetryDelay(context.attempt)
      };
    }

    return customized;
  }

  /**
   * Calculate next retry delay
   * @param {number} attempt - Current attempt number
   * @returns {number}
   */
  calculateNextRetryDelay(attempt) {
    const baseDelay = 1000; // 1 second
    const maxDelay = 10000; // 10 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    return delay;
  }

  /**
   * Log error for monitoring
   * @param {Error|string} error - Original error
   * @param {string} errorCode - Determined error code
   * @param {Object} context - Error context
   */
  logErrorForMonitoring(error, errorCode, context) {
    logError(error, {
      component: 'ErrorMessageManager',
      action: 'getErrorMessage',
      errorCode,
      userContext: this.userContext,
      context
    });
  }

  /**
   * Update user context
   * @param {Object} context - New context
   */
  updateUserContext(context) {
    this.userContext = {
      ...this.userContext,
      ...context
    };
  }

  /**
   * Get available error codes
   * @returns {Array}
   */
  getAvailableErrorCodes() {
    return Array.from(this.messageTemplates.keys());
  }

  /**
   * Get message template for an error code
   * @param {string} errorCode - Error code
   * @returns {Object|null}
   */
  getMessageTemplate(errorCode) {
    return this.messageTemplates.get(errorCode) || null;
  }

  /**
   * Create error message with multiple fallback levels
   * @param {Error|string} error - Primary error
   * @param {Array} fallbackErrors - Array of fallback errors
   * @param {Object} context - Error context
   * @returns {Object}
   */
  createHierarchicalMessage(error, fallbackErrors = [], context = {}) {
    // Try primary error
    let message = this.getErrorMessage(error, context);
    
    // If primary error has generic message, try fallbacks
    if (message.technicalMessage === this.getFallbackTemplate().technicalMessage) {
      for (const fallbackError of fallbackErrors) {
        const fallbackMessage = this.getErrorMessage(fallbackError, { ...context, isFallback: true });
        if (fallbackMessage.technicalMessage !== this.getFallbackTemplate().technicalMessage) {
          message = {
            ...message,
            hierarchicalMessage: fallbackMessage.userMessage,
            fallbackUsed: true
          };
          break;
        }
      }
    }
    
    return message;
  }

  /**
   * Create action suggestions based on error and context
   * @param {Object} errorMessage - Error message object
   * @returns {Array}
   */
  getActionSuggestions(errorMessage) {
    const suggestions = [];
    
    if (errorMessage.showRetry) {
      suggestions.push({
        type: 'retry',
        label: 'Try Again',
        priority: 1
      });
    }
    
    if (errorMessage.showSupport) {
      suggestions.push({
        type: 'support',
        label: 'Contact Support',
        priority: 2
      });
    }
    
    if (errorMessage.id.includes('VALIDATION')) {
      suggestions.push({
        type: 'help',
        label: 'Show Help',
        priority: 1
      });
    }
    
    return suggestions.sort((a, b) => a.priority - b.priority);
  }
}

// Create singleton instance
const errorMessageManager = new ErrorMessageManager();

// Convenience functions
export const getUserFriendlyError = (error, context = {}) => 
  errorMessageManager.getErrorMessage(error, context);

export const updateErrorUserContext = (context) => 
  errorMessageManager.updateUserContext(context);

export const getErrorActionSuggestions = (errorMessage) => 
  errorMessageManager.getActionSuggestions(errorMessage);

export const createHierarchicalErrorMessage = (error, fallbackErrors = [], context = {}) => 
  errorMessageManager.createHierarchicalMessage(error, fallbackErrors, context);

export const getAvailableErrorCodes = () => 
  errorMessageManager.getAvailableErrorCodes();

export const getMessageTemplate = (errorCode) => 
  errorMessageManager.getMessageTemplate(errorCode);

export default errorMessageManager;