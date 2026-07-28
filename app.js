// DOC consultada: https://developers.facebook.com/docs/instagram/webhooks
// Webhook handler principal - verificación + recepción de eventos

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const supabase = require('./db');

// Cargar configuración de flujos (Arquitectura JSON - Fase 1)
let flowsConfig = { flows: [], defaultFlow: null };
try {
  const rawData = fs.readFileSync(path.join(__dirname, 'flows.json'));
  flowsConfig = JSON.parse(rawData);
  console.log('✅ Flujos cargados correctamente.');
} catch (err) {
  console.error('❌ Error al cargar flows.json', err);
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de Multer (Subida de Imágenes)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'img-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Almacén de clientes SSE para el dashboard
let sseClients = [];

function broadcastLog(type, message, profile = null) {
  const logEntry = { type, message, profile, timestamp: Date.now() };
  console.log(`[${type}] ${message}`);
  
  sseClients.forEach(client => {
    client.res.write(`data: ${JSON.stringify(logEntry)}\n\n`);
  });
}

const {
  PAGE_ACCESS_TOKEN,
  INSTAGRAM_ACCOUNT_ID,
  VERIFY_TOKEN,
  PORT = 3000,
} = process.env;

const GRAPH_API = 'https://graph.facebook.com/v21.0';

// ─────────────────────────────────────────────
// Inicialización del Bot (Cargar datos propios)
// ─────────────────────────────────────────────
let BOT_USERNAME = process.env.BOT_USERNAME || null;
const recentReplies = new Set(); // Para guardar textos de respuestas recientes y evitar ecos

async function initBot() {
  try {
    const res = await axios.get(`${GRAPH_API}/${INSTAGRAM_ACCOUNT_ID}`, {
      params: { fields: 'username', access_token: PAGE_ACCESS_TOKEN }
    });
    BOT_USERNAME = res.data.username;
    console.log(`🤖 Bot inicializado. Username: @${BOT_USERNAME}`);
    // No podemos hacer broadcast aquí porque aún no hay clientes conectados,
    // pero guardamos el estado.
  } catch (err) {
    console.error('❌ Error obteniendo datos del bot en inicio:', err.response?.data || err.message);
  }
}
if (!BOT_USERNAME) {
  initBot();
}

// ─────────────────────────────────────────────
// GET /stream  — Server-Sent Events para el Dashboard UI
// ─────────────────────────────────────────────
app.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  sseClients.push(newClient);

  // Send a system message on connect
  res.write(`data: ${JSON.stringify({ type: 'SYSTEM', message: 'Conectado al monitor de eventos', timestamp: Date.now() })}\n\n`);
  
  if (BOT_USERNAME) {
    res.write(`data: ${JSON.stringify({ type: 'SYSTEM', message: `Bot configurado como: @${BOT_USERNAME}`, timestamp: Date.now() })}\n\n`);
  } else {
    res.write(`data: ${JSON.stringify({ type: 'WARNING', message: 'No se pudo obtener el BOT_USERNAME. Para mayor seguridad, añade BOT_USERNAME=farolesgenius a tus variables de entorno.', timestamp: Date.now() })}\n\n`);
  }

  // Heartbeat para mantener la conexión viva (cada 30 seg)
  const heartbeat = setInterval(() => {
    res.write(`:\n\n`); // Comentario SSE estándar para keep-alive
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter(client => client.id !== clientId);
  });
});

// ─────────────────────────────────────────────
// GET /webhook  — Verificación del webhook por Meta
// ─────────────────────────────────────────────
app.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verificado por Meta');
    return res.status(200).send(challenge);
  }

  console.warn('❌ Verificación fallida — token incorrecto');
  res.sendStatus(403);
});

// ─────────────────────────────────────────────
// POST /webhook  — Recepción de eventos en tiempo real
// ─────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  // Responder 200 inmediatamente para que Meta no reintente
  res.sendStatus(200);

  const body = req.body;
  console.log('\n📨 Evento recibido:', JSON.stringify(body, null, 2));

  if (body.object !== 'instagram') return;

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      await handleMessage(event);
    }

    for (const change of entry.changes || []) {
      if (change.field === 'comments') {
        await handleComment(change.value);
      }
      if (change.field === 'mentions') {
        await handleMention(change.value);
      }
    }
  }
});

// ─────────────────────────────────────────────
// API REST para el Flow Builder
// ─────────────────────────────────────────────

// Leer flujos
app.get('/api/flows', (req, res) => {
  res.json(flowsConfig);
});

// Guardar flujos
app.post('/api/flows', (req, res) => {
  try {
    const newFlows = req.body;
    fs.writeFileSync(path.join(__dirname, 'flows.json'), JSON.stringify(newFlows, null, 2));
    flowsConfig = newFlows; // Actualizar memoria
    console.log('✅ flows.json actualizado desde el Builder');
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error guardando flows.json', err);
    res.status(500).json({ error: 'Failed to save' });
  }
});

