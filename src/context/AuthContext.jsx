import React, { createContext, useContext, useState, useEffect } from 'react';

// Lazy API URL resolution to prevent React error #310
function getApiBaseUrl() {
  // Check for explicit environment variable first
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/api$/, '');
  } else if (typeof window !== 'undefined' && (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('netlify.app'))) {
    // Production deployment detected by hostname
    return 'https://threed-configurator-backend-7pwk.onrender.com';
  } else if (import.meta.env.MODE === 'production') {
    // Fallback production check
    return 'https://threed-configurator-backend-7pwk.onrender.com';
  } else {
    // Development - use localhost instead of network IP for better compatibility
    return 'http://localhost:5000';
  }
}

// Retry configuration for auth requests
const AUTH_RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  retryableErrors: [
    'Network Error',
    'Failed to fetch',
    'timeout',
    'ECONNREFUSED',
    'ENOTFOUND'
  ]
};

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Check if error is retryable for auth operations
 * @param {Error} error - Error object
 * @returns {boolean} - True if error is retryable
 */
function isAuthRetryableError(error) {
  const errorMessage = error.message?.toLowerCase() || '';
  return AUTH_RETRY_CONFIG.retryableErrors.some(retryableError => 
    errorMessage.includes(retryableError.toLowerCase())
  );
}

/**
 * Sleep utility
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Sleep promise
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function for auth operations
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} - Result of the function
 */
async function retryAuthOperation(fn, maxRetries = AUTH_RETRY_CONFIG.maxRetries, baseDelay = AUTH_RETRY_CONFIG.retryDelay) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt <= maxRetries && isAuthRetryableError(error)) {
        const delay = baseDelay * attempt + Math.random() * 500; // Add jitter
        console.warn(`Auth operation attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
        await sleep(delay);
        continue;
      }
      
      break;
    }
  }
  
  throw lastError;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Enhanced auth check with retry logic
  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const verifyToken = async () => {
          const response = await fetch(`${getApiBaseUrl()}/api/auth/verify`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.message || `HTTP ${response.status}: ${response.statusText}`;
            throw new Error(errorMessage);
          }

          return response.json();
        };

        const data = await retryAuthOperation(verifyToken);
        setUser(data.user);
        setError(null);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setError(error.message);
      
      // Handle specific auth errors
      if (error.message.includes('Invalid token') || error.message.includes('401')) {
        localStorage.removeItem('token');
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // Enhanced login with better error handling
  const login = async (email, password) => {
    try {
      setError(null);
      setLoading(true);

      const performLogin = async () => {
        const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const errorMessage = data.message || `HTTP ${response.status}: ${response.statusText}`;
          throw new Error(errorMessage);
        }

        return data;
      };

      const data = await retryAuthOperation(performLogin);
      
      localStorage.setItem('token', data.token);
      setUser(data.user);
      setError(null);
      
      return data;
    } catch (error) {
      const errorMessage = error.message || 'Login failed. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced logout with error handling
  const logout = () => {
    try {
      localStorage.removeItem('token');
      setUser(null);
      setError(null);
      
      // Clear any cached data
      sessionStorage.removeItem('user_preferences');
      
      console.log('User logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      // Force clear user state even if cleanup fails
      setUser(null);
      setError('Logout encountered an issue, but you have been logged out.');
    }
  };

  // Clear error state
  const clearError = () => {
    setError(null);
  };

  // Enhanced password reset with retry logic
  const requestPasswordReset = async (email) => {
    try {
      setError(null);
      setLoading(true);

      const requestReset = async () => {
        const response = await fetch(`${getApiBaseUrl()}/api/auth/request-password-reset`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const errorMessage = data.message || `HTTP ${response.status}: ${response.statusText}`;
          throw new Error(errorMessage);
        }

        return data;
      };

      return await retryAuthOperation(requestReset);
    } catch (error) {
      const errorMessage = error.message || 'Failed to send password reset email';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced password change with error handling
  const changePassword = async (currentPassword, newPassword) => {
    try {
      setError(null);
      setLoading(true);

      const changePasswordRequest = async () => {
        const token = localStorage.getItem('token');
        const response = await fetch(`${getApiBaseUrl()}/api/auth/change-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ currentPassword, newPassword }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const errorMessage = data.message || `HTTP ${response.status}: ${response.statusText}`;
          throw new Error(errorMessage);
        }

        return data;
      };

      return await retryAuthOperation(changePasswordRequest);
    } catch (error) {
      const errorMessage = error.message || 'Failed to change password';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Periodic auth check for token refresh (every 30 seconds when logged in)
  useEffect(() => {
    const intervalId = setInterval(() => {
      const token = localStorage.getItem('token');
      if (token) {
        checkAuth();
      }
    }, 30_000); // every 30 seconds

    return () => clearInterval(intervalId);
  }, []);

  // Initial auth check
  useEffect(() => {
    checkAuth();
  }, []);

  // Real-time updates via Server-Sent Events (SSE) with error handling
  useEffect(() => {
    let es;
    const token = localStorage.getItem('token');
    if (!token || !user) return;

    try {
      const sseUrl = `${getApiBaseUrl()}/api/stream?token=${token}`;
      es = new EventSource(sseUrl);

      es.addEventListener('connected', (ev) => {
        console.log('SSE connected successfully');
      });

      es.addEventListener('permissionsUpdated', (ev) => {
        try {
          console.log('Permissions updated, refreshing user data...');
          checkAuth();
        } catch (e) {
          console.warn('SSE permissionsUpdated handler failed:', e);
        }
      });

      es.addEventListener('userUpdated', (ev) => {
        try {
          console.log('User data updated, refreshing...');
          checkAuth();
        } catch (e) {
          console.warn('SSE userUpdated handler failed:', e);
        }
      });

      es.onerror = (err) => {
        console.warn('SSE connection error:', err);
        
        // Don't automatically close on error, let the browser handle reconnection
        // Only close if it's a persistent error (after some time)
        setTimeout(() => {
          if (es.readyState === EventSource.CLOSED) {
            console.log('SSE connection closed, will reconnect on next check');
          }
        }, 5000);
      };

    } catch (err) {
      console.warn('SSE initialization failed:', err);
    }

    return () => {
      try {
        if (es) es.close();
      } catch (e) {
        console.warn('SSE cleanup error:', e);
      }
    };
  }, [user]);

  const value = {
    user,
    login,
    logout,
    loading,
    error,
    clearError,
    checkAuth,
    requestPasswordReset,
    changePassword
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
