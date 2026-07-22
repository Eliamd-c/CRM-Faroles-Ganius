const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const { getGeminiLeadScore, getChatGptSuggestion, classifyIntent } = require('./ai_copilot');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// --- SUPABASE CLIENT ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Error: SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY requeridos en .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('✅ Conectado a Supabase:', SUPABASE_URL);

// --- HELPERS DE BASE DE DATOS (Supabase) ---

/**
 * Obtener un registro
 */
async function dbGet(table, filter = {}) {
    try {
        let query = supabase.from(table).select('*');
        for (const [key, value] of Object.entries(filter)) {
            query = query.eq(key, value);
        }
        const { data, error } = await query.limit(1).single();
        if (error && error.code !== 'PGRST116') throw error;
        return data || null;
    } catch (err) {
        console.error(`Error en dbGet (${table}):`, err.message);
        return null;
    }
}

/**
 * Obtener múltiples registros
 */
async function dbAll(table, filter = {}) {
    try {
        let query = supabase.from(table).select('*');
        for (const [key, value] of Object.entries(filter)) {
            query = query.eq(key, value);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error(`Error en dbAll (${table}):`, err.message);
        return [];
    }
}

/**
 * Insertar registro
 */
async function dbInsert(table, data) {
    try {
        const { data: result, error } = await supabase
            .from(table)
            .insert([data])
            .select();
        if (error) throw error;
        return result ? result[0] : null;
    } catch (err) {
        console.error(`Error en dbInsert (${table}):`, err.message);
        return null;
    }
}

/**
 * Actualizar registro
 */
async function dbUpdate(table, data, filter = {}) {
    try {
        let query = supabase.from(table).update(data);
        for (const [key, value] of Object.entries(filter)) {
            query = query.eq(key, value);
        }
        const { error } = await query;
        if (error) throw error;
        return true;
    } catch (err) {
        console.error(`Error en dbUpdate (${table}):`, err.message);
        return false;
    }
}

/**
 * Obtener setting
 */
async function getSetting(key) {
    const row = await dbGet('settings', { key });
    return row ? row.value : null;
}

/**
 * Guardar setting
 */
async function setSetting(key, value) {
    const existing = await dbGet('settings', { key });
    if (existing) {
        return await dbUpdate('settings', { value }, { key });
    } else {
        return await dbInsert('settings', { key, value });
    }
}

// --- CLIENTE META ---

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
                    title: b.title.substring(0, 20),
                    payload: b.payload
                }));
            }
        } catch (e) {
            console.error("Error parseando botones:", e);
        }
    }

    const url = `https://graph.facebook.com/v19.0/me/messages`;
    try {
        console.log(`📤 Enviando mensaje a Meta para ${recipientId}...`);
        const response = await axios.post(url, {
            recipient: { id: recipientId },
            message: messageData
        }, {
            params: { access_token: token }
        });
        console.log(`✅ Mensaje enviado. ID: ${response.data.message_id}`);
        return response.data;
    } catch (err) {
        const errorMsg = err.response?.data?.error?.message || err.message;
        console.error(`❌ Error Meta API: ${errorMsg}`);
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
        console.error(`Error obteniendo perfil: ${err.message}`);
        return null;
    }
}

// --- ENDPOINTS ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

// Webhook verification
app.get('/webhook', async (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedToken = await getSetting('webhook_verify_token');

    console.log(`🔐 Verificación Webhook. Token recibido: ${token}`);

    if (mode && token) {
        if (mode === 'subscribe' && token === expectedToken) {
            console.log('✅ Webhook verificado');
            return res.status(200).send(challenge);
        } else {
            console.warn(`❌ Token inválido. Esperado: ${expectedToken}`);
            return res.status(403).send('Forbidden');
        }
    }
    return res.status(400).send('Bad Request');
});

