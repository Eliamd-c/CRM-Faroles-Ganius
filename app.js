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

// --- SUPABASE CLIENTS ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    console.error('❌ Error: SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY requeridos en .env.local');
    process.exit(1);
}

// Cliente público (para queries normales)
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Cliente admin (para operaciones sensibles con RLS)
const supabaseAdmin = SUPABASE_SERVICE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    : null;

console.log('✅ Conectado a Supabase:', SUPABASE_URL);
if (supabaseAdmin) console.log('✅ Cliente admin habilitado para operaciones RLS');

// --- CARGAR CREDENCIALES DE ENTORNO (HOSTING) ---
const META_PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;
const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const INSTAGRAM_BUSINESS_ACCOUNT_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

// Inicializar BD con credenciales si existen
async function initializeMetaCredentials() {
    if (META_PAGE_ACCESS_TOKEN) {
        await setSetting('page_access_token', META_PAGE_ACCESS_TOKEN);
        console.log('✅ Meta Page Access Token cargado de .env');
    }
    if (META_WEBHOOK_VERIFY_TOKEN) {
        await setSetting('webhook_verify_token', META_WEBHOOK_VERIFY_TOKEN);
        console.log('✅ Meta Webhook Verify Token cargado de .env');
    }
    if (INSTAGRAM_ACCOUNT_ID) {
        await setSetting('instagram_account_id', INSTAGRAM_ACCOUNT_ID);
        console.log('✅ Instagram Account ID cargado de .env');
    }
    if (INSTAGRAM_BUSINESS_ACCOUNT_ID) {
        await setSetting('instagram_business_account_id', INSTAGRAM_BUSINESS_ACCOUNT_ID);
        console.log('✅ Instagram Business Account ID cargado de .env');
    }
}

// Inicializar credenciales al arrancar
initializeMetaCredentials().catch(err => {
    console.warn('⚠️ Error inicializando credenciales:', err.message);
});

// --- HELPERS DE BASE DE DATOS (Supabase) ---

/**
 * Obtener un registro (usa cliente admin para RLS)
 */
