/**
 * chatList.js — Renderizado y lógica de la lista de conversaciones.
 * Incluye semáforo de ventana de 24 horas por cada chat.
 */

// ── Utilidades de tiempo ──────────────────────────────────────────────────────

function formatChatTime(isoTs) {
  if (!isoTs) return '';
  const d     = new Date(isoTs);
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgD  = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (msgD.getTime() === today.getTime()) {
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }
  const diff = Math.floor((today - msgD) / 86400000);
  if (diff === 1) return 'Ayer';
  if (diff < 7)  return d.toLocaleDateString('es-CO', { weekday: 'short' });
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
}

/**
 * Calcula el estado de la ventana de 24h basado en el timestamp del último mensaje.
 * @returns {'open'|'warn'|'close'}
 */
function getWindowStatus(lastMsgTime) {
  if (!lastMsgTime) return 'close';
  const diffMs   = Date.now() - new Date(lastMsgTime).getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 18) return 'open';
  if (diffHours < 24) return 'warn';
  return 'close';
}

function windowLabel(status) {
  const labels = {
    open:  '🟢 Ventana abierta',
    warn:  '🟡 Cierra pronto',
    close: '🔴 Ventana cerrada',
  };
  return labels[status] || '';
}

// ── Avatar helper ─────────────────────────────────────────────────────────────

function avatarHtml(name, avatarUrl, size = 44) {
  if (avatarUrl) {
    return `<img src="${avatarUrl}" alt="${name}" width="${size}" height="${size}"
      onerror="this.outerHTML=this.parentElement.querySelector('.avatar-fallback')?.outerHTML||''">`;
  }
  const initials = name
    ? name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';
  return `<span class="avatar-fallback" style="width:${size}px;height:${size}px">${initials}</span>`;
}

// ── Renderizado ───────────────────────────────────────────────────────────────

let allChats = [];

function renderChatList(chats, activeConvId) {
  allChats = chats;
  const container = document.getElementById('chat-list');
  const search    = (document.getElementById('search-input')?.value || '').toLowerCase();

  const filtered = chats.filter(c =>
    (c.name || '').toLowerCase().includes(search) ||
    (c.username || '').toLowerCase().includes(search)
  );

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💬</div>
        <p>No hay conversaciones todavía</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(chat => {
    const status   = getWindowStatus(chat.last_message_time);
    const isActive = chat.conv_id === activeConvId;
    const time     = formatChatTime(chat.last_message_time);
    const badge    = chat.unread_count > 0
      ? `<span class="unread-badge">${chat.unread_count > 99 ? '99+' : chat.unread_count}</span>` : '';

    return `
      <div class="chat-item ${isActive ? 'active' : ''}" data-conv="${chat.conv_id}" data-contact="${chat.contact_id}">
        <div class="chat-avatar">
          ${avatarHtml(chat.name, chat.avatar_url)}
          <span class="window-dot ${status}" title="${windowLabel(status)}"></span>
        </div>
        <div class="chat-info">
          <div class="chat-name">${escapeHtml(chat.name || 'Sin nombre')}</div>
          <div class="chat-preview">${escapeHtml(chat.last_preview || '...')}</div>
        </div>
        <div class="chat-meta">
          <span class="chat-time">${time}</span>
          ${badge}
        </div>
      </div>`;
  }).join('');
}

function updateChatListItem(convId, updates) {
  const item = document.querySelector(`.chat-item[data-conv="${convId}"]`);
  if (!item) return;
  if (updates.preview) {
    const prev = item.querySelector('.chat-preview');
    if (prev) prev.textContent = updates.preview;
  }
  if (updates.time) {
    const t = item.querySelector('.chat-time');
    if (t) t.textContent = updates.time;
  }
  if (updates.unread !== undefined) {
    let badge = item.querySelector('.unread-badge');
    if (updates.unread > 0) {
      if (!badge) {
        const meta = item.querySelector('.chat-meta');
        badge = document.createElement('span');
        badge.className = 'unread-badge';
        meta?.appendChild(badge);
      }
      badge.textContent = updates.unread > 99 ? '99+' : updates.unread;
    } else if (badge) {
      badge.remove();
    }
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.chatList = {
  render: renderChatList,
  updateItem: updateChatListItem,
  getWindowStatus,
  windowLabel,
  avatarHtml,
  formatChatTime,
  escapeHtml,
};
