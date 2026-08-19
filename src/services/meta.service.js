const axios = require('axios');
const { state, broadcastLog } = require('../shared');
const supabase = require('../../db');

async function logMessageToDB(instagram_id, direction, type, content, mid = null, extra = {}) {
  if (!supabase) return;
  try {
    const textContent = typeof content === 'string' ? content : JSON.stringify(content);
    const row = { instagram_id, mid, direction, message_type: type, content: textContent };
    if (extra.attachment_type) row.attachment_type = extra.attachment_type;
    if (extra.attachment_url) row.attachment_url = extra.attachment_url;
    if (extra.reply_to_mid) row.reply_to_mid = extra.reply_to_mid;
    if (extra.metadata && Object.keys(extra.metadata).length > 0) row.metadata = extra.metadata;
    await supabase.from('messages').insert(row);
  } catch (err) {
    console.error('⚠️ Error guardando mensaje en DB:', err.message);
  }
}

function graphUrl(path) {
  return `${state.GRAPH_API}${path}`;
}

// Normalizar recipientId a string (Meta API exige string, no número)
function normalizeId(id) {
  return String(id).trim();
}

async function getUserProfile(senderId) {
  try {
    const response = await axios.get(graphUrl(`/${senderId}`), {
      params: { fields: 'name,profile_pic', access_token: state.ACCESS_TOKEN }
    });
    return response.data;
  } catch (err) {
    console.error(`❌ Error obteniendo perfil de ${senderId}:`, err.response?.data?.error?.message || err.message);
    return null;
  }
}

const kommoService = require('./kommo.service');

async function _postToMetaOrProxy(payload) {
  // 🌉 PUENTE KOMMO: Interceptor Global
  if (process.env.KOMMO_CLIENT_ID) {
    const recipientId = payload.recipient?.id;
    let text = payload.message?.text || "";

    // Extraer texto de templates si existe
    if (payload.message?.attachment?.payload?.text) {
      text = payload.message.attachment.payload.text;
    }

    // Agregar botones / quick replies como viñetas de texto
    if (payload.message?.quick_replies) {
      text += '\n\nOpciones:\n' + payload.message.quick_replies.map(qr => `- ${qr.title}`).join('\n');
    } else if (payload.message?.attachment?.payload?.buttons) {
      text += '\n\nOpciones:\n' + payload.message.attachment.payload.buttons.map(b => `- ${b.title}`).join('\n');
    }

    if (!text) text = "[Mensaje multimedia/plantilla]";

    const success = await kommoService.sendMessage(recipientId, text);
    if (!success) {
      console.error('❌ Falló el envío por Kommo. Abortando para no caer en Meta.');
    }
    return; // ⛔ NUNCA intentar Meta si estamos usando el puente de Kommo
  }

  // Comportamiento por defecto (Graph API)
  if (process.env.N8N_WEBHOOK_URL) {
    await axios.post(process.env.N8N_WEBHOOK_URL, payload);
  } else {
    await axios.post(graphUrl('/me/messages'), payload, { params: { access_token: state.ACCESS_TOKEN } });
  }
}

async function sendMessage(recipientId, text, quickReplies = null) {
  try {
    if (!state.ACCESS_TOKEN && !process.env.N8N_WEBHOOK_URL && !process.env.KOMMO_CLIENT_ID) {
      console.error('❌ Error enviando DM: ACCESS_TOKEN o Proxy no configurado');
      return;
    }
    const messagePayload = { text };
    if (quickReplies && quickReplies.length > 0) {
      messagePayload.quick_replies = quickReplies.map(qr => ({
        content_type: 'text',
        title: qr.title,
        payload: qr.payload || qr.title
      }));
    }
    const payload = {
      recipient: { id: normalizeId(recipientId) },
      message: messagePayload,
    };
    
    await _postToMetaOrProxy(payload);
    
    console.log(`✅ DM enviado a ${recipientId}`);
    broadcastLog('SYSTEM', `Respuesta enviada a ${recipientId}`);
    logMessageToDB(recipientId, 'outbound', 'text', text);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando DM:', errorMsg);
    broadcastLog('ERROR', `Error al responder: ${errorMsg}`);
    throw new Error(errorMsg);
  }
}

