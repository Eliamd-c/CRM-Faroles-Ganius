// --- InstaCRM Frontend Logic ---

// State Management
const state = {
    activeTab: 'inbox',
    chats: [],
    contacts: [],
    activeChatId: null,
    activeContact: null,
    rules: [],
    pollingInterval: null
};

// DOM Elements
const elements = {
    navItems: document.querySelectorAll('.nav-item'),
    tabViews: document.querySelectorAll('.tab-view'),
    connectionBadge: document.getElementById('connection-status-badge'),
    
    // Inbox elements
    chatsContainer: document.getElementById('chats-list-container'),
    chatHeader: document.getElementById('chat-header-area'),
    messagesContainer: document.getElementById('chat-messages-container'),
    inputWrapper: document.getElementById('chat-input-wrapper'),
    messageInput: document.getElementById('chat-message-input'),
    sendBtn: document.getElementById('chat-send-btn'),
    chatSearchInput: document.getElementById('chat-search'),
    
    // Contact Detail elements
    contactPanel: document.getElementById('contact-details-panel'),
    contactAvatar: document.getElementById('contact-detail-avatar'),
    contactName: document.getElementById('contact-detail-name'),
    contactUsername: document.getElementById('contact-detail-username'),
    contactStageSelect: document.getElementById('contact-detail-stage'),
    contactTagsInput: document.getElementById('contact-detail-tags'),
    tagsPreview: document.getElementById('tags-preview-container'),
    contactNotes: document.getElementById('contact-detail-notes'),
    saveContactBtn: document.getElementById('save-contact-btn'),
    
    // Kanban elements
    columns: {
        Lead: document.getElementById('cards-Lead'),
        Contacted: document.getElementById('cards-Contacted'),
        Customer: document.getElementById('cards-Customer'),
        Lost: document.getElementById('cards-Lost')
    },
    
    // Automation elements
    autoresponderForm: document.getElementById('autoresponder-form'),
    arKeyword: document.getElementById('ar-keyword'),
    arResponse: document.getElementById('ar-response'),
    rulesListBody: document.getElementById('rules-list-body'),
    
    // Settings elements
    settingsForm: document.getElementById('settings-form'),
    setToken: document.getElementById('set-token'),
    setIgId: document.getElementById('set-ig-id'),
    setVerifyToken: document.getElementById('set-verify-token'),
    
    // Simulator elements
    simulatorForm: document.getElementById('simulator-form'),
    simSenderId: document.getElementById('sim-sender-id'),
    simUsername: document.getElementById('sim-username'),
    simName: document.getElementById('sim-name'),
    simText: document.getElementById('sim-text'),
    simLogsConsole: document.getElementById('sim-logs-console')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    setupTabNavigation();
    loadSettings();
    loadChats();
    loadAutoResponders();
    
    // Event Listeners
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'ENTER' || e.keyCode === 13) sendMessage();
    });
    elements.saveContactBtn.addEventListener('click', saveContactDetails);
    elements.autoresponderForm.addEventListener('submit', handleARSubmit);
    elements.settingsForm.addEventListener('submit', handleSettingsSubmit);
    elements.simulatorForm.addEventListener('submit', handleSimulatorSubmit);
    elements.chatSearchInput.addEventListener('input', filterChats);
    
    // Setup Drag and Drop events for Kanban Columns
    setupKanbanDragAndDrop();
    
    // Start background polling for updates (simulate real-time Webhooks)
    startPolling();
});

// --- NAVIGATION ---
function setupTabNavigation() {
    elements.navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            
            // Toggle active classes on nav
            elements.navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            // Toggle active classes on views
            elements.tabViews.forEach(view => {
                view.classList.remove('active');
                if (view.id === `view-${targetTab}`) {
                    view.classList.add('active');
                }
            });
            
            state.activeTab = targetTab;
            
            // Trigger tab specific loads
            if (targetTab === 'pipeline') {
                loadPipeline();
            } else if (targetTab === 'automation') {
                loadAutoResponders();
            } else if (targetTab === 'inbox') {
                loadChats();
            }
        });
    });
}

