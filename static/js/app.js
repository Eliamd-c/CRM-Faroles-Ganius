// ============================================================
//  CMR FAROLES — APP LOGIC v2.0
// ============================================================

// --- STATE --------------------------------------------------
const state = {
    activeTab: 'inbox',
    chats: [],
    contacts: [],
    activeChatId: null,
    activeContact: null,
    rules: [],
    pollingInterval: null
};

// --- ELEMENTS (resolved after DOM ready) --------------------
let el = {};

// ============================================================
//  BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    el = {
        // Nav
        allNavBtns:     document.querySelectorAll('[data-tab]'),
        views:          document.querySelectorAll('.view'),

        // Status
        statusDot:      document.getElementById('status-dot'),
        statusLabel:    document.getElementById('status-label'),

        // Inbox
        chatsContainer: document.getElementById('chats-list-container'),
        chatHeader:     document.getElementById('chat-header-area'),
        messages:       document.getElementById('chat-messages-container'),
        inputWrapper:   document.getElementById('chat-input-wrapper'),
        msgInput:       document.getElementById('chat-message-input'),
        sendBtn:        document.getElementById('chat-send-btn'),
        searchInput:    document.getElementById('chat-search'),
        inboxWrap:      document.querySelector('.inbox-wrap'),
        
        // AI Copilot
        btnAiSuggest:   document.getElementById('btn-ai-suggest'),
        btnAiAnalyze:   document.getElementById('btn-ai-analyze'),

        // Contact panel
        contactPanel:       document.getElementById('contact-details-panel'),
        cAvatar:            document.getElementById('contact-detail-avatar'),
        cName:              document.getElementById('contact-detail-name'),
        cEditName:          document.getElementById('contact-detail-edit-name'),
        cUsername:          document.getElementById('contact-detail-username'),
        cStage:             document.getElementById('contact-detail-stage'),
        cTags:              document.getElementById('contact-detail-tags'),
        cTagsPreview:       document.getElementById('tags-preview-container'),
        cNotes:             document.getElementById('contact-detail-notes'),
        saveContactBtn:     document.getElementById('save-contact-btn'),
        btnSyncMetaProfile: document.getElementById('btn-sync-meta-profile'),

        // Kanban columns
        kanbanCols: {
            Lead:      document.getElementById('cards-Lead'),
            Contacted: document.getElementById('cards-Contacted'),
            Customer:  document.getElementById('cards-Customer'),
            Lost:      document.getElementById('cards-Lost')
        },

        // Automation
        arForm:         document.getElementById('autoresponder-form'),
        arKeyword:      document.getElementById('ar-keyword'),
        arResponse:     document.getElementById('ar-response'),
        rulesList:      document.getElementById('rules-list-body'),

        // Settings
        settingsForm:   document.getElementById('settings-form'),
        setToken:       document.getElementById('set-token'),
        setIgId:        document.getElementById('set-ig-id'),
        setVerifyToken: document.getElementById('set-verify-token'),

        // Simulator
        simForm:        document.getElementById('simulator-form'),
        simSenderId:    document.getElementById('sim-sender-id'),
        simUsername:    document.getElementById('sim-username'),
        simName:        document.getElementById('sim-name'),
        simText:        document.getElementById('sim-text'),
        simConsole:     document.getElementById('sim-logs-console')
    };

    initNavigation();
    loadSettings();
    loadChats();
    loadAutoResponders();
    wireEvents();
    setupKanban();
    startPolling();
});

// ============================================================
//  NAVIGATION
// ============================================================
function initNavigation() {
    el.allNavBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab, btn));
    });
}

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(v => v.classList.remove('active'));
    
    document.getElementById(viewId).style.display = 'block';
    const activeNav = document.querySelector(`[data-view="${viewId}"]`);
    if(activeNav) activeNav.classList.add('active');

    if (viewId === 'view-inbox') {
        renderChatsList();
    } else if (viewId === 'view-pipeline') {
        loadPipeline();
    } else if (viewId === 'view-automation') {
        loadAutoresponders();
        loadFlows();
    }
}

function switchTab(tab, clickedBtn) {
    // Deactivate all nav buttons
    el.allNavBtns.forEach(b => b.classList.remove('active'));
    // Activate clicked button (could be sidebar or mobile bottom nav)
    document.querySelectorAll(`[data-tab="${tab}"]`).forEach(b => b.classList.add('active'));

    // Switch views
    el.views.forEach(v => {
        v.classList.toggle('active', v.id === `view-${tab}`);
    });

    state.activeTab = tab;

    if (tab === 'pipeline')   loadPipeline();
    if (tab === 'automation') {
        loadAutoResponders();
        loadFlows();
    }
    if (tab === 'inbox')      loadChats();
}