// Envía texto largo en partes (límite Instagram ~1000 chars por mensaje).
// Extraído del closure de webhook.handlers para poder reutilizarlo (injectHumanMessage).
async function sendMessageInChunks(recipientId, text) {
  if (!text) return;
  const chunks = String(text).match(/[\s\S]{1,950}/g) || [];
  for (const chunk of chunks) {
    await sendMessage(recipientId, chunk);
    await new Promise(r => setTimeout(r, 500)); // Pequeña pausa entre mensajes
  }
}

async function sendTemplate(recipientId, text, buttons) {
  try {
    const formattedButtons = buttons.map(b =>
      b.type === 'web_url'
        ? { type: 'web_url', url: b.url, title: b.title }
        : { type: 'postback', title: b.title, payload: b.payload }
    );
    const payload = {
      recipient: { id: normalizeId(recipientId) },
      message: {
        attachment: {
          type: 'template',
          payload: { template_type: 'button', text, buttons: formattedButtons }
        }
      },
    };
    await _postToMetaOrProxy(payload);
    console.log(`✅ Plantilla enviada a ${recipientId}`);
    broadcastLog('SYSTEM', `Plantilla de botones enviada a ${recipientId}`);
    logMessageToDB(recipientId, 'outbound', 'template', text);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando Plantilla:', errorMsg);
    broadcastLog('ERROR', `Error al enviar plantilla: ${errorMsg}`);
  }
}

async function sendIceBreaker(recipientId, question, suggestions = []) {
  try {
    const messagePayload = { text: question };
    if (suggestions && suggestions.length > 0) {
      messagePayload.quick_replies = suggestions.map((s, idx) => ({
        content_type: 'text',
        title: s.title || `Opción ${idx + 1}`,
        payload: s.payload || s.title || `ICE_${idx}`,
        image_url: s.image_url
      }));
    }
    const payload = {
      recipient: { id: normalizeId(recipientId) },
      message: messagePayload,
    };
    await _postToMetaOrProxy(payload);
    console.log(`❄️ Ice Breaker enviado a ${recipientId}`);
    broadcastLog('SYSTEM', `Ice Breaker enviado a ${recipientId}`);
    logMessageToDB(recipientId, 'outbound', 'text', question);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando Ice Breaker:', errorMsg);
    broadcastLog('ERROR', `Error al enviar Ice Breaker: ${errorMsg}`);
  }
}

async function sendQuickReplies(recipientId, text, options = []) {
  try {
    const messagePayload = {
      text,
      quick_replies: options.map(opt => ({
        content_type: opt.content_type || 'text',
        title: opt.title,
        payload: opt.payload || opt.title,
        image_url: opt.image_url,
        location_coordinates: opt.location_coordinates
      }))
    };
    const payload = {
      recipient: { id: normalizeId(recipientId) },
      message: messagePayload,
    };
    await _postToMetaOrProxy(payload);
    console.log(`⚡ Quick Replies enviado a ${normalizeId(recipientId)}`);
    broadcastLog('SYSTEM', `Quick Replies enviado a ${normalizeId(recipientId)}`);
    logMessageToDB(recipientId, 'outbound', 'text', text);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando Quick Replies:', errorMsg);
    broadcastLog('ERROR', `Error al enviar Quick Replies: ${errorMsg}`);
    throw new Error(errorMsg);
  }
}

async function sendMessageWithTag(recipientId, text, messagingTag = 'ACCOUNT_UPDATE') {
  try {
    const payload = {
      recipient: { id: normalizeId(recipientId) },
      message: { text },
      messaging_type: 'MESSAGE_TAG',
      tag: messagingTag
    };
    await _postToMetaOrProxy(payload);
    console.log(`🏷️ Mensaje con tag "${messagingTag}" enviado a ${recipientId}`);
    broadcastLog('SYSTEM', `Mensaje con tag "${messagingTag}" enviado`);
    logMessageToDB(recipientId, 'outbound', 'text', text);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando mensaje con tag:', errorMsg);
    broadcastLog('ERROR', `Error al enviar con tag: ${errorMsg}`);
  }
}

