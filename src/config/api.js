// API Configuration
console.log('API Config - Environment variables:', {
  VITE_API_BASE: import.meta.env.VITE_API_BASE,
  MODE: import.meta.env.MODE,
  NODE_ENV: import.meta.env.NODE_ENV
});

const API_BASE_URL = import.meta.env.VITE_API_BASE || 
  (import.meta.env.MODE === 'production' 
    ? 'https://threed-configurator-backend-7pwk.onrender.com/api' 
    : 'http://localhost:5000/api');

console.log('API Config - Using API_BASE_URL:', API_BASE_URL);

export { API_BASE_URL };