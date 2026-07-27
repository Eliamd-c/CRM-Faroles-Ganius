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

  req.on('close', () => {
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
  const senderId = event.sender?.id;
  const text     = event.message?.text;

  // Ignorar mensajes vacíos o mensajes enviados por la propia cuenta (el bot)
  if (!senderId || !text || senderId === INSTAGRAM_ACCOUNT_ID) return;

  const profile = await getUserProfile(senderId);
  const senderName = profile?.name || senderId;

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
  const from      = value.from?.username;

  broadcastLog('COMMENT', `@${from} comentó: "${text}"`);

  // Respuesta automática al comentario
  await replyComment(commentId, `Gracias @${from} por tu comentario! 🙌`);
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
// Arranque del servidor
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 CRM 2.0 Webhook escuchando en http://localhost:${PORT}/webhook`);
  console.log(`   Account ID : ${INSTAGRAM_ACCOUNT_ID}`);
  console.log(`   Verify Token: ${VERIFY_TOKEN}`);
});
