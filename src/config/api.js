// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE || 
  (import.meta.env.MODE === 'production' 
    ? 'https://threed-configurator-backend-7pwk.onrender.com/api' 
    : 'http://localhost:5000/api');

export { API_BASE_URL };