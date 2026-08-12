require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const multer = require('multer');
const supabase = require('./db');

// ─── Constantes de configuración ───
const MASTER_CONTEXT_PATH = path.join(__dirname, 'Agente_IA_Faroles_Genius_Contexto_Maestro_Oficial.md');

// ─── Módulos extraídos ───
const { state, broadcastLog } = require('./src/shared');
const meta = require('./src/services/meta.service');
const openai = require('./src/services/openai.service');
const flowService = require('./src/services/flow.service');
const { syncFlowsFromSupabase } = require('./src/services/flow.sync');
const handlers = require('./src/handlers/webhook.handlers');

// ─── Clean Architecture Bootstrap ───
const bootstrap = require('./src/infrastructure/bootstrap');

// ─── Status Monitor ───
const StatusMonitor = require('./src/services/status-monitor');
const statusMonitor = new StatusMonitor();

// ─── Inicialización de estado ───
const { PAGE_ACCESS_TOKEN, VERIFY_TOKEN, PORT = 3000, INSTAGRAM_ACCESS_TOKEN } = process.env;
state.ACCESS_TOKEN = INSTAGRAM_ACCESS_TOKEN || PAGE_ACCESS_TOKEN;
state.INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;

// Cargar configuración de base de datos (DESHABILITADO PARA FORZAR USO DE .ENV)
/*
(async () => {
  try {
    if (supabase) {
      const { data, error } = await supabase.from('app_config').select('*').in('key', ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_ACCOUNT_ID']);
      if (!error && data && data.length > 0) {
        const tokenConfig = data.find(d => d.key === 'INSTAGRAM_ACCESS_TOKEN');
        const idConfig = data.find(d => d.key === 'INSTAGRAM_ACCOUNT_ID');
        if (tokenConfig) state.ACCESS_TOKEN = tokenConfig.value;
        if (idConfig) state.INSTAGRAM_ACCOUNT_ID = idConfig.value;
        console.log('✅ Configuración de Instagram OAuth cargada desde la base de datos');
      }
    }
  } catch (err) {
    console.error('⚠️ No se pudo cargar la configuración desde Supabase:', err.message);
  }
})();
*/

// Cargar contexto maestro IA
try {
  state.AI_MASTER_CONTEXT = fs.readFileSync(MASTER_CONTEXT_PATH, 'utf8');
  console.log(`🧠 Contexto maestro cargado (${state.AI_MASTER_CONTEXT.length} caracteres / ~${Math.round(state.AI_MASTER_CONTEXT.length / 4)} tokens)`);
  const splitIdx = state.AI_MASTER_CONTEXT.indexOf('## 5. HISTORIAS DE ÉXITO');
  state.AI_BASE_PERSONA = splitIdx !== -1 ? state.AI_MASTER_CONTEXT.substring(0, splitIdx) : state.AI_MASTER_CONTEXT;
} catch (err) {
  console.warn('⚠️ Contexto maestro no encontrado. El agente usará prompt genérico.');
}

// ⚠️ IMPORTANTE: flows.json se carga PRIMERO como estado temporal.
// Luego loadFlowsFromSupabase() decidirá si usar Supabase (fuente de verdad)
// o mantener flows.json si Supabase está vacío.
console.log('📋 Cargando configuración inicial de flujos...');
flowService.loadFlowsFromFile();

// ─── Inicializar Clean Architecture DI Container ───
const di = bootstrap({
  state,
  flowsConfig: state.flowsConfig,
  supabaseClient: supabase,
  broadcastLog,
  recentReplies: state.recentReplies
});
console.log('✅ Clean Architecture initialized (Gateways + UseCases)');
// Único punto de verdad para pausar/reanudar el bot (sella bot_paused_at/reason)
const supabaseGateway = di.gateways.supabaseGateway;

// ─── Express setup ───
const app = express();
app.set('trust proxy', true);
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Auth middleware ───
function requireAuth(req, res, next) {
  if (req.path === '/webhook' || req.path === '/chat-init' || req.path === '/status' || req.path === '/status/detailed') return next();
  const validToken = process.env.API_SECRET;
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Falta Token de Autorización' });
  }
  const token = authHeader.split(' ')[1];
  if (token !== validToken) return res.status(403).json({ error: 'Token Inválido' });
  next();
}
app.use('/api', requireAuth);

// ─── Multer (file upload) ───
const ALLOWED_MIME_TYPES = {
  'image/jpeg': true, 'image/png': true, 'image/gif': true, 'image/webp': true,
  'audio/mpeg': true, 'audio/ogg': true, 'audio/wav': true, 'audio/mp4': true, 'audio/aac': true,
  'video/mp4': true, 'video/quicktime': true, 'video/webm': true, 'video/mpeg': true,
  'application/pdf': true, 'application/msword': true,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
  'application/vnd.ms-excel': true,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true,
  'application/zip': true, 'application/x-zip-compressed': true,
};
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const prefix = file.mimetype.startsWith('audio/') ? 'audio-'
                 : file.mimetype.startsWith('video/') ? 'video-'
                 : file.mimetype === 'application/pdf' ? 'file-' : 'img-';
    cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage, limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES[file.mimetype]) cb(null, true);
    else cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
  }
});

// ─── SSE (Server-Sent Events) ───
app.get('/stream', (req, res) => {
  if (req.query.token !== process.env.API_SECRET) return res.status(403).json({ error: 'Token inválido' });
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const clientId = Date.now();
  const newClient = { id: clientId, res };
  state.sseClients.push(newClient);
  res.write(`data: ${JSON.stringify({ type: 'SYSTEM', message: 'Conectado al monitor de eventos', timestamp: Date.now() })}\n\n`);
  if (state.BOT_USERNAME) {
    res.write(`data: ${JSON.stringify({ type: 'SYSTEM', message: `Bot configurado como: @${state.BOT_USERNAME}`, timestamp: Date.now() })}\n\n`);
  }
  const heartbeat = setInterval(() => { res.write(`:\n\n`); }, 30000);
  req.on('close', () => {
    clearInterval(heartbeat);
    state.sseClients = state.sseClients.filter(c => c.id !== clientId);
  });
});

