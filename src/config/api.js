// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.MODE === 'production' 
    ? 'https://your-backend.render.com' 
    : 'http://localhost:5000');

export { API_BASE_URL };