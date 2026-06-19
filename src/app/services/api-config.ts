export const apiBaseUrl =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:8080'
    : 'https://immobilier-backend-k5g6.onrender.com';