// ═══════════════════════════════════════════════
// WEBHOOK ROUTES
// ═══════════════════════════════════════════════
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verificado por Meta');
    return res.status(200).send(challenge);
  }
  console.warn('❌ Verificación fallida — token incorrecto');
  res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const appSecret = (process.env.META_APP_SECRET || '').trim();
  if (appSecret && signature) {
    const expectedSignature = 'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');
    if (signature !== expectedSignature) {
      console.warn('⚠️ Firma de webhook inválida (NO BLOQUEANTE)');
    }
  }
  res.sendStatus(200);
  const body = req.body;
  if (body.object !== 'instagram') return;

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      if (event.message?.is_echo) await handlers.handleMessageEcho(event);
      else if (event.delivery) await handlers.handleDeliveryConfirmation(event);
      else if (event.read) await handlers.handleReadReceipt(event);
      else if (event.typing) await handlers.handleTypingIndicator(event);
      else if (event.referral?.ref && event.referral.ref.includes('welcome')) await handlers.handleWelcomeMessageAd(event);
      else if (event.postback) {
        const payload = event.postback.payload || '';
        try {
          console.log(`[Router] Postback detectado (${payload}), intentando LangGraph...`);
          const timeoutMs = 8000;
          let timeoutId;
          const abortController = new AbortController();
          
          const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
              abortController.abort();
              reject(new Error('LangGraph Timeout'));
            }, timeoutMs);
          });

          const langGraphExecution = di.handleMessage.execute({
            senderId: event.sender.id,
            text: payload,
            storyMention: false,
            hasAttachments: false,
            event: event,
            isPostback: true,
            signal: abortController.signal
          });

          await Promise.race([langGraphExecution, timeoutPromise])
            .finally(() => clearTimeout(timeoutId));

        } catch (err) {
          console.warn(`[Fallback] LangGraph falló para postback (${payload}). Usando flujo estático. Error: ${err.message}`);
          await handlers.handlePostback(event);
        }
      }
      else if (event.message?.reaction) await handlers.handleMessageReaction(event);
      else if (event.message?.attachments) await handlers.handleAttachments(event);
      else if (event.message?.location) await handlers.handleLocation(event);
      else if (event.message?.shares) await handlers.handleShare(event);
      else if (event.message?.live_location) await handlers.handleLiveLocation(event);
      else if (event.referral) await handlers.handleUserReferral(event);
      else if (event.account_linking) await handlers.handleAccountLinking(event);
      else if (event.pass_thread_control) await handlers.handleHandoverProtocol(event);
      else if (event.opt_in) await handlers.handleOptIn(event);
      else if (event.payment) await handlers.handlePayment(event);
      else if (event.sponsored_message) await handlers.handleSponsoredMessage(event);
      else if (event.message_edit) { /* no-op */ }
      else if (event.message?.text || event.message?.quick_reply) {
        // ✅ PHASE 3: Clean Architecture (Direct handler execution)
        try {
          await di.handleMessage.execute({
            senderId: event.sender.id,
            text: event.message?.text || event.message?.quick_reply?.payload || '',
            storyMention: false,
            hasAttachments: !!event.message?.attachments,
            event: event
          });
        } catch (err) {
          console.error('[Handler Message] Error:', err.message);
        }
      }
    }
    for (const change of entry.changes || []) {
      if (change.field === 'comments') {
        // ✅ PHASE 3: Clean Architecture (Direct handler execution)
        try {
          await handlers.handleComment(change.value);
        } catch (err) {
          console.error('[Handler Comment] Error:', err.message);
        }
      }
      else if (change.field === 'live_comments') { /* handleLiveComment */ }
      else if (change.field === 'mentions') await handlers.handleMention(change.value);
      else if (change.field === 'story_reactions') await handlers.handleStoryReaction(change.value);
      else if (change.field === 'messaging_policy_enforcement') handlers.handlePolicyEnforcement(change.value);
      else if (change.field === 'message_template_quality_update') handlers.handleMessageTags(change.value);
      else if (change.field === 'messaging_handover') handlers.handleMessagingHandover(change.value);
    }
  }
});

// ═══════════════════════════════════════════════
// HEALTH CHECK & STATUS ENDPOINTS
// ═══════════════════════════════════════════════

// Status Endpoint - Real connection status
app.get('/api/status', (req, res) => {
  const status = statusMonitor.getHealthCheck();
  res.status(200).json(status);
});

// Detailed Status (Admin)
app.get('/api/status/detailed', (req, res) => {
  res.json(statusMonitor.getFullStatus());
});

// Health Check Endpoint
app.get('/health/builder', (req, res) => {
  const status = statusMonitor.getHealthCheck();
  res.status(200).json({
    status: 'HEALTHY',
    timestamp: new Date().toISOString(),
    message: status.message,
    configured: status.details.configured,
    connected: status.details.instagramConnected
  });
});

// ═══════════════════════════════════════════════
// FLOW BUILDER API
// ═══════════════════════════════════════════════
app.get('/api/flows', (req, res) => res.json(state.flowsConfig));

// ═══════════════════════════════════════════════
// LANGGRAPH API
// ═══════════════════════════════════════════════
const langgraphRoutes = require('./src/routes/langgraphRoutes')(di);
app.use('/api/langgraph', requireAuth, langgraphRoutes);

// ═══════════════════════════════════════════════
// AI INSTRUCTIONS API (Dynamic Instructions with Caching)
// ═══════════════════════════════════════════════
// IMPORTANTE: el registro debe ser SÍNCRONO. Dentro de un IIFE async, el primer
// `await` cede el control y app.use() termina corriendo después de app.listen(),
// dejando /api/ai en 404. El constructor de InstructionService no necesita await:
// los overrides se leen del gateway bajo demanda (OverrideInstructionStrategy).
try {
  const InstructionOverridesGateway = require('./src/adapters/gateways/InstructionOverridesGateway');
  const { getInstance: getInstructionService } = require('./src/domain/services/InstructionService.instance');

  const instructionOverridesGateway = new InstructionOverridesGateway(supabase);

  // Se pasa el PROVEEDOR del singleton, no una instancia nueva: el CRM y el
  // agente deben compartir el mismo servicio, o invalidar el cache desde el CRM
  // no tendría efecto sobre las respuestas del agente.
  const aiInstructionsRoutes = require('./src/routes/aiInstructionsRoutes')(
    instructionOverridesGateway,
    getInstructionService
  );
  app.use('/api/ai', requireAuth, aiInstructionsRoutes);

  console.log('✅ AI Instructions API initialized with caching');
} catch (err) {
  console.error('⚠️ Failed to initialize AI Instructions API:', err.message);
  console.error('    Instructions API will be unavailable');
}

