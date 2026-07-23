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

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const supabaseAdmin = SUPABASE_SERVICE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    : null;

console.log('✅ Conectado a Supabase:', SUPABASE_URL);
if (supabaseAdmin) console.log('✅ Cliente admin habilitado para operaciones RLS');

// --- CARGAR CREDENCIALES ---
const META_PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;
const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const INSTAGRAM_BUSINESS_ACCOUNT_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

async function initializeMetaCredentials() {
    if (META_PAGE_ACCESS_TOKEN) await setSetting('page_access_token', META_PAGE_ACCESS_TOKEN);
    if (META_WEBHOOK_VERIFY_TOKEN) await setSetting('webhook_verify_token', META_WEBHOOK_VERIFY_TOKEN);
    if (INSTAGRAM_ACCOUNT_ID) await setSetting('instagram_account_id', INSTAGRAM_ACCOUNT_ID);
    if (INSTAGRAM_BUSINESS_ACCOUNT_ID) await setSetting('instagram_business_account_id', INSTAGRAM_BUSINESS_ACCOUNT_ID);
}
initializeMetaCredentials().catch(err => console.warn('⚠️ Error credenciales:', err.message));

// --- DB HELPERS ---
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
        console.error(`❌ dbGet(${table}):`, err.message);
        return null;
    }
}

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
        console.error(`❌ dbAll(${table}):`, err.message);
        return [];
    }
}

async function dbInsert(table, data) {
    try {
        const client = supabaseAdmin || supabase;
        const { data: result, error } = await client.from(table).insert([data]).select();
        if (error) throw error;
        return result ? result[0] : null;
    } catch (err) {
        console.error(`❌ dbInsert(${table}):`, err.message);
        return null;
    }
}

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
        console.error(`❌ dbUpdate(${table}):`, err.message);
        return false;
    }
}

async function dbDelete(table, filter = {}) {
    try {
        const client = supabaseAdmin || supabase;
        let query = client.from(table).delete();
        for (const [key, value] of Object.entries(filter)) {
            query = query.eq(key, value);
        }
        const { error } = await query;
        if (error) throw error;
        return true;
    } catch (err) {
        console.error(`❌ dbDelete(${table}):`, err.message);
        return false;
    }
}

async function getSetting(key) {
    const row = await dbGet('settings', { key });
    return row ? row.value : null;
}

async function setSetting(key, value) {
    const existing = await dbGet('settings', { key });
    if (existing) {
        return await dbUpdate('settings', { value }, { key });
    } else {
        return await dbInsert('settings', { key, value });
    }
}

// --- META API ---
async function sendMetaMessage(recipientId, text, buttonsJson = null) {
    const token = await getSetting('page_access_token');
    if (!token) {
        console.warn('⚠️ Meta API no configurada (sin token)');
        return null;
    }

    const messageData = { text };
    if (buttonsJson) {
        try {
            const buttons = typeof buttonsJson === 'string' ? JSON.parse(buttonsJson) : buttonsJson;
            if (buttons && buttons.length > 0) {
                messageData.quick_replies = buttons.map(b => ({
                    content_type: 'text',
                    title: b.title.substring(0, 20),
                    payload: b.payload
                }));
            }
        } catch (e) {
            console.error('Error parseando botones:', e.message);
        }
    }

    try {
        console.log(`📤 Enviando a Meta -> ${recipientId}...`);
        const response = await axios.post('https://graph.facebook.com/v19.0/me/messages', {
            recipient: { id: recipientId },
            message: messageData
        }, {
            params: { access_token: token }
        });
        console.log(`✅ Mensaje enviado Meta ID: ${response.data.message_id}`);
        return response.data;
    } catch (err) {
        console.error(`❌ Meta API error:`, err.response?.data?.error?.message || err.message);
        return null;
    }
}

