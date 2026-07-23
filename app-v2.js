/**
 * 🧠 FAROLES GENIUS BOT — App.js Refactorizado (v2)
 *
 * Basado en Skill Vendedor Genius
 * - Perfilamiento de 3 canales (consumidor, vendedor, iglesia)
 * - Flujos adaptados por canal
 * - Disparadores (ad referral, fast-path, IA)
 * - Memoria de contacto
 * - Fallback inteligente
 * - Reactivación a 23h
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const { classifyIntent } = require('./ai_copilot');

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

const supabaseAdmin = SUPABASE_SERVICE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    : null;

console.log('✅ Conectado a Supabase:', SUPABASE_URL);
if (supabaseAdmin) console.log('✅ Cliente admin para RLS');

// --- DB HELPERS ---

async function dbGet(table, filter = {}) {
    try {
        const client = supabaseAdmin;
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
        const client = supabaseAdmin;
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
        const client = supabaseAdmin;
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
        const client = supabaseAdmin;
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

async function getSetting(key) {
    const row = await dbGet('settings', { key });
    return row ? row.value : null;
}

async function setSetting(key, value) {
    try {
        const existing = await dbGet('settings', { key });
        if (existing) {
            return await dbUpdate('settings', { value }, { key });
        } else {
            return await dbInsert('settings', { key, value });
        }
    } catch (err) {
        console.error(`❌ setSetting(${key}):`, err.message);
        return false;
    }
}

// --- META API ---

async function sendMetaMessage(recipientId, text, buttonsJson = null) {
    const token = await getSetting('page_access_token');
    if (!token) {
        console.warn('⚠️ Meta API no configurada');
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
        console.log(`📤 Enviando a ${recipientId}...`);
        const response = await axios.post('https://graph.facebook.com/v19.0/me/messages', {
            recipient: { id: recipientId },
            message: messageData
        }, {
            params: { access_token: token }
        });
        console.log(`✅ Mensaje enviado. ID: ${response.data.message_id}`);
        return response.data;
    } catch (err) {
        console.error(`❌ Meta API:`, err.response?.data?.error?.message || err.message);
        return null;
    }
}

// --- PERFILAMIENTO Y ESTADO ---

/**
 * Obtener o crear contacto
 * Estructura:
 * - instagram_id
 * - name
 * - city
 * - profile (consumidor | vendedor | iglesia | null)
 * - church_name (si aplica)
 * - project (si aplica — retiro, misión, ayuda social)
 * - flow_step (actual estado en la conversación)
 * - conversation_stage (perfilando | educando | escalado | cerrado)
 * - last_message_received_at
 */
async function getOrCreateContact(instagramId) {
    let contact = await dbGet('contacts', { id: instagramId });
    if (!contact) {
        contact = await dbInsert('contacts', {
            id: instagramId,
            name: null,
            city: null,
            profile: null,
            church_name: null,
            project: null,
            flow_step: 'start',
            conversation_stage: 'perfilando',
            last_message_received_at: new Date().toISOString()
        });
        console.log(`➕ Nuevo contacto: ${instagramId}`);
    }
    return contact;
}

async function updateContactStage(instagramId, updates) {
    updates.last_message_received_at = new Date().toISOString();
    await dbUpdate('contacts', updates, { id: instagramId });
}

// --- DISPARADORES (Fase 2) ---

const FAST_PATH_KEYWORDS = {
    'precio|costo|cuánto cuesta|tarifa|valor': 'pricing',
    'hola|buenos|buenas|hey|qué tal': 'welcome',
    'información|info|catálogo|qué venden|producto|productos': 'pricing',
    'comprar|me interesa|envío': 'pricing'
};