app.get('/api/instagram/media', async (req, res) => {
  try {
    if (!state.ACCESS_TOKEN) return res.status(503).json({ error: 'No access token configured' });
    const r = await axios.get(`${state.GRAPH_API}/me/media`, {
      params: { fields: 'id,media_type,thumbnail_url,media_url,caption,timestamp,permalink', limit: 12, access_token: state.ACCESS_TOKEN }
    });
    res.json(r.data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/flows', async (req, res) => {
  try {
    const incoming = req.body;
    if (!incoming.defaultFlow && state.flowsConfig.defaultFlow) incoming.defaultFlow = state.flowsConfig.defaultFlow;
    if (!incoming.welcomeFlow && state.flowsConfig.welcomeFlow) incoming.welcomeFlow = state.flowsConfig.welcomeFlow;
    const incomingIds = new Set((incoming.flows || []).map(f => f.id));
    const merged = state.flowsConfig.flows.filter(f => !incomingIds.has(f.id));
    const now = new Date().toISOString();
    for (const f of (incoming.flows || [])) {
      const existing = state.flowsConfig.flows.find(e => e.id === f.id);
      merged.push({ ...(existing || {}), ...f, enabled: existing ? existing.enabled : (f.enabled !== false), createdAt: existing?.createdAt || now, updatedAt: now });
    }
    incoming.flows = merged;
    state.flowsConfig = incoming;
    await flowService.saveFlowsConfig();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to save' }); }
});

app.get('/api/flows/:id', (req, res) => {
  const flow = state.flowsConfig.flows.find(f => f.id === req.params.id);
  if (!flow) return res.status(404).json({ error: 'Flow not found' });
  res.json(flow);
});

app.patch('/api/flows/:id', async (req, res) => {
  try {
    const idx = state.flowsConfig.flows.findIndex(f => f.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Flow not found' });
    const allowed = ['name', 'enabled', 'keywords', 'matchType', 'steps'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) state.flowsConfig.flows[idx][key] = req.body[key];
    }
    state.flowsConfig.flows[idx].updatedAt = new Date().toISOString();
    await flowService.saveFlowsConfig();
    res.json(state.flowsConfig.flows[idx]);
  } catch (err) { res.status(500).json({ error: 'Failed to update flow' }); }
});

app.delete('/api/flows/:id', async (req, res) => {
  try {
    const idx = state.flowsConfig.flows.findIndex(f => f.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Flow not found' });
    state.flowsConfig.flows.splice(idx, 1);
    await flowService.saveFlowsConfig();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to delete flow' }); }
});

app.post('/api/flows/:id/duplicate', async (req, res) => {
  try {
    const original = state.flowsConfig.flows.find(f => f.id === req.params.id);
    if (!original) return res.status(404).json({ error: 'Flow not found' });
    const clone = JSON.parse(JSON.stringify(original));
    clone.id = 'flow_' + Date.now();
    clone.name = (original.name || 'Flow') + ' (Copia)';
    clone.enabled = false;
    clone.createdAt = new Date().toISOString();
    clone.updatedAt = new Date().toISOString();
    state.flowsConfig.flows.push(clone);
    await flowService.saveFlowsConfig();
    res.json(clone);
  } catch (err) { res.status(500).json({ error: 'Failed to duplicate flow' }); }
});

// ═══════════════════════════════════════════════
// WELCOME MESSAGE FLOWS (Meta API)
// ═══════════════════════════════════════════════

function validateWelcomeFlowPayload(data) {
  const { name, message_text, quick_replies } = data;
  if (!name || name.trim().length === 0) return { valid: false, error: 'Nombre requerido' };
  if (name.length > 100) return { valid: false, error: 'Nombre muy largo (máx 100 caracteres)' };
  if (!message_text || message_text.trim().length === 0) return { valid: false, error: 'Mensaje requerido' };
  if (message_text.length > 2000) return { valid: false, error: 'Mensaje muy largo (máx 2000 caracteres)' };
  if (quick_replies && Array.isArray(quick_replies)) {
    if (quick_replies.length > 13) return { valid: false, error: 'Máximo 13 botones permitidos (Meta límite)' };
    for (const qr of quick_replies) {
      if (!qr.title || qr.title.trim().length === 0) return { valid: false, error: 'Título de botón requerido' };
      if (qr.title.length > 20) return { valid: false, error: 'Título de botón muy largo (máx 20 caracteres)' };
      if (!qr.payload || qr.payload.trim().length === 0) return { valid: false, error: 'Payload de botón requerido' };
      if (qr.payload.length > 1000) return { valid: false, error: 'Payload de botón muy largo (máx 1000 caracteres)' };
    }
  }
  return { valid: true };
}

app.get('/api/welcome-flows', requireAuth, async (req, res) => {
  try {
    if (!state.ACCESS_TOKEN) return res.status(503).json({ error: 'No access token configured' });
    const response = await axios.get(`https://graph.instagram.com/v26.0/me/welcome_message_flows`, { params: { access_token: state.ACCESS_TOKEN } });
    const mapped = (response.data.data || []).map(flow => {
      let wm = flow.welcome_message;
      if (typeof wm === 'string') { try { wm = JSON.parse(wm); } catch(e){} }
      const msgObj = Array.isArray(wm) ? wm[0]?.message : (wm?.message || wm);
      return { id: flow.id, name: flow.name, message_text: msgObj?.text || '', quick_replies: msgObj?.quick_replies || [], is_used_in_ad: flow.is_used_in_ad || false, created_at: flow.last_update_time || new Date().toISOString() };
    });
    res.json(mapped);
  } catch (err) { res.status(500).json({ error: 'Failed to get welcome flows from Meta' }); }
});

app.post('/api/welcome-flows', requireAuth, express.json(), async (req, res) => {
  try {
    const validation = validateWelcomeFlowPayload(req.body);
    if (!validation.valid) return res.status(400).json({ error: validation.error });

    if (!state.ACCESS_TOKEN) return res.status(503).json({ error: 'No access token configured' });
    const { name, message_text, quick_replies } = req.body;
    const metaPayload = {
      eligible_platforms: ['instagram'], name,
      welcome_message_flow: [{ message: { text: message_text, quick_replies: (quick_replies || []).map(qr => ({ content_type: 'text', title: qr.title, payload: qr.payload })) } }]
    };
    const response = await axios.post(`https://graph.instagram.com/v26.0/me/welcome_message_flows`, metaPayload, { params: { access_token: state.ACCESS_TOKEN } });
    res.json({ success: true, flow_id: response.data.flow_id });
  } catch (err) { res.status(500).json({ error: err?.response?.data?.error?.message || 'Failed to create welcome flow in Meta' }); }
});

app.patch('/api/welcome-flows/:id', requireAuth, express.json(), async (req, res) => {
  try {
    const validation = validateWelcomeFlowPayload(req.body);
    if (!validation.valid) return res.status(400).json({ error: validation.error });

    if (!state.ACCESS_TOKEN) return res.status(503).json({ error: 'No access token configured' });
    const { name, message_text, quick_replies } = req.body;
    const params = new URLSearchParams();
    params.append('access_token', state.ACCESS_TOKEN);
    params.append('flow_id', req.params.id);
    if (name) params.append('name', name);
    if (message_text) {
      const welcome_message_flow = [{ message: { text: message_text, quick_replies: (quick_replies || []).map(qr => ({ content_type: 'text', title: qr.title, payload: qr.payload })) } }];
      params.append('welcome_message_flow', JSON.stringify(welcome_message_flow));
    }
    await axios.post(`https://graph.instagram.com/v26.0/me/welcome_message_flows`, params);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err?.response?.data?.error?.message || 'Failed to update welcome flow in Meta' }); }
});

app.delete('/api/welcome-flows/:id', requireAuth, async (req, res) => {
  try {
    if (!state.ACCESS_TOKEN) return res.status(503).json({ error: 'No access token configured' });
    await axios.delete(`https://graph.instagram.com/v26.0/me/welcome_message_flows`, { params: { access_token: state.ACCESS_TOKEN, flow_id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err?.response?.data?.error?.message || 'Failed to delete welcome flow in Meta' }); }
});

// ═══════════════════════════════════════════════
// FILE UPLOAD
// ═══════════════════════════════════════════════
app.post('/api/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => { if (err) return res.status(400).json({ error: err.message }); next(); });
}, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  res.json({ url: `${protocol}://${host}/uploads/${req.file.filename}`, mimetype: req.file.mimetype, originalname: req.file.originalname });
});

// ═══════════════════════════════════════════════
// AI API
// ═══════════════════════════════════════════════
app.get('/api/ai/status', (req, res) => res.json({ configured: !!process.env.OPENAI_API_KEY }));

app.post('/api/ai/improve-text', express.json(), async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Texto requerido' });
  if (text.length > 2000) return res.status(400).json({ error: 'Texto demasiado largo (máx 2000 caracteres)' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Falta configurar OPENAI_API_KEY' });
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un experto en copywriting para chatbots y marketing. Mejora el texto para hacerlo más persuasivo, claro y amigable para WhatsApp/Instagram. Mantén la esencia original, corrige ortografía si es necesario, y puedes añadir emojis pertinentes. Solo devuelve el texto mejorado.' },
        { role: 'user', content: text }
      ], temperature: 0.7, max_tokens: 300
    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 15000 });
    const improvedText = response?.data?.choices?.[0]?.message?.content?.trim();
    if (!improvedText) throw new Error('Respuesta vacía de OpenAI');
    res.json({ text: improvedText });
  } catch (error) { res.status(500).json({ error: 'Error al procesar el texto con IA' }); }
});

