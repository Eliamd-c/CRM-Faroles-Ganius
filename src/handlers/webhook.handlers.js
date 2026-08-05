const { state, broadcastLog } = require('../shared');
const supabase = require('../../db');
const meta = require('../services/meta.service');
const openai = require('../services/openai.service');
const flow = require('../services/flow.service');
const supabaseGateway = require('../adapters/gateways/supabaseGateway.instance');

async function handleMessage(event) {
  const senderId = event.sender?.id;
  const text = event.message?.quick_reply?.payload || event.postback?.payload || event.message?.text || "";
  const storyMention = event.message?.story?.mention;
  const hasAttachments = event.message?.attachments && event.message.attachments.length > 0;

  if (!senderId) return;
  if (String(senderId).trim() === String(state.INSTAGRAM_ACCOUNT_ID).trim()) return;
  if (!text && !storyMention && !hasAttachments) return;

  const profile = await meta.getUserProfile(senderId);
  const senderName = profile?.name || senderId;

  if (storyMention) {
    broadcastLog('STORY', `@${senderName} te mencionó en su historia.`, profile);
    meta.logMessageToDB(senderId, 'inbound', 'story_mention', '[Mención en historia]');
    await meta.sendMessage(senderId, `¡Hola @${senderName}! 👋 ¡Gracias por mencionarnos en tu historia! Nos encanta ❤️`);
    return;
  }

  broadcastLog('DM', `Recibido de ${senderName}: "${text}"`, profile);
  const msgExtra = {};
  if (event.message?.reply_to?.mid) msgExtra.reply_to_mid = event.message.reply_to.mid;
  if (event.message?.quick_reply) msgExtra.metadata = { quick_reply: event.message.quick_reply.payload };
  if (event.message?.referral) msgExtra.metadata = { ...msgExtra.metadata, referral: event.message.referral };
  meta.logMessageToDB(senderId, 'inbound', 'text', text || (hasAttachments ? '[Adjunto/s]' : ''), event.message?.mid, msgExtra);

  let customer = null;
  if (supabase) {
    try {
      const { data } = await supabase.from('customers').select('*').eq('instagram_id', senderId).single();
      customer = data;
      if (customer && profile) {
        const updates = {};
        if (profile.name && profile.name !== customer.name) updates.name = profile.name;
        if (profile.profile_pic && profile.profile_pic !== customer.profile_picture_url) updates.profile_picture_url = profile.profile_pic;
        if (Object.keys(updates).length > 0) {
          supabase.from('customers').update(updates).eq('instagram_id', senderId).then(() => {});
        }
      }
      if (customer && customer.bot_paused) {
        console.log(`[IGNORE] Bot pausado para el usuario ${senderId}`);
        return;
      }
    } catch (e) {
      console.error('[DB] Error verificando estado del bot:', e.message);
    }
  }

  if (!customer && supabase) {
    try {
      const { data: newCustomer, error: insertErr } = await supabase
        .from('customers')
        .insert([{ instagram_id: senderId, name: senderName, profile_picture_url: profile?.profile_pic || null, tags: [], fields: {}, bot_paused: false, bot_state: 'active' }])
        .select().single();
      if (!insertErr && newCustomer) {
        customer = newCustomer;
        broadcastLog('SYSTEM', `Nuevo contacto creado: ${senderName}`);
        if (state.flowsConfig.welcomeFlow?.steps?.length > 0) {
          broadcastLog('SYSTEM', `Ejecutando Welcome Flow para ${senderName}`);
          await flow.processFlowSteps(state.flowsConfig.welcomeFlow.steps, senderId, senderName, new Set(), text);
          return;
        }
      } else if (insertErr) {
        console.error('[DB] Error creando nuevo contacto:', insertErr.message);
        broadcastLog('SYSTEM', `⚠️ Error creando cliente: ${insertErr.message}`);
      }
    } catch (e) {
      console.error('[DB] Error creando nuevo contacto:', e.message);
    }
  }
  if (customer && customer.bot_state === 'awaiting_input') {
    const inputType = customer.awaiting_input_type;
    const lowerTxt = text.trim();
    let isValid = false;
    if (inputType === 'email') isValid = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(lowerTxt);
    else if (inputType === 'phone') isValid = /^\+?[\d\s-]{7,15}$/.test(lowerTxt);
    else if (inputType === 'number') isValid = /^-?\d+(\.\d+)?$/.test(lowerTxt);
    else if (inputType === 'url') isValid = /^https?:\/\/.+\..+/.test(lowerTxt);
    else if (inputType === 'date') isValid = !isNaN(Date.parse(lowerTxt));
    else if (inputType === 'choice') {
      const choices = (customer.awaiting_input_choices || '').split(',').map(c => c.trim().toLowerCase());
      isValid = choices.includes(lowerTxt.toLowerCase());
    } else isValid = lowerTxt.length > 0;

    if (isValid) {
      const updates = { bot_state: 'active' };
      if (customer.awaiting_input_field) {
        updates.fields = { ...(customer.fields || {}), [customer.awaiting_input_field]: lowerTxt };
      }
      await supabase.from('customers').update(updates).eq('instagram_id', senderId);
      broadcastLog('SYSTEM', `Dato capturado: ${lowerTxt} guardado en ${customer.awaiting_input_field}`);
      if (customer.current_flow_id) {
        const successFlow = state.flowsConfig.flows.find(f => f.id === `flow_${customer.current_flow_id}`);
        if (successFlow) await flow.processFlowSteps(successFlow.steps, senderId, senderName);
      }
    } else {
      const retries = (customer.awaiting_input_retries || 0) + 1;
      if (retries >= 3) {
        await supabase.from('customers').update({ bot_state: 'active', awaiting_input_retries: 0 }).eq('instagram_id', senderId);
        broadcastLog('SYSTEM', `Fallo de input máximo alcanzado para ${senderName}`);
        if (customer.current_step_index !== null && typeof customer.current_step_index === 'string') {
          const failFlow = state.flowsConfig.flows.find(f => f.id === `flow_${customer.current_step_index}`);
          if (failFlow) await flow.processFlowSteps(failFlow.steps, senderId, senderName);
        }
      } else {
        await supabase.from('customers').update({ awaiting_input_retries: retries }).eq('instagram_id', senderId);
        await meta.sendMessage(senderId, customer.awaiting_input_prompt || "Ese formato no es válido. Intenta de nuevo:");
      }
    }
    return;
  }

  const normalizedText = openai.removeAccents(text);
  const lowerText = normalizedText.toLowerCase();
  let matchedFlow = null;

  for (const f of state.flowsConfig.flows) {
    if (f.enabled === false) continue;
    if (!f.keywords || f.keywords.length === 0) continue;
    const matchType = f.matchType || 'contains';
    if (matchType === 'contains') {
      const match = f.keywords.find(kw => { const cleanKw = kw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); return lowerText.includes(cleanKw); });
      if (match) { matchedFlow = f; break; }
    } else if (matchType === 'exact') {
      const match = f.keywords.find(kw => { const cleanKw = kw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); return lowerText === cleanKw; });
      if (match) { matchedFlow = f; break; }
    } else if (matchType === 'starts_with') {
      const match = f.keywords.find(kw => { const cleanKw = kw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); return lowerText.startsWith(cleanKw); });
      if (match) { matchedFlow = f; break; }
    } else if (matchType === 'regex') {
      const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = f.keywords.some(kw => { const cleanKw = kw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); try { return new RegExp('\\b' + escapeRegExp(cleanKw) + '\\b', 'i').test(lowerText); } catch (e) { return false; } });
      if (match) { matchedFlow = f; break; }
    }
  }

  if (matchedFlow && matchedFlow.steps) {
    matchedFlow.executionCount = (matchedFlow.executionCount || 0) + 1;
    matchedFlow.lastExecutedAt = new Date().toISOString();
    flow.saveFlowsConfig().catch(err => console.warn('⚠️ Error guardando flujos (no-bloqueante):', err.message));
    await flow.processFlowSteps(matchedFlow.steps, senderId, senderName, new Set(), text);
  } else {
    console.log(`[LangGraph] Delegando mensaje de "${senderName}" a LangGraph (Fallback inteligente)`);
    const langGraph = require('../services/langgraph.service');
    // Envío por partes centralizado en meta.service (límite Instagram ~1000 chars)
    const sendInChunks = (targetId, body) => meta.sendMessageInChunks(targetId, body);

    // Ejecución asíncrona para no bloquear el Event Loop ni causar Timeout en Meta
    langGraph.processConversation(senderId, text, customer).then(async (result) => {
      if (result.action === 'pause_bot') {
        // Usa pauseBot() para sellar bot_paused_at/bot_paused_reason (invariante de la cola humana)
        await supabaseGateway.pauseBot(senderId, 'escalado_langgraph');
        await sendInChunks(senderId, result.reply);
        broadcastLog('SYSTEM', `Bot pausado por LangGraph para el usuario ${senderName} (Requiere humano)`);
      } else if (result.action === 'send_message' && result.reply) {
        await sendInChunks(senderId, result.reply);
        broadcastLog('SYSTEM', `LangGraph respondió a ${senderName}: ${result.reply.substring(0, 50)}...`);
      } else if (result.action === 'error') {
        broadcastLog('SYSTEM', `❌ Error interno en LangGraph: ${result.reply}`);
      }
    }).catch(err => {
      console.error('[LangGraph] Error en ejecución de fondo:', err);
      broadcastLog('SYSTEM', `❌ Excepción en LangGraph: ${err.message}`);
    });
  }
}