// --- POLLING ENGINE ---
function startPolling() {
    // Poll every 3 seconds
    state.pollingInterval = setInterval(() => {
        if (state.activeTab === 'inbox') {
            pollChatsSilent();
            if (state.activeChatId) {
                pollMessagesSilent(state.activeChatId);
            }
        } else if (state.activeTab === 'pipeline') {
            loadPipelineSilent();
        }
    }, 3000);
}

// --- BACKEND API COMMUNICATIONS ---

// Config
async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        const settings = await res.json();
        
        elements.setToken.value = settings.page_access_token || '';
        elements.setIgId.value = settings.instagram_account_id || '';
        elements.setVerifyToken.value = settings.webhook_verify_token || '';
        
        updateConnectionBadge(settings.page_access_token && settings.instagram_account_id);
    } catch (err) {
        console.error('Error loading settings:', err);
        addSimLog('[ERROR] Error cargando configuración desde la BD.', 'error');
    }
}

function updateConnectionBadge(isConnected) {
    const dot = elements.connectionBadge.querySelector('.status-dot');
    const text = elements.connectionBadge.querySelector('.status-text');
    
    if (isConnected) {
        dot.className = 'status-dot success';
        text.innerText = 'Meta API Conectada';
        addSimLog('[SISTEMA] Conexión real con Meta API detectada.', 'success');
    } else {
        dot.className = 'status-dot warning';
        text.innerText = 'Modo Simulador';
    }
}

async function handleSettingsSubmit(e) {
    e.preventDefault();
    const data = {
        page_access_token: elements.setToken.value.trim(),
        instagram_account_id: elements.setIgId.value.trim(),
        webhook_verify_token: elements.setVerifyToken.value.trim()
    };
    
    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        
        if (result.status === 'success') {
            alert('Configuración guardada correctamente.');
            loadSettings();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (err) {
        console.error('Error saving settings:', err);
    }
}

// Chats (Inbox)
async function loadChats() {
    try {
        const res = await fetch('/api/chats');
        state.chats = await res.json();
        renderChatsList();
    } catch (err) {
        elements.chatsContainer.innerHTML = '<div class="loading-state">Error cargando chats</div>';
    }
}

async function pollChatsSilent() {
    try {
        const res = await fetch('/api/chats');
        const newChats = await res.json();
        
        // Simple comparador de cambios
        if (JSON.stringify(newChats) !== JSON.stringify(state.chats)) {
            state.chats = newChats;
            renderChatsList();
        }
    } catch (err) {
        console.warn('Error polling chats:', err);
    }
}

function renderChatsList() {
    if (state.chats.length === 0) {
        elements.chatsContainer.innerHTML = '<div class="loading-state">No hay conversaciones activas</div>';
        return;
    }
    
    const query = elements.chatSearchInput.value.toLowerCase().trim();
    
    elements.chatsContainer.innerHTML = '';
    state.chats.forEach(chat => {
        // Filtrado por buscador
        if (query && !chat.name.toLowerCase().includes(query) && !chat.username.toLowerCase().includes(query)) {
            return;
        }

        const isChatActive = chat.conversation_id === state.activeChatId;
        const unreadBadge = chat.unread_count > 0 ? `<span class="chat-unread-badge">${chat.unread_count}</span>` : '';
        
        // Formatear hora
        const timeStr = formatTimestamp(chat.last_message_time);
        
        // Formatear último mensaje
        let lastMsgText = chat.last_message_text || 'Sin mensajes';
        if (chat.last_message_sender === 'auto_response') {
            lastMsgText = `🤖 Bot: ${lastMsgText}`;
        } else if (chat.last_message_sender === 'agent') {
            lastMsgText = `Tú: ${lastMsgText}`;
        }

        const card = document.createElement('div');
        card.className = `chat-card ${isChatActive ? 'active' : ''}`;
        card.innerHTML = `
            <img class="chat-avatar" src="${chat.avatar_url}" alt="Avatar">
            <div class="chat-card-info">
                <div class="chat-card-header">
                    <h4>${chat.name}</h4>
                    <span class="chat-time">${timeStr}</span>
                </div>
                <div class="chat-card-body">
                    <p class="chat-last-msg">${lastMsgText}</p>
                    ${unreadBadge}
                </div>
            </div>
        `;
        
        card.addEventListener('click', () => selectChat(chat));
        elements.chatsContainer.appendChild(card);
    });
}

function filterChats() {
    renderChatsList();
}

async function selectChat(chat) {
    state.activeChatId = chat.conversation_id;
    
    // Actualizar clase activa en UI
    document.querySelectorAll('.chat-card').forEach(card => card.classList.remove('active'));
    
    // Activar clase chat-active en el layout para responsive móvil
    const inboxLayout = document.querySelector('.inbox-layout');
    if (inboxLayout) {
        inboxLayout.classList.add('chat-active');
    }
    
    // Obtener y renderizar detalles del contacto
    state.activeContact = chat;
    renderContactDetailsPanel(chat);
    
    // Cargar mensajes de la conversación
    await loadMessages(chat.conversation_id);
    
    // Renderizar cabecera del chat con soporte para botón de retroceso móvil
    elements.chatHeader.innerHTML = `
        <div class="chat-header-content">
            <button class="back-btn" id="chat-back-btn" title="Volver a los chats">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 20px; height: 20px;">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
            </button>
            <div class="chat-user-info">
                <h3>${chat.name}</h3>
                <p>@${chat.username} | Cuenta: ${chat.contact_id}</p>
            </div>
        </div>
    `;
    
    // Vincular evento del botón de regreso
    const backBtn = document.getElementById('chat-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            state.activeChatId = null;
            if (inboxLayout) {
                inboxLayout.classList.remove('chat-active');
            }
            document.querySelectorAll('.chat-card').forEach(card => card.classList.remove('active'));
            elements.inputWrapper.style.display = 'none';
            elements.messagesContainer.innerHTML = `
                <div class="no-chat-selected">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <p>Bandeja de entrada lista para operar</p>
                </div>
            `;
            elements.chatHeader.innerHTML = `
                <div class="chat-user-info">
                    <h3>Selecciona un chat</h3>
                    <p>Elige una conversación de la izquierda para comenzar</p>
                </div>
            `;
            loadChats();
        });
    }
    
    elements.inputWrapper.style.display = 'flex';
    elements.messageInput.focus();
    
    // Forzar renderizado para limpiar badges de no leído
    loadChats();
}

