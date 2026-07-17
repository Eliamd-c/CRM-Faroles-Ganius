const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const { getGeminiLeadScore, getChatGptSuggestion } = require('./ai_copilot');

const app = express();
const PORT = process.env.PORT || 5000;
const DATABASE_PATH = process.env.DATABASE_PATH || 'crm.db';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// Conexión a la base de datos
const db = new sqlite3.Database(DATABASE_PATH, (err) => {
    if (err) {
        console.error('Error al abrir la base de datos SQLite:', err.message);
    } else {
        console.log('Conectado a la base de datos SQLite:', DATABASE_PATH);
        initDb();
    }
});

// Promesas para base de datos
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
    });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const dbExec = (sql) => new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
    });
});

// Inicializar la base de datos
async function initDb() {
    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await dbExec(schemaSql);
        console.log('Tablas de base de datos inicializadas.');
    } catch (err) {
        console.error('Error inicializando base de datos:', err);
    }
}

// --- CONFIGURACIÓN Y CLIENTE META ---

async function getSetting(key) {
    const row = await dbGet("SELECT value FROM settings WHERE key = ?", [key]);
    return row ? row.value : null;
}

async function sendMetaMessage(recipientId, text, buttonsJson = null) {
    const token = await getSetting('page_access_token');
    if (!token) {
        console.warn('Meta API no configurada (falta Page Access Token). Mensaje omitido.');
        return null;
    }

    const messageData = { text };
    if (buttonsJson) {
        try {
            const buttons = typeof buttonsJson === 'string' ? JSON.parse(buttonsJson) : buttonsJson;
            if (buttons && buttons.length > 0) {
                messageData.quick_replies = buttons.map(b => ({
                    content_type: "text",
                    title: b.title.substring(0, 20), // IG limita a 20 caracteres
                    payload: b.payload
                }));
            }
        } catch (e) {
            console.error("Error parseando botones para Quick Replies:", e);
        }
    }

    const url = `https://graph.facebook.com/v19.0/me/messages`;
    try {
        console.log(`Enviando mensaje a Meta API para ${recipientId}...`);
        const response = await axios.post(url, {
            recipient: { id: recipientId },
            message: messageData
        }, {
            params: { access_token: token }
        });
        console.log(`Mensaje enviado con éxito. Message ID: ${response.data.message_id}`);
        return response.data;
    } catch (err) {
        const errorMsg = err.response && err.response.data ? err.response.data.error.message : err.message;
        console.error(`Error al enviar mensaje por Meta API: ${errorMsg}`);
        return null;
    }
}

async function fetchMetaUserProfile(senderScopedId) {
    const token = await getSetting('page_access_token');
    if (!token) return null;

    const url = `https://graph.facebook.com/v19.0/${senderScopedId}`;
    try {
        const response = await axios.get(url, {
            params: {
                fields: 'name,profile_pic,username',
                access_token: token
            }
        });
        return response.data;
    } catch (err) {
        console.error(`Error obteniendo perfil de Meta: ${err.message}`);
        return null;
    }
}

// --- VISTA HTML PRINCIPAL ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

// --- WEBHOOK ENDPOINTS ---

app.get('/webhook', async (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedToken = await getSetting('webhook_verify_token');

    console.log(`Verificación de Webhook recibida. Token recibido: ${token}`);

    if (mode && token) {
        if (mode === 'subscribe' && token === expectedToken) {
            console.log('Verificación de Webhook exitosa.');
            return res.status(200).send(challenge);
        } else {
            console.warn(`Fallo de verificación de Webhook. Esperado: ${expectedToken}`);
            return res.status(403).send('Forbidden');
        }
    }
    return res.status(400).send('Bad Request');
});

app.post('/webhook', async (req, res) => {
    const data = req.body;
    console.log('Webhook recibido de Meta:', JSON.stringify(data));

    if (data.object === 'instagram') {
        for (const entry of data.entry || []) {
            for (const messagingEvent of entry.messaging || []) {
                await processMessagingEvent(messagingEvent);
            }
        }
        return res.status(200).send('EVENT_RECEIVED');
    }
    return res.status(404).send('Not Found');
});

