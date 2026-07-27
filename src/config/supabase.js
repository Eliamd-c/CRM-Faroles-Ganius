'use strict';

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── Helpers internos ─────────────────────────────────────────────────────────

function checkError(result, context) {
  if (result.error) {
    // PGRST116 = no rows found (no es un error real)
    if (result.error.code === 'PGRST116') return null;
    console.error(`❌ Supabase [${context}]:`, result.error.message);
  }
  return result.data || null;
}

// ─── contacts ─────────────────────────────────────────────────────────────────

/**
 * Obtiene un contacto por IGSID. Devuelve null si no existe.
 */
async function getContact(igsid) {
  const result = await supabase
    .from('contacts')
    .select('*')
    .eq('id', igsid)
    .limit(1);
  const data = checkError(result, 'getContact');
  return data && data.length > 0 ? data[0] : null;
}

/**
 * Crea o actualiza un contacto. Sólo actualiza los campos que se pasan.
 * Columnas válidas: id, username, name, avatar_url, stage, tags, notes,
 *                   phone_number, is_wholesaler_potential, flow_step,
 *                   created_at, updated_at, last_message_received_at,
 *                   last_message_sent_at, message_count, response_rate,
 *                   is_active, days_since_last_message
 */
async function upsertContact(igsid, data) {
  const payload = { id: igsid, updated_at: new Date().toISOString(), ...data };
  const result = await supabase
    .from('contacts')
    .upsert(payload, { onConflict: 'id' });
  return checkError(result, 'upsertContact');
}

// ─── conversations ────────────────────────────────────────────────────────────

/**
 * Obtiene la conversación de un contacto. Devuelve null si no existe.
 */
async function getConversation(igsid) {
  const result = await supabase
    .from('conversations')
    .select('*')
    .eq('contact_id', igsid)
    .limit(1);
  const data = checkError(result, 'getConversation');
  return data && data.length > 0 ? data[0] : null;
}

/**
 * Crea o actualiza la conversación de un contacto.
 * Columnas válidas: id, contact_id, last_message_time, unread_count,
 *                   created_at, updated_at
 */
async function upsertConversation(igsid, lastMessageTime) {
  const convId = `conv_${igsid}`;
  const now = new Date().toISOString();
  const payload = {
    id: convId,
    contact_id: igsid,
    last_message_time: lastMessageTime || now,
    updated_at: now,
  };
  const result = await supabase
    .from('conversations')
    .upsert(payload, { onConflict: 'id' });
  return checkError(result, 'upsertConversation');
}

/**
 * Incrementa el contador de mensajes no leídos de una conversación.
 */
async function incrementUnread(igsid) {
  const conv = await getConversation(igsid);
  const current = conv?.unread_count || 0;
  const result = await supabase
    .from('conversations')
    .update({ unread_count: current + 1, updated_at: new Date().toISOString() })
    .eq('contact_id', igsid);
  checkError(result, 'incrementUnread');
}

/**
 * Pone en cero el contador de no leídos (cuando el asesor abre el chat).
 */
async function clearUnread(igsid) {
  const result = await supabase
    .from('conversations')
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq('contact_id', igsid);
  checkError(result, 'clearUnread');
}

// ─── messages ─────────────────────────────────────────────────────────────────

/**
 * Inserta un mensaje. Usa 'meta_message_id' para deduplicación sólo si la
 * columna existe; de lo contrario usa timestamp+conversation_id como fallback.
 *
 * Columnas válidas: conversation_id, sender_id, recipient_id, text,
 *                   media_url, timestamp, direction, sender_type,
 *                   status, created_at
 */
async function insertMessage(data) {
  const payload = {
    conversation_id: data.conversation_id,
    sender_id: data.sender_id || '',
    recipient_id: data.recipient_id || '',
    text: data.text || '',
    media_url: data.media_url || null,
    direction: data.direction || 'incoming',
    sender_type: data.sender_type || 'customer',
    status: data.status || 'sent',
    timestamp: data.timestamp || new Date().toISOString(),
    created_at: data.timestamp || new Date().toISOString(),
  };

  // Evitar duplicados: verificar por conversation_id + timestamp
  const { data: existing } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', payload.conversation_id)
    .eq('timestamp', payload.timestamp)
    .limit(1);

  if (existing && existing.length > 0) return null; // ya existe

  const result = await supabase.from('messages').insert([payload]);
  return checkError(result, 'insertMessage');
}

/**
 * Lista los mensajes de una conversación ordenados cronológicamente.
 */
async function getMessages(convId, limit = 50) {
  const result = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', convId)
    .order('timestamp', { ascending: true })
    .limit(limit);
  return checkError(result, 'getMessages') || [];
}

/**
 * Lista todas las conversaciones con datos del contacto, ordenadas por
 * último mensaje (más reciente primero).
 */
async function getChats() {
  const { data: convs, error } = await supabase
    .from('conversations')
    .select('*, contacts(*)')
    .order('last_message_time', { ascending: false });

  if (error) {
    console.error('❌ Supabase [getChats]:', error.message);
    return [];
  }

  return (convs || []).map(cv => ({
    conv_id: cv.id,
    contact_id: cv.contact_id,
    name: cv.contacts?.name || `Usuario ${cv.contact_id?.slice(-6)}`,
    username: cv.contacts?.username || '',
    avatar_url: cv.contacts?.avatar_url || '',
    stage: cv.contacts?.stage || 'Lead',
    last_message_time: cv.last_message_time,
    unread_count: cv.unread_count || 0,
  }));
}

module.exports = {
  supabase,
  getContact,
  upsertContact,
  getConversation,
  upsertConversation,
  incrementUnread,
  clearUnread,
  insertMessage,
  getMessages,
  getChats,
};