// Mensajes
async function loadMessages(convId) {
    try {
        const res = await fetch(`/api/chats/${convId}/messages`);
        const messages = await res.json();
        renderMessages(messages);
    } catch (err) {
        console.error('Error loading messages:', err);
    }
}

async function pollMessagesSilent(convId) {
    try {
        const res = await fetch(`/api/chats/${convId}/messages`);
        const messages = await res.json();
        // Solo re-renderizar si cambia el número de mensajes para evitar molestos resets de scroll
        const currentCount = elements.messagesContainer.querySelectorAll('.message-bubble').length;
        if (messages.length !== currentCount) {
            renderMessages(messages);
        }
    } catch (err) {
        console.warn('Error polling messages:', err);
    }
}

function renderMessages(messages) {
    elements.messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
        elements.messagesContainer.innerHTML = '<div class="loading-state">Escribe un mensaje para iniciar la conversación</div>';
        return;
    }
    
    messages.forEach(msg => {
        const bubble = document.createElement('div');
        let bubbleClass = 'message-bubble';
        if (msg.direction === 'incoming') {
            bubbleClass += ' incoming';
        } else {
            if (msg.sender_type === 'auto_response') {
                bubbleClass += ' auto-response';
            } else {
                bubbleClass += ' outgoing';
            }
        }
        
        // Formatear hora de mensaje
        const date = new Date(msg.timestamp);
        const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        bubble.className = bubbleClass;
        bubble.innerHTML = `
            ${msg.text}
            <span class="msg-timestamp">${timeStr}</span>
        `;
        
        elements.messagesContainer.appendChild(bubble);
    });
    
    // Auto Scroll al fondo
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