// --- PROCESAMIENTO DE MENSAJES ---

async function processMessagingEvent(messagingEvent) {
    const senderId = messagingEvent.sender ? messagingEvent.sender.id : null;
    const recipientId = messagingEvent.recipient ? messagingEvent.recipient.id : null;
    
    if (!senderId) return;

    // Evitar bucles con nuestros propios mensajes
    const myIgId = await getSetting('instagram_account_id');
    if (senderId === myIgId) {
        console.log('Ignorando mensaje autogenerado por el bot.');
        return;
    }

    const message = messagingEvent.message || {};
    let text = message.text || '';
    const quickReplyPayload = message.quick_reply ? message.quick_reply.payload : null;
    let mediaUrl = null;

    if (message.attachments && message.attachments.length > 0) {
        mediaUrl = message.attachments[0].payload ? message.attachments[0].payload.url : null;
    }

    if (!text && !mediaUrl && !quickReplyPayload) return;

    console.log(`Procesando mensaje de ${senderId}: "${text}" (Payload: ${quickReplyPayload})`);

    // 1. Asegurar contacto en BD
    let contact = await dbGet("SELECT * FROM contacts WHERE id = ?", [senderId]);
    if (!contact) {
        const profile = await fetchMetaUserProfile(senderId);
        let username = `ig_user_${senderId}`;
        let name = `Cliente @${username}`;
        let avatarUrl = 'https://api.dicebear.com/7.x/adventurer/svg?seed=default';

        if (profile) {
            username = profile.username || username;
            name = profile.name || name;
            avatarUrl = profile.profile_pic || avatarUrl;
        }

        await dbRun(
            "INSERT INTO contacts (id, username, name, avatar_url, stage, flow_step) VALUES (?, ?, ?, ?, 'Lead', 'start')",
            [senderId, username, name, avatarUrl]
        );
        contact = { id: senderId, username, name, avatar_url: avatarUrl, stage: 'Lead', flow_step: 'start' };
    }

    // 2. Asegurar conversación en BD
    const conv = await dbGet("SELECT * FROM conversations WHERE id = ?", [senderId]);
    if (!conv) {
        await dbRun(
            "INSERT INTO conversations (id, contact_id, last_message_time, unread_count) VALUES (?, ?, CURRENT_TIMESTAMP, 1)",
            [senderId, senderId]
        );
    } else {
        await dbRun(
            "UPDATE conversations SET last_message_time = CURRENT_TIMESTAMP, unread_count = unread_count + 1 WHERE id = ?",
            [senderId]
        );
    }

    // 3. Insertar mensaje recibido
    await dbRun(
        "INSERT INTO messages (conversation_id, sender_id, recipient_id, text, media_url, direction, sender_type) VALUES (?, ?, ?, ?, ?, 'incoming', 'customer')",
        [senderId, senderId, recipientId, text, mediaUrl]
    );

    // 4. Lógica de State Machine (Flujos Persuasivos) y Respuestas
    await handleBotResponseLogic(senderId, text, quickReplyPayload, contact);
}