// Subir imágenes
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo' });
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
  res.json({ url: imageUrl });
});

// ─────────────────────────────────────────────
// Obtener Perfil de Usuario
// ─────────────────────────────────────────────
async function getUserProfile(senderId) {
  try {
    const response = await axios.get(`${GRAPH_API}/${senderId}`, {
      params: {
        fields: 'name,profile_pic',
        access_token: PAGE_ACCESS_TOKEN
      }
    });
    return response.data;
  } catch (err) {
    console.error(`❌ Error obteniendo perfil de ${senderId}:`, err.response?.data?.error?.message || err.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// Handler: Mensaje Directo (DM) y Postbacks
// DOC: https://developers.facebook.com/docs/messenger-platform/instagram/messages
// ─────────────────────────────────────────────
async function handleMessage(event) {
  const senderId     = event.sender?.id;
  const text         = event.message?.text || event.postback?.payload;
  const storyMention = event.message?.story?.mention;

  // Ignorar eventos que no tengan ID de origen o sean del propio bot
  if (!senderId) return;
  if (String(senderId).trim() === String(INSTAGRAM_ACCOUNT_ID).trim()) return;

  // Si no hay texto ni es una mención en historia, ignoramos
  if (!text && !storyMention) return;

  const profile = await getUserProfile(senderId);
  const senderName = profile?.name || senderId;

  // 1. Manejo de menciones en Historias
  if (storyMention) {
    broadcastLog('STORY', `@${senderName} te mencionó en su historia.`, profile);
    await sendMessage(senderId, `¡Hola @${senderName}! 👋 ¡Gracias por mencionarnos en tu historia! Nos encanta ❤️`);
    return;
  }

  // 2. Manejo de Mensajes Directos regulares (DM)
  broadcastLog('DM', `Recibido de ${senderName}: "${text}"`, profile);

  // 3. Verificar si el bot está pausado para este cliente en Supabase
  if (supabase) {
    try {
      const { data: customer } = await supabase
        .from('customers')
        .select('bot_paused')
        .eq('instagram_id', senderId)
        .single();
        
      if (customer && customer.bot_paused) {
        console.log(`[IGNORE] Bot pausado para el usuario ${senderId}`);
        return;
      }
    } catch (e) {
      console.error('[DB] Error verificando estado del bot:', e.message);
    }
  }

  // Normalizar el texto (quitar mayúsculas y acentos)
  const lowerText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let matchedFlow = null;

  // Buscar coincidencia en los flujos
  for (const flow of flowsConfig.flows) {
    if (flow.keywords && flow.matchType === 'contains') {
      const match = flow.keywords.find(kw => {
         const cleanKw = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
         return lowerText.includes(cleanKw);
      });
      if (match) {
        matchedFlow = flow;
        break;
      }
    }
  }

  // Si no hay coincidencia, nos quedamos en silencio absoluto (apagado el flujo por defecto)
  const flowToExecute = matchedFlow;
  
  if (flowToExecute && flowToExecute.steps) {
    for (const step of flowToExecute.steps) {
      if (step.type === 'text') {
        const replyText = step.message.replace('{username}', senderName);
        await sendMessage(senderId, replyText);
      } else if (step.type === 'buttons') {
        const replyText = step.message.replace('{username}', senderName);
        await sendMessage(senderId, replyText, step.buttons);
      } else if (step.type === 'template') {
        const replyText = step.message.replace('{username}', senderName);
        await sendTemplate(senderId, replyText, step.buttons);
      } else if (step.type === 'card') {
        const replyText = step.message?.replace('{username}', senderName);
        await sendCard(senderId, step.card, replyText);
      } else if (step.type === 'action') {
        await executeAction(senderId, senderName, step);
      }
    }
  }
}

// ─────────────────────────────────────────────
// Ejecución de Acciones de Flujo (Fase C.3)
// ─────────────────────────────────────────────
async function executeAction(senderId, senderName, step) {
  if (!supabase) {
    console.warn('⚠️ Supabase no conectado. No se ejecutó la acción:', step.actionType);
    return;
  }
  
  const { actionType, params } = step;
  console.log(`[ACTION] Ejecutando acción: ${actionType} para el usuario ${senderId}`);
  
  try {
    // 1. Obtener o crear al cliente
    let { data: customer, error: fetchErr } = await supabase
      .from('customers')
      .select('*')
      .eq('instagram_id', senderId)
      .single();

    if (fetchErr || !customer) {
      const { data: newCust, error: insertErr } = await supabase
        .from('customers')
        .insert([{ instagram_id: senderId, name: senderName }])
        .select()
        .single();
      if (insertErr) {
        console.error('❌ Error creando cliente:', insertErr.message);
        return;
      }
      customer = newCust;
    }

    // 2. Procesar cada acción
    let updates = {};

    switch (actionType) {
      case 'add_tag': {
        const tag = params.tag?.trim();
        if (tag) {
          const tags = new Set(customer.tags || []);
          tags.add(tag);
          updates.tags = Array.from(tags);
        }
        break;
      }
      case 'remove_tag': {
        const tag = params.tag?.trim();
        if (tag) {
          const tags = new Set(customer.tags || []);
          tags.delete(tag);
          updates.tags = Array.from(tags);
        }
        break;
      }
      case 'set_field': {
        const field = params.field?.trim();
        const value = params.value?.trim();
        if (field) {
          updates.fields = { ...customer.fields, [field]: value };
        }
        break;
      }
      case 'clear_field': {
        const field = params.field?.trim();
        if (field) {
          updates.fields = { ...customer.fields };
          delete updates.fields[field];
        }
        break;
      }
      case 'delete_contact': {
        await supabase.from('customers').delete().eq('instagram_id', senderId);
        broadcastLog('SYSTEM', `Contacto eliminado permanentemente: ${senderName}`);
        return;
      }
      case 'pause_bot': {
        updates.bot_paused = true;
        break;
      }
      case 'resume_bot': {
        updates.bot_paused = false;
        break;
      }
      case 'mark_open': {
        updates.status = 'open';
        break;
      }
      case 'mark_closed': {
        updates.status = 'closed';
        break;
      }
      default:
        // Por retrocompatibilidad con la version vieja (Acción de etiqueta legacy)
        if (step.tag) {
          console.log(`[ACTION] Legacy tag: ${step.tag}`);
          const tags = new Set(customer.tags || []);
          tags.add(step.tag);
          updates.tags = Array.from(tags);
        } else {
          console.log(`[ACTION] Tipo de acción desconocida: ${actionType}`);
        }
        break;
    }

    // 3. Aplicar actualización si hay cambios
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from('customers')
        .update(updates)
        .eq('instagram_id', senderId);

      if (updateErr) {
        console.error(`❌ Error actualizando cliente en acción ${actionType}:`, updateErr.message);
      } else {
        broadcastLog('SYSTEM', `Acción ${actionType || 'legacy'} ejecutada para ${senderName}`);
      }
    }
  } catch (error) {
    console.error('[ACTION] Excepción general:', error.message);
  }
}

// ─────────────────────────────────────────────
// Handler: Comentario en publicación
// DOC: https://developers.facebook.com/docs/instagram-platform/reference/ig-media/comments
// ─────────────────────────────────────────────
async function handleComment(value) {
  const commentId = value.id;
  const text      = value.text;
  const fromName  = value.from?.username;
  const fromId    = value.from?.id;

  // 1. Ignorar por ID o Username
  if (fromId === INSTAGRAM_ACCOUNT_ID || (BOT_USERNAME && fromName === BOT_USERNAME)) {
    console.log(`[IGNORE] Ignorando eco del propio bot en comentarios (por ID/User).`);
    return;
  }

  // 2. Ignorar por coincidencia de texto exacto (eco de nuestra propia respuesta)
  if (recentReplies.has(text)) {
    console.log(`[IGNORE] Ignorando eco del propio bot (texto coincidente).`);
    recentReplies.delete(text); // Lo borramos para no llenar memoria
    return;
  }

  broadcastLog('COMMENT', `@${fromName} comentó: "${text}"`);

  // Respuesta automática al comentario pública
  const replyText = `Gracias @${fromName} por tu comentario! 🙌`;
  recentReplies.add(replyText);
  await replyComment(commentId, replyText);

  // Enviar mensaje privado (DM) a quien comentó
  await sendPrivateReply(commentId, `Hola @${fromName}! Vimos tu comentario: "${text}". Te escribimos por aquí para darte una atención más personalizada. ¿En qué podemos ayudarte?`);
}

// ─────────────────────────────────────────────
// Handler: Mención en Historia
// DOC: https://developers.facebook.com/docs/instagram-platform/reference/ig-user/tags
// ─────────────────────────────────────────────
async function handleMention(value) {
  const mediaId = value.media_id;
  const from    = value.from?.username;
  broadcastLog('MENTION', `@${from} te mencionó en una historia.`);
}

// ─────────────────────────────────────────────
// Enviar DM
// DOC: https://developers.facebook.com/docs/messenger-platform/send-messages
// ─────────────────────────────────────────────
async function sendMessage(recipientId, text, quickReplies = null) {
  try {
    const messagePayload = { text };
    
    // Si hay botones de respuesta rápida, agregarlos al formato de Meta
    if (quickReplies && quickReplies.length > 0) {
      messagePayload.quick_replies = quickReplies.map(qr => ({
        content_type: 'text',
        title: qr.title,
        payload: qr.payload || qr.title
      }));
    }

    await axios.post(
      `${GRAPH_API}/me/messages`,
      {
        recipient: { id: recipientId },
        message: messagePayload,
      },
      {
        params: { access_token: PAGE_ACCESS_TOKEN },
      }
    );
    console.log(`✅ DM enviado a ${recipientId}`);
    broadcastLog('SYSTEM', `Respuesta enviada a ${recipientId}`);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando DM:', errorMsg);
    broadcastLog('ERROR', `Error al responder: ${errorMsg}`);
  }
}

// ─────────────────────────────────────────────
// Enviar Plantilla de Botones (Button Template)
// ─────────────────────────────────────────────
async function sendTemplate(recipientId, text, buttons) {
  try {
    const formattedButtons = buttons.map(b => {
      if (b.type === 'web_url') {
        return { type: 'web_url', url: b.url, title: b.title };
      } else {
        return { type: 'postback', title: b.title, payload: b.payload };
      }
    });

    const messagePayload = {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: text,
          buttons: formattedButtons
        }
      }
    };

    await axios.post(
      `${GRAPH_API}/me/messages`,
      {
        recipient: { id: recipientId },
        message: messagePayload,
      },
      { params: { access_token: PAGE_ACCESS_TOKEN } }
    );
    console.log(`✅ Plantilla enviada a ${recipientId}`);
    broadcastLog('SYSTEM', `Plantilla de botones enviada a ${recipientId}`);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando Plantilla:', errorMsg);
    broadcastLog('ERROR', `Error al enviar plantilla: ${errorMsg}`);
  }
}