// Webhook eventos
app.post('/webhook', async (req, res) => {
    const data = req.body;
    console.log('📨 Webhook recibido:', JSON.stringify(data, null, 2));

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
    const senderId = messagingEvent.sender?.id;
    const recipientId = messagingEvent.recipient?.id;

    if (!senderId) return;

    const myIgId = await getSetting('instagram_account_id');
    if (senderId === myIgId) {
        console.log('⚠️ Ignorando mensaje autogenerado.');
        return;
    }

    const message = messagingEvent.message || {};
    const text = message.text || '';
    const quickReplyPayload = message.quick_reply?.payload || null;
    let mediaUrl = message.attachments?.[0]?.payload?.url || null;

    // Obtener o crear contacto
    let contact = await dbGet('contacts', { id: senderId });
    if (!contact) {
        const profile = await fetchMetaUserProfile(senderId);
        contact = await dbInsert('contacts', {
            id: senderId,
            username: profile?.username || `user_${senderId}`,
            name: profile?.name || 'Unknown',
            avatar_url: profile?.profile_pic || null,
            stage: 'Lead',
            flow_step: 'start'
        });
        console.log(`✅ Nuevo contacto creado: ${contact?.name}`);
    }

    // Crear/actualizar conversación
    let conversation = await dbGet('conversations', { contact_id: senderId });
    if (!conversation) {
        conversation = await dbInsert('conversations', {
            id: `conv_${senderId}`,
            contact_id: senderId,
            unread_count: 1
        });
    } else {
        await dbUpdate('conversations', { unread_count: (conversation.unread_count || 0) + 1 }, { contact_id: senderId });
    }

    // Guardar mensaje
    await dbInsert('messages', {
        conversation_id: conversation.id,
        sender_id: senderId,
        recipient_id: recipientId,
        text,
        media_url: mediaUrl,
        direction: 'incoming',
        sender_type: 'customer'
    });

    // Procesar lógica del bot
    await handleBotResponseLogic(senderId, text, quickReplyPayload, contact);
}

async function handleBotResponseLogic(senderId, text, quickReplyPayload, contact) {
    console.log(`🤖 Procesando: "${text}" de ${contact.name}`);

    // Si es respuesta de botón
    if (quickReplyPayload) {
        console.log(`➡️ Payload de botón: ${quickReplyPayload}`);
        // Aquí iría la lógica de botones
        return;
    }

    // Si hay texto, intentar clasificar intención
    if (text) {
        const triggers = await dbAll('ai_triggers', { is_active: 1 });
        if (triggers.length > 0) {
            try {
                const result = await classifyIntent(text, '', triggers);
                console.log(`🧠 Intención detectada: ${result.intent} (confianza: ${result.confianza})`);

                if (result.intent && result.confianza >= 0.6) {
                    const trigger = triggers.find(t => t.intent_name === result.intent);
                    if (trigger) {
                        const flow = await dbGet('flows', { id: trigger.target_flow });
                        if (flow) {
                            await sendMetaMessage(senderId, flow.message_text, flow.buttons_json);
                            await dbUpdate('contacts', { flow_step: trigger.target_flow }, { id: senderId });
                            return;
                        }
                    }
                }
            } catch (err) {
                console.warn(`⚠️ Error en clasificación: ${err.message}`);
            }
        }
    }

    console.log('✅ Mensaje procesado');
}

// --- SETTINGS API ---

app.get('/api/settings', async (req, res) => {
    try {
        const settings = await dbAll('settings');
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const { key, value } = req.body;
        await setSetting(key, value);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- CONTACTS API ---

app.get('/api/contacts', async (req, res) => {
    try {
        const contacts = await dbAll('contacts');
        res.json(contacts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/contacts/:id', async (req, res) => {
    try {
        const contact = await dbGet('contacts', { id: req.params.id });
        if (!contact) return res.status(404).json({ error: 'Not found' });
        res.json(contact);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- FLOWS API ---

app.get('/api/flows', async (req, res) => {
    try {
        const flows = await dbAll('flows');
        res.json(flows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- AI TRIGGERS API ---

app.get('/api/ai-triggers', async (req, res) => {
    try {
        const triggers = await dbAll('ai_triggers');
        res.json(triggers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/ai-triggers', async (req, res) => {
    try {
        const { intent_name, description, examples, target_flow } = req.body;
        const result = await dbInsert('ai_triggers', {
            intent_name,
            description,
            examples,
            target_flow,
            is_active: 1
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/ai-triggers/:id', async (req, res) => {
    try {
        const { is_active } = req.body;
        await dbUpdate('ai_triggers', { is_active }, { id: parseInt(req.params.id) });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/ai-triggers/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('ai_triggers')
            .delete()
            .eq('id', parseInt(req.params.id));
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/ai-triggers/test', async (req, res) => {
    try {
        const { text } = req.body;
        const triggers = await dbAll('ai_triggers', { is_active: 1 });
        const result = await classifyIntent(text, '', triggers);

        const matchedTrigger = triggers.find(t => t.intent_name === result.intent);
        res.json({
            ...result,
            matched: result.confianza >= 0.6,
            target_flow: matchedTrigger?.target_flow || null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- MESSAGES API ---

app.get('/api/conversations/:contactId/messages', async (req, res) => {
    try {
        const messages = await dbAll('messages', { sender_id: req.params.contactId });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- INICIAR SERVIDOR ---

app.listen(PORT, () => {
    console.log(`\n🚀 CMR Faroles corriendo en puerto ${PORT}`);
    console.log(`📊 BD: Supabase PostgreSQL`);
    console.log(`🌐 URL: http://localhost:${PORT}\n`);
});
