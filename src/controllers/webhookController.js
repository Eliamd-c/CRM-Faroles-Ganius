'use strict';

const chatService = require('../services/chatService');

// ─── GET /webhook — Verificación de Meta ──────────────────────────────────────
function verify(req, res) {
  const mode      = req.query['hub.mode'];
  const challenge = req.query['hub.challenge'];
  const token     = req.query['hub.verify_token'];

  const expectedToken = process.env.VERIFY_TOKEN || process.env.WEBHOOK_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('✅ Webhook verificado por Meta.');
    return res.status(200).send(challenge);
  }
  console.warn('⚠️  Intento de verificación de webhook fallido.');
  return res.sendStatus(403);
}

// ─── POST /webhook — Recepción de eventos en tiempo real ──────────────────────
function receive(req, res) {
  const body = req.body;

  // Responder a Meta INMEDIATAMENTE para evitar reintentos por timeout
  res.sendStatus(200);

  if (body.object !== 'instagram') return;

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      // Procesar en background sin bloquear el event loop
      setImmediate(() => chatService.processIncomingEvent(event));
    }
  }
}

module.exports = { verify, receive };