// --- META API ---
async function fetchMetaUserProfile(senderScopedId) {
    const token = await getSetting('page_access_token');
    if (!token) {
        console.log('ℹ️ Page Access Token no configurado aún para obtener perfil de Meta.');
        return null;
    }
    try {
        console.log(`🔍 Obteniendo perfil Meta para IGSID: ${senderScopedId}...`);
        const response = await axios.get(`https://graph.facebook.com/v19.0/${senderScopedId}`, {
            params: { fields: 'name,profile_pic,username', access_token: token }
        });
        console.log(`✅ Perfil obtenido de Meta:`, response.data.name || response.data.username);
        return response.data;
    } catch (err) {
        const errorMsg = err.response?.data?.error?.message || err.message;
        console.warn(`⚠️ Error obteniendo perfil de Meta para ${senderScopedId}: ${errorMsg}`);
        return null;
    }
}

// --- CONTACT MANAGEMENT & PROFILING ---
function sanitizeContactData(data) {
    const validColumns = [
        'id', 'username', 'name', 'avatar_url', 'stage', 'tags',
        'notes', 'phone_number', 'is_wholesaler_potential', 'flow_step',
        'created_at', 'updated_at'
    ];
    const sanitized = {};
    for (const key of validColumns) {
        if (data[key] !== undefined) {
            sanitized[key] = data[key];
        }
    }
    if (data.profile && (!sanitized.tags || !sanitized.tags.includes(data.profile))) {
        sanitized.tags = sanitized.tags ? `${sanitized.tags},${data.profile}` : data.profile;
    }
    if (data.city) {
        sanitized.notes = sanitized.notes ? `${sanitized.notes} | Ciudad: ${data.city}` : `Ciudad: ${data.city}`;
    }
    return sanitized;
}

async function getOrCreateContact(senderId) {
    let contact = await dbGet('contacts', { id: senderId });
    if (!contact) {
        const profile = await fetchMetaUserProfile(senderId);
        const newContactData = sanitizeContactData({
            id: senderId,
            username: profile?.username || `user_${senderId}`,
            name: profile?.name && profile.name !== 'Unknown' ? profile.name : `Cliente ${senderId.substring(0, 6)}`,
            avatar_url: profile?.profile_pic || null,
            stage: 'Lead',
            flow_step: 'start'
        });
        contact = await dbInsert('contacts', newContactData);
        if (!contact) {
            contact = { ...newContactData, profile: null };
        }
        console.log(`➕ Nuevo contacto creado: ${contact.name} (${senderId})`);
    } else {
        const isGenericName = !contact.name || contact.name === 'Unknown' || contact.name.startsWith('Cliente ') || !contact.avatar_url;
        if (isGenericName && !senderId.startsWith('sim_') && !senderId.startsWith('test_')) {
            const profile = await fetchMetaUserProfile(senderId);
            if (profile && (profile.name || profile.username || profile.profile_pic)) {
                const updates = sanitizeContactData({
                    name: profile.name || contact.name,
                    username: profile.username || contact.username,
                    avatar_url: profile.profile_pic || contact.avatar_url
                });
                await dbUpdate('contacts', updates, { id: senderId });
                contact = { ...contact, ...updates };
                console.log(`🔄 Perfil actualizado automáticamente de Meta para ${senderId}: ${contact.name}`);
            }
        }
    }

    if (!contact.profile) {
        if (contact.tags?.includes('vendedor')) contact.profile = 'vendedor';
        else if (contact.tags?.includes('iglesia')) contact.profile = 'iglesia';
        else if (contact.tags?.includes('consumidor')) contact.profile = 'consumidor';
        else contact.profile = null;
    }
    return contact;
}

async function updateContactStage(senderId, updates) {
    const sanitized = sanitizeContactData(updates);
    if (Object.keys(sanitized).length > 0) {
        await dbUpdate('contacts', sanitized, { id: senderId });
    }
}

// --- BOT DISPARADORES Y FLUJOS VENDEDOR GENIUS ---
const FAST_PATH_KEYWORDS = {
    'precio|costo|cuánto cuesta|tarifa|valor': 'pricing',
    'hola|buenos|buenas|hey|qué tal': 'welcome',
    'información|info|catálogo|qué venden|producto|productos': 'pricing',
    'comprar|me interesa|envío': 'pricing'
};