async function handleComment(value) {
  const commentId = value.id;
  const text = value.text;
  const fromName = value.from?.username;
  const fromId = value.from?.id;
  if (fromId === state.INSTAGRAM_ACCOUNT_ID || (state.BOT_USERNAME && fromName === state.BOT_USERNAME)) return;
  if (state.recentReplies.has(commentId)) return;
  state.recentReplies.add(commentId);
  setTimeout(() => state.recentReplies.delete(commentId), 60_000);
  broadcastLog('COMMENT', `@${fromName} comentó: "${text}"`);

  const commentTriggers = state.flowsConfig.commentTriggers || [];
  const lowerText = openai.removeAccents(text).toLowerCase();
  let matched = null;
  for (const trigger of commentTriggers) {
    if (!trigger.keywords || trigger.keywords.length === 0) continue;
    const matchType = trigger.matchType || 'contains';
    const found = trigger.keywords.find(kw => {
      const cleanKw = openai.removeAccents(kw).toLowerCase();
      if (matchType === 'exact') return lowerText === cleanKw;
      if (matchType === 'starts_with') return lowerText.startsWith(cleanKw);
      return lowerText.includes(cleanKw);
    });
    if (found) { matched = trigger; break; }
  }

  if (matched) {
    const replyPool = matched.commentPublicReplies?.length ? matched.commentPublicReplies : (matched.publicReply ? [matched.publicReply] : []);
    if (replyPool.length) {
      const pick = replyPool[Math.floor(Math.random() * replyPool.length)];
      await meta.replyComment(commentId, pick.replace('{username}', fromName));
    }
    if (matched.privateReply) await meta.sendPrivateReply(commentId, matched.privateReply.replace('{username}', fromName));
    if (matched.dmFlowId) {
      const f = state.flowsConfig.flows.find(fl => fl.id === matched.dmFlowId);
      if (f) await meta.sendPrivateReply(commentId, f.steps?.[0]?.message || 'Hola, te escribimos por privado.');
    }
  } else {
    await meta.replyComment(commentId, `Gracias @${fromName} por tu comentario! 🙌`);
    await meta.sendPrivateReply(commentId, `Hola @${fromName}! Vimos tu comentario: "${text}". Te escribimos por aquí para darte una atención más personalizada. ¿En qué podemos ayudarte?`);
  }
}

