/**
 * main.js — Punto de entrada del CRM. Coordina todos los módulos.
 * Inicializa, conecta eventos DOM y mantiene el estado de la sesión.
 */

const state = {
  activeConvId:    null,
  activeContactId: null,
  activeChat:      null,
  chats:           [],
  pollInterval:    null,
};

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(msg, duration = 3000) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ── Carga de chats ────────────────────────────────────────────────────────────

async function loadChats(silent = false) {
  try {
    const chats = await api.getChats();
    state.chats = chats;

    // Calcular preview del último mensaje para mostrar en la lista
    // (el backend devuelve last_message_time; el preview viene del historial)
    window.chatList.render(chats, state.activeConvId);
    return chats;
  } catch (err) {
    if (!silent) showToast('Error cargando conversaciones');
    console.error('loadChats:', err.message);
    return [];
  }
}

// ── Abrir conversación ────────────────────────────────────────────────────────

async function openChat(convId, contactId, chatData) {
  state.activeConvId    = convId;
  state.activeContactId = contactId;
  state.activeChat      = chatData;

  // Mostrar el panel de chat en móvil
  document.getElementById('app')?.classList.add('chat-open');

  // Actualizar header
  window.chatWindow.renderHeader(chatData, chatData.last_message_time);

  // Activar item en la lista
  document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.chat-item[data-conv="${convId}"]`)?.classList.add('active');

  // Habilitar input
  const input   = document.getElementById('msg-input');
  const sendBtn = document.getElementById('send-btn');
  if (input)   { input.disabled = false; input.placeholder = 'Escribe un mensaje...'; input.focus(); }
  if (sendBtn) sendBtn.disabled = false;

  // Cargar mensajes
  await loadMessages(convId);
}

async function loadMessages(convId) {
  try {
    const msgs = await api.getMessages(convId);
    window.chatWindow.render(msgs, state.activeChat?.name);

    // Actualizar preview en la lista
    if (msgs.length > 0) {
      const last = msgs[msgs.length - 1];
      window.chatList.updateItem(convId, {
        preview: last.text || (last.media_url ? '📎 Archivo adjunto' : '...'),
        unread: 0,
      });
    }
  } catch (err) {
    showToast('Error cargando mensajes');
    console.error('loadMessages:', err.message);
  }
}

// ── Enviar mensaje ────────────────────────────────────────────────────────────

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const text  = input?.value?.trim();
  if (!text || !state.activeContactId) return;

  // Verificar ventana 24h
  const status = window.chatList.getWindowStatus(state.activeChat?.last_message_time);
  if (status === 'close') {
    showToast('⚠️ Ventana de 24h cerrada. No puedes enviar mensajes automáticos.');
    return;
  }

  input.value   = '';
  input.style.height = '';

  // Mostrar mensaje optimista en la UI
  const nowIso = new Date().toISOString();
  const optimisticMsg = {
    direction:    'outgoing',
    sender_type:  'agent',
    text,
    media_url:    null,
    message_type: 'text',
    timestamp:    nowIso,
  };
  const container = document.getElementById('messages-container');
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap outgoing';
  wrap.innerHTML = `
    <div class="bubble outgoing">${window.chatList.escapeHtml(text)}</div>
    <span class="msg-meta">${window.chatWindow.fmtTime(nowIso)} <span style="opacity:0.5">●</span></span>`;
  container?.appendChild(wrap);
  container && (container.scrollTop = container.scrollHeight);

  try {
    await api.sendMessage(state.activeContactId, text);
    // Recargar mensajes para confirmar entrega
    setTimeout(() => loadMessages(state.activeConvId), 1200);
  } catch (err) {
    showToast(`Error enviando: ${err.message}`);
    // Revertir mensaje optimista
    wrap.remove();
    input.value = text;
  }
}

// ── Sincronización ────────────────────────────────────────────────────────────

async function triggerSync() {
  const btn = document.getElementById('sync-btn');
  if (!btn) return;
  btn.classList.add('syncing');
  btn.textContent = '↻ Sincronizando...';

  try {
    await api.syncHistory();
    showToast('🔄 Sincronización iniciada en segundo plano');
    setTimeout(() => loadChats(true), 4000);
  } catch (err) {
    showToast('Error al sincronizar');
  } finally {
    btn.classList.remove('syncing');
    btn.innerHTML = '↻ Sincronizar';
  }
}

// ── Polling ligero (actualización en tiempo real) ─────────────────────────────

function startPolling() {
  if (state.pollInterval) clearInterval(state.pollInterval);
  state.pollInterval = setInterval(async () => {
    await loadChats(true);
    if (state.activeConvId) {
      const exists = state.chats.some(c => c.conv_id === state.activeConvId);
      if (exists) {
        await loadMessages(state.activeConvId);
      } else {
        state.activeConvId = null;
        state.activeContactId = null;
        state.activeChat = null;
      }
    }
  }, 8000); // cada 8 segundos
}

// ── Auto-resize del textarea ──────────────────────────────────────────────────

function autoResize(el) {
  el.style.height = '';
  el.style.height = Math.min(el.scrollHeight, 130) + 'px';
}

// ── Inicialización ────────────────────────────────────────────────────────────

async function init() {
  // Carga inicial de chats
  await loadChats();

  // Eventos del sidebar
  document.getElementById('chat-list')?.addEventListener('click', e => {
    const item = e.target.closest('.chat-item');
    if (!item) return;
    const convId    = item.dataset.conv;
    const contactId = item.dataset.contact;
    const chat      = state.chats.find(c => c.conv_id === convId);
    if (chat) openChat(convId, contactId, chat);
  });

  // Búsqueda en tiempo real
  document.getElementById('search-input')?.addEventListener('input', () => {
    window.chatList.render(state.chats, state.activeConvId);
  });

  // Enviar con botón
  document.getElementById('send-btn')?.addEventListener('click', sendMessage);

  // Enviar con Enter (Shift+Enter = salto de línea)
  document.getElementById('msg-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize del textarea
  document.getElementById('msg-input')?.addEventListener('input', e => autoResize(e.target));

  // Botón sincronizar
  document.getElementById('sync-btn')?.addEventListener('click', triggerSync);

  // Arrancar polling
  startPolling();
}

document.addEventListener('DOMContentLoaded', init);