async function detectDispatcher(text, referral, contact) {
    // 1. Anuncio pagado
    if (referral && (!contact.flow_step || contact.flow_step === 'start')) {
        console.log('🎯 Disparador: ANUNCIO PAGADO');
        return { type: 'ad_referral', action: 'welcome_from_ad' };
    }

    // 2. Fast-Path
    for (const [pattern, action] of Object.entries(FAST_PATH_KEYWORDS)) {
        if (new RegExp(pattern, 'i').test(text)) {
            console.log(`⚡ Disparador: FAST-PATH (${action})`);
            return { type: 'fast_path', action };
        }
    }

    // 3. IA (si no está perfilado)
    if (contact.profile === null) {
        try {
            const triggers = await dbAll('ai_triggers', { is_active: 1 });
            if (triggers.length === 0) {
                console.log('ℹ️ Sin triggers IA, enviar fallback');
                return { type: 'fallback', action: 'ask_help' };
            }

            const result = await classifyIntent(text, '', triggers);
            console.log(`🧠 Intent: ${result.intent} (${(result.confianza * 100).toFixed(0)}%)`);

            if (result.confianza >= 0.7) {
                return { type: 'ia_high', action: 'pricing' };
            }
            if (result.confianza >= 0.5) {
                return { type: 'ia_medium', action: 'ask_help' };
            }
            return { type: 'ia_low', action: null };
        } catch (err) {
            console.warn('⚠️ IA error:', err.message);
            return { type: 'fallback', action: 'ask_help' };
        }
    }

    // Si ya está perfilado, ir a flujo según perfil
    if (contact.profile === 'consumidor') {
        return { type: 'profile_match', action: 'show_pricing' };
    }
    if (contact.profile === 'vendedor') {
        return { type: 'profile_match', action: 'show_seller_opportunity' };
    }
    if (contact.profile === 'iglesia') {
        return { type: 'profile_match', action: 'show_church_opportunity' };
    }

    return { type: 'unknown', action: null };
}

// --- FLUJOS POR CANAL ---

/**
 * FLUJO DE PERFILAMIENTO: primero preguntar ciudad y perfil
 */
async function startProfiling(instagramId, contact) {
    let step = contact.flow_step;

    // Pregunta 1: Ciudad
    if (step === 'start' || step === 'ask_city') {
        console.log('❓ Preguntando ciudad...');
        await sendMetaMessage(
            instagramId,
            '¡Hola! 👋 Bienvenid@ a Faroles Genius 🕯️ Me encantaría ayudarte de la mejor forma.\n\nPara eso, ¿me ayudas respondiendo un par de preguntas? ¿De qué ciudad eres?'
        );
        await updateContactStage(instagramId, { flow_step: 'ask_city', conversation_stage: 'perfilando' });
        return;
    }

    // Pregunta 2: Iglesia
    if (step === 'ask_church') {
        console.log('❓ Preguntando iglesia...');
        await sendMetaMessage(
            instagramId,
            '¿Eres parte de una iglesia, comunidad o grupo de oración? 🙏'
        );
        await updateContactStage(instagramId, { flow_step: 'ask_church', conversation_stage: 'perfilando' });
        return;
    }

    // Pregunta 3: Intención (pivote clave)
    if (step === 'ask_intent') {
        console.log('❓ Preguntando intención...');
        await sendMetaMessage(
            instagramId,
            '¿Te interesa un farol para ti, o te gustaría emprender vendiendo faroles en tu comunidad? 💡'
        );
        await updateContactStage(instagramId, { flow_step: 'ask_intent', conversation_stage: 'perfilando' });
        return;
    }
}

/**
 * FLUJO A: CONSUMIDOR (detal)
 */
async function runConsumerFlow(instagramId, contact) {
    console.log('🕯️ Flujo: CONSUMIDOR');
    const flowSteps = ['show_product', 'show_pricing', 'group_offer', 'ask_whatsapp'];
    const step = contact.flow_step;

    if (step === 'consumer_start' || !flowSteps.includes(step)) {
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
            `¿Quieres intentar con más personas? Muchas familias y comunidades compran en grupo y ahorran juntas. 🤝`
        );
        await updateContactStage(instagramId, { flow_step: 'group_offer' });
        return;
    }

    if (step === 'group_offer') {
        await sendMetaMessage(
            instagramId,
            `Excelente. Vamos al WhatsApp para coordinar tu pedido. Ahí te damos todos los detalles. 📲\n\nhttps://wa.me/[NUMERO]?text=Hola%20Faroles%20Genius`,
            [{
                title: '📲 Ir a WhatsApp',
                payload: 'ESCALATE_WHATSAPP'
            }]
        );
        await updateContactStage(instagramId, { flow_step: 'escalated', conversation_stage: 'cerrado' });
    }
}

