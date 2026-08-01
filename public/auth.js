// Interceptor global para inyectar token de autenticación en llamadas a la API
const API_SECRET = 'farolesgenius_dev_secret'; // Debe coincidir con backend (app.js)

const originalFetch = window.fetch;
window.fetch = async function() {
  let [resource, config] = arguments;
  
  if (typeof resource === 'string' && resource.startsWith('/api/')) {
    config = config || {};
    config.headers = config.headers || {};
    
    if (config.headers instanceof Headers) {
      config.headers.append('Authorization', `Bearer ${API_SECRET}`);
    } else {
      config.headers['Authorization'] = `Bearer ${API_SECRET}`;
    }
  }
  
  return originalFetch(resource, config);
};