async function sendMessage() {
    const text = elements.messageInput.value.trim();
    if (!text || !state.activeChatId) return;
    
    // Limpiar input inmediatamente para una sensación fluida (optimistic UI)
    elements.messageInput.value = '';
    
    try {
        const res = await fetch(`/api/chats/${state.activeChatId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const result = await res.json();
        
        if (result.status === 'success') {
            // Recargar mensajes
            loadMessages(state.activeChatId);
            loadChats();
            
            if (result.meta_sent) {
                addSimLog(`[API META] Mensaje enviado a IGSID ${state.activeChatId}: "${text}"`, 'success');
            } else if (result.meta_error) {
                addSimLog(`[API META - ERROR] No se pudo enviar por Meta: ${result.meta_error}`, 'error');
            } else {
                addSimLog(`[CRM LOCAL] Mensaje guardado en base de datos local (Simulador): "${text}"`, 'info');
            }
        } else {
            alert('Error al enviar: ' + result.error);
        }
    } catch (err) {
        console.error('Error sending message:', err);
    }
}

// Ficha de Contacto
function renderContactDetailsPanel(contact) {
    elements.contactPanel.style.display = 'block';
    elements.contactAvatar.src = contact.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${contact.username}`;
    elements.contactName.innerText = contact.name;
    elements.contactUsername.innerText = `@${contact.username}`;
    elements.contactStageSelect.value = contact.stage || 'Lead';
    elements.contactTagsInput.value = contact.tags || '';
    elements.contactNotes.value = contact.notes || '';
    
    renderTagsPreview(contact.tags || '');
}

function renderTagsPreview(tagsStr) {
    elements.tagsPreview.innerHTML = '';
    if (!tagsStr) return;
    
    const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0);
    tags.forEach(tag => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.innerText = tag;
        elements.tagsPreview.appendChild(chip);
    });
}

// Vincular input de tags a previsualización en vivo
elements.contactTagsInput.addEventListener('input', (e) => {
    renderTagsPreview(e.target.value);
});