/**
 * FLUJO B: VENDEDOR (preventa)
 */
async function runSellerFlow(instagramId, contact) {
    console.log('💰 Flujo: VENDEDOR');
    const step = contact.flow_step;

    if (step === 'seller_start' || step === 'ask_intent') {
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
            `📊 Números:\n\n• Precio mayorista: $17.000 por paquete\n• Precio reventa (detal): $20.000–$28.000\n• Tu ganancia: $3.000–$11.000 por paquete\n• Mínimo: 18 paquetes para la primera compra\n\nPrueba social: Google Reviews dicen que el producto se vende solo. 🌟`
        );
        await updateContactStage(instagramId, { flow_step: 'show_numbers' });
        return;
    }

    if (step === 'show_numbers') {
        await sendMetaMessage(
            instagramId,
            `🎯 Ejercicio Guía:\n\nEmpieza con tu círculo cercano:\n• 6 familia\n• 6 amigos\n• 6 conocidos\n= 18 pedidos para la primera compra\n\nLuego expande a parroquia, bazares, eventos.`
        );
        await updateContactStage(instagramId, { flow_step: 'exercise' });
        return;
    }

    if (step === 'exercise') {
        await sendMetaMessage(
            instagramId,
            `Te damos TODO el material listo: fotos HD, videos, catálogo, descripciones. Solo tienes que compartir. 🎬`,
            [{
                title: '📥 Solicitar Material',
                payload: 'REQUEST_SELLER_KIT'
            }]
        );
        await updateContactStage(instagramId, { flow_step: 'requesting_kit' });
        return;
    }

    if (step === 'requesting_kit') {
        await sendMetaMessage(
            instagramId,
            `Perfecto. Vamos al WhatsApp para confirmar tu material y estructura de apoyo. 📲\n\nhttps://wa.me/[NUMERO]?text=Quiero%20empezar%20a%20vender%20Faroles`
        );
        await updateContactStage(instagramId, { flow_step: 'escalated', conversation_stage: 'cerrado' });
    }
}

/**
 * FLUJO C: IGLESIA (compra con devolución)
 */
async function runChurchFlow(instagramId, contact) {
    console.log('⛪ Flujo: IGLESIA');
    const step = contact.flow_step;

    if (step === 'church_start' || step === 'ask_intent') {
        await sendMetaMessage(
            instagramId,
            `¡Qué hermoso, ${contact.name || 'hermana'}! ⛪\n\nLos faroles son una herramienta perfecta para financiar proyectos comunitarios. Retiros espirituales, misiones, ayuda social — lo que sea.\n\n¿Qué proyecto tiene en mente tu comunidad?`
        );
        await updateContactStage(instagramId, { flow_step: 'ask_project', profile: 'iglesia' });
        return;
    }

    if (step === 'ask_project') {
        await sendMetaMessage(
            instagramId,
            `✨ Nosotros financiamos con RIESGO COMPARTIDO:\n\n• Compran a $17.000 por paquete\n• Venden a feligreses a $25.000–$30.000 (ustedes deciden margen)\n• Lo no vendido antes del 8 dic se devuelve\n• Nosotros reembolsamos ese dinero\n\nNo pierden con lo que no se vende. Es justo.`
        );
        await updateContactStage(instagramId, { flow_step: 'explain_buyback' });
        return;
    }

    if (step === 'explain_buyback') {
        await sendMetaMessage(
            instagramId,
            `Mínimo: 18 paquetes para la primera compra (deben tener el dinero para comprar en serio).\n\nTe damos material publicitario + acompañamiento. Estamos contigo. 🤝`
        );
        await updateContactStage(instagramId, { flow_step: 'explained' });
        return;
    }

    if (step === 'explained') {
        await sendMetaMessage(
            instagramId,
            `¿Listo para llevar los faroles a tu comunidad?`,
            [{
                title: '✅ Sí, quiero',
                payload: 'CHURCH_YES'
            },
            {
                title: '❓ Consultar primero',
                payload: 'ESCALATE_WHATSAPP'
            }]
        );
        await updateContactStage(instagramId, { flow_step: 'confirm' });
        return;
    }

    if (step === 'confirm') {
        await sendMetaMessage(
            instagramId,
            `Excelente. Conectemos con quien toma las decisiones en tu iglesia. Vamos al WhatsApp. 📲\n\nhttps://wa.me/[NUMERO]?text=Somos%20de%20iglesia%20y%20queremos%20faroles`
        );
        await updateContactStage(instagramId, { flow_step: 'escalated', conversation_stage: 'cerrado' });
    }
}