// ============================================================
//  EVENTS WIRING
// ============================================================
function wireEvents() {
    el.sendBtn.addEventListener('click', sendMessage);
    el.msgInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    el.saveContactBtn.addEventListener('click', saveContactDetails);
    el.arForm.addEventListener('submit', handleARSubmit);
    el.settingsForm.addEventListener('submit', handleSettingsSubmit);
    el.simForm.addEventListener('submit', handleSimSubmit);
    el.searchInput.addEventListener('input', () => renderChatsList());
    el.cTags.addEventListener('input', e => renderTagsPreview(e.target.value));
    
    if(el.btnAiSuggest) el.btnAiSuggest.addEventListener('click', handleAiSuggest);
    if(el.btnAiAnalyze) el.btnAiAnalyze.addEventListener('click', handleAiAnalyze);
    if(el.btnSyncMetaProfile) el.btnSyncMetaProfile.addEventListener('click', handleSyncMetaProfile);
}

// ============================================================
//  STATUS BADGE
// ============================================================
function setStatus(connected) {
    if (connected) {
        el.statusDot.className = 'status-indicator connected';
        el.statusLabel.textContent = 'Meta API Conectada';
    } else {
        el.statusDot.className = 'status-indicator';
        el.statusLabel.textContent = 'Modo Simulador';
    }
}

// ============================================================
//  POLLING
// ============================================================
function startPolling() {
    state.pollingInterval = setInterval(() => {
        if (state.activeTab === 'inbox') {
            pollChatsSilent();
            if (state.activeChatId) pollMsgsSilent(state.activeChatId);
        } else if (state.activeTab === 'pipeline') {
            pollPipelineSilent();
        }
    }, 3000);
}

// ============================================================
//  SETTINGS
// ============================================================
async function loadSettings() {
    try {
        const [statusRes, settingsRes] = await Promise.all([
            fetch('/api/meta/status').then(r => r.json()).catch(() => ({})),
            fetch('/api/settings').then(r => r.json()).catch(() => ([]))
        ]);

        const settingsMap = {};
        if (Array.isArray(settingsRes)) {
            settingsRes.forEach(s => settingsMap[s.key] = s.value);
        }

        if (el.setToken) el.setToken.value = settingsMap.page_access_token || '';
        if (el.setIgId) el.setIgId.value = settingsMap.instagram_account_id || '';
        if (el.setVerifyToken) el.setVerifyToken.value = settingsMap.webhook_verify_token || '';

        setStatus(!!statusRes.configured);

        const statusDot = document.getElementById('settings-status-dot');
        const statusText = document.getElementById('settings-status-text');
        if (statusDot && statusText) {
            statusDot.className = statusRes.configured ? 'status-indicator connected' : 'status-indicator';
            statusText.textContent = statusRes.configured ? 'Meta API Conectada' : 'No Conectado (Modo Simulador)';
        }
    } catch (err) {
        console.error('loadSettings:', err);
    }
}

async function handleSettingsSubmit(e) {
    e.preventDefault();
    const token = el.setToken ? el.setToken.value.trim() : '';
    const igId = el.setIgId ? el.setIgId.value.trim() : '';
    const verifyToken = el.setVerifyToken ? el.setVerifyToken.value.trim() : '';

    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({
                page_access_token: token,
                instagram_account_id: igId,
                webhook_verify_token: verifyToken
            })
        });
        const result = await res.json();
        if (result.success || result.status === 'success') {
            await loadSettings();
            showToast('✅ Credenciales guardadas y conexión actualizada.');
        } else {
            showToast('❌ Error: ' + (result.error || 'No se pudo guardar'), 'error');
        }
    } catch (err) {
        console.error('handleSettingsSubmit:', err);
        showToast('❌ Error de red guardando configuración', 'error');
    }
}

// ============================================================
//  CHATS (INBOX)
// ============================================================
async function loadChats() {
    try {
        const res  = await fetch('/api/chats');
        state.chats = await res.json();
        renderChatsList();
        updateUnreadBadge();
    } catch (err) {
        el.chatsContainer.innerHTML = emptyStateHtml('Error al cargar conversaciones');
    }
}

