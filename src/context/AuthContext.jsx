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
    // Development
    return 'http://192.168.1.7:5000';
  }
}

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  // Periodically refresh user info so permission changes applied by admin are picked up
  useEffect(() => {
    let intervalId = null;
    // Only poll when a token exists
    const token = localStorage.getItem('token');
    if (token) {
      intervalId = setInterval(() => {
        checkAuth();
      }, 30_000); // every 30 seconds
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  // Real-time updates via Server-Sent Events (SSE)
  useEffect(() => {
    let es;
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      es = new EventSource(`${getApiBaseUrl()}/api/stream?token=${token}`);
    } catch (err) {
      console.warn('SSE init failed', err);
      return;
    }

    es.addEventListener('connected', (ev) => {
      // console.log('SSE connected', ev);
    });

    es.addEventListener('permissionsUpdated', (ev) => {
      try {
        // When permissions updated for this user, re-check auth to refresh user object
        checkAuth();
      } catch (e) {
        console.warn('SSE permissionsUpdated handler failed', e);
      }
    });

    es.onerror = (err) => {
      // console.warn('SSE error', err);
      // Close on persistent errors
      try { es.close(); } catch (e) {}
    };

    return () => {
      try { es.close(); } catch (e) {}
    };
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        // Verify token with backend
  const response = await fetch(`${getApiBaseUrl()}/api/auth/verify`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          localStorage.removeItem('token');
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
  const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      setUser(data.user);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    loading,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