async function handleBotResponseLogic(senderId, text, quickReplyPayload, contact) {
    const input = quickReplyPayload || text.toLowerCase().trim();
    
    // WA Bridge Links generator
    const generateWaLink = (msg) => `https://wa.me/573000000000?text=${encodeURIComponent(msg + " Mi usuario es @" + contact.username)}`;
    
    // Si el usuario toca un botón de ir a WhatsApp (WA Bridge)
    if (input === 'WA_BUSINESS' || input === 'WA_HOME') {
        const waMsg = input === 'WA_BUSINESS' 
            ? "¡Hola! Quiero iniciar como distribuidor y vender faroles."
            : "¡Hola! Quiero el catálogo para decorar mi hogar y conocer el descuento por cantidad.";
        
        const finalMsg = `¡Excelente! 📲 Haz clic aquí para ir a nuestro WhatsApp y te envío todo de inmediato: \n\n${generateWaLink(waMsg)}`;
        
        await dbRun(
            "INSERT INTO messages (conversation_id, sender_id, recipient_id, text, direction, sender_type) VALUES (?, 'auto_response', ?, ?, 'outgoing', 'auto_response')",
            [senderId, senderId, finalMsg]
        );
        await dbRun("UPDATE contacts SET stage = 'Contacted' WHERE id = ?", [senderId]);
        await sendMetaMessage(senderId, finalMsg);
        return;
    }

    // Si toca un Payload de flujo, usamos la tabla flows
    if (quickReplyPayload && quickReplyPayload.startsWith('FLOW_')) {
        const flowStep = await dbGet("SELECT * FROM flows WHERE id = ?", [quickReplyPayload]);
        if (flowStep) {
            await dbRun(
                "INSERT INTO messages (conversation_id, sender_id, recipient_id, text, direction, sender_type) VALUES (?, 'auto_response', ?, ?, 'outgoing', 'auto_response')",
                [senderId, senderId, flowStep.message_text]
            );
            await sendMetaMessage(senderId, flowStep.message_text, flowStep.buttons_json);
            return;
        }
    }

    // Si no fue un botón, intentar flujo de bienvenida (ej: si dice hola)
    if (input === 'hola' || input === 'buenas' || input === 'saludos') {
        const flowStep = await dbGet("SELECT * FROM flows WHERE id = ?", ['start']);
        if (flowStep) {
            await dbRun(
                "INSERT INTO messages (conversation_id, sender_id, recipient_id, text, direction, sender_type) VALUES (?, 'auto_response', ?, ?, 'outgoing', 'auto_response')",
                [senderId, senderId, flowStep.message_text]
            );
            await sendMetaMessage(senderId, flowStep.message_text, flowStep.buttons_json);
            return;
        }
    }

    // Fallback: Ejecutar autoresponders antiguos si existen
    await checkAndTriggerAutoresponder(senderId, text);
}

async function checkAndTriggerAutoresponder(senderId, messageText) {
    if (!messageText) return;

    const responders = await dbAll("SELECT keyword, response_text FROM auto_responders WHERE is_active = 1");
    const cleanedMessage = messageText.toLowerCase().trim();
    let matchedResponse = null;

    for (const responder of responders) {
        const keyword = responder.keyword.toLowerCase().trim();
        if (cleanedMessage.includes(keyword)) {
            matchedResponse = responder.response_text;
            break;
        }
    }

    if (matchedResponse) {
        console.log(`Coincidencia de palabra clave. Respondiendo automáticamente: "${matchedResponse}"`);

        // Guardar mensaje saliente en BD
        await dbRun(
            "INSERT INTO messages (conversation_id, sender_id, recipient_id, text, direction, sender_type) VALUES (?, 'auto_response', ?, ?, 'outgoing', 'auto_response')",
            [senderId, senderId, matchedResponse]
        );
        await dbRun("UPDATE conversations SET last_message_time = CURRENT_TIMESTAMP WHERE id = ?", [senderId]);

        // Enviar vía Meta API
        await sendMetaMessage(senderId, matchedResponse);
    }
}

// --- REST API ENDPOINTS ---