async function detectDispatcher(text, referral, contact) {
    if (referral && (!contact.flow_step || contact.flow_step === 'start')) {
        return { type: 'ad_referral', action: 'welcome_from_ad' };
    }

    for (const [pattern, action] of Object.entries(FAST_PATH_KEYWORDS)) {
        if (new RegExp(pattern, 'i').test(text)) {
            return { type: 'fast_path', action };
        }
    }

    if (!contact.profile) {
        try {
            const triggers = await dbAll('ai_triggers', { is_active: 1 });
            if (triggers.length > 0) {
                const result = await classifyIntent(text, '', triggers);
                if (result.confianza >= 0.7) {
                    return { type: 'ia_high', action: 'pricing', intent: result.intent };
                }
                if (result.confianza >= 0.5) {
                    return { type: 'ia_medium', action: 'ask_help', intent: result.intent };
                }
            }
        } catch (e) {
            console.warn('⚠️ Error en IA classification:', e.message);
        }
    }

    return { type: 'unknown', action: null };
}

// Profiling questions & channel flows
async function startProfiling(instagramId, contact) {
    const step = contact.flow_step;
    if (step === 'start' || step === 'ask_city') {
        await sendMetaMessage(
            instagramId,
            '¡Hola! 👋 Bienvenid@ a Faroles Genius 🕯️ Me encantaría ayudarte de la mejor forma.\n\nPara eso, ¿me ayudas respondiendo un par de preguntas? ¿De qué ciudad eres?'
        );
        await updateContactStage(instagramId, { flow_step: 'ask_city', conversation_stage: 'perfilando' });
        return;
    }
    if (step === 'ask_church') {
        await sendMetaMessage(
            instagramId,
            '¿Eres parte de una iglesia, comunidad o grupo de oración? 🙏'
        );
        await updateContactStage(instagramId, { flow_step: 'ask_church', conversation_stage: 'perfilando' });
        return;
    }
    if (step === 'ask_intent') {
        await sendMetaMessage(
            instagramId,
            '¿Te interesa un farol para ti, o te gustaría emprender vendiendo faroles en tu comunidad? 💡'
        );
        await updateContactStage(instagramId, { flow_step: 'ask_intent', conversation_stage: 'perfilando' });
        return;
    }
}

async function runConsumerFlow(instagramId, contact) {
    const step = contact.flow_step;
    if (step === 'consumer_start' || step === 'start') {
        await sendMetaMessage(
            instagramId,
            `¡Perfecto, ${contact.name || 'amig@'}! 🕯️\n\nNuestros faroles son artesanales, hechos a mano con cartón de caña de azúcar y papel seda. 35×17 cm, 4 faroles únicos por paquete. 100% reutilizables.\n\n8 advocaciones: "Devoción y Tradición" + "Fe y Esperanza".`
        );
        await updateContactStage(instagramId, { flow_step: 'show_product', profile: 'consumidor' });
        return;
    }
    if (step === 'show_product') {
        await sendMetaMessage(
            instagramId,
            `📊 Tabla de Precios (Detal):\n\n1 paq: $28.000 + envío\n2-6 paq: $26.000-$24.000 c/u\n7-10 paq: $24.000-$22.000 c/u\n11-12 paq: $21.000-$20.000 c/u\n\nEnvío: $18.500 (1-6), $26.500 (7-10), $30.500 (11-12)\n\n💡 Si juntas a familia o amigos, ¡todos pagan menos!`
        );
        await updateContactStage(instagramId, { flow_step: 'show_pricing' });
        return;
    }
    if (step === 'show_pricing') {
        await sendMetaMessage(
            instagramId,
            `¿Quieres intentar comprar con más personas? Muchas familias y comunidades compran en grupo y ahorran juntas. 🤝`
        );
        await updateContactStage(instagramId, { flow_step: 'group_offer' });
        return;
    }
    if (step === 'group_offer') {
        const waNumber = (await getSetting('whatsapp_number')) || '573000000000';
        await sendMetaMessage(
            instagramId,
            `Excelente. Vamos a WhatsApp para coordinar tu pedido. Ahí te damos todos los detalles. 📲\n\nhttps://wa.me/${waNumber}?text=Hola%20Faroles%20Genius`,
            [{ title: '📲 Ir a WhatsApp', payload: 'ESCALATE_WHATSAPP' }]
        );
        await updateContactStage(instagramId, { flow_step: 'escalated', conversation_stage: 'cerrado', stage: 'Customer' });
    }
}