async function sendMediaMessage(recipientId, type, url) {
  try {
    const payload = {
      recipient: { id: normalizeId(recipientId) },
      message: { attachment: { type, payload: { url, is_reusable: true } } }
    };
    await _postToMetaOrProxy(payload);
    console.log(`✅ Media (${type}) enviado a ${recipientId}`);
    broadcastLog('SYSTEM', `Media enviado a ${recipientId}`);
    logMessageToDB(recipientId, 'outbound', type, url);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando Media autónomo:', errorMsg);
    broadcastLog('ERROR', `Error al enviar media: ${errorMsg}`);
  }
}

async function sendCard(recipientId, cardData) {
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
    const payload = {
      recipient: { id: normalizeId(recipientId) },
      message: { attachment: { type: 'template', payload: { template_type: 'generic', elements: [element] } } },
    };
    await _postToMetaOrProxy(payload);
    console.log(`✅ Tarjeta enviada a ${recipientId}`);
    broadcastLog('SYSTEM', `Tarjeta (Imagen) enviada a ${recipientId}`);
    logMessageToDB(recipientId, 'outbound', 'template', cardData.title);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando Tarjeta:', errorMsg);
    broadcastLog('ERROR', `Error al enviar tarjeta: ${errorMsg}`);
    throw new Error(errorMsg);
  }
}

async function sendCarousel(recipientId, elements) {
  if (!elements || elements.length === 0) return;
  const formattedElements = elements.slice(0, 10).map(el => {
    const buttons = (el.buttons || []).slice(0, 3).map(b =>
      b.type === 'web_url'
        ? { type: 'web_url', url: b.url, title: b.title }
        : { type: 'postback', title: b.title, payload: b.payload || b.title }
    );
    return {
      title: el.title || 'Sin título',
      subtitle: el.subtitle || '',
      image_url: el.image_url || undefined,
      buttons: buttons.length > 0 ? buttons : undefined
    };
  });
  try {
    const payload = {
      recipient: { id: normalizeId(recipientId) },
      message: { attachment: { type: 'template', payload: { template_type: 'generic', elements: formattedElements } } }
    };
    await _postToMetaOrProxy(payload);
    broadcastLog('SYSTEM', `Carrusel (${formattedElements.length} tarjetas) enviado a ${recipientId}`);
    logMessageToDB(recipientId, 'outbound', 'template', '[Carrusel]');
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando carrusel:', msg);
    broadcastLog('ERROR', `Error al enviar carrusel: ${msg}`);
    throw new Error(msg);
  }
}

async function sendGallery(recipientId, images, delayBetweenMs = 300) {
  for (const img of images) {
    try {
      const payload = {
        recipient: { id: normalizeId(recipientId) },
        message: { attachment: { type: 'image', payload: { url: img.url, is_reusable: true } } }
      };
      await _postToMetaOrProxy(payload);
    } catch (err) {
      console.error('❌ Error enviando imagen de galería:', err.response?.data?.error?.message || err.message);
    }
    if (delayBetweenMs > 0) await new Promise(r => setTimeout(r, delayBetweenMs));
  }
  broadcastLog('SYSTEM', `Galería (${images.length} imágenes) enviada a ${recipientId}`);
  logMessageToDB(recipientId, 'outbound', 'image', '[Galería de Imágenes]');
}

async function sendAudio(recipientId, audioUrl) {
  try {
    const payload = {
      recipient: { id: normalizeId(recipientId) },
      message: { attachment: { type: 'audio', payload: { url: audioUrl, is_reusable: true } } }
    };
    await _postToMetaOrProxy(payload);
    broadcastLog('SYSTEM', `Audio enviado a ${recipientId}`);
    logMessageToDB(recipientId, 'outbound', 'audio', audioUrl);
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando audio:', msg);
    broadcastLog('ERROR', `Error al enviar audio: ${msg}`);
  }
}

async function sendVideo(recipientId, videoUrl) {
  try {
    const payload = {
      recipient: { id: normalizeId(recipientId) },
      message: { attachment: { type: 'video', payload: { url: videoUrl, is_reusable: true } } }
    };
    await _postToMetaOrProxy(payload);
    broadcastLog('SYSTEM', `Video enviado a ${recipientId}`);
    logMessageToDB(recipientId, 'outbound', 'video', videoUrl);
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando video:', msg);
    broadcastLog('ERROR', `Error al enviar video: ${msg}`);
  }
}