async function pollChatsSilent() {
    try {
        const res = await fetch('/api/chats');
        const nc  = await res.json();
        if (JSON.stringify(nc) !== JSON.stringify(state.chats)) {
            state.chats = nc;
            renderChatsList();
            updateUnreadBadge();
        }
    } catch (_) {}
}

function updateUnreadBadge() {
    const total = state.chats.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    const badge = document.getElementById('total-unread-badge');
    if (badge) {
        badge.style.display = total > 0 ? 'flex' : 'none';
        badge.textContent = total;
    }
}

function renderChatsList() {
    const query = el.searchInput.value.toLowerCase().trim();

    if (state.chats.length === 0) {
        el.chatsContainer.innerHTML = `
            <div class="empty-state">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <p>Sin conversaciones aún</p>
                <span>Usa el simulador para comenzar</span>
            </div>`;
        return;
    }

    el.chatsContainer.innerHTML = '';
    state.chats.forEach(chat => {
        if (query && !chat.name.toLowerCase().includes(query) && !chat.username.toLowerCase().includes(query)) return;

        const isActive = chat.conversation_id === state.activeChatId;
        const avatar   = chat.avatar_url || avatarUrl(chat.username);
        const time     = formatTs(chat.last_message_time);

        let preview = chat.last_message_text || 'Sin mensajes';
        if (chat.last_message_sender === 'auto_response') preview = '🤖 ' + preview;
        else if (chat.last_message_sender === 'agent')    preview = 'Tú: ' + preview;

        const div = document.createElement('div');
        div.className = `chat-item${isActive ? ' active' : ''}`;
        div.innerHTML = `
            <div class="chat-item-avatar">
                <img src="${avatar}" alt="Avatar" onerror="this.src='${avatarUrl(chat.username)}'">
                ${chat.unread_count > 0 ? '<span class="unread-dot"></span>' : ''}
            </div>
            <div class="chat-item-content">
                <div class="chat-item-row1">
                    <span class="chat-item-name">${escHtml(chat.name)}</span>
                    <span class="chat-item-time">${time}</span>
                </div>
                <div class="chat-item-row2">
                    <span class="chat-item-preview">${escHtml(preview)}</span>
                    ${chat.unread_count > 0 ? `<span class="unread-badge">${chat.unread_count}</span>` : ''}
                </div>
            </div>`;
        div.addEventListener('click', () => selectChat(chat));
        el.chatsContainer.appendChild(div);
    });
}

async function selectChat(chat) {
    state.activeChatId = chat.conversation_id;
    state.activeContact = chat;

    // Mobile: show chat window
    if (el.inboxWrap) el.inboxWrap.classList.add('chat-active');

    // Highlight selected in list
    document.querySelectorAll('.chat-item').forEach(d => d.classList.remove('active'));
    const found = [...el.chatsContainer.querySelectorAll('.chat-item')].find(d => {
        return d.querySelector('.chat-item-name')?.textContent === chat.name;
    });
    if (found) found.classList.add('active');

    // Render contact panel
    renderContactPanel(chat);
    if (el.contactPanel) el.contactPanel.style.display = 'flex';

    // Render chat header
    renderChatHeader(chat);

    // Load & show messages
    el.inputWrapper.style.display = 'flex';
    await loadMessages(chat.conversation_id);
    el.msgInput.focus();

    // Clear unread
    loadChats();
}

function renderChatHeader(chat) {
    el.chatHeader.innerHTML = `
        <div class="chat-active-header">
            <button class="back-btn-chat" id="btn-back-to-list" title="Volver">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            </button>
            <div class="chat-header-avatar">
                <img src="${chat.avatar_url || avatarUrl(chat.username)}" alt="Avatar">
            </div>
            <div class="chat-header-info">
                <h4>${escHtml(chat.name)}</h4>
                <p>@${escHtml(chat.username)}</p>
            </div>
            <span class="chat-header-stage">${chat.stage || 'Lead'}</span>
        </div>`;

    document.getElementById('btn-back-to-list')?.addEventListener('click', () => {
        state.activeChatId = null;
        el.inboxWrap?.classList.remove('chat-active');
        el.inputWrapper.style.display = 'none';
        el.contactPanel.style.display = 'none';
        el.chatHeader.innerHTML = `
            <div class="chat-placeholder-header">
                <div class="placeholder-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <p>Selecciona una conversación</p>
            </div>`;
        el.messages.innerHTML = `
            <div class="chat-empty-state">
                <div class="chat-empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
                <h3>Tu bandeja está lista</h3>
                <p>Los mensajes de Instagram aparecerán aquí en tiempo real</p>
            </div>`;
        loadChats();
    });
}

