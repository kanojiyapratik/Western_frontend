import React, { createContext, useContext, useState, useEffect } from 'react';

// Ensure API_BASE_URL doesn't end with /api to avoid double /api in URLs
let API_BASE_URL;

// Check for explicit environment variable first
if (import.meta.env.VITE_API_BASE) {
  API_BASE_URL = import.meta.env.VITE_API_BASE;
} else if (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('netlify.app')) {
  // Production deployment detected by hostname
  API_BASE_URL = 'https://threed-configurator-backend-7pwk.onrender.com';
} else if (import.meta.env.MODE === 'production') {
  // Fallback production check
  API_BASE_URL = 'https://threed-configurator-backend-7pwk.onrender.com';
} else {
  // Development
  API_BASE_URL = 'http://192.168.1.7:5000';
}

console.log('API_BASE_URL detected:', API_BASE_URL, 'hostname:', window.location.hostname, 'mode:', import.meta.env.MODE);

// Remove trailing /api if present to avoid double /api in requests
if (API_BASE_URL.endsWith('/api')) {
  API_BASE_URL = API_BASE_URL.slice(0, -4);
}

console.log('Final API_BASE_URL:', API_BASE_URL);

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
      es = new EventSource(`${API_BASE_URL}/api/stream?token=${token}`);
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
  const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
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
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
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
