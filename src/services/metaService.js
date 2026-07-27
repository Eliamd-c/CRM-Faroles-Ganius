'use strict';

const axios = require('axios');

const BASE = 'https://graph.facebook.com/v20.0';

function token() {
  return process.env.PAGE_ACCESS_TOKEN;
}

// ─── Perfiles ──────────────────────────────────────────────────────────────────

/**
 * Obtiene nombre, username y foto de perfil de un usuario de Instagram.
 * Sólo funciona si el usuario nos escribió primero (consentimiento).
 */
async function fetchProfile(igsid) {
  try {
    const { data } = await axios.get(`${BASE}/${igsid}`, {
      params: { fields: 'name,username,profile_pic', access_token: token() },
      timeout: 8000,
    });
    return {
      name: data.name || null,
      username: data.username || null,
      avatar_url: data.profile_pic || null,
    };
  } catch (err) {
    console.warn(`⚠️  fetchProfile(${igsid}): ${err.response?.data?.error?.message || err.message}`);
    return { name: null, username: null, avatar_url: null };
  }
}

// ─── Sender Actions ────────────────────────────────────────────────────────────

async function senderAction(recipientId, action) {
  try {
    await axios.post(
      `${BASE}/me/messages`,
      { recipient: { id: recipientId }, sender_action: action },
      { params: { access_token: token() }, timeout: 5000 }
    );
  } catch (err) {
    console.warn(`⚠️  senderAction(${action}): ${err.response?.data?.error?.message || err.message}`);
  }
}

const sendTypingOn  = (id) => senderAction(id, 'typing_on');
const sendTypingOff = (id) => senderAction(id, 'typing_off');
const markSeen      = (id) => senderAction(id, 'mark_seen');

// ─── Envío de Mensajes ─────────────────────────────────────────────────────────

/**
 * Envía un mensaje de texto al usuario.
 * Muestra "escribiendo..." antes de enviar para mejor experiencia.
 * @returns {string|null} mid del mensaje enviado, o null si falló.
 */
async function sendMessage(recipientId, text) {
  await sendTypingOn(recipientId);
  await new Promise(r => setTimeout(r, 600)); // pausa natural antes de enviar

  try {
    const { data } = await axios.post(
      `${BASE}/me/messages`,
      {
        recipient: { id: recipientId },
        message: { text },
      },
      { params: { access_token: token() }, timeout: 10000 }
    );
    await sendTypingOff(recipientId);
    return data.message_id || null;
  } catch (err) {
    console.error(`❌ sendMessage(${recipientId}): ${err.response?.data?.error?.message || err.message}`);
    return null;
  }
}

// ─── Conversaciones ────────────────────────────────────────────────────────────

/**
 * Obtiene una página de conversaciones de Instagram.
 * @param {string} pageId - IG_ID de la cuenta de negocio
 * @param {string|null} cursor - cursor de paginación
 */
async function fetchConversations(pageId, cursor = null) {
  const params = {
    platform: 'instagram',
    fields: 'id,participants',
    limit: 25,
    access_token: token(),
  };
  if (cursor) params.after = cursor;

  try {
    const { data } = await axios.get(`${BASE}/${pageId}/conversations`, {
      params,
      timeout: 15000,
    });
    return {
      data: data.data || [],
      nextCursor: data.paging?.cursors?.after || null,
      hasMore: !!data.paging?.next,
    };
  } catch (err) {
    console.error(`❌ fetchConversations: ${err.response?.data?.error?.message || err.message}`);
    return { data: [], nextCursor: null, hasMore: false };
  }
}

/**
 * Obtiene los mensajes de un hilo de conversación con todos los campos relevantes.
 * @param {string} threadId - ID del hilo (formato: t_XXXXXXXXX)
 */
async function fetchThreadMessages(threadId) {
  try {
    const { data } = await axios.get(`${BASE}/${threadId}`, {
      params: {
        fields: 'messages{id,created_time,message,from,to,attachments,reply_to}',
        access_token: token(),
      },
      timeout: 15000,
    });
    return data.messages?.data || [];
  } catch (err) {
    console.error(`❌ fetchThreadMessages(${threadId}): ${err.response?.data?.error?.message || err.message}`);
    return [];
  }
}

module.exports = {
  fetchProfile,
  sendTypingOn,
  sendTypingOff,
  markSeen,
  sendMessage,
  fetchConversations,
  fetchThreadMessages,
};