async function runSellerFlow(instagramId, contact) {
    const step = contact.flow_step;
    if (step === 'seller_start' || step === 'ask_intent' || step === 'start') {
        await sendMetaMessage(
            instagramId,
            `¡Me encanta tu visión, ${contact.name || 'amig@'}! 💪\n\nQueremos que emprendas de forma inteligente, sin riesgos. Así funciona:\n\n✅ Tú consigues los pedidos y el dinero PRIMERO\n✅ Nosotros te enviamos los faroles\n✅ Tú ganas la diferencia\n\nEs preventa, no consignación. Cero inversión de tu parte.`
        );
        await updateContactStage(instagramId, { flow_step: 'explain_presale', profile: 'vendedor' });
        return;
    }
    if (step === 'explain_presale') {
        await sendMetaMessage(
            instagramId,
            `📊 Números:\n\n• Precio mayorista: $17.000 por paquete\n• Precio reventa (detal): $20.000–$28.000\n• Tu ganancia: $3.000–$11.000 por paquete\n• Mínimo: 18 paquetes para la primera compra`
        );
        await updateContactStage(instagramId, { flow_step: 'show_numbers' });
        return;
    }
    if (step === 'show_numbers') {
        await sendMetaMessage(
            instagramId,
            `🎯 Ejercicio Guía:\n\nEmpieza con tu círculo cercano:\n• 6 familia\n• 6 amigos\n• 6 conocidos\n= 18 pedidos para la primera compra`
        );
        await updateContactStage(instagramId, { flow_step: 'exercise' });
        return;
    }
    if (step === 'exercise') {
        await sendMetaMessage(
            instagramId,
            `Te damos TODO el material listo: fotos HD, videos, catálogo, descripciones. Solo tienes que compartir. 🎬`,
            [{ title: '📥 Solicitar Material', payload: 'REQUEST_SELLER_KIT' }]
        );
        await updateContactStage(instagramId, { flow_step: 'requesting_kit' });
        return;
    }
    if (step === 'requesting_kit') {
        const waNumber = (await getSetting('whatsapp_number')) || '573000000000';
        await sendMetaMessage(
            instagramId,
            `Perfecto. Vamos a WhatsApp para confirmar tu material y apoyo. 📲\n\nhttps://wa.me/${waNumber}?text=Quiero%20empezar%20a%20vender%20Faroles`
        );
        await updateContactStage(instagramId, { flow_step: 'escalated', conversation_stage: 'cerrado', stage: 'Contacted' });
    }
}

async function runChurchFlow(instagramId, contact) {
    const step = contact.flow_step;
    if (step === 'church_start' || step === 'ask_intent' || step === 'start') {
        await sendMetaMessage(
            instagramId,
            `¡Qué hermoso, ${contact.name || 'herman@'}! ⛪\n\nLos faroles son una herramienta perfecta para financiar proyectos comunitarios (retiros, misiones, ayuda social).\n\n¿Qué proyecto tiene en mente tu comunidad?`
        );
        await updateContactStage(instagramId, { flow_step: 'ask_project', profile: 'iglesia' });
        return;
    }
    if (step === 'ask_project') {
        await sendMetaMessage(
            instagramId,
            `✨ Nosotros financiamos con RIESGO COMPARTIDO:\n\n• Compran a $17.000 por paquete\n• Venden a feligreses a $25.000–$30.000\n• Lo no vendido antes del 8 dic se devuelve con reembolso`
        );
        await updateContactStage(instagramId, { flow_step: 'explain_buyback' });
        return;
    }
    if (step === 'explain_buyback') {
        await sendMetaMessage(
            instagramId,
            `Mínimo: 18 paquetes para la primera compra.\n\nTe damos material publicitario + acompañamiento. 🤝`
        );
        await updateContactStage(instagramId, { flow_step: 'explained' });
        return;
    }
    if (step === 'explained') {
        await sendMetaMessage(
            instagramId,
            `¿Listo para llevar los faroles a tu comunidad?`,
            [
                { title: '✅ Sí, quiero', payload: 'CHURCH_YES' },
                { title: '❓ Consultar primero', payload: 'ESCALATE_WHATSAPP' }
            ]
        );
        await updateContactStage(instagramId, { flow_step: 'confirm' });
        return;
    }
    if (step === 'confirm') {
        const waNumber = (await getSetting('whatsapp_number')) || '573000000000';
        await sendMetaMessage(
            instagramId,
            `Excelente. Vamos a WhatsApp para conectar con los líderes de tu comunidad. 📲\n\nhttps://wa.me/${waNumber}?text=Somos%20de%20iglesia%20y%20queremos%20faroles`
        );
        await updateContactStage(instagramId, { flow_step: 'escalated', conversation_stage: 'cerrado', stage: 'Contacted' });
    }
}

