document.addEventListener('DOMContentLoaded', () => {
  const contactsListEl = document.getElementById('contactsList');
  const contactSearchEl = document.getElementById('contactSearch');
  const filterStatusEl = document.getElementById('filterStatus');
  const filterTagEl = document.getElementById('filterTag');
  const btnExportEl = document.getElementById('btnExport');
  const btnSyncEl = document.getElementById('btnSync');
  const contactCountEl = document.getElementById('contactCount');

  const chatMessagesEl = document.getElementById('chatMessages');
  const chatHeaderInfoEl = document.getElementById('chatHeaderInfo');
  const messageInputEl = document.getElementById('messageInput');
  const btnSendMessageEl = document.getElementById('btnSendMessage');
  const btnToggleBotEl = document.getElementById('btnToggleBot');
  const botStatusTextEl = document.getElementById('botStatusText');

  const profileEmptyEl = document.getElementById('profileEmpty');
  const profileContentEl = document.getElementById('profileContent');
  const profileAvatarEl = document.getElementById('profileAvatar');
  const profileNameEl = document.getElementById('profileName');
  const profileIgIdEl = document.getElementById('profileIgId');
  const profileBotStatusEl = document.getElementById('profileBotStatus');
  const profileStatusSelectEl = document.getElementById('profileStatusSelect');
  const profileTagsEl = document.getElementById('profileTags');
  const newTagInputEl = document.getElementById('newTagInput');
  const btnAddTagEl = document.getElementById('btnAddTag');
  const profileMsgCountEl = document.getElementById('profileMsgCount');
  const profileCreatedAtEl = document.getElementById('profileCreatedAt');
  const profileLastActiveEl = document.getElementById('profileLastActive');
  const profileFieldsEl = document.getElementById('profileFields');
  const profileFieldsSectionEl = document.getElementById('profileFieldsSection');

  let allContacts = [];
  let currentContact = null;
  let chatPollingInterval = null;
  let allTags = new Set();

  async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Error ${res.status}`);
    }
    return res.json();
  }

  // ─── Init ───
  fetchContacts();

  // ─── Search & Filters ───
  let searchTimeout;
  contactSearchEl.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => filterAndRender(), 200);
  });
  filterStatusEl.addEventListener('change', () => filterAndRender());
  filterTagEl.addEventListener('change', () => filterAndRender());

  function filterAndRender() {
    const q = contactSearchEl.value.toLowerCase();
    const status = filterStatusEl.value;
    const tag = filterTagEl.value;
    let filtered = allContacts;
    if (q) {
      filtered = filtered.filter(c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.instagram_id && c.instagram_id.toLowerCase().includes(q)) ||
        (c.tags && c.tags.some(t => t.toLowerCase().includes(q)))
      );
    }
    if (status) filtered = filtered.filter(c => c.status === status);
    if (tag) filtered = filtered.filter(c => c.tags && c.tags.includes(tag));
    renderContactsList(filtered);
  }

  // ─── Send message ───
  btnSendMessageEl.addEventListener('click', sendMessage);
  messageInputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  btnToggleBotEl.addEventListener('click', toggleBot);
  btnExportEl.addEventListener('click', exportCSV);
  
  if (btnSyncEl) {
    btnSyncEl.addEventListener('click', async () => {
      btnSyncEl.disabled = true;
      const originalHtml = btnSyncEl.innerHTML;
      btnSyncEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      try {
        const res = await fetch('/api/sync-conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        const data = await res.json();
        if (data.success) {
          alert(`Sincronización completa. ${data.conversations_checked} chats revisados, ${data.messages_synced} mensajes nuevos guardados.`);
          await fetchContacts();
        } else {
          alert(`Error: ${data.error}`);
        }
      } catch (err) {
        alert('Error al sincronizar con Meta.');
        console.error(err);
      } finally {
        btnSyncEl.innerHTML = originalHtml;
        btnSyncEl.disabled = false;
      }
    });
  }

  // ─── Tags ───
  btnAddTagEl.addEventListener('click', addTag);
  newTagInputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTag();
  });

  // ─── Status change ───
  profileStatusSelectEl.addEventListener('change', async () => {
    if (!currentContact) return;
    try {
      await apiFetch(`/api/contacts/${currentContact.instagram_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: profileStatusSelectEl.value })
      });
      currentContact.status = profileStatusSelectEl.value;
    } catch (err) {
      alert('Error cambiando estado: ' + err.message);
    }
  });

  // ─── API calls ───
  async function fetchContacts() {
    try {
      const res = await apiFetch('/api/contacts?limit=200');
      if (res) {
        allContacts = res;
        collectTags();
        renderContactsList(allContacts);
        contactCountEl.textContent = allContacts.length;
      }
    } catch (err) {
      console.error('Error cargando contactos:', err);
      contactsListEl.innerHTML = '<div class="loading-contacts" style="color:#ef4444;">Error al cargar contactos</div>';
    }
  }

  function collectTags() {
    allTags.clear();
    for (const c of allContacts) {
      if (c.tags) c.tags.forEach(t => allTags.add(t));
    }
    const current = filterTagEl.value;
    filterTagEl.innerHTML = '<option value="">Todos los tags</option>';
    for (const t of [...allTags].sort()) {
      filterTagEl.innerHTML += `<option value="${esc(t)}">${esc(t)}</option>`;
    }
    filterTagEl.value = current;
  }

  function renderContactsList(contacts) {
    contactsListEl.innerHTML = '';
    if (contacts.length === 0) {
      contactsListEl.innerHTML = '<div class="loading-contacts">No hay contactos</div>';
      return;
    }

    for (const contact of contacts) {
      const el = document.createElement('div');
      el.className = 'contact-item';
      if (currentContact && currentContact.instagram_id === contact.instagram_id) {
        el.classList.add('active');
      }

      const name = contact.name || contact.instagram_id;
      const initial = name.charAt(0).toUpperCase();
      const preview = contact.last_message_preview
        ? truncate(contact.last_message_preview, 35)
        : '@' + contact.instagram_id;
      const timeStr = contact.last_message_at ? relativeTime(new Date(contact.last_message_at)) : '';
      const unread = contact.unread_count || 0;
      const botIcon = contact.bot_paused
        ? '<i class="fa-solid fa-pause bot-indicator" style="color:var(--bot-paused)"></i>'
        : '<i class="fa-solid fa-robot bot-indicator" style="color:var(--bot-active)"></i>';

      let avatarHTML;
      if (contact.profile_picture_url) {
        avatarHTML = `<div class="contact-avatar"><img src="${esc(contact.profile_picture_url)}" alt="" onerror="this.parentElement.textContent='${initial}'"></div>`;
      } else {
        avatarHTML = `<div class="contact-avatar">${initial}</div>`;
      }

      el.innerHTML = `
        ${avatarHTML}
        <div class="contact-info">
          <h4 class="contact-name">${esc(name)}</h4>
          <p class="contact-preview">${esc(preview)}</p>
        </div>
        <div class="contact-meta-right">
          <span class="contact-time">${timeStr}</span>
          ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : botIcon}
        </div>
      `;

      el.addEventListener('click', () => selectContact(contact));
      contactsListEl.appendChild(el);
    }
  }

  function selectContact(contact) {
    currentContact = contact;
    filterAndRender();

    // Chat header
    chatHeaderInfoEl.innerHTML = `
      <h3>${esc(contact.name || contact.instagram_id)}</h3>
      <span class="status-indicator">@${esc(contact.instagram_id)}</span>
    `;
    messageInputEl.disabled = false;
    btnSendMessageEl.disabled = false;
    btnToggleBotEl.disabled = false;
    updateBotToggleButton(contact.bot_paused);

    // Profile
    profileEmptyEl.style.display = 'none';
    profileContentEl.classList.remove('hidden');

    if (contact.profile_picture_url) {
      profileAvatarEl.innerHTML = `<img src="${esc(contact.profile_picture_url)}" alt="" onerror="this.outerHTML='<i class=\\'fa-solid fa-user-circle\\'></i>'">`;
    } else {
      profileAvatarEl.innerHTML = '<i class="fa-solid fa-user-circle"></i>';
    }

    profileNameEl.textContent = contact.name || 'Sin nombre';
    profileIgIdEl.textContent = contact.instagram_id;

    if (contact.bot_paused) {
      profileBotStatusEl.textContent = 'Pausado (Manual)';
      profileBotStatusEl.className = 'status-badge paused';
    } else {
      profileBotStatusEl.textContent = 'Activo';
      profileBotStatusEl.className = 'status-badge';
    }

    profileStatusSelectEl.value = contact.status || 'open';
    renderTags(contact.tags || []);
    profileMsgCountEl.textContent = contact.message_count || 0;
    profileCreatedAtEl.textContent = contact.created_at ? shortDate(new Date(contact.created_at)) : '-';
    profileLastActiveEl.textContent = contact.updated_at ? shortDate(new Date(contact.updated_at)) : '-';
    renderFields(contact.fields || {});

    // Fetch messages
    fetchMessages(contact.instagram_id);

    // Mark as read
    apiFetch(`/api/contacts/${contact.instagram_id}/mark-read`, { method: 'POST' }).catch(() => {});
    contact.unread_count = 0;

    // Polling
    if (chatPollingInterval) clearInterval(chatPollingInterval);
    chatPollingInterval = setInterval(() => {
      if (currentContact) fetchMessages(currentContact.instagram_id, true);
    }, 5000);
  }

  function renderTags(tags) {
    profileTagsEl.innerHTML = '';
    if (!tags || tags.length === 0) {
      profileTagsEl.innerHTML = '<span style="color:var(--text-secondary); font-size:0.78rem;">Sin etiquetas</span>';
      return;
    }
    for (const t of tags) {
      const span = document.createElement('span');
      span.className = 'tag';
      span.innerHTML = `${esc(t)} <i class="fa-solid fa-xmark tag-remove" data-tag="${esc(t)}"></i>`;
      span.querySelector('.tag-remove').addEventListener('click', () => removeTag(t));
      profileTagsEl.appendChild(span);
    }
  }

  async function addTag() {
    const tag = newTagInputEl.value.trim();
    if (!tag || !currentContact) return;
    const tags = [...(currentContact.tags || [])];
    if (tags.includes(tag)) return;
    tags.push(tag);
    try {
      await apiFetch(`/api/contacts/${currentContact.instagram_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ tags })
      });
      currentContact.tags = tags;
      renderTags(tags);
      newTagInputEl.value = '';
      collectTags();
    } catch (err) {
      alert('Error agregando tag: ' + err.message);
    }
  }

  async function removeTag(tag) {
    if (!currentContact) return;
    const tags = (currentContact.tags || []).filter(t => t !== tag);
    try {
      await apiFetch(`/api/contacts/${currentContact.instagram_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ tags })
      });
      currentContact.tags = tags;
      renderTags(tags);
      collectTags();
    } catch (err) {
      alert('Error eliminando tag: ' + err.message);
    }
  }

  function renderFields(fields) {
    const excluded = ['ai_history', 'ai_context'];
    const keys = Object.keys(fields).filter(k => !excluded.includes(k));

    if (keys.length === 0) {
      profileFieldsSectionEl.style.display = 'none';
      return;
    }

    profileFieldsSectionEl.style.display = '';
    profileFieldsEl.innerHTML = '';

    const labels = {
      last_location_lat: 'Latitud',
      last_location_lng: 'Longitud',
      referral_source: 'Fuente',
      referral_at: 'Fecha referral',
      last_story_reaction: 'Reaccion historia',
      story_reaction_at: 'Fecha reaccion',
      opted_in: 'Opt-in',
      opt_in_type: 'Tipo opt-in',
      last_payment: 'Pago',
      last_payment_currency: 'Moneda',
      last_payment_at: 'Fecha pago'
    };

    for (const key of keys) {
      let val = fields[key];
      if (val && typeof val === 'object') val = JSON.stringify(val);
      if (typeof val === 'string' && val.length > 50) val = val.substring(0, 47) + '...';
      const div = document.createElement('div');
      div.className = 'field-item';
      div.innerHTML = `
        <span class="field-key">${esc(labels[key] || key)}</span>
        <span class="field-value" title="${esc(String(fields[key]))}">${esc(String(val))}</span>
      `;
      profileFieldsEl.appendChild(div);
    }
  }

  function updateBotToggleButton(isPaused) {
    if (isPaused) {
      btnToggleBotEl.className = 'btn-toggle-bot bot-off';
      botStatusTextEl.textContent = 'Bot Pausado';
    } else {
      btnToggleBotEl.className = 'btn-toggle-bot bot-on';
      botStatusTextEl.textContent = 'Bot Activo';
    }
  }

  async function fetchMessages(instagram_id, isPolling = false) {
    try {
      const msgs = await apiFetch(`/api/contacts/${instagram_id}/messages`);
      if (!msgs) return;

      const currentCount = chatMessagesEl.querySelectorAll('.message').length;
      if (isPolling && msgs.length === currentCount) return;

      if (msgs.length === 0) {
        chatMessagesEl.innerHTML = `
          <div class="empty-chat-state">
            <i class="fa-regular fa-comments"></i>
            <p>No hay mensajes registrados aun.</p>
          </div>
        `;
        return;
      }

      chatMessagesEl.innerHTML = '';
      let lastDate = '';

      for (const m of msgs) {
        const date = new Date(m.created_at);
        const dateKey = date.toLocaleDateString();

        // Date separator
        if (dateKey !== lastDate) {
          lastDate = dateKey;
          const sep = document.createElement('div');
          sep.className = 'date-separator';
          sep.innerHTML = `<span>${isToday(date) ? 'Hoy' : isYesterday(date) ? 'Ayer' : dateKey}</span>`;
          chatMessagesEl.appendChild(sep);
        }

        // System messages (reactions, postbacks)
        if (m.message_type === 'reaction') {
          const sys = document.createElement('div');
          sys.className = 'message system';
          const emoji = m.content || '';
          sys.textContent = `${m.direction === 'inbound' ? 'Usuario' : 'Tu'} reacciono: ${emoji}`;
          chatMessagesEl.appendChild(sys);
          continue;
        }

        const div = document.createElement('div');
        div.className = `message ${m.direction}`;

        let contentHTML = '';

        // Reply preview
        if (m.reply_to_mid) {
          contentHTML += `<div class="msg-reply-preview"><i class="fa-solid fa-reply"></i> Respuesta</div>`;
        }

        // Type badge for non-text
        if (m.message_type && m.message_type !== 'text' && m.message_type !== 'attachment' && m.message_type !== 'reaction') {
          const typeLabels = {
            template: 'Plantilla',
            postback: 'Boton',
            story_mention: 'Mencion en historia',
            share: 'Compartido',
            location: 'Ubicacion',
            quick_reply: 'Respuesta rapida'
          };
          const label = typeLabels[m.message_type] || m.message_type;
          contentHTML += `<span class="msg-type-badge"><i class="fa-solid fa-tag"></i> ${esc(label)}</span> `;
        }

        // Content
        contentHTML += esc(m.content || '');

        // Attachment rendering
        if (m.attachment_url) {
          const aType = (m.attachment_type || '').toLowerCase();
          if (aType === 'image' || aType === 'sticker') {
            contentHTML += `<div class="msg-attachment"><img src="${esc(m.attachment_url)}" alt="Imagen" onclick="window._openLightbox(this.src)" loading="lazy"></div>`;
          } else if (aType === 'video' || aType === 'ig_reel' || aType === 'reel') {
            contentHTML += `<div class="msg-attachment"><video src="${esc(m.attachment_url)}" controls preload="metadata"></video></div>`;
          } else if (aType === 'audio') {
            contentHTML += `<div class="msg-attachment"><audio src="${esc(m.attachment_url)}" controls preload="metadata"></audio></div>`;
          } else if (aType === 'file') {
            contentHTML += `<div class="msg-attachment-file"><i class="fa-solid fa-file"></i> <a href="${esc(m.attachment_url)}" target="_blank">Descargar archivo</a></div>`;
          } else if (aType === 'share' || aType === 'ig_post') {
            contentHTML += `<div class="msg-attachment-file"><i class="fa-solid fa-share"></i> <a href="${esc(m.attachment_url)}" target="_blank">Ver publicacion</a></div>`;
          }
        }

        // Time + read status
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let readIcon = '';
        if (m.direction === 'outbound') {
          readIcon = m.is_read
            ? '<i class="fa-solid fa-check-double msg-read-check"></i>'
            : '<i class="fa-solid fa-check" style="opacity:0.5"></i>';
        }

        contentHTML += `<div class="msg-time">${timeStr} ${readIcon}</div>`;

        div.innerHTML = contentHTML;
        chatMessagesEl.appendChild(div);
      }

      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    } catch (err) {
      console.error('Error cargando mensajes', err);
    }
  }

  async function sendMessage() {
    const text = messageInputEl.value.trim();
    if (!text || !currentContact) return;

    messageInputEl.value = '';
    messageInputEl.disabled = true;
    btnSendMessageEl.disabled = true;

    const div = document.createElement('div');
    div.className = 'message outbound';
    const now = new Date();
    div.innerHTML = `${esc(text)}<div class="msg-time">${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} <i class="fa-solid fa-clock" style="opacity:0.4"></i></div>`;
    chatMessagesEl.appendChild(div);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

    try {
      const res = await apiFetch(`/api/contacts/${currentContact.instagram_id}/send`, {
        method: 'POST',
        body: JSON.stringify({ message: text })
      });

      if (res && res.success) {
        currentContact.bot_paused = true;
        updateBotToggleButton(true);
        profileBotStatusEl.textContent = 'Pausado (Manual)';
        profileBotStatusEl.className = 'status-badge paused';
        setTimeout(() => fetchMessages(currentContact.instagram_id), 1000);
      }
    } catch (err) {
      alert('Error enviando mensaje: ' + err.message);
    } finally {
      messageInputEl.disabled = false;
      btnSendMessageEl.disabled = false;
      messageInputEl.focus();
    }
  }

  async function toggleBot() {
    if (!currentContact) return;
    const newState = !currentContact.bot_paused;
    btnToggleBotEl.disabled = true;
    try {
      const res = await apiFetch(`/api/contacts/${currentContact.instagram_id}/toggle-bot`, {
        method: 'POST',
        body: JSON.stringify({ bot_paused: newState })
      });
      if (res && res.success) {
        currentContact.bot_paused = newState;
        updateBotToggleButton(newState);
        profileBotStatusEl.textContent = newState ? 'Pausado (Manual)' : 'Activo';
        profileBotStatusEl.className = newState ? 'status-badge paused' : 'status-badge';
      }
    } catch (err) {
      alert('Error cambiando estado: ' + err.message);
    } finally {
      btnToggleBotEl.disabled = false;
    }
  }

  function exportCSV() {
    window.open('/api/contacts-export', '_blank');
  }

  // ─── Helpers ───
  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function truncate(str, len) {
    return str.length > len ? str.substring(0, len) + '...' : str;
  }

  function isToday(date) {
    const t = new Date();
    return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear();
  }

  function isYesterday(date) {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return date.getDate() === y.getDate() && date.getMonth() === y.getMonth() && date.getFullYear() === y.getFullYear();
  }

  function shortDate(date) {
    return date.toLocaleDateString('es', { day: 'numeric', month: 'short', year: '2-digit' });
  }

  function relativeTime(date) {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }

  // ─── Lightbox ───
  window._openLightbox = function(src) {
    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.innerHTML = `<img src="${src}" alt="">`;
    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  };
});
