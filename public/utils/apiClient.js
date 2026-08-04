const API = (() => {
  function getToken() {
    return localStorage.getItem('api_token') || '';
  }

  async function request(path, options = {}) {
    const { method = 'GET', body, headers: extra = {} } = options;
    const headers = { 'Authorization': `Bearer ${getToken()}`, ...extra };
    if (body && typeof body === 'object' && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(path, {
      method, headers,
      body: body instanceof FormData ? body
           : body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 || res.status === 403) {
      window.location.href = '/login.html';
      throw new Error('No autorizado');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('text/csv')) return res.text();
    return res.json();
  }

  return {
    get:    (path)       => request(path),
    post:   (path, body) => request(path, { method: 'POST', body }),
    patch:  (path, body) => request(path, { method: 'PATCH', body }),
    delete: (path)       => request(path, { method: 'DELETE' }),
    upload: (path, file) => {
      const form = new FormData();
      form.append('file', file);
      return request(path, { method: 'POST', body: form });
    },
  };
})();