// ============================================================
//  MESSAGES
// ============================================================
async function loadMessages(convId) {
    try {
        const res  = await fetch(`/api/chats/${convId}/messages`);
        const msgs = await res.json();
        renderMessages(msgs);
    } catch (err) { console.error(err); }
}

async function pollMsgsSilent(convId) {
    try {
        const res  = await fetch(`/api/chats/${convId}/messages`);
        const msgs = await res.json();
        const cur  = el.messages.querySelectorAll('.msg-wrap').length;
        if (msgs.length !== cur) renderMessages(msgs);
    } catch (_) {}
}

function renderMessages(msgs) {
    el.messages.innerHTML = '';

    if (!msgs.length) {
        el.messages.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:32px;font-size:.85rem;">Escribe un mensaje para iniciar la conversación</div>';
        return;
    }

    msgs.forEach(msg => {
        const dir   = msg.direction;
        const isAuto = msg.sender_type === 'auto_response';
        const ts    = fmtTime(msg.timestamp);

        const wrap = document.createElement('div');
        wrap.className = `msg-wrap ${dir === 'incoming' ? 'incoming' : 'outgoing'}`;

        const bubbleCls = dir === 'incoming' ? 'bubble incoming' : (isAuto ? 'bubble auto-resp' : 'bubble outgoing');
        wrap.innerHTML = `
            <div class="${bubbleCls}">${escHtml(msg.text)}</div>
            <span class="msg-meta">
                ${ts}
                ${isAuto ? '<span class="bot-label">🤖 Auto</span>' : ''}
            </span>`;
        el.messages.appendChild(wrap);
    });

    el.messages.scrollTop = el.messages.scrollHeight;
}

async function sendMessage() {
    const text = el.msgInput.value.trim();
    if (!text || !state.activeChatId) return;
    el.msgInput.value = '';

    try {
        const res    = await fetch(`/api/chats/${state.activeChatId}/messages`, {
            method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ text })
        });
        const result = await res.json();
        if (result.status === 'success') {
            loadMessages(state.activeChatId);
            loadChats();
            if (result.meta_sent)  addLog(`[META API] Enviado a IGSID ${state.activeChatId}: "${text}"`, 'success');
            else if (result.meta_error) addLog(`[META ERROR] ${result.meta_error}`, 'error');
            else addLog(`[LOCAL] Mensaje guardado en BD local.`, 'info');
        } else {
            showToast('❌ ' + result.error, 'error');
        }
    } catch (err) { console.error(err); }
}

// ============================================================
//  CONTACT PANEL
// ============================================================
function renderContactPanel(contact) {
    el.cAvatar.src       = contact.avatar_url || avatarUrl(contact.username);
    el.cName.textContent  = contact.name || 'Cliente';
    if (el.cEditName) el.cEditName.value = contact.name || '';
    el.cUsername.textContent = `@${contact.username || contact.contact_id}`;
    el.cStage.value       = contact.stage || 'Lead';
    el.cTags.value        = contact.tags || '';
    el.cNotes.value       = contact.notes || '';
    renderTagsPreview(contact.tags || '');
}

function renderTagsPreview(tagsStr) {
    el.cTagsPreview.innerHTML = '';
    if (!tagsStr) return;
    tagsStr.split(',').map(t => t.trim()).filter(Boolean).forEach(t => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.textContent = t;
        el.cTagsPreview.appendChild(chip);
    });
}