async function saveContactDetails() {
    if (!state.activeContact) return;
    
    const contactId = state.activeContact.contact_id;
    const data = {
        stage: elements.contactStageSelect.value,
        tags: elements.contactTagsInput.value.trim(),
        notes: elements.contactNotes.value.trim()
    };
    
    try {
        const res = await fetch(`/api/contacts/${contactId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        
        if (result.status === 'success') {
            alert('Ficha de contacto actualizada correctamente.');
            // Actualizar estado local
            state.activeContact.stage = data.stage;
            state.activeContact.tags = data.tags;
            state.activeContact.notes = data.notes;
            
            // Recargar listas
            loadChats();
        } else {
            alert('Error al guardar ficha: ' + result.error);
        }
    } catch (err) {
        console.error('Error saving contact details:', err);
    }
}

// --- KANBAN BOARD (PIPELINE) ---
async function loadPipeline() {
    try {
        const res = await fetch('/api/contacts');
        state.contacts = await res.json();
        renderKanbanColumns();
    } catch (err) {
        console.error('Error loading contacts for pipeline:', err);
    }
}

async function loadPipelineSilent() {
    try {
        const res = await fetch('/api/contacts');
        const newContacts = await res.json();
        if (JSON.stringify(newContacts) !== JSON.stringify(state.contacts)) {
            state.contacts = newContacts;
            renderKanbanColumns();
        }
    } catch (err) {
        console.warn('Error polling pipeline:', err);
    }
}

function renderKanbanColumns() {
    // Inicializar columnas limpias
    Object.keys(elements.columns).forEach(key => {
        elements.columns[key].innerHTML = '';
        const badge = elements.columns[key].parentElement.querySelector('.count-badge');
        badge.innerText = '0';
    });
    
    const counts = { Lead: 0, Contacted: 0, Customer: 0, Lost: 0 };
    
    state.contacts.forEach(contact => {
        const stage = contact.stage || 'Lead';
        if (!elements.columns[stage]) return;
        
        counts[stage]++;
        
        const tags = contact.tags 
            ? contact.tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
            : [];
            
        const tagsHtml = tags.map(tag => `<span class="card-tag">${tag}</span>`).join('');
        
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.draggable = true;
        card.setAttribute('data-id', contact.id);
        card.innerHTML = `
            <div class="card-contact-info">
                <img class="card-avatar" src="${contact.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${contact.username}`}" alt="Avatar">
                <div class="card-name-wrapper">
                    <h4>${contact.name}</h4>
                    <p>@${contact.username}</p>
                </div>
            </div>
            ${tags.length > 0 ? `<div class="card-tags">${tagsHtml}</div>` : ''}
        `;
        
        // Agregar eventos de drag al elemento carta
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
        
        elements.columns[stage].appendChild(card);
    });
    
    // Actualizar contadores de las columnas
    Object.keys(counts).forEach(key => {
        const badge = elements.columns[key].parentElement.querySelector('.count-badge');
        badge.innerText = counts[key];
    });
}

// Drag & Drop Handlers
let draggedCard = null;

function handleDragStart(e) {
    draggedCard = this;
    this.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.getAttribute('data-id'));
}

function handleDragEnd() {
    draggedCard = null;
    this.style.opacity = '1';
    
    // Limpiar estilos dragover de las columnas
    document.querySelectorAll('.kanban-column').forEach(col => {
        col.style.borderColor = 'var(--border-color)';
        col.style.backgroundColor = 'rgba(15, 16, 31, 0.4)';
    });
}

function setupKanbanDragAndDrop() {
    document.querySelectorAll('.kanban-column').forEach(column => {
        column.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            column.style.borderColor = 'var(--accent-purple)';
            column.style.backgroundColor = 'rgba(168, 85, 247, 0.03)';
        });
        
        column.addEventListener('dragleave', () => {
            column.style.borderColor = 'var(--border-color)';
            column.style.backgroundColor = 'rgba(15, 16, 31, 0.4)';
        });
        
        column.addEventListener('drop', async function(e) {
            e.preventDefault();
            const contactId = e.dataTransfer.getData('text/plain');
            const targetStage = this.getAttribute('data-stage');
            
            if (contactId && targetStage) {
                // Actualizar localmente el DOM primero para feedback rápido (optimistic update)
                const card = document.querySelector(`.kanban-card[data-id="${contactId}"]`);
                if (card) {
                    const originCol = card.parentElement;
                    this.querySelector('.column-cards').appendChild(card);
                    
                    // Enviar actualización a la API
                    try {
                        const res = await fetch(`/api/contacts/${contactId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ stage: targetStage })
                        });
                        const result = await res.json();
                        
                        if (result.status === 'success') {
                            addSimLog(`[CRM] Contacto ${contactId} movido exitosamente a etapa "${targetStage}".`, 'info');
                            loadPipeline(); // Recargar bien para recalcular badges y estado
                        } else {
                            // Revertir en caso de fallo
                            originCol.appendChild(card);
                            alert('No se pudo mover el contacto: ' + result.error);
                        }
                    } catch (err) {
                        console.error('Error al arrastrar contacto:', err);
                        originCol.appendChild(card);
                    }
                }
            }
        });
    });
}

// --- AUTOMATION (AUTO RESPONDERS) ---
async function loadAutoResponders() {
    try {
        const res = await fetch('/api/auto-responders');
        state.rules = await res.json();
        renderRulesTable();
    } catch (err) {
        console.error('Error loading auto-responders:', err);
    }
}

function renderRulesTable() {
    elements.rulesListBody.innerHTML = '';
    
    if (state.rules.length === 0) {
        elements.rulesListBody.innerHTML = `
            <tr>
                <td colspan="4" class="loading-state" style="text-align: center;">No hay respuestas automáticas creadas.</td>
            </tr>
        `;
        return;
    }
    
    state.rules.forEach(rule => {
        const tr = document.createElement('tr');
        
        const activeBadge = rule.is_active === 1 
            ? '<span class="status-badge active">Activo</span>' 
            : '<span class="status-badge inactive">Inactivo</span>';
            
        tr.innerHTML = `
            <td><span class="keyword-badge">${rule.keyword}</span></td>
            <td><div class="response-text-preview" title="${rule.response_text}">${rule.response_text}</div></td>
            <td>${activeBadge}</td>
            <td>
                <button class="btn-icon" onclick="toggleAR(${rule.id}, ${rule.is_active})" title="Activar/Desactivar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                        <line x1="12" y1="2" x2="12" y2="12"></line>
                    </svg>
                </button>
                <button class="btn-icon delete" onclick="deleteAR(${rule.id})" title="Eliminar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </td>
        `;
        elements.rulesListBody.appendChild(tr);
    });
}

