// DOC consultada: https://developers.facebook.com/docs/instagram/webhooks
// Webhook handler principal - verificación + recepción de eventos

require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const {
  PAGE_ACCESS_TOKEN,
  INSTAGRAM_ACCOUNT_ID,
  VERIFY_TOKEN,
  PORT = 3000,
} = process.env;

const GRAPH_API = 'https://graph.facebook.com/v21.0';

// ─────────────────────────────────────────────
// GET /  — Health check (Ruta principal)
// ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send('🤖 CRM 2.0 Webhook Server está en línea y funcionando correctamente.');
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
// Handler: Mensaje Directo (DM)
// DOC: https://developers.facebook.com/docs/messenger-platform/instagram/messages
// ─────────────────────────────────────────────
async function handleMessage(event) {
  const senderId = event.sender?.id;
  const text     = event.message?.text;

  if (!senderId || !text) return;

  console.log(`💬 DM recibido de ${senderId}: "${text}"`);

  // Respuesta automática simple (primer test)
  await sendMessage(senderId, `Hola! Recibimos tu mensaje: "${text}". Pronto te respondemos.`);
}

// ─────────────────────────────────────────────
// Handler: Comentario en publicación
// DOC: https://developers.facebook.com/docs/instagram-platform/reference/ig-media/comments
// ─────────────────────────────────────────────
async function handleComment(value) {
  const commentId = value.id;
  const text      = value.text;
  const from      = value.from?.username;

  console.log(`💬 Comentario de @${from}: "${text}" (id: ${commentId})`);

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
  console.log(`📸 Mención en historia de @${from} (media_id: ${mediaId})`);
}

// ─────────────────────────────────────────────
// Enviar DM
// DOC: https://developers.facebook.com/docs/messenger-platform/send-messages
// ─────────────────────────────────────────────
async function sendMessage(recipientId, text) {
  try {
    await axios.post(
      `${GRAPH_API}/${INSTAGRAM_ACCOUNT_ID}/messages`,
      {
        recipient: { id: recipientId },
        message:   { text },
      },
      {
        params: { access_token: PAGE_ACCESS_TOKEN },
      }
    );
    console.log(`✅ DM enviado a ${recipientId}`);
  } catch (err) {
    console.error('❌ Error enviando DM:', err.response?.data || err.message);
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
  } catch (err) {
    console.error('❌ Error respondiendo comentario:', err.response?.data || err.message);
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
