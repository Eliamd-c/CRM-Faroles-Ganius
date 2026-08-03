// contacts.js - Lógica frontend del módulo de Contactos
document.addEventListener('DOMContentLoaded', () => {
  const contactsListEl = document.getElementById('contactsList');
  const contactSearchEl = document.getElementById('contactSearch');
  
  const chatMessagesEl = document.getElementById('chatMessages');
  const chatHeaderInfoEl = document.getElementById('chatHeaderInfo');
  const messageInputEl = document.getElementById('messageInput');
  const btnSendMessageEl = document.getElementById('btnSendMessage');
  const btnToggleBotEl = document.getElementById('btnToggleBot');
  const botStatusTextEl = document.getElementById('botStatusText');
  
  const profileSidebarEl = document.getElementById('profileSidebar');
  const profileContentEl = document.getElementById('profileContent');
  const profileNameEl = document.getElementById('profileName');
  const profileIgIdEl = document.getElementById('profileIgId');
  const profileBotStatusEl = document.getElementById('profileBotStatus');
  const profileTagsEl = document.getElementById('profileTags');
  const profileLastActiveEl = document.getElementById('profileLastActive');
  const profileFieldsEl = document.getElementById('profileFields');

  let allContacts = [];
  let currentContact = null;
  let chatPollingInterval = null;

  // Wrapper para fetch estándar
  async function apiFetch(url, options = {}) {
    const defaultHeaders = {
      'Content-Type': 'application/json'
    };
    
    // auth.js inyectará automáticamente x-api-secret si sobrescribió fetch
    // pero usamos fetch nativo normalmente. auth.js intercepta fetch globalmente.
    
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers
        }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.error('API Fetch Error:', err);
      throw err;
    }
  }

  // Cargar lista de contactos al inicio
  fetchContacts();

  // Buscar contactos (local)
  contactSearchEl.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    renderContactsList(allContacts.filter(c => 
      (c.name && c.name.toLowerCase().includes(q)) || 
      (c.instagram_id && c.instagram_id.toLowerCase().includes(q)) ||
      (c.tags && c.tags.some(t => t.toLowerCase().includes(q)))
    ));
  });

  // Enviar mensaje
  btnSendMessageEl.addEventListener('click', sendMessage);
  messageInputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Toggle Bot
  btnToggleBotEl.addEventListener('click', toggleBot);

  // Funciones API
  async function fetchContacts() {
    try {
      const res = await apiFetch('/api/contacts');
      if (res) {
        allContacts = res;
        renderContactsList(allContacts);
      }
    } catch (err) {
      console.error("Error cargando contactos:", err);
      contactsListEl.innerHTML = `<div style="color:red; padding:20px;">Error al cargar contactos</div>`;
    }
  }

  function renderContactsList(contacts) {
    contactsListEl.innerHTML = '';
    if (contacts.length === 0) {
      contactsListEl.innerHTML = `<div style="color:var(--text-secondary); text-align:center; padding:20px;">No hay contactos</div>`;
      return;
    }

    contacts.forEach(contact => {
      const el = document.createElement('div');
      el.className = 'contact-item';
      if (currentContact && currentContact.instagram_id === contact.instagram_id) {
        el.classList.add('active');
      }

      const initial = (contact.name ? contact.name.charAt(0) : '?').toUpperCase();
      const statusIcon = contact.bot_paused ? '<i class="fa-solid fa-pause" style="color:var(--bot-paused)"></i>' : '<i class="fa-solid fa-robot" style="color:var(--bot-active)"></i>';

      el.innerHTML = `
        <div class="contact-avatar">${initial}</div>
        <div class="contact-info">
          <h4 class="contact-name">${contact.name || contact.instagram_id}</h4>
          <div class="contact-meta">
            <span>@${contact.instagram_id}</span>
            <span>${statusIcon}</span>
          </div>
        </div>
      `;

      el.addEventListener('click', () => selectContact(contact));
      contactsListEl.appendChild(el);
    });
  }

  function selectContact(contact) {
    currentContact = contact;
    
    // Actualizar UI lista
    document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
    // Un pequeño hack para re-renderizar la lista y marcar el activo
    renderContactsList(contactSearchEl.value ? 
      allContacts.filter(c => c.name?.toLowerCase().includes(contactSearchEl.value.toLowerCase())) : 
      allContacts
    );

    // Actualizar Panel Central
    chatHeaderInfoEl.innerHTML = `
      <h3>${contact.name || contact.instagram_id}</h3>
      <span class="status-indicator">@${contact.instagram_id}</span>
    `;
    messageInputEl.disabled = false;
    btnSendMessageEl.disabled = false;
    btnToggleBotEl.disabled = false;
    updateBotToggleButton(contact.bot_paused);

    // Actualizar Perfil
    document.querySelector('.profile-empty').style.display = 'none';
    profileContentEl.classList.remove('hidden');
    profileNameEl.textContent = contact.name || 'Desconocido';
    profileIgIdEl.textContent = contact.instagram_id;
    
    if (contact.bot_paused) {
      profileBotStatusEl.textContent = 'Pausado (Manual)';
      profileBotStatusEl.className = 'status-badge paused';
    } else {
      profileBotStatusEl.textContent = 'Activo';
      profileBotStatusEl.className = 'status-badge';
    }

    profileTagsEl.innerHTML = (contact.tags && contact.tags.length > 0) 
      ? contact.tags.map(t => `<span class="tag">${t}</span>`).join('') 
      : '<span style="color:var(--text-secondary); font-size:0.8rem;">Sin etiquetas</span>';
    
    profileLastActiveEl.textContent = new Date(contact.updated_at).toLocaleString();
    profileFieldsEl.textContent = JSON.stringify(contact.fields || {}, null, 2);

    // Cargar mensajes
    fetchMessages(contact.instagram_id);

    // Iniciar polling
    if (chatPollingInterval) clearInterval(chatPollingInterval);
    chatPollingInterval = setInterval(() => {
      if (currentContact) fetchMessages(currentContact.instagram_id, true);
    }, 5000);
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
      
      // Chequeo simple para no re-renderizar si no hay cambios (evita saltos de scroll)
      // Idealmente se compara el último ID o timestamp.
      // Aquí simplificamos comprobando longitud (si cambia o no había antes).
      const currentCount = chatMessagesEl.querySelectorAll('.message').length;
      if (isPolling && msgs.length === currentCount) return;

      if (msgs.length === 0) {
        chatMessagesEl.innerHTML = `
          <div class="empty-chat-state">
            <i class="fa-regular fa-comments"></i>
            <p>No hay mensajes registrados aún.</p>
          </div>
        `;
        return;
      }

      chatMessagesEl.innerHTML = '';
      msgs.forEach(m => {
        const div = document.createElement('div');
        div.className = `message ${m.direction}`;
        
        let displayContent = m.content;
        if (m.message_type === 'template' || m.message_type === 'image' || m.message_type === 'video') {
          displayContent = `<em>[${m.message_type}]</em> ${m.content}`;
        }

        const date = new Date(m.created_at);
        const timeStr = isToday(date) 
          ? date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
          : date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        div.innerHTML = `
          ${displayContent}
          <span class="msg-time">${timeStr}</span>
        `;
        chatMessagesEl.appendChild(div);
      });

      // Scroll bottom
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

    } catch (err) {
      console.error("Error cargando mensajes", err);
    }
  }

  async function sendMessage() {
    const text = messageInputEl.value.trim();
    if (!text || !currentContact) return;

    const originalText = text;
    messageInputEl.value = '';
    messageInputEl.disabled = true;
    btnSendMessageEl.disabled = true;

    // Agregar optimísticamente
    const div = document.createElement('div');
    div.className = `message outbound`;
    div.innerHTML = `${originalText} <span class="msg-time">Enviando...</span>`;
    chatMessagesEl.appendChild(div);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

    try {
      const res = await apiFetch(`/api/contacts/${currentContact.instagram_id}/send`, {
        method: 'POST',
        body: JSON.stringify({ message: originalText })
      });

      if (res && res.success) {
        // Al enviar manual, el bot se pausa
        currentContact.bot_paused = true;
        updateBotToggleButton(true);
        profileBotStatusEl.textContent = 'Pausado (Manual)';
        profileBotStatusEl.className = 'status-badge paused';
        
        // Recargar para mostrar el mensaje real
        setTimeout(() => fetchMessages(currentContact.instagram_id), 1000);
      }
    } catch (err) {
      alert("Error enviando mensaje: " + err.message);
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
      alert("Error cambiando estado: " + err.message);
    } finally {
      btnToggleBotEl.disabled = false;
    }
  }

  function isToday(date) {
    const today = new Date();
    return date.getDate() == today.getDate() &&
      date.getMonth() == today.getMonth() &&
      date.getFullYear() == today.getFullYear();
  }
});