async function runFallback(instagramId, contact) {
    await sendMetaMessage(
        instagramId,
        `No entendí bien, amig@. ¿Te identificas con alguna de estas opciones? 👇`,
        [
            { title: '🏠 Para mi hogar', payload: 'PROFILE_CONSUMER' },
            { title: '💰 Vender', payload: 'PROFILE_SELLER' },
            { title: '⛪ Iglesia', payload: 'PROFILE_CHURCH' }
        ]
    );
    await updateContactStage(instagramId, { flow_step: 'fallback_menu' });
}

// --- EVENT PROCESSOR ---
async function processMessagingEvent(event) {
    const senderId = event.sender?.id;
    const recipientId = event.recipient?.id;
    if (!senderId) return;

    const myIgId = await getSetting('instagram_account_id');
    if (senderId === myIgId) return;

    const text = event.message?.text || '';
    const payload = event.postback?.payload || event.message?.quick_reply?.payload || '';
    const referral = event.referral?.ref;
    const mediaUrl = event.message?.attachments?.[0]?.payload?.url || null;

    let contact = await getOrCreateContact(senderId);

    // Record conversation & message safely
    const conversationId = `conv_${senderId}`;
    let conversation = await dbGet('conversations', { contact_id: senderId });
    if (!conversation) {
        conversation = await dbInsert('conversations', {
            id: conversationId,
            contact_id: senderId,
            unread_count: 1
        });
        if (!conversation) {
            conversation = { id: conversationId, contact_id: senderId, unread_count: 1 };
        }
    } else {
        await dbUpdate('conversations', { unread_count: (conversation.unread_count || 0) + 1 }, { contact_id: senderId });
    }

    const currentConvId = conversation?.id || conversationId;

    if (text || mediaUrl) {
        await dbInsert('messages', {
            conversation_id: currentConvId,
            sender_id: senderId,
            recipient_id: recipientId || 'me',
            text: text || '',
            media_url: mediaUrl,
            direction: 'incoming',
            sender_type: 'customer'
        });
    }

    // Handle Quick Reply / Button payload
    if (payload) {
        if (payload === 'PROFILE_CONSUMER') {
            await updateContactStage(senderId, { profile: 'consumidor', flow_step: 'consumer_start' });
            return await runConsumerFlow(senderId, { ...contact, profile: 'consumidor', flow_step: 'consumer_start' });
        }
        if (payload === 'PROFILE_SELLER') {
            await updateContactStage(senderId, { profile: 'vendedor', flow_step: 'seller_start' });
            return await runSellerFlow(senderId, { ...contact, profile: 'vendedor', flow_step: 'seller_start' });
        }
        if (payload === 'PROFILE_CHURCH' || payload === 'CHURCH_YES') {
            await updateContactStage(senderId, { profile: 'iglesia', church_name: 'Iglesia Local', flow_step: 'church_start' });
            return await runChurchFlow(senderId, { ...contact, profile: 'iglesia', flow_step: 'church_start' });
        }
        if (payload === 'ESCALATE_WHATSAPP') {
            await updateContactStage(senderId, { conversation_stage: 'cerrado', flow_step: 'escalated' });
            return;
        }
        if (payload === 'REQUEST_SELLER_KIT') {
            await updateContactStage(senderId, { flow_step: 'requesting_kit' });
            return await runSellerFlow(senderId, { ...contact, flow_step: 'requesting_kit' });
        }
    }

    // Context Extraction during profiling steps
    if (contact.flow_step === 'ask_city' && text.length > 0) {
        await updateContactStage(senderId, { city: text, flow_step: 'ask_church' });
        contact = { ...contact, city: text, flow_step: 'ask_church' };
    } else if (contact.flow_step === 'ask_church' && text.length > 0) {
        const isChurch = text.toLowerCase().includes('sí') || text.toLowerCase().includes('si') || text.toLowerCase().includes('comunidad');
        await updateContactStage(senderId, { church_name: isChurch ? 'Iglesia' : null, flow_step: 'ask_intent' });
        contact = { ...contact, church_name: isChurch ? 'Iglesia' : null, flow_step: 'ask_intent' };
    } else if (contact.flow_step === 'ask_intent' && text.length > 0) {
        if (text.toLowerCase().includes('vend') || text.toLowerCase().includes('emprend')) {
            await updateContactStage(senderId, { profile: 'vendedor', flow_step: 'seller_start' });
            return await runSellerFlow(senderId, { ...contact, profile: 'vendedor', flow_step: 'seller_start' });
        } else if (contact.church_name) {
            await updateContactStage(senderId, { profile: 'iglesia', flow_step: 'church_start' });
            return await runChurchFlow(senderId, { ...contact, profile: 'iglesia', flow_step: 'church_start' });
        } else {
            await updateContactStage(senderId, { profile: 'consumidor', flow_step: 'consumer_start' });
            return await runConsumerFlow(senderId, { ...contact, profile: 'consumidor', flow_step: 'consumer_start' });
        }
    }

    // Router by profile
    if (!contact.profile) {
        if (!contact.flow_step || contact.flow_step === 'start') {
            await startProfiling(senderId, contact);
        } else if (contact.flow_step === 'ask_city' || contact.flow_step === 'ask_church' || contact.flow_step === 'ask_intent') {
            await startProfiling(senderId, contact);
        } else {
            await runFallback(senderId, contact);
        }
    } else if (contact.profile === 'consumidor') {
        await runConsumerFlow(senderId, contact);
    } else if (contact.profile === 'vendedor') {
        await runSellerFlow(senderId, contact);
    } else if (contact.profile === 'iglesia') {
        await runChurchFlow(senderId, contact);
    }
}

