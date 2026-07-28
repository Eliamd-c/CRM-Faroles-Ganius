// DOC consultada: https://developers.facebook.com/docs/instagram/webhooks
// Webhook handler principal - verificación + recepción de eventos

require('dotenv').config();
const express = require('express');
const axios = require('axios');

const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
// DOC: https://developers.facebook.com/docs/graph-api/webhooks/getting-started
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
// DOC: https://developers.facebook.com/docs/instagram/webhooks#payload-examples
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
// Obtener Perfil de Usuario
// DOC: https://developers.facebook.com/docs/messenger-platform/instagram/features/user-profile
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
// Handler: Mensaje Directo (DM)
// DOC: https://developers.facebook.com/docs/messenger-platform/instagram/messages
// ─────────────────────────────────────────────
async function handleMessage(event) {
  const senderId     = event.sender?.id;
  const text         = event.message?.text;
  const storyMention = event.message?.story?.mention;

  // Ignorar eventos que no tengan ID de origen o sean del propio bot
  if (!senderId) return;
  if (senderId === INSTAGRAM_ACCOUNT_ID) return;

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

  // Respuesta automática simple (primer test)
  await sendMessage(senderId, `Hola ${senderName}! Recibimos tu mensaje: "${text}". Pronto te respondemos.`);
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
async function sendMessage(recipientId, text) {
  try {
    await axios.post(
      `${GRAPH_API}/me/messages`,
      {
        recipient: { id: recipientId },
        message:   { text },
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