async function handleMention(value) {
  const mentionId = value.comment_id || value.media_id;
  if (!mentionId) return;
  broadcastLog('MENTION', `Alguien te mencionó en una publicación o comentario (ID: ${mentionId}).`);
  if (state.flowsConfig.mentionFlow?.steps?.length > 0) {
    const firstStep = state.flowsConfig.mentionFlow.steps[0];
    let replyText = '¡Gracias por mencionarnos! 🙌';
    if (firstStep.type === 'message' && firstStep.message) replyText = firstStep.message;
    await replyToMention(mentionId, replyText);
  }
}

const axios = require('axios');
async function replyToMention(mentionId, text) {
  if (!state.ACCESS_TOKEN || !state.INSTAGRAM_ACCOUNT_ID) return;
  try {
    const payload = new URLSearchParams();
    payload.append('message', text);
    payload.append('access_token', state.ACCESS_TOKEN);
    if (mentionId) payload.append('comment_id', mentionId);
    await axios.post(`https://graph.instagram.com/v26.0/${state.INSTAGRAM_ACCOUNT_ID}/mentions`, payload);
    console.log(`✅ Respuesta a mención enviada a ${mentionId}`);
    broadcastLog('SYSTEM', `Comentario de respuesta publicado en la mención ${mentionId}`);
  } catch (err) {
    console.error(`❌ Error enviando respuesta a mención ${mentionId}:`, err.response?.data || err.message);
    broadcastLog('ERROR', `Falló respuesta a mención: ${err.message}`);
  }
}

