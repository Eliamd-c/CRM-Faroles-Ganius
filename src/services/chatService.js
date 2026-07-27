'use strict';

const db   = require('../config/supabase');
const meta = require('./metaService');

const PAGE_ID = () => process.env.INSTAGRAM_ACCOUNT_ID;

// ─── Detección del tipo de mensaje ────────────────────────────────────────────

/**
 * Analiza un evento de webhook y extrae texto, URL de media y tipo de mensaje.
 * Cubre: texto, imagen, video, audio, story_reply, story_mention, reaction, share.
 */
function parseMessageEvent(event) {
  const msg = event.message || {};
  const reaction = event.reaction || null;

  // Reacción a un mensaje
  if (reaction) {
    return {
      type: 'reaction',
      text: `Reaccionó con ${reaction.emoji || '❤️'}`,
      media_url: null,
    };
  }

  const text = msg.text || '';
  const storyReplyUrl = msg.reply_to?.story?.url || null;
  const attachments = msg.attachments || [];
  const firstAttach = attachments[0] || null;
  const attachType = firstAttach?.type || null;
  const attachUrl  = firstAttach?.payload?.url || null;

  // Respuesta a historia (Story Reply)
  if (storyReplyUrl) {
    return {
      type: 'story_reply',
      text: text || 'Respondió a tu historia',
      media_url: storyReplyUrl,
    };
  }

  // Mención en historia (Story Mention) — puede llegar sin text
  if (attachType === 'story_mention') {
    return {
      type: 'story_mention',
      text: text || 'Te mencionó en su historia',
      media_url: attachUrl || null,
    };
  }

  // Publicación o Reel compartido
  if (attachType === 'share') {
    return {
      type: 'share',
      text: text || '📤 Compartió una publicación',
      media_url: attachUrl || null,
    };
  }

  // Imagen
  if (attachType === 'image') {
    return { type: 'image', text: text || '', media_url: attachUrl };
  }

  // Video
  if (attachType === 'video') {
    return { type: 'video', text: text || '', media_url: attachUrl };
  }

  // Audio
  if (attachType === 'audio') {
    return { type: 'audio', text: text || '🎵 Nota de voz', media_url: attachUrl };
  }

  // Texto plano
  if (text) {
    return { type: 'text', text, media_url: null };
  }

  // Fallback genérico
  return { type: 'unknown', text: '📎 Archivo adjunto', media_url: attachUrl };
}

// ─── Obtener o crear contacto con nombre real ──────────────────────────────────

async function resolveContact(igsid) {
  let contact = await db.getContact(igsid);

  if (!contact) {
    // Primer mensaje: obtener perfil de Meta
    const profile = await meta.fetchProfile(igsid);
    await db.upsertContact(igsid, {
      name: profile.name || `Usuario ${igsid.slice(-6)}`,
      username: profile.username || '',
      avatar_url: profile.avatar_url || '',
      stage: 'Lead',
      created_at: new Date().toISOString(),
      is_active: 1,
    });
    contact = await db.getContact(igsid);
  } else if (!contact.name || contact.name.startsWith('Usuario ') || contact.name === 'Unknown') {
    // Tiene registro pero sin nombre real: intentar obtenerlo
    const profile = await meta.fetchProfile(igsid);
    if (profile.name) {
      await db.upsertContact(igsid, {
        name: profile.name,
        username: profile.username || contact.username,
        avatar_url: profile.avatar_url || contact.avatar_url,
      });
      contact = { ...contact, name: profile.name };
    }
  }

  return contact;
}

// ─── Procesar evento entrante (desde webhook) ──────────────────────────────────

/**
 * Punto de entrada principal para eventos de webhook.
 * Garantiza: 1) contacto existe, 2) conversación existe, 3) mensaje guardado.
 */
async function processIncomingEvent(event) {
  try {
    const senderId    = event.sender?.id;
    const recipientId = event.recipient?.id;
    if (!senderId) return;

    // Ignorar mensajes propios (eco)
    const myId = PAGE_ID();
    if (senderId === myId) return;

    const timestamp = event.timestamp
      ? new Date(event.timestamp).toISOString()
      : new Date().toISOString();

    // 1. Asegurar contacto con nombre real
    await resolveContact(senderId);

    // 2. Asegurar conversación
    await db.upsertConversation(senderId, timestamp);
    await db.incrementUnread(senderId);

    // 3. Parsear tipo de mensaje
    const parsed = parseMessageEvent(event);

    // 4. Guardar mensaje en Supabase
    await db.insertMessage({
      conversation_id: `conv_${senderId}`,
      sender_id: senderId,
      recipient_id: recipientId || myId,
      text: parsed.text,
      media_url: parsed.media_url,
      direction: 'incoming',
      sender_type: 'customer',
      status: 'delivered',
      timestamp,
    });

    console.log(`💬 [${parsed.type}] de ${senderId}: "${parsed.text.slice(0, 40)}"`);

  } catch (err) {
    console.error('❌ processIncomingEvent:', err.message);
  }
}