async function saveContactDetails() {
    if (!state.activeContact) return;
    const newName = el.cEditName ? el.cEditName.value.trim() : state.activeContact.name;
    const data = {
        name:  newName,
        stage: el.cStage.value,
        tags:  el.cTags.value.trim(),
        notes: el.cNotes.value.trim()
    };
    try {
        const res    = await fetch(`/api/contacts/${state.activeContact.contact_id}`, {
            method: 'PUT', headers: jsonHeaders(), body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success || result.status === 'success') {
            Object.assign(state.activeContact, data);
            el.cName.textContent = newName || 'Cliente';
            showToast('✅ Ficha guardada correctamente.');
            loadChats();
        } else {
            showToast('❌ ' + (result.error || 'Error al guardar'), 'error');
        }
    } catch (err) { console.error(err); }
}

async function handleSyncMetaProfile() {
    if (!state.activeContact) return;
    const cid = state.activeContact.contact_id;
    if (el.btnSyncMetaProfile) {
        el.btnSyncMetaProfile.textContent = '⏳ Sincronizando...';
        el.btnSyncMetaProfile.disabled = true;
    }
    try {
        const res = await fetch(`/api/contacts/${cid}/sync-meta`, { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success' || data.success) {
            const updated = data.contact;
            if (updated) {
                Object.assign(state.activeContact, updated);
                renderContactPanel(state.activeContact);
            }
            showToast('✅ Perfil de Instagram actualizado desde Meta.');
            loadChats();
        } else {
            showToast('❌ ' + (data.error || 'Error obteniendo perfil'), 'error');
        }
    } catch (err) {
        showToast('❌ Error de conexión con el servidor', 'error');
    } finally {
        if (el.btnSyncMetaProfile) {
            el.btnSyncMetaProfile.textContent = '🔄 Sincronizar Perfil Meta';
            el.btnSyncMetaProfile.disabled = false;
        }
    }
}

// ============================================================
//  AI COPILOT
// ============================================================
async function handleAiSuggest() {
    if (!state.activeChatId) return;
    el.btnAiSuggest.textContent = "🪄 Generando...";
    el.btnAiSuggest.disabled = true;

    try {
        const res = await fetch(`/api/ai/suggest-response/${state.activeChatId}`, { method: 'POST' });
        const data = await res.json();
        
        if (data.suggestion) {
            el.msgInput.value = data.suggestion;
            el.msgInput.focus();
            showToast('🪄 Sugerencia lista. Edita y envía.');
        } else {
            showToast('❌ ' + (data.error || 'Error IA'), 'error');
        }
    } catch (err) {
        showToast('❌ Error de red', 'error');
    } finally {
        el.btnAiSuggest.textContent = "🪄 Sugerencia IA";
        el.btnAiSuggest.disabled = false;
    }
}

async function handleAiAnalyze() {
    if (!state.activeChatId || !state.activeContact) return;
    el.btnAiAnalyze.textContent = "🔥 Analizando...";
    el.btnAiAnalyze.disabled = true;

    try {
        const res = await fetch(`/api/ai/analyze-lead/${state.activeChatId}`, { method: 'POST' });
        const data = await res.json();
        
        if (data.temperatura) {
            const oldNotes = el.cNotes.value;
            const aiNotes = `[IA Analysis]\nTemp: ${data.temperatura}\nObjeciones: ${data.objeciones ? data.objeciones.join(', ') : 'Ninguna'}\nResumen: ${data.resumen_breve}`;
            el.cNotes.value = oldNotes ? oldNotes + "\n\n" + aiNotes : aiNotes;
            
            await saveContactDetails();
            showToast('🔥 Lead analizado por Gemini.');
        } else {
            showToast('❌ ' + (data.error || 'Error IA'), 'error');
        }
    } catch (err) {
        showToast('❌ Error de red', 'error');
    } finally {
        el.btnAiAnalyze.textContent = "🔥 Analizar Lead";
        el.btnAiAnalyze.disabled = false;
    }
}

// ============================================================
//  PIPELINE / KANBAN
// ============================================================
async function loadPipeline() {
    try {
        const res      = await fetch('/api/contacts');
        state.contacts  = await res.json();
        renderKanban();
    } catch (err) { console.error(err); }
}

async function pollPipelineSilent() {
    try {
        const res = await fetch('/api/contacts');
        const nc  = await res.json();
        if (JSON.stringify(nc) !== JSON.stringify(state.contacts)) {
            state.contacts = nc;
            renderKanban();
        }
    } catch (_) {}
}

function renderKanban() {
    const stages = ['Lead', 'Contacted', 'Customer', 'Lost'];
    stages.forEach(s => {
        el.kanbanCols[s].innerHTML = '';
        const counter = document.getElementById(`count-${s}`);
        if (counter) counter.textContent = '0';
    });

    const counts = { Lead: 0, Contacted: 0, Customer: 0, Lost: 0 };

    state.contacts.forEach(c => {
        const stage = c.stage || 'Lead';
        if (!el.kanbanCols[stage]) return;
        counts[stage]++;

        const tags = (c.tags || '').split(',').map(t => t.trim()).filter(Boolean);
        const card = document.createElement('div');
        card.className  = 'k-card';
        card.draggable  = true;
        card.dataset.id = c.id;
        card.innerHTML  = `
            <div class="k-card-top">
                <img class="k-avatar" src="${c.avatar_url || avatarUrl(c.username)}" alt="Avatar">
                <div class="k-info">
                    <h5>${escHtml(c.name)}</h5>
                    <span>@${escHtml(c.username)}</span>
                </div>
            </div>
            ${tags.length ? `<div class="k-tags">${tags.map(t => `<span class="k-tag">${escHtml(t)}</span>`).join('')}</div>` : ''}`;

        card.addEventListener('dragstart', e => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', c.id);
            setTimeout(() => card.style.opacity = '0.4', 0);
        });
        card.addEventListener('dragend', () => { card.style.opacity = '1'; });
        el.kanbanCols[stage].appendChild(card);
    });

    stages.forEach(s => {
        const counter = document.getElementById(`count-${s}`);
        if (counter) counter.textContent = counts[s];
    });
}

function setupKanban() {
    document.querySelectorAll('.kanban-col').forEach(col => {
        col.addEventListener('dragover', e => {
            e.preventDefault();
            col.classList.add('drag-over');
        });
        col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
        col.addEventListener('drop', async e => {
            e.preventDefault();
            col.classList.remove('drag-over');
            const id    = e.dataTransfer.getData('text/plain');
            const stage = col.dataset.stage;
            if (!id || !stage) return;

            const card = document.querySelector(`.k-card[data-id="${id}"]`);
            if (card) {
                const origin = card.parentElement;
                col.querySelector('.kanban-cards').appendChild(card);

                try {
                    const res    = await fetch(`/api/contacts/${id}`, {
                        method: 'PUT', headers: jsonHeaders(), body: JSON.stringify({ stage })
                    });
                    const result = await res.json();
                    if (result.status === 'success') {
                        addLog(`[CRM] Contacto ${id} → "${stage}"`, 'info');
                        loadPipeline();
                    } else {
                        origin.appendChild(card);
                        showToast('❌ ' + result.error, 'error');
                    }
                } catch (_) { origin.appendChild(card); }
            }
        });
    });
}

// ============================================================
//  AUTOMATION / AUTO RESPONDERS
// ============================================================
async function loadAutoResponders() {
    try {
        const res   = await fetch('/api/auto-responders');
        state.rules  = await res.json();
        renderRules();
    } catch (err) { console.error(err); }
}

function renderRules() {
    el.rulesList.innerHTML = '';
    if (!state.rules.length) {
        el.rulesList.innerHTML = `
            <div style="text-align:center;padding:32px;color:var(--text-muted);font-size:.85rem;">
                No hay respuestas automáticas. Crea una arriba.
            </div>`;
        return;
    }
    state.rules.forEach(rule => {
        const div = document.createElement('div');
        div.className = 'rule-item';
        div.innerHTML = `
            <div class="rule-status ${rule.is_active ? '' : 'inactive'}"></div>
            <span class="rule-keyword">${escHtml(rule.keyword)}</span>
            <span class="rule-text">${escHtml(rule.response_text)}</span>
            <div class="rule-actions">
                <button class="rule-btn" title="Activar/Desactivar" onclick="window.toggleAR(${rule.id}, ${rule.is_active})">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                </button>
                <button class="rule-btn danger" title="Eliminar" onclick="window.deleteAR(${rule.id})">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>`;
        el.rulesList.appendChild(div);
    });
}

// ============================================================
//  AUTO RESPONDERS & FLOW BUILDER
// ============================================================
async function loadAutoresponders() {
    try {
        const res = await fetch('/api/autoresponders');
        const data = await res.json();
        const list = document.getElementById('rules-list');
        if(!list) return;

        if (data.length === 0) {
            list.innerHTML = '<p style="color:var(--text-muted); font-size:13px; padding:16px;">No hay reglas activas.</p>';
            return;
        }

        list.innerHTML = data.map(rule => `
            <div class="rule-item" style="padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-weight: 600; color: #34d399; margin-bottom: 4px;">"${rule.keyword}"</div>
                    <div style="color: var(--text-muted); font-size: 13px;">${rule.response_text}</div>
                </div>
                <button onclick="deleteAutoresponder(${rule.id})" class="btn-icon" style="color:#ef4444;" title="Eliminar regla">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
        `).join('');
    } catch (err) {
        console.error("Error loading autoresponders", err);
    }
}

async function loadFlows() {
    try {
        const res = await fetch('/api/flows');
        const data = await res.json();
        renderFlowsGrid(data);
    } catch (err) {
        console.error("Error loading flows", err);
    }
}

function renderFlowsGrid(flows) {
    const grid = document.getElementById('flows-grid');
    if (!grid) return;

    grid.innerHTML = flows.map(f => {
        let btns = [];
        try { btns = JSON.parse(f.buttons_json || "[]"); } catch(e){}
        
        return `
        <div class="flow-card" data-id="${f.id}">
            <div class="flow-card-header">
                <input type="text" class="flow-id-badge flow-id-input" value="${f.id}" placeholder="ID_DEL_PASO">
                <button onclick="deleteFlow('${f.id}')" class="flow-delete-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
            </div>
            <div>
                <textarea class="field-textarea flow-msg-input" rows="3" placeholder="Mensaje persuasivo...">${f.message_text || ''}</textarea>
            </div>
            <div class="flow-buttons-list">
                ${btns.map((b, i) => `
                <div class="flow-button-item">
                    <input type="text" placeholder="Título del botón" class="btn-title-input" value="${b.title}">
                    <input type="text" placeholder="ID de Destino o WA:..." class="payload-input" value="${b.payload}">
                    <button class="btn-icon btn-remove-flow-btn" onclick="this.parentElement.remove(); saveAllFlows();" style="color:var(--text-muted)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                </div>
                `).join('')}
            </div>
            ${btns.length < 3 ? `<div class="add-btn-row"><button class="btn-outline add-flow-btn-trigger">+ Botón</button></div>` : ''}
        </div>
        `;
    }).join('');

    // Attach events
    grid.querySelectorAll('.flow-id-input, .flow-msg-input, .btn-title-input, .payload-input').forEach(el => {
        el.addEventListener('change', saveAllFlows);
    });

    grid.querySelectorAll('.add-flow-btn-trigger').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.flow-card');
            const list = card.querySelector('.flow-buttons-list');
            const newBtn = document.createElement('div');
            newBtn.className = 'flow-button-item';
            newBtn.innerHTML = `
                <input type="text" placeholder="Título" class="btn-title-input" value="">
                <input type="text" placeholder="Destino (WA: o ID)" class="payload-input" value="">
                <button class="btn-icon btn-remove-flow-btn" onclick="this.parentElement.remove(); saveAllFlows();" style="color:var(--text-muted)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
            `;
            list.appendChild(newBtn);
            newBtn.querySelectorAll('input').forEach(i => i.addEventListener('change', saveAllFlows));
            saveAllFlows();
            loadFlows(); // re-render to update the "+ Botón" visibility
        });
    });
}