// Configuración
app.get('/api/settings', async (req, res) => {
    try {
        const rows = await dbAll("SELECT key, value FROM settings");
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        res.json({
            page_access_token: settings.page_access_token || '',
            instagram_account_id: settings.instagram_account_id || '',
            webhook_verify_token: settings.webhook_verify_token || ''
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/settings', async (req, res) => {
    const data = req.body;
    try {
        for (const k of ['page_access_token', 'instagram_account_id', 'webhook_verify_token']) {
            if (k in data) {
                await dbRun("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [k, data[k]]);
            }
        }
        res.json({ status: 'success', message: 'Configuración guardada.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Contactos
app.get('/api/contacts', async (req, res) => {
    try {
        const contacts = await dbAll("SELECT * FROM contacts ORDER BY created_at DESC");
        res.json(contacts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/contacts', async (req, res) => {
    const { id, username, name, avatar_url, stage, tags, notes } = req.body;
    if (!id || !username) {
        return res.status(400).json({ error: 'Falta id o username.' });
    }

    try {
        await dbRun(
            "INSERT INTO contacts (id, username, name, avatar_url, stage, tags, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [id, username, name, avatar_url || 'https://api.dicebear.com/7.x/adventurer/svg?seed=default', stage || 'Lead', tags || '', notes || '']
        );
        await dbRun(
            "INSERT OR IGNORE INTO conversations (id, contact_id, last_message_time, unread_count) VALUES (?, ?, CURRENT_TIMESTAMP, 0)",
            [id, id]
        );
        res.json({ status: 'success', id });
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            res.status(409).json({ error: 'El contacto ya existe.' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.put('/api/contacts/:id', async (req, res) => {
    const contactId = req.params.id;
    const data = req.body;

    const fields = [];
    const params = [];

    for (const k of ['name', 'avatar_url', 'stage', 'tags', 'notes']) {
        if (k in data) {
            fields.push(`${k} = ?`);
            params.push(data[k]);
        }
    }

    if (fields.length === 0) {
        return res.status(400).json({ error: 'No hay campos para actualizar.' });
    }

    // updated_at
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    fields.push("updated_at = ?");
    params.push(now);
    
    params.push(contactId);

    try {
        const query = `UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`;
        await dbRun(query, params);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/contacts/:id', async (req, res) => {
    const contactId = req.params.id;
    try {
        await dbRun("DELETE FROM contacts WHERE id = ?", [contactId]);
        await dbRun("DELETE FROM conversations WHERE id = ?", [contactId]);
        res.json({ status: 'success', message: 'Contacto eliminado.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Chats
app.get('/api/chats', async (req, res) => {
    const query = `
        SELECT 
            c.id AS conversation_id,
            c.unread_count,
            c.last_message_time,
            cnt.id AS contact_id,
            cnt.username,
            cnt.name,
            cnt.avatar_url,
            cnt.stage,
            (SELECT text FROM messages WHERE conversation_id = c.id ORDER BY timestamp DESC LIMIT 1) AS last_message_text,
            (SELECT sender_type FROM messages WHERE conversation_id = c.id ORDER BY timestamp DESC LIMIT 1) AS last_message_sender
        FROM conversations c
        JOIN contacts cnt ON c.contact_id = cnt.id
        ORDER BY c.last_message_time DESC
    `;
    try {
        const chats = await dbAll(query);
        res.json(chats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/chats/:id/messages', async (req, res) => {
    const convId = req.params.id;
    try {
        // Marcar conversación como leída
        await dbRun("UPDATE conversations SET unread_count = 0 WHERE id = ?", [convId]);
        
        // Obtener historial
        const messages = await dbAll("SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC", [convId]);
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/chats/:id/messages', async (req, res) => {
    const convId = req.params.id;
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Mensaje vacío.' });
    }

    try {
        const contact = await dbGet("SELECT id FROM contacts WHERE id = ?", [convId]);
        if (!contact) {
            return res.status(404).json({ error: 'Contacto no encontrado para este chat.' });
        }

        const recipientId = contact.id;

        // Guardar mensaje en BD local
        await dbRun(
            "INSERT INTO messages (conversation_id, sender_id, recipient_id, text, direction, sender_type) VALUES (?, 'agent', ?, ?, 'outgoing', 'agent')",
            [convId, recipientId, text]
        );
        await dbRun("UPDATE conversations SET last_message_time = CURRENT_TIMESTAMP, unread_count = 0 WHERE id = ?", [convId]);

        // Enviar vía Meta
        const metaResponse = await sendMetaMessage(recipientId, text);

        res.json({
            status: 'success',
            meta_sent: !!metaResponse,
            meta_error: metaResponse ? null : 'Meta API no configurada o error de red.'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Respuestas Automáticas
app.get('/api/auto-responders', async (req, res) => {
    try {
        const responders = await dbAll("SELECT * FROM auto_responders ORDER BY keyword ASC");
        res.json(responders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auto-responders', async (req, res) => {
    const { keyword, response_text, is_active } = req.body;
    if (!keyword || !response_text) {
        return res.status(400).json({ error: 'Keyword y response_text son requeridos.' });
    }

    try {
        await dbRun(
            "INSERT OR REPLACE INTO auto_responders (keyword, response_text, is_active) VALUES (?, ?, ?)",
            [keyword.toLowerCase().trim(), response_text.trim(), is_active !== undefined ? is_active : 1]
        );
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/auto-responders/:id', async (req, res) => {
    const id = req.params.id;
    const { is_active, response_text } = req.body;

    const fields = [];
    const params = [];

    if (is_active !== undefined) {
        fields.push("is_active = ?");
        params.push(Number(is_active));
    }
    if (response_text !== undefined) {
        fields.push("response_text = ?");
        params.push(response_text.trim());
    }

    if (fields.length === 0) {
        return res.status(400).json({ error: 'Nada que actualizar.' });
    }

    params.push(id);

    try {
        await dbRun(`UPDATE auto_responders SET ${fields.join(', ')} WHERE id = ?`, params);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/auto-responders/:id', async (req, res) => {
    const id = req.params.id;
    try {
        await dbRun("DELETE FROM auto_responders WHERE id = ?", [id]);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SIMULADOR ---
app.post('/api/simulator/receive', async (req, res) => {
    const { sender_id, username, name, text } = req.body;
    
    if (!sender_id || !username) {
        return res.status(400).json({ error: 'sender_id y username son requeridos para la simulación.' });
    }

    const cleanUsername = username.replace('@', '').trim();

    try {
        // Asegurar que el contacto existe en el simulador
        const contact = await dbGet("SELECT * FROM contacts WHERE id = ?", [sender_id]);
        if (!contact) {
            await dbRun(
                "INSERT INTO contacts (id, username, name, avatar_url, stage) VALUES (?, ?, ?, ?, 'Lead')",
                [sender_id, cleanUsername, name || `Simulado @${cleanUsername}`, `https://api.dicebear.com/7.x/adventurer/svg?seed=${cleanUsername}`]
            );
        }

        // Mock del evento webhook de Meta
        const messagingEvent = {
            sender: { id: sender_id },
            recipient: { id: 'my_instagram_page_id' },
            message: {
                mid: `mid_sim_${Date.now()}`,
                text: text
            }
        };

        // Procesar evento
        await processMessagingEvent(messagingEvent);

        res.json({
            status: 'success',
            message: 'Mensaje simulado procesado.',
            details: { sender_id, username: cleanUsername, text }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- AI COPILOT ENDPOINTS ---

app.post('/api/ai/analyze-lead/:id', async (req, res) => {
    const convId = req.params.id;
    try {
        const messages = await dbAll("SELECT text, sender_type FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC", [convId]);
        if (messages.length === 0) return res.status(400).json({ error: "No hay historial" });

        const historyStr = messages.map(m => `${m.sender_type === 'customer' ? 'Cliente' : 'Vendedor'}: ${m.text}`).join('\n');
        const score = await getGeminiLeadScore(historyStr);
        
        if (score.error) return res.status(500).json({ error: score.error });
        res.json(score);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/ai/suggest-response/:id', async (req, res) => {
    const convId = req.params.id;
    try {
        const contact = await dbGet("SELECT * FROM contacts WHERE id = ?", [convId]);
        if (!contact) return res.status(404).json({ error: "Contacto no encontrado" });

        const messages = await dbAll("SELECT text, sender_type FROM messages WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT 10", [convId]);
        if (messages.length === 0) return res.status(400).json({ error: "No hay historial para sugerir" });

        // Invertimos para que el más viejo quede arriba
        const historyStr = messages.reverse().map(m => `${m.sender_type === 'customer' ? 'Cliente' : 'Vendedor'}: ${m.text}`).join('\n');
        const suggestion = await getChatGptSuggestion(historyStr, contact);

        if (suggestion.error) return res.status(500).json({ error: suggestion.error });
        res.json(suggestion);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor CRM ejecutándose en puerto ${PORT}`);
});
