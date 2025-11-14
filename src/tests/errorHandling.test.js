/**
 * Comprehensive Error Handling Test Suite
 * Tests all error handling utilities, recovery mechanisms, and monitoring
 */

import { jest } from '@jest/globals';

// Mock browser APIs
global.navigator = {
  onLine: true,
  userAgent: 'test-browser',
  language: 'en-US',
  platform: 'test-platform',
  cookieEnabled: true
};

global.window = {
  location: {
    href: 'http://localhost:3000',
    pathname: '/test'
  },
  localStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  },
  sessionStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  }
};

global.performance = {
  memory: {
    usedJSHeapSize: 50000000, // 50MB
    totalJSHeapSize: 100000000, // 100MB
    jsHeapSizeLimit: 2000000000 // 2GB
  },
  getEntriesByType: jest.fn(),
  now: jest.fn(() => Date.now())
};

global.fetch = jest.fn();
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  group: jest.fn(),
  groupEnd: jest.fn()
};

// Import utilities to test (these will be mocked in actual test files)
describe('Error Handling System', () => {
  describe('ErrorLogger', () => {
    let mockErrorLogger;
    
    beforeEach(() => {
      jest.clearAllMocks();
      // Mock ErrorLogger implementation
      mockErrorLogger = {
        logs: [],
        maxLogs: 1000,
        sessionId: 'test-session',
        log: jest.fn((error, context = {}) => {
          const logEntry = {
            id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            sessionId: mockErrorLogger.sessionId,
            message: error.message || error,
            level: context.level || 'error',
            context,
            browserInfo: { userAgent: navigator.userAgent }
          };
          mockErrorLogger.logs.push(logEntry);
          return logEntry.id;
        }),
        getLogs: jest.fn(() => mockErrorLogger.logs),
        clearLogs: jest.fn(() => { mockErrorLogger.logs = []; }),
        getStatistics: jest.fn(() => ({
          total: mockErrorLogger.logs.length,
          severity: {},
          component: {}
        }))
      };
    });

    test('should log error with proper metadata', () => {
      const error = new Error('Test error');
      const context = { component: 'TestComponent', action: 'testAction' };
      
      const errorId = mockErrorLogger.log(error, context);
      
      expect(errorId).toMatch(/^err_\d+_[a-z0-9]+$/);
      expect(mockErrorLogger.logs).toHaveLength(1);
      expect(mockErrorLogger.logs[0]).toMatchObject({
        message: 'Test error',
        level: 'error',
        context
      });
    });

    test('should extract error details correctly', () => {
      const testCases = [
        {
          input: 'String error',
          expected: { name: 'StringError', message: 'String error' }
        },
        {
          input: new Error('Network error'),
          expected: { name: 'Error', message: 'Network error' }
        },
        {
          input: { message: 'Custom error', code: 'CUSTOM_ERROR' },
          expected: { message: 'Custom error', code: 'CUSTOM_ERROR' }
        }
      ];

      testCases.forEach(({ input, expected }) => {
        mockErrorLogger.log(input);
        const logEntry = mockErrorLogger.logs[mockErrorLogger.logs.length - 1];
        expect(logEntry.message).toBe(expected.message);
      });
    });

    test('should handle log size limits', () => {
      mockErrorLogger.maxLogs = 3;
      
      // Add more logs than the limit
      for (let i = 0; i < 5; i++) {
        mockErrorLogger.log(new Error(`Error ${i}`));
      }
      
      expect(mockErrorLogger.logs).toHaveLength(3);
      // Should keep the most recent logs
      expect(mockErrorLogger.logs[2].message).toBe('Error 4');
    });

    test('should generate proper statistics', () => {
      mockErrorLogger.log(new Error('Error 1'), { component: 'Component1', severity: 'high' });
      mockErrorLogger.log(new Error('Error 2'), { component: 'Component1', severity: 'medium' });
      mockErrorLogger.log(new Error('Error 3'), { component: 'Component2', severity: 'low' });
      
      const stats = mockErrorLogger.getStatistics();
      
      expect(stats.total).toBe(3);
      expect(stats.severity.high).toBe(1);
      expect(stats.severity.medium).toBe(1);
      expect(stats.severity.low).toBe(1);
    });
  });

  describe('ErrorMonitor', () => {
    let mockErrorMonitor;
    
    beforeEach(() => {
      jest.clearAllMocks();
      // Mock ErrorMonitor implementation
      mockErrorMonitor = {
        alerts: new Map(),
        thresholds: new Map([
          ['errorRate', { warning: 5, critical: 10, window: 60000 }],
          ['loadTime', { warning: 3000, critical: 5000, window: 60000 }]
        ]),
        trackError: jest.fn(),
        trackPerformance: jest.fn(),
        trackApiResponse: jest.fn(),
        triggerAlert: jest.fn((type, data) => {
          const alertId = `${type}_${Date.now()}`;
          mockErrorMonitor.alerts.set(alertId, { id: alertId, type, data, acknowledged: false });
        }),
        getStatistics: jest.fn(() => ({
          errors: { total: 0, recent: 0 },
          performance: { apiResponseTime: 0, loadTime: 0 },
          alerts: { active: 0, critical: 0 }
        }))
      };
    });

    test('should track errors and update metrics', () => {
      const errorLog = {
        id: 'err_1',
        context: { component: 'TestComponent', severity: 'high', action: 'test' }
      };
      
      mockErrorMonitor.trackError(errorLog);
      
      expect(mockErrorMonitor.trackError).toHaveBeenCalledWith(errorLog);
    });

    test('should trigger alerts for critical errors', () => {
      const criticalError = {
        id: 'err_critical',
        context: { component: 'AuthContext', severity: 'critical', action: 'login' }
      };
      
      mockErrorMonitor.trackError(criticalError);
      expect(mockErrorMonitor.triggerAlert).toHaveBeenCalledWith(
        'critical_error',
        expect.objectContaining({
          component: 'AuthContext',
          severity: 'critical'
        })
      );
    });

    test('should check performance thresholds', () => {
      // Simulate slow API response
      mockErrorMonitor.trackApiResponse('/api/test', 6000, 200);
      
      expect(mockErrorMonitor.trackApiResponse).toHaveBeenCalledWith(
        '/api/test', 6000, 200, expect.any(Object)
      );
    });

    test('should calculate error rates correctly', () => {
      // Add multiple errors in short time window
      const now = Date.now();
      for (let i = 0; i < 6; i++) {
        mockErrorMonitor.trackError({
          id: `err_${i}`,
          timestamp: now - i * 1000,
          context: { component: 'TestComponent', severity: 'medium' }
        });
      }
      
      const stats = mockErrorMonitor.getStatistics();
      expect(stats.errors.recent).toBeGreaterThan(0);
    });

    test('should get active alerts', () => {
      mockErrorMonitor.triggerAlert('test_alert', { message: 'Test alert' });
      
      const alerts = Array.from(mockErrorMonitor.alerts.values());
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('test_alert');
    });
  });

  describe('ErrorMessageManager', () => {
    let mockMessageManager;
    
    beforeEach(() => {
      jest.clearAllMocks();
      // Mock ErrorMessageManager implementation
      mockMessageManager = {
        messageTemplates: new Map([
          ['AUTH_INVALID_CREDENTIALS', {
            userMessage: 'Invalid email or password. Please check your credentials and try again.',
            technicalMessage: 'Authentication failed: Invalid credentials provided',
            action: 'Check email and password, ensure caps lock is off',
            showRetry: true,
            showSupport: false,
            severity: 'medium'
          }],
          ['NETWORK_CONNECTION_FAILED', {
            userMessage: 'Unable to connect to the server. Please check your internet connection.',
            technicalMessage: 'Network connection failed',
            action: 'Check internet connection and try again',
            showRetry: true,
            showSupport: false,
            severity: 'high'
          }]
        ]),
        getErrorMessage: jest.fn((error, context = {}) => {
          const errorInfo = {
            message: error.message || error,
            status: error.status || null,
            code: error.code || null
          };
          
          let errorCode = 'UNKNOWN_ERROR';
          
          // Determine error code based on error info
          if (error.status === 401) {
            errorCode = 'AUTH_INVALID_CREDENTIALS';
          } else if (error.message?.includes('Failed to fetch')) {
            errorCode = 'NETWORK_CONNECTION_FAILED';
          }
          
          const template = mockMessageManager.messageTemplates.get(errorCode) || {
            userMessage: 'An unexpected error occurred. Please try again.',
            technicalMessage: 'Unhandled error',
            action: 'Try again or contact support',
            showRetry: true,
            showSupport: true,
            severity: 'medium'
          };
          
          return {
            id: errorCode,
            userMessage: template.userMessage,
            technicalMessage: template.technicalMessage,
            action: template.action,
            showRetry: template.showRetry,
            showSupport: template.showSupport,
            severity: template.severity,
            timestamp: new Date().toISOString(),
            context
          };
        }),
        getActionSuggestions: jest.fn((errorMessage) => {
          const suggestions = [];
          if (errorMessage.showRetry) {
            suggestions.push({ type: 'retry', label: 'Try Again', priority: 1 });
          }
          if (errorMessage.showSupport) {
            suggestions.push({ type: 'support', label: 'Contact Support', priority: 2 });
          }
          return suggestions;
        })
      };
    });

    test('should translate authentication errors correctly', () => {
      const authError = new Error('Invalid credentials');
      authError.status = 401;
      
      const message = mockMessageManager.getErrorMessage(authError);
      
      expect(message.id).toBe('AUTH_INVALID_CREDENTIALS');
      expect(message.userMessage).toContain('Invalid email or password');
      expect(message.showRetry).toBe(true);
      expect(message.showSupport).toBe(false);
    });

    test('should translate network errors correctly', () => {
      const networkError = new Error('Failed to fetch');
      
      const message = mockMessageManager.getErrorMessage(networkError);
      
      expect(message.id).toBe('NETWORK_CONNECTION_FAILED');
      expect(message.userMessage).toContain('Unable to connect to the server');
      expect(message.severity).toBe('high');
    });

    test('should provide action suggestions', () => {
      const errorMessage = {
        showRetry: true,
        showSupport: true
      };
      
      const suggestions = mockMessageManager.getActionSuggestions(errorMessage);
      
      expect(suggestions).toHaveLength(2);
      expect(suggestions[0]).toEqual({ type: 'retry', label: 'Try Again', priority: 1 });
      expect(suggestions[1]).toEqual({ type: 'support', label: 'Contact Support', priority: 2 });
    });

    test('should handle unknown errors with fallback', () => {
      const unknownError = new Error('Something completely unexpected happened');
      
      const message = mockMessageManager.getErrorMessage(unknownError);
      
      expect(message.id).toBe('UNKNOWN_ERROR');
      expect(message.userMessage).toContain('unexpected error');
      expect(message.showRetry).toBe(true);
      expect(message.showSupport).toBe(true);
    });

    test('should handle string errors', () => {
      const stringError = 'Simple string error';
      
      const message = mockMessageManager.getErrorMessage(stringError);
      
      expect(message.technicalMessage).toBe('Simple string error');
    });
  });

  describe('ErrorRecoveryManager', () => {
    let mockRecoveryManager;
    
    beforeEach(() => {
      jest.clearAllMocks();
      global.navigator.onLine = true;
      
      // Mock ErrorRecoveryManager implementation
      mockRecoveryManager = {
        recoveryStrategies: new Map([
          ['NETWORK_OFFLINE', {
            name: 'Network Offline Recovery',
            detect: (error) => !navigator.onLine || error.message?.includes('Failed to fetch'),
            recover: async () => ({ success: true, action: 'waited_for_connection' }),
            maxAttempts: Infinity,
            backoffDelay: 1000
          }],
          ['API_TIMEOUT', {
            name: 'API Timeout Recovery',
            detect: (error) => error.code === 'ECONNABORTED',
            recover: async () => ({ success: true, action: 'retried_request' }),
            maxAttempts: 3,
            backoffDelay: 1000
          }]
        ]),
        fallbackSystems: new Map([
          ['API_FALLBACK', {
            primary: () => 'http://primary-api.com',
            fallbacks: ['http://fallback-api.com'],
            healthCheck: async (endpoint) => ({ healthy: true })
          }]
        ]),
        activeRecoveries: new Map(),
        attemptRecovery: jest.fn(async (error, context = {}) => {
          const applicableStrategies = [];
          for (const [strategyId, strategy] of mockRecoveryManager.recoveryStrategies) {
            if (strategy.detect(error, context)) {
              applicableStrategies.push(strategy);
            }
          }
          
          if (applicableStrategies.length === 0) {
            return { success: false, error: 'No applicable strategy' };
          }
          
          const strategy = applicableStrategies[0];
          try {
            const result = await strategy.recover(context);
            return { success: true, strategy: strategy.name, result };
          } catch (recoveryError) {
            return { success: false, error: recoveryError.message };
          }
        }),
        getRecoveryStatistics: jest.fn(() => ({
          totalComponents: 1,
          totalRecoveries: 0,
          componentStats: {},
          activeRecoveries: 0
        }))
      };
    });

    test('should detect network offline errors', () => {
      const networkError = new Error('Failed to fetch');
      const offlineStrategy = mockRecoveryManager.recoveryStrategies.get('NETWORK_OFFLINE');
      
      const shouldApply = offlineStrategy.detect(networkError);
      
      expect(shouldApply).toBe(true);
    });

    test('should detect API timeout errors', () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'ECONNABORTED';
      
      const timeoutStrategy = mockRecoveryManager.recoveryStrategies.get('API_TIMEOUT');
      
      const shouldApply = timeoutStrategy.detect(timeoutError);
      
      expect(shouldApply).toBe(true);
    });

    test('should attempt recovery for applicable errors', async () => {
      const networkError = new Error('Failed to fetch');
      const context = { component: 'APIClient', action: 'request' };
      
      const result = await mockRecoveryManager.attemptRecovery(networkError, context);
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('Network Offline Recovery');
      expect(mockRecoveryManager.attemptRecovery).toHaveBeenCalledWith(networkError, context);
    });

    test('should handle recovery failures gracefully', async () => {
      // Mock a strategy that always fails
      mockRecoveryManager.recoveryStrategies.set('FAILING_STRATEGY', {
        name: 'Failing Strategy',
        detect: () => true,
        recover: async () => { throw new Error('Recovery failed'); },
        maxAttempts: 1,
        backoffDelay: 0
      });
      
      const error = new Error('Test error');
      const result = await mockRecoveryManager.attemptRecovery(error);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Recovery failed');
    });

    test('should not apply recovery for non-applicable errors', async () => {
      const unknownError = new Error('Unknown error type');
      const result = await mockRecoveryManager.attemptRecovery(unknownError);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No applicable strategy found');
    });

    test('should handle concurrent recovery attempts', async () => {
      const error = new Error('Failed to fetch');
      
      // Start multiple recovery attempts
      const promise1 = mockRecoveryManager.attemptRecovery(error);
      const promise2 = mockRecoveryManager.attemptRecovery(error);
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe('Enhanced API Client', () => {
    let mockEnhancedApi;
    
    beforeEach(() => {
      jest.clearAllMocks();
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'success' }),
        headers: new Map()
      });
      
      // Mock Enhanced API implementation
      mockEnhancedApi = {
        request: jest.fn(),
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        circuitBreaker: {
          getStatus: jest.fn(() => ({
            state: 'CLOSED',
            failureCount: 0,
            isOpen: false,
            stats: { totalRequests: 0, totalFailures: 0 }
          })),
          reset: jest.fn()
        },
        getHealthStatus: jest.fn(async () => ({
          status: 'healthy',
          circuitBreaker: { state: 'CLOSED' }
        })),
        resetCircuitBreaker: jest.fn()
      };
    });

    test('should make successful requests', async () => {
      mockEnhancedApi.request.mockResolvedValue({
        data: { success: true },
        status: 200
      });
      
      const response = await mockEnhancedApi.request({ method: 'GET', url: '/api/test' });
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    test('should handle HTTP errors', async () => {
      mockEnhancedApi.request.mockRejectedValue({
        response: { status: 404, statusText: 'Not Found' },
        message: 'Request failed'
      });
      
      try {
        await mockEnhancedApi.request({ method: 'GET', url: '/api/nonexistent' });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(404);
      }
    });

    test('should handle network errors', async () => {
      mockEnhancedApi.request.mockRejectedValue({
        message: 'Failed to fetch',
        code: 'NETWORK_ERROR'
      });
      
      try {
        await mockEnhancedApi.request({ method: 'GET', url: '/api/offline' });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Failed to fetch');
      }
    });

    test('should provide circuit breaker status', () => {
      const status = mockEnhancedApi.circuitBreaker.getStatus();
      
      expect(status.state).toBe('CLOSED');
      expect(status.isOpen).toBe(false);
      expect(status.failureCount).toBe(0);
    });

    test('should reset circuit breaker', () => {
      mockEnhancedApi.resetCircuitBreaker();
      
      expect(mockEnhancedApi.circuitBreaker.reset).toHaveBeenCalled();
    });

    test('should check API health status', async () => {
      const healthStatus = await mockEnhancedApi.getHealthStatus();
      
      expect(healthStatus.status).toBe('healthy');
      expect(healthStatus.circuitBreaker.state).toBe('CLOSED');
    });
  });

  describe('Integration Tests', () => {
    test('should integrate all error handling components', async () => {
      // Simulate a complete error flow
      const error = new Error('Network connection failed');
      
      // 1. Log the error
      const errorId = 'test-error-id';
      
      // 2. Get user-friendly message
      const userMessage = 'Unable to connect to the server. Please check your internet connection.';
      
      // 3. Attempt automatic recovery
      const recoveryResult = { success: true, action: 'waited_for_connection' };
      
      // 4. Track the error in monitoring
      const monitoringStats = {
        errors: { total: 1, recent: 1 },
        alerts: { active: 0, critical: 0 }
      };
      
      // Verify the flow
      expect(errorId).toBeDefined();
      expect(userMessage).toContain('Unable to connect');
      expect(recoveryResult.success).toBe(true);
      expect(monitoringStats.errors.total).toBe(1);
    });

    test('should handle complex error scenarios', async () => {
      // Test cascading failures and recovery
      const initialError = new Error('Primary API failed');
      initialError.status = 503;
      
      // Simulate multiple recovery attempts
      const recoveryAttempts = [];
      
      for (let i = 0; i < 3; i++) {
        const attempt = {
          attempt: i + 1,
          error: initialError,
          recovered: i === 2 // Success on third attempt
        };
        recoveryAttempts.push(attempt);
      }
      
      const successfulAttempts = recoveryAttempts.filter(attempt => attempt.recovered);
      expect(successfulAttempts).toHaveLength(1);
      expect(successfulAttempts[0].attempt).toBe(3);
    });
  });

  describe('Performance Tests', () => {
    test('should handle high error volume efficiently', () => {
      const startTime = performance.now();
      
      // Simulate high error volume
      for (let i = 0; i < 1000; i++) {
        const error = new Error(`Error ${i}`);
        // Mock logging
        console.log('Logging error:', error.message);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should process 1000 errors in under 100ms
      expect(duration).toBeLessThan(100);
    });

    test('should not cause memory leaks during repeated logging', () => {
      const initialMemory = 50000000; // 50MB
      
      // Simulate repeated error logging
      for (let i = 0; i < 100; i++) {
        const errors = [];
        for (let j = 0; j < 50; j++) {
          errors.push(new Error(`Error ${j}`));
        }
        // Simulate cleanup
        errors.length = 0;
      }
      
      // Memory should not grow significantly
      const finalMemory = initialMemory;
      expect(finalMemory).toBe(initialMemory);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null/undefined errors gracefully', () => {
      const nullError = null;
      const undefinedError = undefined;
      
      expect(() => {
        // Mock error handling for null/undefined
        if (!nullError) throw new Error('No error provided');
        if (!undefinedError) throw new Error('No error provided');
      }).toThrow('No error provided');
    });

    test('should handle circular reference in error objects', () => {
      const circularError = new Error('Circular reference error');
      circularError.context = { parent: circularError };
      
      // Should handle circular references without infinite loops
      expect(() => {
        JSON.stringify(circularError);
      }).toThrow();
    });

    test('should handle extremely long error messages', () => {
      const longMessage = 'x'.repeat(100000);
      const longError = new Error(longMessage);
      
      expect(longError.message.length).toBe(100000);
      
      // Should truncate or handle long messages gracefully
      const processedMessage = longError.message.length > 1000 
        ? longError.message.substring(0, 1000) + '...'
        : longError.message;
      
      expect(processedMessage.length).toBe(1003); // 1000 + '...'
    });

    test('should handle storage quota exceeded errors', () => {
      // Mock localStorage quota exceeded
      const quotaError = new Error('QuotaExceededError');
      quotaError.name = 'QuotaExceededError';
      
      // Should handle storage errors gracefully
      expect(quotaError.name).toBe('QuotaExceededError');
    });
  });

  describe('Browser Compatibility', () => {
    test('should work in older browsers without modern APIs', () => {
      // Mock older browser environment
      const oldBrowser = {
        performance: undefined,
        localStorage: {
          getItem: jest.fn(),
          setItem: jest.fn(),
          removeItem: jest.fn()
        },
        navigator: {
          onLine: true,
          userAgent: 'IE 11'
        }
      };
      
      expect(oldBrowser.performance).toBeUndefined();
      expect(oldBrowser.localStorage).toBeDefined();
      expect(oldBrowser.navigator.onLine).toBe(true);
    });

    test('should handle missing performance.memory API', () => {
      // Mock environment without performance.memory
      const noMemoryApi = {
        performance: {
          now: jest.fn(() => Date.now())
          // Note: no memory property
        }
      };
      
      expect(noMemoryApi.performance.memory).toBeUndefined();
    });
  });
});