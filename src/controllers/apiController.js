'use strict';

const db          = require('../config/supabase');
const meta        = require('../services/metaService');
const chatService = require('../services/chatService');

// ─── GET /api/chats ────────────────────────────────────────────────────────────
async function listChats(req, res) {
  try {
    const chats = await db.getChats();
    return res.json(chats);
  } catch (err) {
    console.error('❌ listChats:', err.message);
    return res.status(500).json({ error: 'Error al obtener conversaciones' });
  }
}

// ─── GET /api/chats/:convId/messages ──────────────────────────────────────────
async function listMessages(req, res) {
  try {
    const { convId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const messages = await db.getMessages(convId, limit);

    // Marcar la conversación como leída
    const contactId = convId.replace('conv_', '');
    await db.clearUnread(contactId);

    return res.json(messages);
  } catch (err) {
    console.error('❌ listMessages:', err.message);
    return res.status(500).json({ error: 'Error al obtener mensajes' });
  }
}

// ─── POST /api/send ────────────────────────────────────────────────────────────
async function sendMessage(req, res) {
  try {
    const { recipient_id, text } = req.body;
    if (!recipient_id || !text?.trim()) {
      return res.status(400).json({ error: 'recipient_id y text son requeridos' });
    }

    // Enviar a Meta (incluye typing_on automático)
    const mid = await meta.sendMessage(recipient_id, text.trim());

    if (!mid && mid !== null) {
      return res.status(502).json({ error: 'No se pudo enviar el mensaje a Meta' });
    }

    // Guardar en Supabase
    const myId = process.env.INSTAGRAM_ACCOUNT_ID;
    const now  = new Date().toISOString();

    await db.upsertConversation(recipient_id, now);
    await db.insertMessage({
      conversation_id: `conv_${recipient_id}`,
      sender_id: myId,
      recipient_id,
      text: text.trim(),
      media_url: null,
      direction: 'outgoing',
      sender_type: 'agent',
      status: 'sent',
      timestamp: now,
    });

    return res.json({ ok: true, mid });
  } catch (err) {
    console.error('❌ sendMessage:', err.message);
    return res.status(500).json({ error: 'Error interno al enviar mensaje' });
  }
}

// ─── POST /api/sync ────────────────────────────────────────────────────────────
async function syncHistory(req, res) {
  // Responder inmediatamente y sincronizar en background
  res.json({ ok: true, message: 'Sincronización iniciada en segundo plano' });
  setImmediate(() => chatService.syncHistoryInBackground());
}

// ─── GET /api/contacts/:id ─────────────────────────────────────────────────────
async function getContact(req, res) {
  try {
    const contact = await db.getContact(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contacto no encontrado' });
    return res.json(contact);
  } catch (err) {
    console.error('❌ getContact:', err.message);
    return res.status(500).json({ error: 'Error al obtener contacto' });
  }
}

// ─── PATCH /api/contacts/:id ───────────────────────────────────────────────────
async function updateContact(req, res) {
  try {
    const allowed = ['stage', 'tags', 'notes', 'phone_number', 'is_wholesaler_potential'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
    }
    await db.upsertContact(req.params.id, updates);
    return res.json({ ok: true });
  } catch (err) {
    console.error('❌ updateContact:', err.message);
    return res.status(500).json({ error: 'Error al actualizar contacto' });
  }
}

module.exports = {
  listChats,
  listMessages,
  sendMessage,
  syncHistory,
  getContact,
  updateContact,
};