app.post('/api/ai/generate-flow', express.json(), async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt requerido' });
  if (prompt.length > 2000) return res.status(400).json({ error: 'Prompt demasiado largo' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Falta configurar OPENAI_API_KEY' });
  try {
    const systemInstruction = `Eres un experto diseñador de Chatbots. El usuario pedirá que crees un flujo de conversación. Debes generar un objeto JSON estricto con dos arreglos: "nodes" y "connections".
Tipos de nodo ('type'): 'trigger', 'message', 'action', 'input', 'condition', 'delay', 'ai_agent'.
Formato de "connections": [{ "from": "1", "to": "2" }]
Devuelve ÚNICAMENTE el JSON válido.`;
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o', response_format: { type: "json_object" },
      messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: prompt }],
      temperature: 0.2, max_tokens: 1500
    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 15000 });
    const parsedJSON = JSON.parse(response?.data?.choices?.[0]?.message?.content?.trim());
    if (!parsedJSON?.nodes || !Array.isArray(parsedJSON.nodes)) throw new Error('Estructura JSON inválida');
    res.json(parsedJSON);
  } catch (error) { res.status(500).json({ error: 'Error al generar flujo con IA' }); }
});

app.get('/api/media-catalog', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase no conectado' });
  try {
    const { data, error } = await supabase.from('media_catalog').select('*').eq('active', true).order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Error al obtener el catálogo de media' }); }
});

app.post('/api/ai/learn', express.json(), async (req, res) => {
  if (!supabase || !process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Configuración incompleta' });
  try {
    const { question, answer } = req.body;
    if (!question || !answer) return res.status(400).json({ error: 'Faltan datos (question, answer)' });
    const embedRes = await axios.post('https://api.openai.com/v1/embeddings', { input: question, model: 'text-embedding-3-small' }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }, timeout: 15000 });
    const { error } = await supabase.from('learned_responses').insert({ question, answer, embedding: embedRes.data.data[0].embedding });
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Error al guardar aprendizaje' }); }
});

app.get('/api/ai/master-context', (req, res) => res.json({ context: state.AI_MASTER_CONTEXT }));

