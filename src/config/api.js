// API Configuration - Lazy evaluation to prevent React error #310
let cachedApiUrl = null;

export function getApiBaseUrl() {
  if (cachedApiUrl) return cachedApiUrl;
  
  // Check for explicit environment variable first
  if (import.meta.env.VITE_API_BASE) {
    cachedApiUrl = import.meta.env.VITE_API_BASE;
  } else if (typeof window !== 'undefined' && (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('netlify.app'))) {
    // Production deployment detected by hostname
    cachedApiUrl = 'https://threed-configurator-backend-7pwk.onrender.com/api';
  } else if (import.meta.env.MODE === 'production') {
    // Fallback production check
    cachedApiUrl = 'https://threed-configurator-backend-7pwk.onrender.com/api';
  } else {
    // Development
    cachedApiUrl = 'http://192.168.1.7:5000/api';
  }
  
  return cachedApiUrl;
}

// Legacy export for backward compatibility
export const API_BASE_URL = getApiBaseUrl();