async function handleMessageEcho(event) {
  const messageId = event.message?.mid;
  const senderId = event.sender?.id;
  console.log(`✅ Message Echo - ID: ${messageId} enviado a ${senderId}`);
  broadcastLog('ECHO', `Mensaje confirmado (ID: ${messageId})`);
}

async function handleDeliveryConfirmation(event) {
  const senderId = event.sender?.id;
  const watermark = event.delivery?.watermark;
  console.log(`🚚 Delivery Confirmation - Entregado hasta: ${watermark}`);
  broadcastLog('DELIVERY', `Mensaje entregado a ${senderId}`);
}

async function handleReadReceipt(event) {
  const senderId = event.sender?.id;
  const watermark = event.read?.watermark;
  const mid = event.read?.mid;
  console.log(`👀 Read Receipt - Leído por ${senderId}`);
  broadcastLog('READ', `Mensaje leído por el usuario`);
  if (supabase && senderId) {
    try {
      if (mid) {
        await supabase.from('messages').update({ is_read: true }).eq('mid', mid);
      } else if (watermark) {
        await supabase.from('messages').update({ is_read: true })
          .eq('instagram_id', senderId).eq('direction', 'outbound').eq('is_read', false)
          .lte('created_at', new Date(watermark).toISOString());
      }
    } catch (e) {
      console.error('Error actualizando read receipt:', e.message);
    }
  }
}

async function handleTypingIndicator(event) {
  const senderId = event.sender?.id;
  console.log(`⌨️ Typing Indicator - ${senderId} está escribiendo...`);
  broadcastLog('TYPING', `Usuario está escribiendo...`);
}

async function handlePostback(event) {
  const senderId = event.sender?.id;
  const payload = event.postback?.payload;
  const title = event.postback?.title;
  const mid = event.postback?.mid;
  console.log(`🔘 Postback - ${title} (${payload}) desde ${senderId}`);
  broadcastLog('POSTBACK', `Usuario pulsó botón: ${title}`);
  meta.logMessageToDB(senderId, 'inbound', 'postback', title || payload, mid, {
    metadata: { postback_payload: payload, postback_title: title }
  });
  await handleMessage({ sender: event.sender, message: { text: payload } });
}

async function handleMessageReaction(event) {
  const senderId = event.sender?.id;
  const reactionData = event.reaction || event.message?.reaction;
  const emoji = reactionData?.emoji || reactionData;
  const action = reactionData?.action || 'react';
  const targetMid = reactionData?.mid;
  console.log(`😊 Message Reaction - ${emoji} (${action}) desde ${senderId}`);
  broadcastLog('REACTION', `Usuario reaccionó: ${emoji}`);
  if (action === 'react') {
    meta.logMessageToDB(senderId, 'inbound', 'reaction', emoji, null, {
      metadata: { reaction: emoji, target_mid: targetMid, action }
    });
  }
}

async function handleStoryReaction(value) {
  const fromId = value.from?.id;
  const fromUsername = value.from?.username;
  const reaction = value.reaction;
  console.log(`💬 Story Reaction - @${fromUsername} reaccionó con ${reaction}`);
  broadcastLog('STORY_REACTION', `@${fromUsername} reaccionó a tu historia: ${reaction}`, { id: fromId, name: fromUsername });
  if (supabase) {
    try {
      const { data: existing } = await supabase.from('customers').select('fields').eq('instagram_id', fromId).single();
      await supabase.from('customers').update({
        fields: { ...(existing?.fields || {}), last_story_reaction: reaction, story_reaction_at: new Date().toISOString() }
      }).eq('instagram_id', fromId);
    } catch (e) { console.error('Error guardando story reaction:', e.message); }
  }
}

