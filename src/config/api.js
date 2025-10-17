// API Configuration
console.log('API Config - Environment variables:', {
  VITE_API_BASE: import.meta.env.VITE_API_BASE,
  MODE: import.meta.env.MODE,
  NODE_ENV: import.meta.env.NODE_ENV,
  hostname: window.location.hostname
});

let API_BASE_URL;

// Check for explicit environment variable first
if (import.meta.env.VITE_API_BASE) {
  API_BASE_URL = import.meta.env.VITE_API_BASE;
} else if (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('netlify.app')) {
  // Production deployment detected by hostname
  API_BASE_URL = 'https://threed-configurator-backend-7pwk.onrender.com/api';
} else if (import.meta.env.MODE === 'production') {
  // Fallback production check
  API_BASE_URL = 'https://threed-configurator-backend-7pwk.onrender.com/api';
} else {
  // Development
  API_BASE_URL = 'http://192.168.1.7:5000/api';
}

console.log('API Config - Using API_BASE_URL:', API_BASE_URL);

export { API_BASE_URL };