// 23h Reactivation check
async function checkAndSendReactivation() {
    try {
        const now = new Date();
        const contacts = await dbAll('contacts');
        for (const contact of contacts) {
            if (!contact.last_message_received_at) continue;
            const hoursAgo = (now - new Date(contact.last_message_received_at)) / (1000 * 60 * 60);
            if (hoursAgo > 23 && hoursAgo < 24 && contact.conversation_stage !== 'cerrado') {
                console.log(`📢 Reactivación a ${contact.name}`);
                await sendMetaMessage(
                    contact.id,
                    `¡Hola, ${contact.name || 'amig@'}! 🕯️ ¿Te quedó alguna duda sobre los faroles? Estamos listos para apoyarte.`
                );
            }
        }
    } catch (err) {
        console.error('Error reactivación:', err.message);
    }
}
setInterval(checkAndSendReactivation, 10 * 60 * 1000);

// --- FRONTEND DASHBOARD & API ENDPOINTS ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

// Meta Webhook Verification
app.get('/webhook', async (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const expectedToken = await getSetting('webhook_verify_token');

    if (mode === 'subscribe' && token === expectedToken) {
        console.log('✅ Webhook verificado');
        return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
});

// Meta Webhook Events
app.post('/webhook', async (req, res) => {
    const data = req.body;
    if (data.object === 'instagram' || data.object === 'page') {
        for (const entry of data.entry || []) {
            for (const messagingEvent of entry.messaging || []) {
                await processMessagingEvent(messagingEvent);
            }
        }
        return res.status(200).send('EVENT_RECEIVED');
    }
    return res.status(404).send('Not Found');
});

// Settings API
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
        const body = req.body;
        if (body.key && body.value !== undefined) {
            await setSetting(body.key, body.value);
        } else {
            for (const [k, v] of Object.entries(body)) {
                if (v !== undefined && v !== null) {
                    await setSetting(k, v);
                }
            }
        }
        res.json({ success: true, status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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
            message: pageToken && webhookToken && igAccountId ? '✅ Meta configurado' : '❌ Faltan credenciales Meta'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Contacts API
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
        if (!contact) return res.status(404).json({ error: 'Contacto no encontrado' });
        res.json(contact);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/contacts/:id', async (req, res) => {
    try {
        const updates = req.body;
        const sanitized = sanitizeContactData(updates);
        await dbUpdate('contacts', sanitized, { id: req.params.id });
        const updated = await dbGet('contacts', { id: req.params.id });
        res.json({ status: 'success', success: true, contact: updated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/contacts/:id/sync-meta', async (req, res) => {
    try {
        const contactId = req.params.id;
        const profile = await fetchMetaUserProfile(contactId);
        if (!profile) {
            return res.status(400).json({
                error: 'No se pudo obtener el perfil de Meta. Verifica que el Page Access Token esté guardado en Configuración Meta.'
            });
        }

        const updates = sanitizeContactData({
            name: profile.name || undefined,
            username: profile.username || undefined,
            avatar_url: profile.profile_pic || undefined
        });

        await dbUpdate('contacts', updates, { id: contactId });
        const updated = await dbGet('contacts', { id: contactId });
        res.json({ status: 'success', success: true, contact: updated, meta_profile: profile });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Chats / Conversations API
app.get('/api/chats', async (req, res) => {
    try {
        const contacts = await dbAll('contacts');
        const conversations = await dbAll('conversations');
        const messages = await dbAll('messages');

        const chats = contacts.map(c => {
            const conv = conversations.find(cv => cv.contact_id === c.id);
            const convId = conv?.id || `conv_${c.id}`;
            const contactMsgs = messages.filter(m => m.conversation_id === convId || m.sender_id === c.id || m.recipient_id === c.id);
            const lastMsg = contactMsgs[contactMsgs.length - 1];

            const displayName = c.name && c.name !== 'Unknown'
                ? c.name
                : (c.username && !c.username.startsWith('user_') ? `@${c.username}` : `Cliente ${c.id.substring(0, 8)}`);

            return {
                conversation_id: convId,
                contact_id: c.id,
                name: displayName,
                username: c.username || c.id,
                avatar_url: c.avatar_url,
                stage: c.stage || 'Lead',
                tags: c.tags || '',
                notes: c.notes || '',
                unread_count: conv?.unread_count || 0,
                last_message: lastMsg?.text || '',
                last_message_text: lastMsg?.text || '',
                last_message_sender: lastMsg?.sender_type || (lastMsg?.direction === 'outgoing' ? 'agent' : 'customer'),
                last_message_time: lastMsg?.timestamp || lastMsg?.created_at || c.last_message_received_at || new Date().toISOString()
            };
        });

        res.json(chats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get(['/api/chats/:convId/messages', '/api/conversations/:convId/messages'], async (req, res) => {
    try {
        const convId = req.params.convId;
        const contactId = convId.replace('conv_', '');
        const messages = await dbAll('messages');
        const filtered = messages.filter(m => m.conversation_id === convId || m.sender_id === contactId || m.recipient_id === contactId);
        
        await dbUpdate('conversations', { unread_count: 0 }, { contact_id: contactId });

        res.json(filtered);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/chats/:convId/messages', async (req, res) => {
    try {
        const convId = req.params.convId;
        const contactId = convId.replace('conv_', '');
        const { text } = req.body;

        const myIgId = (await getSetting('instagram_account_id')) || 'me';

        const newMsg = await dbInsert('messages', {
            conversation_id: convId,
            sender_id: myIgId,
            recipient_id: contactId,
            text,
            direction: 'outgoing',
            sender_type: 'agent'
        });

        let metaSent = false;
        let metaError = null;
        const metaRes = await sendMetaMessage(contactId, text);
        if (metaRes && metaRes.message_id) {
            metaSent = true;
        } else if (metaRes && metaRes.error) {
            metaError = metaRes.error;
        }

        res.json({ status: 'success', success: true, message: newMsg, meta_sent: metaSent, meta_error: metaError });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Auto-Responders API (Keyword rules)
app.get(['/api/auto-responders', '/api/autoresponders'], async (req, res) => {
    try {
        const rules = await dbAll('auto_responders');
        res.json(rules);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post(['/api/auto-responders', '/api/autoresponders'], async (req, res) => {
    try {
        const { keyword, response_text } = req.body;
        const created = await dbInsert('auto_responders', {
            keyword,
            response_text,
            is_active: 1
        });
        res.json(created);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put(['/api/auto-responders/:id', '/api/autoresponders/:id'], async (req, res) => {
    try {
        const { is_active, keyword, response_text } = req.body;
        const updates = {};
        if (is_active !== undefined) updates.is_active = is_active;
        if (keyword !== undefined) updates.keyword = keyword;
        if (response_text !== undefined) updates.response_text = response_text;

        await dbUpdate('auto_responders', updates, { id: parseInt(req.params.id) });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete(['/api/auto-responders/:id', '/api/autoresponders/:id'], async (req, res) => {
    try {
        await dbDelete('auto_responders', { id: parseInt(req.params.id) });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Flows API
app.get('/api/flows', async (req, res) => {
    try {
        const flows = await dbAll('flows');
        res.json(flows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/flows', async (req, res) => {
    try {
        const { id, name, message_text, buttons_json } = req.body;
        const flow = await dbInsert('flows', { id, name, message_text, buttons_json });
        res.json(flow);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/flows/:id', async (req, res) => {
    try {
        await dbDelete('flows', { id: req.params.id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// AI Triggers API
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
        await dbDelete('ai_triggers', { id: parseInt(req.params.id) });
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

// AI Copilot Endpoints
app.post('/api/ai/suggest-response/:contactId', async (req, res) => {
    try {
        const contactId = req.params.contactId.replace('conv_', '');
        const contact = await dbGet('contacts', { id: contactId });
        const messages = await dbAll('messages');
        const filtered = messages.filter(m => m.sender_id === contactId || m.recipient_id === contactId);
        const historyStr = filtered.slice(-6).map(m => `${m.sender_type}: ${m.text}`).join('\n');

        const suggestion = await getChatGptSuggestion(historyStr, contact || {});
        res.json(suggestion);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/ai/analyze-lead/:contactId', async (req, res) => {
    try {
        const contactId = req.params.contactId.replace('conv_', '');
        const messages = await dbAll('messages');
        const filtered = messages.filter(m => m.sender_id === contactId || m.recipient_id === contactId);
        const historyStr = filtered.slice(-6).map(m => `${m.sender_type}: ${m.text}`).join('\n');

        const analysis = await getGeminiLeadScore(historyStr);
        res.json(analysis);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Simulator Endpoint
app.post('/api/simulator/receive', async (req, res) => {
    try {
        const { sender_id, username, name, text } = req.body;

        const simulatedEvent = {
            sender: { id: sender_id || 'sim_user_1' },
            message: { text }
        };

        let contact = await dbGet('contacts', { id: sender_id });
        if (contact && (username || name)) {
            await dbUpdate('contacts', {
                username: username || contact.username,
                name: name || contact.name
            }, { id: sender_id });
        }

        await processMessagingEvent(simulatedEvent);
        res.json({ success: true, message: 'Evento simulado procesado correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Server listener
app.listen(PORT, () => {
    console.log(`\n🚀 CMR Faroles v2.0 activo en puerto ${PORT}`);
    console.log(`📊 BD: Supabase PostgreSQL`);
    console.log(`🌐 Dashboard: http://localhost:${PORT}\n`);
});