async function handleARSubmit(e) {
    e.preventDefault();
    const data = {
        keyword: elements.arKeyword.value.trim(),
        response_text: elements.arResponse.value.trim(),
        is_active: 1
    };
    
    try {
        const res = await fetch('/api/auto-responders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        
        if (result.status === 'success') {
            elements.arKeyword.value = '';
            elements.arResponse.value = '';
            loadAutoResponders();
            addSimLog(`[AUTOMATIZACIÓN] Nueva respuesta rápida añadida para: "${data.keyword}".`, 'success');
        } else {
            alert('Error al crear regla: ' + result.error);
        }
    } catch (err) {
        console.error('Error creating autoresponder:', err);
    }
}

// Global functions attached to window for table action buttons
window.toggleAR = async (id, currentStatus) => {
    const nextStatus = currentStatus === 1 ? 0 : 1;
    try {
        const res = await fetch(`/api/auto-responders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: nextStatus })
        });
        if (res.ok) {
            loadAutoResponders();
            addSimLog(`[AUTOMATIZACIÓN] Estado de regla ID ${id} cambiado.`, 'info');
        }
    } catch (err) {
        console.error('Error toggling autoresponder:', err);
    }
};

window.deleteAR = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta regla de auto-respuesta?')) return;
    try {
        const res = await fetch(`/api/auto-responders/${id}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            loadAutoResponders();
            addSimLog(`[AUTOMATIZACIÓN] Regla ID ${id} eliminada.`, 'warning');
        }
    } catch (err) {
        console.error('Error deleting autoresponder:', err);
    }
};

// --- SIMULATOR ---
async function handleSimulatorSubmit(e) {
    e.preventDefault();
    const data = {
        sender_id: elements.simSenderId.value.trim(),
        username: elements.simUsername.value.trim(),
        name: elements.simName.value.trim(),
        text: elements.simText.value.trim()
    };
    
    // Logs visuales
    addSimLog(`[SIMULADOR -> WEBHOOK] Simulando llegada de webhook de mensaje...`, 'system');
    addSimLog(`Remitente: @${data.username} (ID: ${data.sender_id})`, 'info');
    addSimLog(`Mensaje: "${data.text}"`, 'info');
    
    try {
        const res = await fetch('/api/simulator/receive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        
        if (result.status === 'success') {
            addSimLog(`[SISTEMA WEBHOOK] Evento inyectado correctamente. Código 200 OK.`, 'success');
            
            // Si el texto simulado contenía una palabra clave disparadora, 
            // el backend inyecta una auto_response que se guardará.
            // Lo sabremos al repasar los logs o refrescar.
            
            // Limpiar campo de texto para facilitar el envío de más mensajes
            elements.simText.value = '';
            
            // Generar un nuevo ID de mensaje aleatorio para simular DMs sucesivos si es del mismo usuario
            // O mantener el mismo Sender ID para seguir chateando con él
            
            // Recargar chats y mensajes activos en Inbox de fondo
            if (state.activeTab === 'inbox') {
                await loadChats();
                if (state.activeChatId === data.sender_id) {
                    await loadMessages(data.sender_id);
                }
            }
        } else {
            addSimLog(`[SIMULADOR - ERROR] Fallo al inyectar mensaje: ${result.error}`, 'error');
        }
    } catch (err) {
        console.error('Error simulating event:', err);
        addSimLog(`[SIMULADOR - ERROR] Excepción de conexión.`, 'error');
    }
}

function addSimLog(message, type = 'info') {
    const logLine = document.createElement('div');
    logLine.className = `log-line ${type}`;
    
    const time = new Date();
    const timeStr = `[${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}]`;
    
    logLine.innerText = `${timeStr} ${message}`;
    elements.simLogsConsole.appendChild(logLine);
    
    // Auto-scroll terminal
    elements.simLogsConsole.scrollTop = elements.simLogsConsole.scrollHeight;
}

// --- UTILS ---
function formatTimestamp(timestampStr) {
    if (!timestampStr) return '';
    const date = new Date(timestampStr.replace(' ', 'T')); // SQLite format standard fix
    
    // Si es hoy, mostrar hora. Si no, mostrar fecha corta.
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    
    return `${date.getDate()}/${date.getMonth() + 1}`;
}