async function sendFile(recipientId, fileUrl) {
  try {
    const payload = {
      recipient: { id: normalizeId(recipientId) },
      message: { attachment: { type: 'file', payload: { url: fileUrl, is_reusable: true } } }
    };
    await _postToMetaOrProxy(payload);
    broadcastLog('SYSTEM', `Archivo enviado a ${recipientId}`);
    logMessageToDB(recipientId, 'outbound', 'file', fileUrl);
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando archivo:', msg);
    broadcastLog('ERROR', `Error al enviar archivo: ${msg}`);
  }
}

async function replyComment(commentId, text) {
  try {
    await axios.post(graphUrl(`/${commentId}/replies`), { message: text }, {
      params: { access_token: state.ACCESS_TOKEN }
    });
    console.log(`✅ Respuesta enviada al comentario ${commentId}`);
    broadcastLog('SYSTEM', `Respuesta enviada al comentario ${commentId}`);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error respondiendo comentario:', errorMsg);
    broadcastLog('ERROR', `Error al responder comentario: ${errorMsg}`);
  }
}

async function sendPrivateReply(commentId, text) {
  try {
    const payload = {
      recipient: { comment_id: commentId },
      message: { text },
    };
    await _postToMetaOrProxy(payload);
    console.log(`✅ DM privado enviado al autor del comentario ${commentId}`);
    broadcastLog('SYSTEM', `DM enviado en privado al autor del comentario`);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando DM privado:', errorMsg);
    broadcastLog('ERROR', `Error al enviar DM privado: ${errorMsg}`);
  }
}

async function validarToken(token) {
  if (!token) return null;
  try {
    const res = await axios.get(graphUrl('/me'), {
      params: { fields: 'username', access_token: token }, timeout: 10000
    });
    return res.data?.username || res.data?.id || 'ok';
  } catch (err) {
    return null;
  }
}

async function initBot() {
  const { PAGE_ACCESS_TOKEN, INSTAGRAM_ACCESS_TOKEN } = process.env;
  const candidatos = [
    { nombre: 'INSTAGRAM_ACCESS_TOKEN', token: INSTAGRAM_ACCESS_TOKEN },
    { nombre: 'PAGE_ACCESS_TOKEN', token: PAGE_ACCESS_TOKEN },
  ].filter((c, i, arr) => c.token && arr.findIndex(x => x.token === c.token) === i);

  for (const c of candidatos) {
    const username = await validarToken(c.token);
    if (username) {
      state.ACCESS_TOKEN = c.token;
      state.BOT_USERNAME = username;
      console.log(`🤖 Bot inicializado con ${c.nombre}. Username: @${state.BOT_USERNAME}`);
      return;
    }
    console.warn(`⚠️ ${c.nombre} rechazado por Meta, probando el siguiente token...`);
  }
  console.error('❌ Ningún token de acceso es válido. El bot NO podrá enviar mensajes hasta renovar las credenciales en Meta.');
}

async function loadAppConfig() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.from('app_config').select('key, value');
    if (!error && data) {
      const dbToken = data.find(d => d.key === 'INSTAGRAM_ACCESS_TOKEN');
      if (dbToken && dbToken.value) {
        state.ACCESS_TOKEN = dbToken.value;
        console.log('✅ INSTAGRAM_ACCESS_TOKEN cargado desde Supabase');
      }
      const dbAccountId = data.find(d => d.key === 'INSTAGRAM_ACCOUNT_ID');
      if (dbAccountId && dbAccountId.value) {
        state.INSTAGRAM_ACCOUNT_ID = dbAccountId.value;
        console.log('✅ INSTAGRAM_ACCOUNT_ID cargado desde Supabase');
      }
    }
  } catch (err) {
    console.error('⚠️ Error cargando app_config:', err.message);
  }
}

module.exports = {
  logMessageToDB,
  getUserProfile,
  sendMessage,
  sendMessageInChunks,
  sendTemplate,
  sendIceBreaker,
  sendQuickReplies,
  sendMessageWithTag,
  sendMediaMessage,
  sendCard,
  sendCarousel,
  sendGallery,
  sendAudio,
  sendVideo,
  sendFile,
  replyComment,
  sendPrivateReply,
  validarToken,
  initBot,
  loadAppConfig,
};