async function saveAllFlows() {
    const grid = document.getElementById('flows-grid');
    if (!grid) return;

    const cards = grid.querySelectorAll('.flow-card');
    for (let card of cards) {
        const oldId = card.getAttribute('data-id');
        const id = card.querySelector('.flow-id-input').value.trim() || oldId;
        const msg = card.querySelector('.flow-msg-input').value;
        const btnItems = card.querySelectorAll('.flow-button-item');
        
        let buttons = [];
        btnItems.forEach(item => {
            const title = item.querySelector('.btn-title-input').value.trim();
            const payload = item.querySelector('.payload-input').value.trim();
            if(title && payload) buttons.push({ type: 'text', title, payload });
        });

        await fetch('/api/flows', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, message_text: msg, buttons_json: JSON.stringify(buttons) })
        });
    }
    showToast("✅ Flujos guardados automáticamente.");
}

async function deleteFlow(id) {
    if(!confirm(`¿Eliminar paso ${id}?`)) return;
    await fetch(`/api/flows/${id}`, { method: 'DELETE' });
    showToast("🗑️ Paso eliminado.");
    loadFlows();
}

const addFlowBtn = document.getElementById('btn-add-flow');
if(addFlowBtn) {
    addFlowBtn.addEventListener('click', async () => {
        const id = 'FLOW_NUEVO_' + Date.now().toString().slice(-4);
        await fetch('/api/flows', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, message_text: 'Nuevo mensaje...', buttons_json: '[]' })
        });
        loadFlows();
    });
}