/**
 * FALLBACK: Usuario dice algo que no entendemos
 */
async function runFallback(instagramId, contact) {
    console.log('⚠️ Fallback: opción de perfilar');
    await sendMetaMessage(
        instagramId,
        `No entendí bien, amig@. ¿Puedo ofrecerte 3 opciones? 👇`,
        [{
            title: '🏠 Para mi hogar',
            payload: 'PROFILE_CONSUMER'
        },
        {
            title: '💰 Vender',
            payload: 'PROFILE_SELLER'
        },
        {
            title: '⛪ Iglesia',
            payload: 'PROFILE_CHURCH'
        }]
    );
    await updateContactStage(instagramId, { flow_step: 'fallback_menu' });
}

// --- PROCESAMIENTO DE EVENTOS ---

async function processMessagingEvent(event) {
    const senderId = event.sender?.id;
    const text = event.message?.text || '';
    const payload = event.postback?.payload || '';
    const referral = event.referral?.ref;

    if (!senderId) return;

    console.log(`\n📥 Evento: ${senderId}`);
    console.log(`   Texto: "${text}" | Payload: "${payload}" | Referral: ${referral}`);

    // Obtener contacto
    let contact = await getOrCreateContact(senderId);
    console.log(`   Perfil: ${contact.profile} | Etapa: ${contact.flow_step}`);

    // Si es payload (botón), procesarlo
    if (payload) {
        if (payload === 'PROFILE_CONSUMER') {
            await updateContactStage(senderId, { profile: 'consumidor', flow_step: 'consumer_start' });
            await runConsumerFlow(senderId, { ...contact, profile: 'consumidor', flow_step: 'consumer_start' });
            return;
        }
        if (payload === 'PROFILE_SELLER') {
            await updateContactStage(senderId, { profile: 'vendedor', flow_step: 'seller_start' });
            await runSellerFlow(senderId, { ...contact, profile: 'vendedor', flow_step: 'seller_start' });
            return;
        }
        if (payload === 'PROFILE_CHURCH') {
            await updateContactStage(senderId, { profile: 'iglesia', church_name: 'Iglesia Local', flow_step: 'church_start' });
            await runChurchFlow(senderId, { ...contact, profile: 'iglesia', flow_step: 'church_start' });
            return;
        }
        if (payload === 'ESCALATE_WHATSAPP') {
            console.log('📲 Escalado a WhatsApp');
            await updateContactStage(senderId, { conversation_stage: 'cerrado', flow_step: 'escalated' });
            return;
        }
    }

    // Si es texto, detectar disparador
    const dispatcher = await detectDispatcher(text, referral, contact);
    console.log(`   Disparador: ${dispatcher.type} → ${dispatcher.action}`);

    // Extraer ciudad si preguntamos
    if (contact.flow_step === 'ask_city' && text.length > 0) {
        await updateContactStage(senderId, { city: text, flow_step: 'ask_church' });
        contact = { ...contact, city: text, flow_step: 'ask_church' };
    }

    // Extraer iglesia si preguntamos
    if (contact.flow_step === 'ask_church' && text.toLowerCase().includes('sí')) {
        await updateContactStage(senderId, { church_name: 'Iglesia Local', flow_step: 'ask_intent' });
        contact = { ...contact, church_name: 'Iglesia Local', flow_step: 'ask_intent' };
    }

    // Extraer perfil si preguntamos
    if (contact.flow_step === 'ask_intent') {
        if (text.toLowerCase().includes('vend') || text.toLowerCase().includes('emprend')) {
            await updateContactStage(senderId, { profile: 'vendedor', flow_step: 'seller_start' });
            await runSellerFlow(senderId, { ...contact, profile: 'vendedor', flow_step: 'seller_start' });
            return;
        } else if (contact.church_name) {
            await updateContactStage(senderId, { profile: 'iglesia', flow_step: 'church_start' });
            await runChurchFlow(senderId, { ...contact, profile: 'iglesia', flow_step: 'church_start' });
            return;
        } else {
            await updateContactStage(senderId, { profile: 'consumidor', flow_step: 'consumer_start' });
            await runConsumerFlow(senderId, { ...contact, profile: 'consumidor', flow_step: 'consumer_start' });
            return;
        }
    }

    // Router de flujos según estado
    if (contact.profile === null) {
        // No perfilado aún
        if (contact.flow_step === 'start') {
            await startProfiling(senderId, contact);
        } else if (contact.flow_step === 'ask_city') {
            await updateContactStage(senderId, { city: text, flow_step: 'ask_church' });
            await startProfiling(senderId, { ...contact, city: text, flow_step: 'ask_church' });
        } else if (contact.flow_step === 'ask_church') {
            await updateContactStage(senderId, { church_name: text.toLowerCase().includes('sí') ? 'Iglesia' : null, flow_step: 'ask_intent' });
            await startProfiling(senderId, { ...contact, flow_step: 'ask_intent' });
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

// --- REACTIVACIÓN 23h ---

async function checkAndSendReactivation() {
    console.log('\n⏰ [Reactivación] Verificando contactos...');
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);

    const contacts = await dbAll('contacts', {});
    let count = 0;

    for (const contact of contacts) {
        if (!contact.last_message_received_at || contact.conversation_stage === 'cerrado') continue;

        const lastTime = new Date(contact.last_message_received_at);
        const hoursAgo = (now - lastTime) / (1000 * 60 * 60);

        if (hoursAgo > 23 && hoursAgo < 24) {
            console.log(`📢 Reactivando ${contact.name || contact.id}`);
            await sendMetaMessage(
                contact.id,
                `Hola ${contact.name || 'amig@'}, ¿seguimos? 🕯️\n\nLa temporada de los faroles es corta (hasta el 8 de diciembre). ¡No te la pierdas! Cuéntame si tienes dudas. 💬`
            );
            count++;
        }
    }

    if (count > 0) console.log(`✅ ${count} reactivaciones enviadas`);
}

// Ejecutar cada 10 minutos
setInterval(checkAndSendReactivation, 10 * 60 * 1000);

// --- ENDPOINTS ---

app.get('/', (req, res) => {
    res.json({ status: 'Faroles Genius Bot v2 running' });
});

app.get('/webhook', async (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const expectedToken = await getSetting('webhook_verify_token');

    console.log(`\n🔐 Webhook Verify: token=${token}`);

    if (mode === 'subscribe' && token === expectedToken) {
        console.log('✅ Webhook verificado');
        return res.status(200).send(challenge);
    }

    console.warn('❌ Token inválido');
    return res.status(403).send('Forbidden');
});

app.post('/webhook', async (req, res) => {
    const data = req.body;
    console.log('\n📨 Webhook POST recibido');

    if (data.object === 'instagram') {
        for (const entry of data.entry || []) {
            for (const event of entry.messaging || []) {
                try {
                    await processMessagingEvent(event);
                } catch (err) {
                    console.error('Error procesando evento:', err.message);
                }
            }
        }
    }

    return res.status(200).json({ status: 'ok' });
});

// --- INICIALIZAR META CREDENCIALES ---

async function initializeMetaCredentials() {
    const token = process.env.META_PAGE_ACCESS_TOKEN;
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

    if (token) await setSetting('page_access_token', token);
    if (verifyToken) await setSetting('webhook_verify_token', verifyToken);

    console.log('✅ Credenciales Meta inicializadas');
}

initializeMetaCredentials().catch(err => console.warn('⚠️ Init error:', err.message));

// --- START SERVER ---

app.listen(PORT, () => {
    console.log(`\n🚀 Faroles Genius v2 escuchando en puerto ${PORT}`);
    console.log(`📡 Webhook: https://crm.falolesgenius.com/webhook`);
    console.log('✅ Listo para recibir eventos de Meta\n');
});

module.exports = app;
