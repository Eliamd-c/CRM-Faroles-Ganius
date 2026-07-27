/**
 * api.js — Cliente HTTP para comunicarse con el backend CRM.
 * Centraliza fetch, manejo de errores y timeouts.
 */

const API_TIMEOUT = 12000; // 12s

async function request(path, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(id);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json();
  } catch (err) {
    clearTimeout(id);
    if (err.name === 'AbortError') throw new Error('Tiempo de espera agotado');
    throw err;
  }
}

const api = {
  getChats:    ()              => request('/api/chats'),
  getMessages: (convId)        => request(`/api/chats/${convId}/messages`),
  sendMessage: (recipientId, text) =>
    request('/api/send', {
      method: 'POST',
      body: JSON.stringify({ recipient_id: recipientId, text }),
    }),
  syncHistory:  () => request('/api/sync', { method: 'POST' }),
  getContact:   (id) => request(`/api/contacts/${id}`),
  updateContact: (id, data) =>
    request(`/api/contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

window.api = api;