async function handleAttachments(event) {
  const senderId = event.sender?.id;
  const attachments = event.message?.attachments || [];
  const mid = event.message?.mid;
  for (const attachment of attachments) {
    const type = attachment.type;
    const url = attachment.payload?.url;
    console.log(`📎 Attachment - ${type} desde ${senderId}: ${url}`);
    broadcastLog('ATTACHMENT', `Usuario compartió ${type}`, { id: senderId });
    meta.logMessageToDB(senderId, 'inbound', 'attachment', `[${type}]`, mid, { attachment_type: type, attachment_url: url });
  }
}

async function handleLocation(event) {
  const senderId = event.sender?.id;
  const coords = event.message?.location?.coordinates;
  const mid = event.message?.mid;
  console.log(`📍 Location - Lat: ${coords?.lat}, Lng: ${coords?.long} desde ${senderId}`);
  broadcastLog('LOCATION', `Usuario compartió ubicación`);
  meta.logMessageToDB(senderId, 'inbound', 'location', `📍 ${coords?.lat}, ${coords?.long}`, mid, { metadata: { lat: coords?.lat, lng: coords?.long } });
  if (supabase && coords) {
    try {
      const { data: existing } = await supabase.from('customers').select('fields').eq('instagram_id', senderId).single();
      await supabase.from('customers').update({
        fields: { ...(existing?.fields || {}), last_location_lat: coords.lat, last_location_lng: coords.long }
      }).eq('instagram_id', senderId);
    } catch (e) { console.error('Error guardando ubicación:', e.message); }
  }
}

async function handleShare(event) {
  const senderId = event.sender?.id;
  const shares = event.message?.shares || [];
  const mid = event.message?.mid;
  console.log(`🔗 Share - ${shares.length} contenidos compartidos desde ${senderId}`);
  broadcastLog('SHARE', `Usuario compartió contenido`);
  for (const share of shares) {
    const url = share.link || share.url || '';
    meta.logMessageToDB(senderId, 'inbound', 'share', url || '[Contenido compartido]', mid, {
      attachment_type: 'share', attachment_url: url, metadata: { share }
    });
  }
}

async function handleLiveLocation(event) {
  console.log(`🔴 Live Location - Desde ${event.sender?.id}`);
  broadcastLog('LIVE_LOCATION', `Usuario compartió ubicación en vivo`);
}

async function handleUserReferral(event) {
  const senderId = event.sender?.id;
  const referral = event.referral;
  console.log(`🎁 Referral - ${referral?.ref} desde ${senderId}`);
  broadcastLog('REFERRAL', `Usuario llegó via referral: ${referral?.ref}`);
  if (supabase) {
    try {
      const { data: existing } = await supabase.from('customers').select('fields').eq('instagram_id', senderId).single();
      await supabase.from('customers').update({
        fields: { ...(existing?.fields || {}), referral_source: referral?.ref, referral_at: new Date().toISOString() }
      }).eq('instagram_id', senderId);
    } catch (e) { console.error('Error guardando referral:', e.message); }
  }
}

async function handleAccountLinking(event) {
  const senderId = event.sender?.id;
  const status = event.account_linking?.status;
  console.log(`🔗 Account Linking - ${status} para ${senderId}`);
  broadcastLog('ACCOUNT_LINKING', `Cuenta ${status} por ${senderId}`);
}

async function handleHandoverProtocol(event) {
  const senderId = event.sender?.id;
  const metadata = event.pass_thread_control?.metadata;
  console.log(`👤 Handover - Thread pasado a humano (${metadata})`);
  broadcastLog('HANDOVER', `Conversación pasada a humano`, { id: senderId });
  if (supabase) {
    try {
      await supabase.from('customers').update({ bot_state: 'paused' }).eq('instagram_id', senderId);
      await supabaseGateway.pauseBot(senderId, 'handover_protocol');
    }
    catch (e) { console.error('Error en handover:', e.message); }
  }
}

async function handleOptIn(event) {
  const senderId = event.sender?.id;
  const ref = event.opt_in?.ref;
  console.log(`✅ Opt-in - ${ref} desde ${senderId}`);
  broadcastLog('OPT_IN', `Usuario hizo opt-in: ${ref}`);
  if (supabase) {
    try {
      const { data: existing } = await supabase.from('customers').select('fields').eq('instagram_id', senderId).single();
      await supabase.from('customers').update({
        fields: { ...(existing?.fields || {}), opted_in: true, opt_in_type: ref }
      }).eq('instagram_id', senderId);
    } catch (e) { console.error('Error guardando opt-in:', e.message); }
  }
}