// ─────────────────────────────────────────────
// Enviar Tarjeta / Carrusel (Generic Template)
// ─────────────────────────────────────────────
async function sendCard(recipientId, cardData, textFallback = null) {
  try {
    const button = cardData.btn_type === 'web_url' 
      ? { type: 'web_url', url: cardData.btn_url, title: cardData.btn_title }
      : { type: 'postback', title: cardData.btn_title, payload: cardData.btn_payload };

    const element = {
      title: cardData.title,
      image_url: cardData.image_url,
      subtitle: cardData.subtitle,
      buttons: [button]
    };

    const messagePayload = {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [element]
        }
      }
    };

    // Meta recomienda enviar un texto introductorio separado antes del carrusel si hay textFallback, 
    // pero para mantenerlo simple, solo enviamos el attachment.
    
    await axios.post(
      `${GRAPH_API}/me/messages`,
      {
        recipient: { id: recipientId },
        message: messagePayload,
      },
      { params: { access_token: PAGE_ACCESS_TOKEN } }
    );
    console.log(`✅ Tarjeta enviada a ${recipientId}`);
    broadcastLog('SYSTEM', `Tarjeta (Imagen) enviada a ${recipientId}`);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando Tarjeta:', errorMsg);
    broadcastLog('ERROR', `Error al enviar tarjeta: ${errorMsg}`);
  }
}