// ─── Sincronización histórica (background) ────────────────────────────────────

/**
 * Sincroniza el historial de conversaciones desde Meta.
 * Pagina hasta obtener todas las conversaciones.
 * No duplica mensajes gracias al índice timestamp+conv_id en insertMessage.
 */
async function syncHistoryInBackground() {
  const pageId = PAGE_ID();
  console.log('🔄 Iniciando sincronización histórica desde Meta...');

  let cursor = null;
  let hasMore = true;
  let totalConvs = 0;
  let totalMsgs  = 0;

  while (hasMore) {
    const page = await meta.fetchConversations(pageId, cursor);
    hasMore = page.hasMore;
    cursor  = page.nextCursor;

    for (const conv of page.data) {
      try {
        const messages = await meta.fetchThreadMessages(conv.id);
        if (!messages.length) continue;

        // Identificar al cliente (el que no es la página)
        const sampleMsg = messages[0];
        let clientId = null;
        if (sampleMsg.from?.id && sampleMsg.from.id !== pageId) {
          clientId = sampleMsg.from.id;
        } else if (sampleMsg.to?.data) {
          const other = sampleMsg.to.data.find(p => p.id !== pageId);
          if (other) clientId = other.id;
        }
        if (!clientId) continue;

        // Asegurar contacto y conversación
        await resolveContact(clientId);
        const latestTs = new Date(messages[0].created_time).toISOString();
        await db.upsertConversation(clientId, latestTs);

        // Insertar mensajes en orden cronológico (del más antiguo al más nuevo)
        for (let i = messages.length - 1; i >= 0; i--) {
          const m = messages[i];
          const isBot = m.from?.id === pageId;

          // Parsear adjuntos del hilo histórico
          const storyUrl = m.reply_to?.story?.url || null;
          const firstA   = m.attachments?.data?.[0] || null;
          const aType    = firstA?.type || null;
          const aUrl     = firstA?.image_data?.url || firstA?.video_data?.url || firstA?.payload?.url || null;

          let text = m.message || '';
          let media_url = null;
          let msgType = 'text';

          if (storyUrl) {
            msgType = 'story_reply';
            media_url = storyUrl;
            text = text || 'Respondió a tu historia';
          } else if (aType === 'story_mention') {
            msgType = 'story_mention';
            media_url = aUrl;
            text = text || 'Te mencionó en su historia';
          } else if (aType === 'share') {
            msgType = 'share';
            media_url = aUrl;
            text = text || '📤 Compartió una publicación';
          } else if (aType === 'image') {
            msgType = 'image';
            media_url = aUrl;
          } else if (aType === 'video') {
            msgType = 'video';
            media_url = aUrl;
          } else if (aType === 'audio') {
            msgType = 'audio';
            text = text || '🎵 Nota de voz';
            media_url = aUrl;
          } else if (!text && aUrl) {
            msgType = 'unknown';
            media_url = aUrl;
            text = '📎 Archivo adjunto';
          } else if (!text && !aUrl) {
            continue; // mensaje sin contenido, ignorar
          }

          const inserted = await db.insertMessage({
            conversation_id: `conv_${clientId}`,
            sender_id: isBot ? pageId : clientId,
            recipient_id: isBot ? clientId : pageId,
            text,
            media_url,
            direction: isBot ? 'outgoing' : 'incoming',
            sender_type: isBot ? 'agent' : 'customer',
            status: 'sent',
            timestamp: new Date(m.created_time).toISOString(),
          });

          if (inserted !== null) totalMsgs++;
        }

        totalConvs++;
      } catch (err) {
        console.warn(`⚠️  Error procesando hilo ${conv.id}: ${err.message}`);
      }
    }
  }

  console.log(`✅ Sincronización completada: ${totalConvs} conversaciones, ${totalMsgs} mensajes nuevos.`);
  return { totalConvs, totalMsgs };
}

module.exports = {
  processIncomingEvent,
  syncHistoryInBackground,
};
