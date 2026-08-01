// Interceptor global para inyectar token de autenticación en llamadas a la API
const API_SECRET = localStorage.getItem('API_SECRET');

if (!API_SECRET && window.location.pathname !== '/login.html') {
  window.location.href = '/login.html';
}

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
  
  const response = await originalFetch(resource, config);
  
  // Si la API rechaza el token, borrarlo y mandar a login
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('API_SECRET');
    window.location.href = '/login.html';
  }
  
  return response;
};