// ─────────────────────────────────────────────
// Responder comentario
// DOC: https://developers.facebook.com/docs/instagram-platform/reference/ig-comment
// ─────────────────────────────────────────────
async function replyComment(commentId, text) {
  try {
    await axios.post(
      `${GRAPH_API}/${commentId}/replies`,
      { message: text },
      { params: { access_token: PAGE_ACCESS_TOKEN } }
    );
    console.log(`✅ Respuesta enviada al comentario ${commentId}`);
    broadcastLog('SYSTEM', `Respuesta enviada al comentario ${commentId}`);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error respondiendo comentario:', errorMsg);
    broadcastLog('ERROR', `Error al responder comentario: ${errorMsg}`);
  }
}

// ─────────────────────────────────────────────
// Enviar respuesta privada (DM) a un comentario
// DOC: https://developers.facebook.com/docs/messenger-platform/instagram/features/private-replies
// ─────────────────────────────────────────────
async function sendPrivateReply(commentId, text) {
  try {
    await axios.post(
      `${GRAPH_API}/me/messages`,
      {
        recipient: { comment_id: commentId },
        message:   { text },
      },
      { params: { access_token: PAGE_ACCESS_TOKEN } }
    );
    console.log(`✅ DM privado enviado al autor del comentario ${commentId}`);
    broadcastLog('SYSTEM', `DM enviado en privado al autor del comentario`);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando DM privado:', errorMsg);
    broadcastLog('ERROR', `Error al enviar DM privado: ${errorMsg}`);
  }
}

// ─────────────────────────────────────────────
// Arranque del servidor
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 CRM 2.0 Webhook escuchando en http://localhost:${PORT}/webhook`);
  console.log(`   Account ID : ${INSTAGRAM_ACCOUNT_ID}`);
  console.log(`   Verify Token: ${VERIFY_TOKEN}`);
});
