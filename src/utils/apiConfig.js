// Centralized API configuration utility
export const getApiBaseUrl = () => {
  // Check for explicit environment variable first
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace('/api', '');
  }
  
  // Production deployment detected by hostname
  if (window.location.hostname.includes('vercel.app') || 
      window.location.hostname.includes('netlify.app')) {
    return 'https://threed-configurator-backend-7pwk.onrender.com';
  }
  
  // Fallback production check
  if (import.meta.env.MODE === 'production') {
    return 'https://threed-configurator-backend-7pwk.onrender.com';
  }
  
  // Development
  return 'http://192.168.1.7:5000';
};

export const getApiUrl = (endpoint = '') => {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}/api${cleanEndpoint}`;
};

// Log the detected configuration
console.log('API Config:', {
  baseUrl: getApiBaseUrl(),
  hostname: window.location.hostname,
  mode: import.meta.env.MODE,
  viteApiBase: import.meta.env.VITE_API_BASE
});