async function dbGet(table, filter = {}) {
    try {
        const client = supabaseAdmin || supabase;
        let query = client.from(table).select('*');
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
 * Obtener múltiples registros (usa cliente admin para RLS)
 */
async function dbAll(table, filter = {}) {
    try {
        const client = supabaseAdmin || supabase;
        let query = client.from(table).select('*');
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
 * Insertar registro (usa cliente admin para RLS)
 */
async function dbInsert(table, data) {
    try {
        const client = supabaseAdmin || supabase;
        const { data: result, error } = await client
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
 * Actualizar registro (usa cliente admin para RLS)
 */
async function dbUpdate(table, data, filter = {}) {
    try {
        const client = supabaseAdmin || supabase;
        let query = client.from(table).update(data);
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
 * Guardar setting (usar cliente admin para RLS)
 */
async function setSetting(key, value) {
    try {
        const client = supabaseAdmin || supabase;
        const existing = await dbGet('settings', { key });

        if (existing) {
            const { error } = await client
                .from('settings')
                .update({ value })
                .eq('key', key);
            if (error) throw error;
            return true;
        } else {
            const { error } = await client
                .from('settings')
                .insert({ key, value });
            if (error) throw error;
            return true;
        }
    } catch (err) {
        console.error(`Error en setSetting (${key}):`, err.message);
        return false;
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

// --- FASE 2: DISPARADORES (Anuncio + IA + Fast-Path) ---

/**
 * Palabras clave de ALTA confianza (fast-path, sin IA)
 * Evita latencia de LLM para preguntas obvias
 */
const FAST_PATH_KEYWORDS = {
  'precio|costo|cuánto cuesta|tarifa|valor': 'msg_pricing_and_story',
  'hola|buenos|buenas|hey|qué tal|buenos días|buenas noches': 'msg_welcome_organic',
  'información|info|catálogo|qué venden|que ofrecen|producto|productos': 'msg_pricing_and_story',
  'comprar|quiero|me interesa|envío|envíos|cómo compro': 'msg_pricing_and_story',
  'gracias|ok|bueno|listo|dale|perfecto|gracias de verdad': null // Sin respuesta (usuario confirmó)
};

/**
 * Detectar tipo de disparador: anuncio, fast-path, IA alta/baja confianza
 * Retorna { type, flowId, confianza, intent }
 */
async function detectDispatcher(text, referral, contact, conversationId) {
  // 1. PRIORIDAD MAX: Anuncio pagado (referral)
  if (referral && (!contact.flow_step || contact.flow_step === 'start')) {
    console.log('🎯 Disparador: ANUNCIO PAGADO (referral detectado)');
    return { type: 'ad_referral', flowId: 'msg_welcome_from_ad' };
  }

  // 2. Fast-Path: Palabras clave sin IA (90% más rápido)
  for (const [pattern, flowId] of Object.entries(FAST_PATH_KEYWORDS)) {
    if (new RegExp(pattern, 'i').test(text)) {
      if (flowId === null) {
        console.log('⏭️ Disparador: CONFIRMACIÓN (sin respuesta necesaria)');
        return { type: 'confirmation', flowId: null };
      }
      console.log(`⚡ Disparador: FAST-PATH (${pattern.split('|')[0]})`);
      return { type: 'fast_path', flowId };
    }
  }

  // 3. Clasificador IA (orgánico, confianza variable)
  try {
    const triggers = await dbAll('ai_triggers', { is_active: 1 });
    if (triggers.length === 0) {
      console.log('ℹ️ Sin triggers IA configurados');
      return { type: 'no_dispatch', reason: 'no_triggers' };
    }

    // Obtener últimos 6 mensajes para contexto
    const messages = await dbAll('messages', { conversation_id: conversationId });
    const historyStr = messages
      .slice(-6)
      .map(m => `${m.sender_type === 'customer' ? 'Usuario' : 'Bot'}: ${m.text}`)
      .join('\n');

    const result = await classifyIntent(text, historyStr, triggers);
    console.log(`🧠 Intención: ${result.intent} (confianza: ${(result.confianza * 100).toFixed(0)}%)`);

    // 3A. Alta confianza (>= 70%): Disparar automáticamente
    if (result.confianza >= 0.7) {
      const trigger = triggers.find(t => t.intent_name === result.intent);
      if (trigger) {
        console.log(`✅ Disparador: IA ALTA CONFIANZA → ${trigger.target_flow}`);
        return { type: 'ia_high_confidence', flowId: trigger.target_flow, intent: result.intent, confianza: result.confianza };
      }
    }

    // 3B. Confianza media (50-70%): Mostrar fallback genérico
    if (result.confianza >= 0.5) {
      console.log('⚠️ Disparador: FALLBACK GENÉRICO (confianza 50-70%)');
      return { type: 'fallback_generic', flowId: 'msg_fallback' };
    }

    // 3C. Baja confianza (< 50%): No disparar
    console.log('❌ Disparador: NO DISPATCH (confianza < 50%, dejar para humano)');
    return { type: 'no_dispatch', reason: 'low_confidence', confianza: result.confianza };
  } catch (err) {
    console.warn(`⚠️ Error en clasificación IA: ${err.message}`);
    return { type: 'no_dispatch', reason: 'ia_error' };
  }
}

// --- SCHEDULER DE REACTIVACIÓN (23h sin respuesta) ---

/**
 * Reactivar contacto después de 23h sin respuesta
 */
async function checkAndSendReactivation() {
    console.log('⏰ Verificando contactos para reactivación...');

    try {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);

        // Obtener contactos que no han respondido en 23h
        const contacts = await dbAll('contacts', {});

        for (const contact of contacts) {
            if (!contact.last_message_received_at) continue;

            const lastMessageTime = new Date(contact.last_message_received_at);
            const timeDiff = now - lastMessageTime;
            const hoursAgo = timeDiff / (1000 * 60 * 60);

            // Si pasaron más de 23h y menos de 24h
            if (hoursAgo > 23 && hoursAgo < 24) {
                const reactivationFlow = await dbGet('flows', { id: 'msg_reactivation' });
                if (reactivationFlow) {
                    console.log(`📢 Enviando reactivación a ${contact.name}`);
                    const messageText = reactivationFlow.message_text.replace('{First Name}', contact.name || 'amiga');
                    await sendMetaMessage(contact.id, messageText, reactivationFlow.buttons_json);
                }
            }
        }
    } catch (err) {
        console.error('Error en reactivación:', err.message);
    }
}

// Ejecutar verificación cada 10 minutos
setInterval(checkAndSendReactivation, 10 * 60 * 1000);

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

    // Procesar lógica del bot (pasar referral si viene de anuncio pagado)
    const referral = messagingEvent.referral || null;
    await handleBotResponseLogic(senderId, text, quickReplyPayload, contact, referral);
}

async function handleBotResponseLogic(senderId, text, quickReplyPayload, contact, referral = null) {
    console.log(`🤖 Procesando: "${text}" de ${contact.name}`);

    // ============================================
    // RESPUESTA DE BOTÓN (Quick Reply Payload) - SIEMPRE PRIMERO
    // ============================================
    if (quickReplyPayload) {
        console.log(`🔘 Botón presionado: ${quickReplyPayload}`);
        return await handleButtonPayload(senderId, quickReplyPayload, contact);
    }

    // ============================================
    // TEXTO LIBRE - FASE 2: DISPARADORES INTELIGENTES
    // ============================================
    if (text) {
        // Obtener conversación para contexto
        const conversation = await dbGet('conversations', { contact_id: senderId });
        const conversationId = conversation?.id || `conv_${senderId}`;

        // Si no está en flujo específico, detectar disparador
        if (!contact.flow_step || contact.flow_step === 'start') {
            const dispatch = await detectDispatcher(text, referral, contact, conversationId);

            // Manejar cada tipo de disparador
            switch (dispatch.type) {
                case 'ad_referral':
                case 'fast_path':
                case 'ia_high_confidence':
                    // Mostrar flow específico
                    const flow = await dbGet('flows', { id: dispatch.flowId });
                    if (flow) {
                        await sendMetaMessage(senderId, flow.message_text, flow.buttons_json);
                        await dbUpdate('contacts', { flow_step: dispatch.flowId }, { id: senderId });
                    }
                    return;

                case 'fallback_generic':
                    // Mostrar fallback con botones de elección
                    const fallbackFlow = await dbGet('flows', { id: 'msg_fallback' });
                    if (fallbackFlow) {
                        const msg = fallbackFlow.message_text.replace('{First Name}', contact.name || 'amiga');
                        await sendMetaMessage(senderId, msg, fallbackFlow.buttons_json);
                        await dbUpdate('contacts', { flow_step: 'msg_fallback' }, { id: senderId });
                    }
                    return;

                case 'confirmation':
                    // Usuario confirmó, no se necesita respuesta
                    return;

                case 'no_dispatch':
                default:
                    // No hay suficiente confianza, dejar para humano
                    console.log(`📞 Mensaje derivado a agente humano (${dispatch.reason})`);
                    return;
            }
        }
    }

    console.log('✅ Mensaje procesado');
}

/**
 * Manejar payloads de botones (Faroles Genius Phase 1 + 2)
 */
async function handleButtonPayload(senderId, payload, contact) {
    const flowMap = {
        // Bienvenida → decisión
        'FLOW_INDIVIDUAL': 'msg_decision',
        'FLOW_GROUP': 'msg_decision',
        'START_FLOW': 'msg_pricing_and_story',

        // Decisión → rama
        'DECISION_POINT': 'msg_decision',

        // Rama Individual: cantidad → WhatsApp
        'QTY_1': 'msg_individual_whatsapp',
        'QTY_2_3': 'msg_individual_whatsapp',
        'QTY_4_6': 'msg_individual_whatsapp',
        'QTY_7PLUS': 'msg_individual_whatsapp',

        // Rama Grupo: confirmar → WhatsApp
        'GROUP_YES': 'msg_group_whatsapp',
        'GROUP_NO': 'msg_individual_qty',

        // WhatsApp
        'WHATSAPP_INDIVIDUAL': null, // Ir a WhatsApp
        'WHATSAPP_GROUP': null, // Ir a WhatsApp

        // Fallback (Fase 2): Usuario elige nuevamente
        'FALLBACK_HUMAN': null, // Derivar a agente
    };

    const nextFlowId = flowMap[payload];

    // Si necesita ir a WhatsApp o hablar con humano
    if (payload.startsWith('WHATSAPP_') || payload === 'FALLBACK_HUMAN') {
        let message;
        if (payload === 'WHATSAPP_INDIVIDUAL') {
            message = '📲 Aquí va el link a WhatsApp para confirmar tu pedido';
        } else if (payload === 'WHATSAPP_GROUP') {
            message = '📲 Aquí va el link a WhatsApp para coordinar tu grupo';
        } else if (payload === 'FALLBACK_HUMAN') {
            message = '📞 Perfecto, un agente te contactará pronto para ayudarte 💬';
        }

        await sendMetaMessage(senderId, message, null);
        await dbUpdate('contacts', { stage: 'Contacted', flow_step: payload }, { id: senderId });
        return;
    }

    // Mostrar siguiente flujo
    if (nextFlowId) {
        const nextFlow = await dbGet('flows', { id: nextFlowId });
        if (nextFlow) {
            await sendMetaMessage(senderId, nextFlow.message_text, nextFlow.buttons_json);
            await dbUpdate('contacts', { flow_step: nextFlowId }, { id: senderId });
        }
    }
}

// --- SETTINGS API ---

app.get('/api/settings', async (req, res) => {
    try {
        const settings = await dbAll('settings');
        // NO EXPONER credenciales sensibles
        const safe = settings.filter(s =>
            !s.key.includes('token') &&
            !s.key.includes('access') &&
            !s.key.includes('secret')
        );
        res.json(safe);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const { key, value } = req.body;
        // Bloquear cambios de credenciales sensibles por API (deben venir de .env)
        if (key.includes('token') || key.includes('access') || key.includes('secret')) {
            return res.status(403).json({ error: 'Las credenciales no pueden cambiar por API. Usa variables de entorno.' });
        }
        await setSetting(key, value);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- META CONFIGURATION STATUS ---
app.get('/api/meta/status', async (req, res) => {
    try {
        const pageToken = await getSetting('page_access_token');
        const webhookToken = await getSetting('webhook_verify_token');
        const igAccountId = await getSetting('instagram_account_id');

        res.json({
            configured: !!(pageToken && webhookToken && igAccountId),
            page_access_token_set: !!pageToken,
            webhook_verify_token_set: !!webhookToken,
            instagram_account_id_set: !!igAccountId,
            message: pageToken && webhookToken && igAccountId
                ? '✅ Meta configurado correctamente'
                : '❌ Faltan credenciales de Meta'
        });
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
