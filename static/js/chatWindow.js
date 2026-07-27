/**
 * chatWindow.js — Renderizado de burbujas de mensajes.
 * Soporta: text, image, video, audio, story_reply, story_mention, reaction, share, unknown.
 */

const { escapeHtml, avatarHtml, getWindowStatus, windowLabel, formatChatTime } = window.chatList;

function fmtTime(isoTs) {
  if (!isoTs) return '';
  const d = new Date(isoTs);
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

// ── Detector de tipo por texto marcado (retrocompatibilidad con DB anterior) ──

function detectLegacyType(msg) {
  const t = msg.text || '';
  if (t.includes('[STORY_REPLY]') || t.includes('Respondió a tu historia')) return 'story_reply';
  if (t.includes('[STORY_MENTION]') || t.includes('mencionó en su historia'))  return 'story_mention';
  if (t.includes('[ATTACHMENT]') && msg.media_url) return 'image';
  return null;
}

function cleanLegacyText(text) {
  return text
    .replace(/\[STORY_REPLY\]|\[STORY_MENTION\]|\[ATTACHMENT\]/g, '')
    .trim();
}

// ── Renderizadores por tipo ───────────────────────────────────────────────────

function renderText(msg) {
  return `<div class="bubble ${msg.direction === 'incoming' ? 'incoming' : 'outgoing'}">${escapeHtml(msg.text)}</div>`;
}

function renderImage(msg) {
  const url = msg.media_url;
  return `
    <div class="bubble ${msg.direction === 'incoming' ? 'incoming' : 'outgoing'}">
      <a href="${url}" target="_blank" rel="noopener">
        <img class="media-img" src="${url}" alt="Imagen"
          onerror="this.outerHTML='<span style=\\'color:var(--text-muted);font-size:0.8rem;\\'>📎 Imagen expirada</span>'">
      </a>
      ${msg.text ? `<div style="margin-top:6px">${escapeHtml(msg.text)}</div>` : ''}
    </div>`;
}

function renderVideo(msg) {
  const url = msg.media_url;
  return `
    <div class="bubble ${msg.direction === 'incoming' ? 'incoming' : 'outgoing'}">
      <video controls style="max-width:100%;max-height:200px;border-radius:8px;display:block"
        onerror="this.outerHTML='<a href=${url} target=_blank style=\\'color:var(--primary)\\'>📹 Ver video</a>'">
        <source src="${url}">
      </video>
      ${msg.text ? `<div style="margin-top:6px">${escapeHtml(msg.text)}</div>` : ''}
    </div>`;
}

function renderAudio(msg) {
  const url = msg.media_url;
  return `
    <div class="bubble ${msg.direction === 'incoming' ? 'incoming' : 'outgoing'}">
      <div class="audio-player">
        🎵
        <audio controls style="max-width:200px" src="${url}"></audio>
      </div>
    </div>`;
}

function renderStoryReply(msg) {
  const url     = msg.media_url;
  const text    = cleanLegacyText(msg.text || '');
  const imgHtml = url
    ? `<a href="${url}" target="_blank" rel="noopener">
         <img class="story-card-img" src="${url}" alt="Historia"
           onerror="this.parentElement.innerHTML='<span class=story-expired>Historia expirada o privada</span>'">
       </a>`
    : `<span class="story-expired">Historia expirada o privada</span>`;

  return `
    <div class="bubble ${msg.direction === 'incoming' ? 'incoming' : 'outgoing'}">
      <div class="story-card" style="background:var(--story-gradient);padding:2px;border-radius:12px;margin-bottom:${text ? '8px' : '0'}">
        <div class="story-card-inner">
          <div class="story-card-label">📸 Respondió a tu Historia</div>
          ${imgHtml}
        </div>
      </div>
      ${text && text !== 'Respondió a tu historia' ? `<div>${escapeHtml(text)}</div>` : ''}
    </div>`;
}

function renderStoryMention(msg) {
  const url  = msg.media_url;
  const text = cleanLegacyText(msg.text || '');
  const imgHtml = url
    ? `<a href="${url}" target="_blank" rel="noopener">
         <img class="story-card-img" src="${url}" alt="Tu Historia"
           onerror="this.parentElement.innerHTML='<span class=story-expired>Historia expirada o privada</span>'">
       </a>`
    : `<span class="story-expired">Historia expirada o privada</span>`;

  return `
    <div class="bubble ${msg.direction === 'incoming' ? 'incoming' : 'outgoing'}">
      <div class="story-card" style="background:var(--story-gradient);padding:2px;border-radius:12px">
        <div class="story-card-inner">
          <div class="story-card-label">🌟 Te mencionó en su Historia</div>
          ${imgHtml}
        </div>
      </div>
      ${text && text !== 'Te mencionó en su historia' ? `<div style="margin-top:6px">${escapeHtml(text)}</div>` : ''}
    </div>`;
}

function renderReaction(msg) {
  return `
    <div class="bubble ${msg.direction === 'incoming' ? 'incoming' : 'outgoing'}"
         style="font-size:1.4rem;padding:6px 12px;background:transparent;border:1px solid var(--border)">
      ${escapeHtml(msg.text || '❤️')}
    </div>`;
}

function renderShare(msg) {
  const url  = msg.media_url;
  const text = msg.text || '📤 Compartió una publicación';
  return `
    <div class="bubble ${msg.direction === 'incoming' ? 'incoming' : 'outgoing'}">
      ${url
        ? `<a href="${url}" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:none">
             📤 Ver publicación compartida
           </a>`
        : escapeHtml(text)}
    </div>`;
}

// ── Despachador principal ─────────────────────────────────────────────────────

function renderBubble(msg) {
  // Retrocompatibilidad: detectar tipo por texto marcado si no viene en msg.message_type
  const legacyType = detectLegacyType(msg);
  const type = msg.message_type || legacyType || (msg.media_url ? 'image' : 'text');

  switch (type) {
    case 'story_reply':   return renderStoryReply(msg);
    case 'story_mention': return renderStoryMention(msg);
    case 'image':         return msg.media_url ? renderImage(msg) : renderText(msg);
    case 'video':         return msg.media_url ? renderVideo(msg) : renderText(msg);
    case 'audio':         return msg.media_url ? renderAudio(msg) : renderText(msg);
    case 'reaction':      return renderReaction(msg);
    case 'share':         return renderShare(msg);
    default:              return renderText(msg);
  }
}

// ── Render completo del hilo ──────────────────────────────────────────────────

function renderMessages(msgs, contactName) {
  const container = document.getElementById('messages-container');
  if (!container) return;

  if (!msgs || !msgs.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💬</div>
        <p>Aún no hay mensajes en esta conversación.</p>
        <p style="font-size:0.78rem">Escribe tu primer mensaje abajo.</p>
      </div>`;
    return;
  }

  let lastDate = null;
  container.innerHTML = '';

  msgs.forEach(msg => {
    // Separador de fecha
    const msgDate = new Date(msg.timestamp).toDateString();
    if (msgDate !== lastDate) {
      lastDate = msgDate;
      const sep = document.createElement('div');
      sep.style.cssText = 'text-align:center;margin:16px 0 10px;font-size:0.72rem;color:var(--text-muted)';
      sep.textContent = new Date(msg.timestamp).toLocaleDateString('es-CO', {
        weekday: 'long', day: 'numeric', month: 'long'
      });
      container.appendChild(sep);
    }

    const wrap = document.createElement('div');
    wrap.className = `msg-wrap ${msg.direction === 'incoming' ? 'incoming' : 'outgoing'}`;
    wrap.innerHTML = `
      ${renderBubble(msg)}
      <span class="msg-meta">${fmtTime(msg.timestamp)}</span>`;
    container.appendChild(wrap);
  });

  container.scrollTop = container.scrollHeight;
}

// ── Header del chat ───────────────────────────────────────────────────────────

function renderChatHeader(contact, lastMsgTime) {
  const headerAvatar = document.getElementById('chat-header-avatar');
  const headerName   = document.getElementById('chat-header-name');
  const headerSub    = document.getElementById('chat-header-sub');
  const windowBadge  = document.getElementById('window-badge');

  if (headerAvatar) {
    headerAvatar.innerHTML = avatarHtml(contact.name, contact.avatar_url, 38);
  }
  if (headerName) headerName.textContent = contact.name || 'Sin nombre';
  if (headerSub)  headerSub.textContent  = contact.username ? `@${contact.username}` : `ID: ${contact.contact_id}`;

  if (windowBadge && lastMsgTime) {
    const status = getWindowStatus(lastMsgTime);
    windowBadge.className = `window-badge ${status}`;
    windowBadge.textContent = windowLabel(status);
    windowBadge.id = 'window-badge';
  }
}

window.chatWindow = {
  render: renderMessages,
  renderHeader: renderChatHeader,
  fmtTime,
};