app.post('/api/ai/master-context', express.json(), async (req, res) => {
  const { context } = req.body;
  if (!context) return res.status(400).json({ error: 'Contexto vacío' });
  try {
    await fs.promises.writeFile(MASTER_CONTEXT_PATH, context, 'utf8');
    state.AI_MASTER_CONTEXT = context;
    const splitIdx = state.AI_MASTER_CONTEXT.indexOf('## 5. HISTORIAS DE ÉXITO');
    state.AI_BASE_PERSONA = splitIdx !== -1 ? state.AI_MASTER_CONTEXT.substring(0, splitIdx) : state.AI_MASTER_CONTEXT;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Error al guardar el contexto maestro' }); }
});

app.get('/api/ai/learned', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'No DB' });
  try { const { data, error } = await supabase.from('learned_responses').select('id, question, answer, created_at').order('created_at', { ascending: false }); if (error) throw error; res.json(data); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/ai/learned/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'No DB' });
  try { const { error } = await supabase.from('learned_responses').delete().eq('id', req.params.id); if (error) throw error; res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/ai/knowledge', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'No DB' });
  try { const { data, error } = await supabase.from('ai_knowledge').select('id, section_title, content, created_at').order('created_at', { ascending: false }); if (error) throw error; res.json(data); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/ai/knowledge', express.json(), async (req, res) => {
  if (!supabase || !process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Configuración incompleta' });
  try {
    const { section_title, content } = req.body;
    if (!section_title || !content) return res.status(400).json({ error: 'Faltan datos' });
    const embedRes = await axios.post('https://api.openai.com/v1/embeddings', { input: `${section_title}\n${content}`, model: 'text-embedding-3-small' }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }, timeout: 15000 });
    const { error } = await supabase.from('ai_knowledge').insert({ section_title, content, embedding: embedRes.data.data[0].embedding });
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/ai/knowledge/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'No DB' });
  try { const { error } = await supabase.from('ai_knowledge').delete().eq('id', req.params.id); if (error) throw error; res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/ai/analytics', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'No DB' });
  try {
    const { data, error } = await supabase.from('ai_analytics').select('*').order('created_at', { ascending: false }).limit(1000);
    if (error) throw error;
    let totalPrompt = 0, totalCompletion = 0, totalCached = 0, totalLatency = 0, toolCalls = 0;
    data.forEach(r => { totalPrompt += r.prompt_tokens; totalCompletion += r.completion_tokens; totalCached += r.cached_tokens; totalLatency += r.latency_ms; if (r.has_tool_call) toolCalls++; });
    res.json({
      total_requests: data.length, avg_latency_ms: data.length ? Math.round(totalLatency / data.length) : 0,
      total_prompt_tokens: totalPrompt, total_completion_tokens: totalCompletion, total_cached_tokens: totalCached,
      saved_by_cache_percent: totalPrompt ? Math.round((totalCached / totalPrompt) * 100) : 0,
      tool_calls: toolCalls, recent_events: data.slice(0, 50)
    });
  } catch (err) { res.status(500).json({ error: 'Error al obtener métricas' }); }
});

