// src/api/user.js
import axios from "axios";

// Lazy API URL resolution to prevent React error #310
function getApiBase() {
  // Check for explicit environment variable first
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  } else if (typeof window !== 'undefined' && (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('netlify.app'))) {
    // Production deployment detected by hostname
    return 'https://threed-configurator-backend-7pwk.onrender.com/api';
  } else if (import.meta.env.MODE === 'production') {
    // Fallback production check
    return 'https://threed-configurator-backend-7pwk.onrender.com/api';
  } else {
    // Development
    return 'http://192.168.1.7:5000/api';
  }
}

const api = axios.create({
  get baseURL() { return getApiBase(); },
  timeout: 10000,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

export const login = async (email, password) => {
  try {
    const res = await api.post("/auth/login", { email, password });
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const register = async (name, email, password) => {
  try {
    const res = await api.post("/auth/register", { name, email, password });
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    const res = await api.get("/auth/me");
    return res.data;
  } catch (error) {
    throw error;
  }
};

// Test connection function
export const testConnection = async () => {
  try {
    const res = await api.get("/health");
    return res.data;
  } catch (error) {
    throw new Error("Cannot connect to server");
  }
};
// src/api/user.js - Add these functions
export const getActivityLogs = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams(filters).toString();
    const res = await api.get(`/activity/logs?${queryParams}`);
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const logActivity = async (activityData) => {
  try {
    const res = await api.post("/activity/log", activityData);
    return res.data;
  } catch (error) {
    console.error("Activity logging error:", error);
  }
};

export const getActivityStats = async () => {
  try {
    const res = await api.get("/activity/stats");
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const deleteActivityForUser = async (userId) => {
  try {
    const res = await api.delete(`/activity/clear/${userId}`);
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const getUserConfigs = async (userId) => {
  try {
    const res = await api.get(`/admin/user-configs/${userId}`);
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const deleteUserConfig = async (configId) => {
  try {
    const res = await api.delete(`/admin/user-configs/${configId}`);
    return res.data;
  } catch (error) {
    throw error;
  }
};