async function handleARSubmit(e) {
    e.preventDefault();
    const data = {
        keyword:      el.arKeyword.value.trim(),
        response_text: el.arResponse.value.trim(),
        is_active:    1
    };
    try {
        const res    = await fetch('/api/auto-responders', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(data) });
        const result = await res.json();
        if (result.status === 'success') {
            el.arKeyword.value  = '';
            el.arResponse.value = '';
            loadAutoResponders();
            addLog(`[BOTS] Regla añadida: "${data.keyword}"`, 'success');
            showToast('✅ Regla creada.');
        } else {
            showToast('❌ ' + result.error, 'error');
        }
    } catch (err) { console.error(err); }
}

window.toggleAR = async (id, cur) => {
    const next = cur === 1 ? 0 : 1;
    try {
        const res = await fetch(`/api/auto-responders/${id}`, { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify({ is_active: next }) });
        if (res.ok) { loadAutoResponders(); addLog(`[BOTS] Regla ${id} cambiada.`, 'info'); }
    } catch (_) {}
};

window.deleteAR = async (id) => {
    if (!confirm('¿Eliminar esta regla?')) return;
    try {
        const res = await fetch(`/api/auto-responders/${id}`, { method: 'DELETE' });
        if (res.ok) { loadAutoResponders(); addLog(`[BOTS] Regla ${id} eliminada.`, 'warning'); }
    } catch (_) {}
};