// ═══════════════════════════════════════════════
// CONTACTS & MESSAGES API
// ═══════════════════════════════════════════════
app.get('/api/contacts/:instagram_id/messages', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'No DB' });
  try {
    const { data, error } = await supabase.from('messages').select('*').eq('instagram_id', req.params.instagram_id).order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/contacts/:instagram_id/send', express.json(), async (req, res) => {
  try {
    const { instagram_id } = req.params;
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensaje vacío' });
    await meta.sendMessage(instagram_id, message);
    await supabaseGateway.pauseBot(instagram_id, 'respuesta_manual_operador');
    res.json({ success: true, message: 'Mensaje enviado y bot pausado.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/contacts/:instagram_id/toggle-bot', express.json(), async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'No DB' });
  try {
    const paused = req.body.bot_paused === true || req.body.bot_paused === 'true';
    if (paused) await supabaseGateway.pauseBot(req.params.instagram_id, 'toggle_manual_crm');
    else await supabaseGateway.resumeBot(req.params.instagram_id);
    res.json({ success: true, bot_paused: paused });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/contacts/:instagram_id/mark-read', express.json(), async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'No DB' });
  try {
    const { error } = await supabase.from('messages').update({ is_read: true }).eq('instagram_id', req.params.instagram_id).eq('direction', 'inbound').eq('is_read', false);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/contacts', async (req, res) => {
  if (!supabase) return res.json([]);
  try {
    const { search, tag, status, limit = 50, offset = 0 } = req.query;
    let query = supabase.from('customers').select('*');
    if (search) {
      const safeSearch = search.replace(/[^a-zA-Z0-9À-ÿ\s._-]/g, '');
      if (safeSearch) query = query.or(`name.ilike.%${safeSearch}%,instagram_id.ilike.%${safeSearch}%`);
    }
    if (tag) query = query.contains('tags', [tag]);
    if (status) query = query.eq('status', status);
    query = query.order('updated_at', { ascending: false }).range(Number(offset), Number(offset) + Number(limit) - 1);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    if (data && data.length > 0) {
      try {
        const igIds = data.map(c => c.instagram_id);
        const { data: msgStats } = await supabase.rpc('get_message_stats', { ig_ids: igIds });
        if (msgStats) {
          const statsMap = {};
          for (const s of msgStats) statsMap[s.instagram_id] = s;
          for (const contact of data) {
            const st = statsMap[contact.instagram_id];
            contact.message_count = st?.total || 0;
            contact.unread_count = st?.unread || 0;
            contact.last_message_at = st?.last_message_at || null;
            contact.last_message_preview = st?.last_content || null;
          }
        }
      } catch (e) { console.warn('Stats de mensajes no disponibles:', e.message); }
    }
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/contacts/count', async (req, res) => {
  if (!supabase) return res.json({ count: 0 });
  try { const { count, error } = await supabase.from('customers').select('*', { count: 'exact', head: true }); if (error) throw error; res.json({ count }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/contacts/:id', async (req, res) => {
  if (!supabase) return res.status(404).json({ error: 'No DB' });
  try { const { data, error } = await supabase.from('customers').select('*').eq('instagram_id', req.params.id).single(); if (error) return res.status(404).json({ error: 'Contacto no encontrado' }); res.json(data); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/contacts/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'No DB' });
  try {
    // bot_paused NO se acepta como campo genérico: se maneja vía pauseBot/resumeBot
    // para no romper el invariante bot_paused <-> bot_paused_at/bot_paused_reason.
    if (req.body.bot_paused !== undefined) {
      const paused = req.body.bot_paused === true || req.body.bot_paused === 'true';
      if (paused) await supabaseGateway.pauseBot(req.params.id, 'patch_contacto_crm');
      else await supabaseGateway.resumeBot(req.params.id);
    }
    const allowedFields = ['name', 'tags', 'status', 'fields'];
    const updates = {};
    for (const key of allowedFields) { if (req.body[key] !== undefined) updates[key] = req.body[key]; }
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from('customers').update(updates).eq('instagram_id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/contacts-export', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'No DB' });
  try {
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false }).limit(10000);
    if (!data || data.length === 0) return res.status(404).json({ error: 'Sin contactos' });
    const headers = ['instagram_id', 'name', 'tags', 'status', 'bot_paused', 'bot_state', 'fields', 'created_at', 'updated_at'];
    const csvRows = [headers.join(',')];
    for (const row of data) {
      csvRows.push(headers.map(h => { const val = row[h]; if (val === null || val === undefined) return ''; if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`; return `"${String(val).replace(/"/g, '""')}"`; }).join(','));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="contactos.csv"');
    res.send(csvRows.join('\n'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tags', async (req, res) => {
  if (!supabase) return res.json([]);
  try {
    const { data } = await supabase.from('customers').select('tags');
    const allTags = new Set();
    for (const row of (data || [])) { for (const tag of (row.tags || [])) allTags.add(tag); }
    res.json(Array.from(allTags).sort());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════
// SEQUENCES / DRIP CAMPAIGNS
// ═══════════════════════════════════════════════
let sequencesConfig = [];
try { sequencesConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'sequences.json'))); } catch (e) {}

async function subscribeToSequence(instagramId, sequenceId) {
  if (!supabase) return;
  const { data: existing } = await supabase.from('sequence_subscriptions').select('id').eq('instagram_id', instagramId).eq('sequence_id', sequenceId).eq('is_completed', false).eq('is_unsubscribed', false).maybeSingle();
  if (existing) return;
  const seq = sequencesConfig.find(s => s.id === sequenceId);
  if (!seq || !seq.steps || seq.steps.length === 0) return;
  const firstDelay = (seq.steps[0].delay_hours || 0) * 3600000;
  await supabase.from('sequence_subscriptions').insert([{ sequence_id: sequenceId, instagram_id: instagramId, current_step: 0, next_send_at: new Date(Date.now() + firstDelay).toISOString(), is_completed: false, is_unsubscribed: false }]);
}

// Wire up sequence subscription to flow service
flowService.setSubscribeToSequence(subscribeToSequence);

async function processSequenceScheduler() {
  if (!supabase) return;
  try {
    const { data: pending } = await supabase.from('sequence_subscriptions').select('*').eq('is_completed', false).eq('is_unsubscribed', false).lte('next_send_at', new Date().toISOString()).limit(50);
    if (!pending || pending.length === 0) return;
    for (const sub of pending) {
      const seq = sequencesConfig.find(s => s.id === sub.sequence_id);
      if (!seq || !seq.steps) continue;
      const step = seq.steps[sub.current_step];
      if (!step) continue;
      const profile = await meta.getUserProfile(sub.instagram_id);
      const name = profile?.name || sub.instagram_id;
      if (step.steps && step.steps.length > 0) await flowService.processFlowSteps(step.steps, sub.instagram_id, name);
      const nextIdx = sub.current_step + 1;
      if (nextIdx >= seq.steps.length) {
        await supabase.from('sequence_subscriptions').update({ is_completed: true }).eq('id', sub.id);
        broadcastLog('SYSTEM', `Secuencia ${seq.name || seq.id} completada para ${name}`);
      } else {
        const nextDelay = (seq.steps[nextIdx].delay_hours || 0) * 3600000;
        await supabase.from('sequence_subscriptions').update({ current_step: nextIdx, next_send_at: new Date(Date.now() + nextDelay).toISOString() }).eq('id', sub.id);
      }
    }
  } catch (e) { console.error('[SEQUENCES] Error en scheduler:', e.message); }
}
setInterval(processSequenceScheduler, 60_000);

app.get('/api/sequences', (req, res) => res.json(sequencesConfig));
app.post('/api/sequences', async (req, res) => {
  try { sequencesConfig = req.body; await fs.promises.writeFile(path.join(__dirname, 'sequences.json'), JSON.stringify(sequencesConfig, null, 2)); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════
// BROADCASTS
// ═══════════════════════════════════════════════
const BROADCASTS_FILE = path.join(__dirname, 'broadcasts.json');
let activeBroadcasts = {};
function loadBroadcasts() { try { if (fs.existsSync(BROADCASTS_FILE)) activeBroadcasts = JSON.parse(fs.readFileSync(BROADCASTS_FILE, 'utf8')); } catch (e) {} }
function saveBroadcasts() { try { fs.writeFileSync(BROADCASTS_FILE, JSON.stringify(activeBroadcasts, null, 2)); } catch (e) {} }
loadBroadcasts();

app.post('/api/broadcasts', async (req, res) => {
  const { name, message_steps, recipient_filter, scheduled_at } = req.body;
  const id = 'bc_' + Date.now();
  const broadcast = { id, name, message_steps, recipient_filter, scheduled_at, status: scheduled_at ? 'scheduled' : 'sending', total: 0, sent: 0, failed: 0, created_at: new Date().toISOString() };
  activeBroadcasts[id] = broadcast;
  saveBroadcasts();
  if (!scheduled_at) executeBroadcast(broadcast);
  res.json(broadcast);
});
app.get('/api/broadcasts', (req, res) => res.json(Object.values(activeBroadcasts)));

async function executeBroadcast(broadcast) {
  if (!supabase) { broadcast.status = 'failed'; return; }
  try {
    let query = supabase.from('customers').select('instagram_id, name');
    const filter = broadcast.recipient_filter;
    if (filter?.tags?.length > 0) query = query.contains('tags', filter.tags);
    const { data: recipients } = await query;
    if (!recipients) { broadcast.status = 'failed'; return; }
    broadcast.total = recipients.length;
    broadcast.status = 'sending';
    broadcastLog('SYSTEM', `Broadcast "${broadcast.name}" iniciado: ${recipients.length} destinatarios`);
    for (const { instagram_id, name } of recipients) {
      try { await flowService.processFlowSteps(broadcast.message_steps || [], instagram_id, name || instagram_id); broadcast.sent++; }
      catch (e) { broadcast.failed++; }
      await new Promise(r => setTimeout(r, 100));
    }
    broadcast.status = 'completed';
    broadcast.completed_at = new Date().toISOString();
    saveBroadcasts();
    broadcastLog('SYSTEM', `Broadcast "${broadcast.name}" completado: ${broadcast.sent}/${broadcast.total} enviados`);
  } catch (e) { broadcast.status = 'failed'; saveBroadcasts(); }
}
setInterval(() => {
  const now = new Date();
  for (const bc of Object.values(activeBroadcasts)) {
    if (bc.status === 'scheduled' && bc.scheduled_at && new Date(bc.scheduled_at) <= now) { executeBroadcast(bc); saveBroadcasts(); }
  }
}, 60_000);

// ═══════════════════════════════════════════════
// MISC API
// ═══════════════════════════════════════════════
app.get('/api/welcome-flow', (req, res) => res.json(state.flowsConfig.welcomeFlow || { steps: [] }));
app.post('/api/welcome-flow', async (req, res) => {
  try { state.flowsConfig.welcomeFlow = req.body; await flowService.saveFlowsConfig(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

const INSTAGRAM_HANDLE = process.env.INSTAGRAM_HANDLE || '';
app.get('/api/widget-config', (req, res) => {
  res.json({ instagram_handle: INSTAGRAM_HANDLE, chat_url: INSTAGRAM_HANDLE ? `https://ig.me/m/${INSTAGRAM_HANDLE}` : null, flows: state.flowsConfig.flows.map(f => ({ id: f.id, name: f.name })) });
});
app.get('/chat-init', (req, res) => {
  if (!INSTAGRAM_HANDLE) return res.status(400).json({ error: 'INSTAGRAM_HANDLE no configurado' });
  res.redirect(`https://ig.me/m/${INSTAGRAM_HANDLE}`);
});

app.get('/api/comment-triggers', (req, res) => res.json(state.flowsConfig.commentTriggers || []));
app.post('/api/comment-triggers', async (req, res) => {
  try { state.flowsConfig.commentTriggers = req.body; await flowService.saveFlowsConfig(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/mention-flow', (req, res) => res.json(state.flowsConfig.mentionFlow || { steps: [] }));
app.post('/api/mention-flow', async (req, res) => {
  try { state.flowsConfig.mentionFlow = req.body; await flowService.saveFlowsConfig(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════
// AUTH / OAUTH
// ═══════════════════════════════════════════════
/*
app.get('/auth/instagram', (req, res) => {
  const host = req.get('host');
  const redirectUri = process.env.META_REDIRECT_URI || `${req.protocol}://${host}/auth/callback`;
  res.redirect(`https://www.facebook.com/v21.0/dialog/oauth?client_id=${process.env.META_APP_ID}&display=page&extras={"setup":{"channel":"IG_API"}}&redirect_uri=${redirectUri}&response_type=code&scope=instagram_basic,instagram_manage_messages,instagram_manage_comments,pages_show_list,pages_read_engagement`);
});

app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send('Error: Código de autorización no proporcionado.');
  try {
    const host = req.get('host');
    const redirectUri = process.env.META_REDIRECT_URI || `${req.protocol}://${host}/auth/callback`;
    const tokenRes = await axios.get(`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${process.env.META_APP_ID}&redirect_uri=${redirectUri}&client_secret=${process.env.META_APP_SECRET}&code=${code}`);
    let userToken = tokenRes.data.access_token;
    const longRes = await axios.get(`https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${userToken}`);
    if (longRes.data?.access_token) userToken = longRes.data.access_token;
    const pagesRes = await axios.get(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${userToken}`);
    const page = pagesRes.data.data.find(p => p.instagram_business_account) || pagesRes.data.data[0];
    if (!page) return res.send('Error: No se encontró una página de Facebook asociada.');
    const igAccountId = page.instagram_business_account?.id;
    const longToken = page.access_token || userToken;
    if (supabase) {
      await supabase.from('app_config').upsert({ key: 'INSTAGRAM_ACCESS_TOKEN', value: longToken, updated_at: new Date() });
      if (igAccountId) await supabase.from('app_config').upsert({ key: 'INSTAGRAM_ACCOUNT_ID', value: igAccountId, updated_at: new Date() });
    }
    state.ACCESS_TOKEN = longToken;
    if (igAccountId) state.INSTAGRAM_ACCOUNT_ID = igAccountId;
    res.send('<div style="font-family:sans-serif;text-align:center;padding:50px;"><h1 style="color:#22c55e;">✅ Conexión Exitosa</h1><p>El CRM ha sido actualizado con el nuevo token OAuth 2.0.</p><script>setTimeout(()=>window.close(),3000);</script></div>');
  } catch (e) {
    const fbError = e.response?.data?.error?.message || e.message;
    res.send(`<div style="font-family:sans-serif;text-align:center;padding:50px;"><h1 style="color:red;">Error en Autenticación OAuth</h1><p>${fbError}</p></div>`);
  }
});

app.get('/api/auth/status', (req, res) => res.json({ connected: !!state.ACCESS_TOKEN }));

app.post('/api/auth/disconnect', async (req, res) => {
  try {
    state.ACCESS_TOKEN = null;
    state.INSTAGRAM_ACCOUNT_ID = null;
    if (supabase) {
      await supabase.from('app_config').delete().in('key', ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_ACCOUNT_ID']);
    }
    res.json({ success: true, message: 'Instagram desconectado exitosamente' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to disconnect Instagram', details: e.message });
  }
});
*/

// ═══════════════════════════════════════════════
// META DATA DELETION (GDPR / Platform Policy)
// ═══════════════════════════════════════════════
function parseSignedRequest(signedRequest, secret) {
  const [encodedSig, payload] = signedRequest.split('.', 2);
  const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest();
  if (!crypto.timingSafeEqual(sig, expectedSig)) throw new Error('Invalid signature');
  return data;
}

app.post('/data-deletion', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const signedRequest = req.body.signed_request;
    if (!signedRequest) return res.status(400).json({ error: 'Missing signed_request' });

    const appSecret = (process.env.META_APP_SECRET || '').trim();
    if (!appSecret) return res.status(500).json({ error: 'META_APP_SECRET not configured' });

    const data = parseSignedRequest(signedRequest, appSecret);
    const userId = data.user_id;
    const confirmationCode = 'del_' + crypto.randomBytes(10).toString('hex');

    // Delete user data from Supabase
    if (supabase && userId) {
      // Delete messages first (foreign key safety)
      await supabase.from('messages').delete().eq('instagram_id', String(userId));
      await supabase.from('customers').delete().eq('instagram_id', String(userId));
    }

    console.log(`🗑️ Data deletion processed for user ${userId} (code: ${confirmationCode})`);

    res.json({
      url: 'https://crm.farolesgenius.com/data-deletion-status',
      confirmation_code: confirmationCode
    });
  } catch (err) {
    console.error('[DATA-DELETION] Error:', err.message);
    res.status(400).json({ error: 'Invalid request' });
  }
});

app.get('/data-deletion-status', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Data Deletion Status</title></head><body style="font-family:sans-serif;text-align:center;padding:60px;"><h1>Data Deletion Confirmed</h1><p>Your data has been successfully deleted from our systems.</p><p>If you have any questions, please contact us.</p></body></html>`);
});

// ═══════════════════════════════════════════════
// SYNC & INSIGHTS
// ═══════════════════════════════════════════════
app.post('/api/sync-conversations', express.json(), async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase no conectado' });
  if (!state.ACCESS_TOKEN) return res.status(503).json({ error: 'No access token configured' });
  if (!state.INSTAGRAM_ACCOUNT_ID) return res.status(503).json({ error: 'No account ID configured' });
  try {
    const convResponse = await axios.get(`https://graph.instagram.com/v26.0/me/conversations?platform=instagram`, { params: { access_token: state.ACCESS_TOKEN } });
    const conversations = convResponse.data.data || [];
    let messagesSynced = 0;
    for (const conv of conversations) {
      try {
        const msgListRes = await axios.get(`https://graph.instagram.com/v26.0/${conv.id}`, { params: { fields: 'messages', access_token: state.ACCESS_TOKEN } });
        for (const msg of (msgListRes.data.messages?.data || [])) {
          try {
            const detailRes = await axios.get(`https://graph.instagram.com/v26.0/${msg.id}`, { params: { fields: 'id,created_time,from,to,message', access_token: state.ACCESS_TOKEN } });
            const detail = detailRes.data;
            if (!detail?.from) continue;
            const isBot = String(detail.from.id).trim() === String(state.INSTAGRAM_ACCOUNT_ID).trim();
            const customerId = isBot ? detail.to?.data?.[0]?.id : detail.from.id;
            const customerName = isBot ? detail.to?.data?.[0]?.username : detail.from.username;
            if (!customerId) continue;
            await supabase.from('customers').upsert({ instagram_id: customerId, name: customerName || 'Desconocido', platform: 'instagram' }, { onConflict: 'instagram_id' });
            await supabase.from('messages').upsert({ message_id: detail.id, customer_id: customerId, direction: isBot ? 'outbound' : 'inbound', text: detail.message || '', timestamp: detail.created_time }, { onConflict: 'message_id' });
            messagesSynced++;
          } catch (e) {}
        }
      } catch (e) {}
    }
    res.json({ success: true, conversations_checked: conversations.length, messages_synced: messagesSynced });
  } catch (err) { res.status(500).json({ error: 'Failed to sync conversations' }); }
});

app.get('/api/insights/profile', async (req, res) => {
  if (!state.ACCESS_TOKEN) return res.status(503).json({ error: 'No access token configured' });
  try {
    const response = await axios.get(`https://graph.instagram.com/v26.0/me`, { params: { fields: 'id,username,name,followers_count,follows_count,media_count,profile_picture_url', access_token: state.ACCESS_TOKEN } });
    res.json(response.data);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch profile insights' }); }
});

app.get('/api/insights/media', async (req, res) => {
  if (!state.ACCESS_TOKEN) return res.status(503).json({ error: 'No access token configured' });
  try {
    const response = await axios.get(`https://graph.instagram.com/v26.0/me/media`, { params: { fields: 'id,caption,media_type,media_url,thumbnail_url,like_count,comments_count,timestamp,permalink', limit: 12, access_token: state.ACCESS_TOKEN } });
    res.json(response.data);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch media insights' }); }
});

// ═══════════════════════════════════════════════
// FLOW BUILDER API (Clean Architecture)
// ═══════════════════════════════════════════════
const flowRoutes = require('./src/routes/flowRoutes');
app.use('/api/flows-builder', flowRoutes(di));

// ═══════════════════════════════════════════════
// ERROR HANDLER & STARTUP
// ═══════════════════════════════════════════════
app.use((err, req, res, next) => {
  console.error('[EXPRESS ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

if (!process.env.API_SECRET) {
  console.error('❌ FATAL: API_SECRET no está configurada.');
  process.exit(1);
}

// Init bot & start server
meta.initBot();

// ⚠️ ARQUITECTURA CRÍTICA: Supabase es la FUENTE DE VERDAD para flujos.
// Esta llamada sobrescribe state.flowsConfig con lo que hay en la BD.
// Si Supabase está vacío, se siembra con flows.json (safety net).
// NUNCA flows.json sobrescribe Supabase una vez que BD tiene datos.
console.log('\n🔄 Sincronizando flujos desde Supabase (BD es fuente de verdad)...');

// Paso 1 + 2: Cargar desde Supabase + sincronizar flows.json
(async () => {
  try {
    // Paso 1: Cargar desde Supabase (FUENTE DE VERDAD) ANTES de esperar sync
    await flowService.loadFlowsFromSupabase();

    const result = await syncFlowsFromSupabase(supabase);
    if (result.success && result.stats) {
      console.log(`📊 Estado de sincronización:`);
      console.log(`   Flujos en Supabase: ${result.stats.flowsInDb}`);
      console.log(`   Flujos en flows.json: ${result.stats.nowSynced}`);
      if (result.stats.onlyInDb.length > 0) {
        console.log(`   ✅ Agregados desde BD: ${result.stats.onlyInDb.length}`);
      }
      if (result.stats.onlyInFile.length > 0) {
        console.log(`   ⚠️ Descartados (solo en archivo): ${result.stats.onlyInFile.length}`);
      }
    } else if (!result.success) {
      console.warn(`⚠️ Sincronización no disponible: ${result.message}`);
    }
  } catch (err) {
    console.error(`❌ Error en sincronización: ${err.message}`);
  }

  // Validar estado final ANTES de levantar servidor
  const loadedFlows = state.flowsConfig?.flows?.length || 0;
  console.log(`🔍 Estado FINAL de flujos en memoria: ${loadedFlows} flujos`);
  if (loadedFlows === 0) {
    console.warn(`⚠️ ADVERTENCIA: state.flowsConfig está VACÍO. La UI mostrará 0 automatizaciones.`);
  }

  app.listen(PORT, async () => {
    // await meta.loadAppConfig(); // DESHABILITADO: forzar uso de tokens del archivo .env
    console.log(`🚀 CRM 2.0 Webhook escuchando en http://localhost:${PORT}/webhook`);
    console.log(`   Account ID : ${state.INSTAGRAM_ACCOUNT_ID}`);
    console.log(`   Verify Token: ${VERIFY_TOKEN}`);
  });
})();