async function handlePayment(event) {
  const senderId = event.sender?.id;
  const payment = event.payment;
  const amount = payment?.amount;
  const currency = payment?.currency;
  console.log(`💳 Payment - ${amount} ${currency} desde ${senderId}`);
  broadcastLog('PAYMENT', `Pago recibido: ${amount} ${currency}`, { id: senderId });
  if (supabase) {
    try {
      const { data: existing } = await supabase.from('customers').select('fields').eq('instagram_id', senderId).single();
      await supabase.from('customers').update({
        fields: { ...(existing?.fields || {}), last_payment: amount, last_payment_currency: currency, last_payment_at: new Date().toISOString() }
      }).eq('instagram_id', senderId);
    } catch (e) { console.error('Error guardando pago:', e.message); }
  }
}

async function handleSponsoredMessage(event) {
  console.log(`🎯 Sponsored Message desde ${event.sender?.id}`);
  broadcastLog('SPONSORED', `Usuario vio mensaje patrocinado`);
}

function handlePolicyEnforcement(value) {
  console.log(`⚠️ Policy Enforcement - Acción: ${value.action}`);
  broadcastLog('POLICY', `Acción de cumplimiento: ${value.action}`);
}

function handleMessageTags(value) {
  console.log(`🏷️ Message Tags - Calidad: ${value.quality}`);
  broadcastLog('MESSAGE_TAGS', `Calidad de mensajes: ${value.quality}`);
}

function handleMessagingHandover(value) {
  console.log(`🔄 Messaging Handover - ${value?.status || 'event'}`);
  broadcastLog('MESSAGING_HANDOVER', `Evento de handover detectado`);
}

async function handleWelcomeMessageAd(event) {
  const senderId = event.sender?.id;
  const clickedButtonPayload = event.message?.quick_reply?.payload || event.postback?.payload;
  if (!senderId) return;
  console.log(`🎯 Welcome Message Ad - Usuario: ${senderId}, Botón: ${clickedButtonPayload}`);
  broadcastLog('WELCOME_AD', `Usuario hizo clic en anuncio de bienvenida (payload: ${clickedButtonPayload})`);

  if (supabase) {
    try {
      const { data: existingCustomer } = await supabase.from('customers').select('id').eq('instagram_id', senderId).single();
      if (!existingCustomer) {
        await supabase.from('customers').insert({ instagram_id: senderId, source: 'welcome_message_ad', welcome_flow_payload: clickedButtonPayload, created_at: new Date().toISOString() });
      } else {
        await supabase.from('customers').update({ source: 'welcome_message_ad', welcome_flow_payload: clickedButtonPayload }).eq('id', existingCustomer.id);
      }
    } catch (err) { console.error('❌ Error registrando cliente de Welcome Message Ad:', err.message); }
  }

  if (clickedButtonPayload) {
    const matchingFlow = state.flowsConfig.flows.find(f => f.keywords && f.keywords.includes(clickedButtonPayload));
    if (matchingFlow && matchingFlow.steps) {
      console.log(`▶️ Ejecutando flujo para Welcome Message Ad: ${matchingFlow.name}`);
      const profile = await meta.getUserProfile(senderId);
      const senderName = profile?.name || senderId;
      matchingFlow.executionCount = (matchingFlow.executionCount || 0) + 1;
      matchingFlow.lastExecutedAt = new Date().toISOString();
      flow.saveFlowsConfig().catch(err => console.warn('⚠️ Error guardando ejecución de Welcome Message Ad (no-bloqueante):', err.message));
      await flow.processFlowSteps(matchingFlow.steps, senderId, senderName);
    }
  }
}

module.exports = {
  handleMessage,
  handleComment,
  handleMention,
  handleMessageEcho,
  handleDeliveryConfirmation,
  handleReadReceipt,
  handleTypingIndicator,
  handlePostback,
  handleMessageReaction,
  handleStoryReaction,
  handleAttachments,
  handleLocation,
  handleShare,
  handleLiveLocation,
  handleUserReferral,
  handleAccountLinking,
  handleHandoverProtocol,
  handleOptIn,
  handlePayment,
  handleSponsoredMessage,
  handlePolicyEnforcement,
  handleMessageTags,
  handleMessagingHandover,
  handleWelcomeMessageAd,
};