// ============================================================
//  SIMULATOR
// ============================================================
async function handleSimSubmit(e) {
    e.preventDefault();
    const data = {
        sender_id: el.simSenderId.value.trim(),
        username:  el.simUsername.value.trim(),
        name:      el.simName.value.trim(),
        text:      el.simText.value.trim()
    };

    addLog(`[SIM → WEBHOOK] Inyectando mensaje de @${data.username}...`, 'system');
    addLog(`[MSG] "${data.text}"`, 'info');

    try {
        const res    = await fetch('/api/simulator/receive', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(data) });
        const result = await res.json();

        if (result.status === 'success') {
            addLog('[WEBHOOK 200 OK] Evento procesado correctamente.', 'success');
            if (result.auto_response_sent) addLog(`[BOT] Auto-respuesta enviada: "${result.auto_response_text}"`, 'success');
            el.simText.value = '';

            if (state.activeTab === 'inbox') {
                await loadChats();
                if (state.activeChatId === data.sender_id) await loadMessages(data.sender_id);
            }
        } else {
            addLog(`[ERROR] ${result.error}`, 'error');
        }
    } catch (err) {
        addLog('[ERROR] Excepción de conexión con el servidor.', 'error');
        console.error(err);
    }
}

function addLog(msg, type = 'info') {
    const console_ = el.simConsole;
    if (!console_) return;

    const t   = new Date();
    const ts  = `[${pad2(t.getHours())}:${pad2(t.getMinutes())}:${pad2(t.getSeconds())}]`;
    const div = document.createElement('div');
    div.className   = `log-line log-${type}`;
    div.textContent = `${ts} ${msg}`;
    console_.appendChild(div);
    console_.scrollTop = console_.scrollHeight;
}

// ============================================================
//  TOAST
// ============================================================
function showToast(msg, type = 'success') {
    // Simple notification in bottom-right
    let toast = document.getElementById('crm-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'crm-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 24px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 8px;
            pointer-events: none;`;
        document.body.appendChild(toast);
    }

    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = `
        background: ${type === 'error' ? 'rgba(239,68,68,0.95)' : 'rgba(22,197,94,0.95)'};
        color: white;
        font-family: var(--font-main);
        font-size: .875rem;
        font-weight: 600;
        padding: 12px 18px;
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        animation: slideInRight .3s ease;
        backdrop-filter: blur(10px);
        pointer-events: auto;`;
    toast.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

// ============================================================
//  UTILS
// ============================================================
function jsonHeaders() {
    return { 'Content-Type': 'application/json' };
}

function avatarUrl(username) {
    return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(username || 'user')}`;
}

function escHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function pad2(n) {
    return n.toString().padStart(2, '0');
}

function formatTs(ts) {
    if (!ts) return '';
    const d = new Date(ts.replace(' ', 'T'));
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return `${d.getDate()}/${d.getMonth() + 1}`;
}

function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts.replace(' ', 'T'));
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function emptyStateHtml(msg) {
    return `<div class="empty-state"><p>${msg}</p></div>`;
}

// Add toast animation globally
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { opacity: 0; transform: translateX(20px); }
        to   { opacity: 1; transform: translateX(0); }
    }`;
document.head.appendChild(style);
