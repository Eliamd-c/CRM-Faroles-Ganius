// DOC consultada: https://developers.facebook.com/docs/instagram/webhooks
// Webhook handler principal - verificación + recepción de eventos

require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const multer = require('multer');
const supabase = require('./db');

// Cargar configuración de flujos (Arquitectura JSON - Fase 1)
let flowsConfig = { flows: [], defaultFlow: null };

// Cargar configuración de flujos de bienvenida (Welcome Message Ads)

try {
  let filePath = path.join(__dirname, 'flows.json');
  // Si flows.json no existe, intenta flows.json.example (para despliegues)
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'flows.json.example');
    if (fs.existsSync(filePath)) {
      console.log('ℹ️ flows.json no encontrado. Usando flows.json.example como semilla...');
    }
  }

  if (fs.existsSync(filePath)) {
    const rawData = fs.readFileSync(filePath);
    flowsConfig = JSON.parse(rawData);
    console.log('✅ Flujos cargados correctamente.');
    let migrated = false;
    for (const flow of (flowsConfig.flows || [])) {
      if (flow.enabled === undefined) { flow.enabled = true; migrated = true; }
      if (!flow.createdAt) { flow.createdAt = new Date().toISOString(); migrated = true; }
      if (!flow.updatedAt) { flow.updatedAt = new Date().toISOString(); migrated = true; }
    }
    if (migrated) {
      fs.writeFileSync(path.join(__dirname, 'flows.json'), JSON.stringify(flowsConfig, null, 2));
      console.log('✅ flows.json migrado: campos enabled/createdAt/updatedAt añadidos');
    }
  } else {
    console.warn('⚠️ flows.json ni flows.json.example encontrados. Usando configuración vacía por defecto.');
  }
} catch (err) {
  console.error('❌ Error al cargar flows.json:', err.message);
  console.warn('⚠️ Usando configuración de flujos vacía por defecto.');
}

// Fuente de verdad de los flujos: Supabase (sobrevive a los despliegues).
// flows.json queda solo como semilla inicial y respaldo local. Antes, al estar
// flows.json en git, cada despliegue lo sobreescribía y borraba los cambios
// hechos desde el Builder.
async function saveFlowsConfig() {
  let savedToDb = false;
  if (supabase) {
    try {
      const { error } = await supabase
        .from('app_flows')
        .upsert({ id: 1, config: flowsConfig, updated_at: new Date().toISOString() });
      if (!error) savedToDb = true;
      else console.error('❌ Error guardando flujos en Supabase:', error.message);
    } catch (e) {
      console.error('❌ Excepción guardando flujos en Supabase:', e.message);
    }
  }
  // Respaldo local (útil en desarrollo o si Supabase está caído).
  try {
    await fs.promises.writeFile(
      path.join(__dirname, 'flows.json'),
      JSON.stringify(flowsConfig, null, 2)
    );
  } catch (e) {
    if (!savedToDb) throw e; // si no se guardó ni en DB ni en archivo, propagar el error
  }
}

// Carga los flujos desde Supabase al arrancar. Si la tabla aún no tiene datos,
// la siembra con el contenido actual de flows.json. Ante cualquier fallo,
// conserva lo ya cargado de flows.json (degradación elegante).
async function loadFlowsFromSupabase() {
  if (!supabase) {
    console.warn('⚠️ Supabase no conectado: los flujos se leen/escriben solo en flows.json (NO persisten entre despliegues).');
    return;
  }
  try {
    const { data, error } = await supabase.from('app_flows').select('config').eq('id', 1).single();
    if (error) {
      if (error.code === 'PGRST116' || /no rows|0 rows/i.test(error.message || '')) {
        console.log('ℹ️ No hay flujos guardados en Supabase todavía. Sembrando con flows.json...');
        await saveFlowsConfig();
      } else {
        console.error('⚠️ No se pudieron cargar flujos de Supabase, se usa flows.json:', error.message);
      }
      return;
    }
    if (data && data.config && Array.isArray(data.config.flows)) {
      flowsConfig = data.config;
      console.log(`✅ Flujos cargados desde Supabase (${flowsConfig.flows.length} flujos) — persistentes entre despliegues.`);
    }
  } catch (e) {
    console.error('⚠️ Excepción cargando flujos de Supabase, se usa flows.json:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// FASE 2: Cargar Contexto Maestro del Agente IA al arrancar
// El archivo .md se lee una sola vez y se guarda en memoria.
// ⚠️ NOTA SOBRE PROMPT CACHING: La arquitectura intenta usar prompt caching,
// pero NO funciona correctamente porque el prefijo del sistema varía con cada
// mensaje (RAG + learnedContext cambian). OpenAI solo cachea prefijos idénticos.
// Solución futura: Usar caché manual o separar contexto estático de dinámico.
// ─────────────────────────────────────────────────────────────────
let AI_MASTER_CONTEXT = '';
let AI_BASE_PERSONA = ''; // FASE 6
try {
  const contextPath = path.join(__dirname, 'Agente_IA_Faroles_Genius_Contexto_Maestro.md');
  AI_MASTER_CONTEXT = fs.readFileSync(contextPath, 'utf8');
  console.log(`🧠 Contexto maestro cargado (${AI_MASTER_CONTEXT.length} caracteres / ~${Math.round(AI_MASTER_CONTEXT.length / 4)} tokens)`);
  
  const splitIdx = AI_MASTER_CONTEXT.indexOf('## 5. HISTORIAS DE ÉXITO');
  AI_BASE_PERSONA = splitIdx !== -1 ? AI_MASTER_CONTEXT.substring(0, splitIdx) : AI_MASTER_CONTEXT;
} catch (err) {
  console.warn('⚠️ Contexto maestro no encontrado. El agente usará prompt genérico. Asegúrate de que el archivo Agente_IA_Faroles_Genius_Contexto_Maestro.md existe en la raíz del proyecto.');
}

// ─────────────────────────────────────────────────────────────────
// FASE 6: Recuperación de Contexto (RAG con pgvector)
// Devuelve SOLO la parte dinámica (learned + rag). La persona base se
// inyecta aparte como primer system message para que OpenAI la cachee.
// ─────────────────────────────────────────────────────────────────
async function retrieveDynamicContext(query) {
  if (!supabase || !process.env.OPENAI_API_KEY) return '';
  try {
    const embedRes = await axios.post(
      'https://api.openai.com/v1/embeddings',
      { input: query, model: 'text-embedding-3-small' },
      { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }, timeout: 15000 }
    );
    const queryEmbedding = embedRes.data.data[0].embedding;

    // FASE 7: Buscar primero en respuestas aprendidas
    let learnedContext = '';
    const { data: learned, error: errLearned } = await supabase.rpc('match_learned_responses', {
      query_embedding: queryEmbedding,
      match_threshold: 0.85,
      match_count: 1
    });

    if (!errLearned && learned && learned.length > 0) {
      learnedContext = `\n\n=== 🚨 INSTRUCCIÓN ESTRICTA: RESPUESTA APRENDIDA DE UN HUMANO ===\nEsta es la respuesta exacta que debes dar a esta pregunta (úsala textualmente o adáptala muy ligeramente):\nPregunta: ${learned[0].question}\nRespuesta: ${learned[0].answer}\n`;
    }

    const { data: chunks, error } = await supabase.rpc('match_knowledge', {
      query_embedding: queryEmbedding,
      match_threshold: 0.30,
      match_count: 5
    });

    if (error || !chunks || chunks.length === 0) return learnedContext;

    let ragContext = '\n\n=== CONOCIMIENTO RECUPERADO (RAG) ===\nÚsalo para responder al cliente:\n';
    chunks.forEach(c => ragContext += `\n[${c.section_title}]\n${c.content}\n`);
    return learnedContext + ragContext;
  } catch (err) {
    console.error('Error en RAG:', err.message);
    return '';
  }
}

// ─────────────────────────────────────────────────────────────────
// FASE 5: Herramientas del Agente IA (Function Calling)
// ─────────────────────────────────────────────────────────────────
const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'send_product_media',
      description: 'Envía una foto o video del producto al cliente. Úsalo cuando el cliente quiera ver los faroles, el efecto vitral, o cómo se arman.',
      parameters: {
        type: 'object',
        properties: {
          media_type: { type: 'string', enum: ['image', 'video'], description: 'Tipo de media' },
          search_tags: { 
            type: 'array', items: { type: 'string' },
            description: 'Tags para buscar el media. Ej: ["encendido", "vitral", "noche"] o ["armado", "tutorial", "instrucciones"] o ["reseña", "testimonio"]'
          },
          caption: { type: 'string', description: 'Mensaje opcional que acompaña la imagen/video' }
        },
        required: ['media_type', 'search_tags']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'escalate_to_human',
      description: 'Pasa la conversación a un asesor humano. Úsalo cuando: el cliente quiere cerrar la compra, está frustrado, tiene un reclamo, o pregunta algo que no sabes.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Resumen de por qué se escala' },
          customer_summary: { type: 'string', description: 'Resumen del cliente: qué quiere, qué datos ya dio, en qué quedó la conversación' }
        },
        required: ['reason', 'customer_summary']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'save_customer_data',
      description: 'Guarda datos del cliente en su ficha (nombre, ciudad, teléfono, dirección, comunidad, interés, tamaño de pedido, etc.) y/o le agrega tags de segmentación. Úsalo cada vez que el cliente comparta información útil para futuras conversaciones o para el equipo humano.',
      parameters: {
        type: 'object',
        properties: {
          fields: {
            type: 'object',
            description: 'Pares clave-valor a guardar en customer.fields. Ejemplos de claves: "ciudad", "telefono", "direccion", "comunidad", "tamano_interes", "cantidad", "fecha_evento". Usa snake_case en las claves.',
            additionalProperties: { type: 'string' }
          },
          tags_to_add: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags que reflejan el estado del cliente. Valores válidos: "considerando", "listo_compra", "aliado_fase1", "cliente_detal", "cliente_confirmado", "pagado", "objecion_precio", "objecion_durabilidad", "interesado_kit_aliado". Usa solo los relevantes.'
          }
        }
      }
    }
  }
];

const app = express();
app.set('trust proxy', true);
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────
// Middleware de Autenticación de API
// ─────────────────────────────────────────────
function requireAuth(req, res, next) {
  // Ignorar autenticación en el webhook de instagram
  if (req.path === '/webhook' || req.path === '/chat-init') return next();

  // El token estático se lee del entorno (validado al arrancar)
  const validToken = process.env.API_SECRET;

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Falta Token de Autorización' });
  }

  const token = authHeader.split(' ')[1];
  if (token !== validToken) {
    return res.status(403).json({ error: 'Token Inválido' });
  }

  next();
}

// Proteger todas las rutas /api/
app.use('/api', requireAuth);

// Configuración de Multer (Subida de Archivos)
const ALLOWED_MIME_TYPES = {
  'image/jpeg': true, 'image/png': true, 'image/gif': true, 'image/webp': true,
  'audio/mpeg': true, 'audio/ogg': true, 'audio/wav': true, 'audio/mp4': true, 'audio/aac': true,
  'video/mp4': true, 'video/quicktime': true, 'video/webm': true, 'video/mpeg': true,
  'application/pdf': true,
  'application/msword': true,
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
                 : file.mimetype === 'application/pdf' ? 'file-'
                 : 'img-';
    cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
    }
  }
});

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
  INSTAGRAM_ACCESS_TOKEN,
} = process.env;

// Token de acceso: se prefiere INSTAGRAM_ACCESS_TOKEN, con PAGE_ACCESS_TOKEN
// como respaldo. Es 'let' porque initBot() puede cambiarlo automáticamente al
// respaldo si el token principal está muerto (evita quedar caído por un token
// vencido cuando el otro sigue siendo válido).
let ACCESS_TOKEN = INSTAGRAM_ACCESS_TOKEN || PAGE_ACCESS_TOKEN;

// ─────────────────────────────────────────────
// Cargar configuraciones de BD al inicio
// ─────────────────────────────────────────────
async function loadAppConfig() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.from('app_config').select('key, value');
    if (!error && data) {
      const dbToken = data.find(d => d.key === 'INSTAGRAM_ACCESS_TOKEN');
      if (dbToken && dbToken.value) {
        ACCESS_TOKEN = dbToken.value;
        console.log('✅ INSTAGRAM_ACCESS_TOKEN cargado desde Supabase');
      }
      const dbAccountId = data.find(d => d.key === 'INSTAGRAM_ACCOUNT_ID');
      if (dbAccountId && dbAccountId.value) {
        INSTAGRAM_ACCOUNT_ID = dbAccountId.value;
        console.log('✅ INSTAGRAM_ACCOUNT_ID cargado desde Supabase');
      }
    }
  } catch (err) {
    console.error('⚠️ Error cargando app_config:', err.message);
  }
}

const GRAPH_API = 'https://graph.instagram.com/v21.0';

// ─────────────────────────────────────────────
// Inicialización del Bot (Cargar datos propios)
// ─────────────────────────────────────────────
let BOT_USERNAME = process.env.BOT_USERNAME || null;
const recentReplies = new Set(); // Para guardar textos de respuestas recientes y evitar ecos

// Prueba un token contra la Graph API; devuelve el username si es válido, o null.
async function validarToken(token) {
  if (!token) return null;
  try {
    const res = await axios.get(`${GRAPH_API}/me`, {
      params: { fields: 'username', access_token: token }, timeout: 10000
    });
    return res.data?.username || res.data?.id || 'ok';
  } catch (err) {
    return null;
  }
}

async function initBot() {
  // Candidatos en orden de preferencia, sin duplicados ni vacíos.
  const candidatos = [
    { nombre: 'INSTAGRAM_ACCESS_TOKEN', token: INSTAGRAM_ACCESS_TOKEN },
    { nombre: 'PAGE_ACCESS_TOKEN', token: PAGE_ACCESS_TOKEN },
  ].filter((c, i, arr) => c.token && arr.findIndex(x => x.token === c.token) === i);

  for (const c of candidatos) {
    const username = await validarToken(c.token);
    if (username) {
      ACCESS_TOKEN = c.token;
      BOT_USERNAME = username;
      console.log(`🤖 Bot inicializado con ${c.nombre}. Username: @${BOT_USERNAME}`);
      return;
    }
    console.warn(`⚠️ ${c.nombre} rechazado por Meta, probando el siguiente token...`);
  }

  console.error('❌ Ningún token de acceso es válido. El bot NO podrá enviar mensajes hasta renovar las credenciales en Meta.');
}
initBot();

// Cargar los flujos persistentes desde Supabase (reemplaza la semilla de
// flows.json si existen datos guardados). Así los cambios del Builder
// sobreviven a los despliegues.
loadFlowsFromSupabase();

// ─────────────────────────────────────────────
// GET /stream  — Server-Sent Events para el Dashboard UI
// ─────────────────────────────────────────────
app.get('/stream', (req, res) => {
  // EventSource no permite headers personalizados, el token viaja por query string
  if (req.query.token !== process.env.API_SECRET) {
    return res.status(403).json({ error: 'Token inválido' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  sseClients.push(newClient);

  // Send a system message on connect
  res.write(`data: ${JSON.stringify({ type: 'SYSTEM', message: 'Conectado al monitor de eventos', timestamp: Date.now() })}\n\n`);
  
  if (BOT_USERNAME) {
    res.write(`data: ${JSON.stringify({ type: 'SYSTEM', message: `Bot configurado como: @${BOT_USERNAME}`, timestamp: Date.now() })}\n\n`);
  }

  // Heartbeat para mantener la conexión viva (cada 30 seg)
  const heartbeat = setInterval(() => {
    res.write(`:\n\n`); // Comentario SSE estándar para keep-alive
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter(client => client.id !== clientId);
  });
});

// ─────────────────────────────────────────────
// GET /webhook  — Verificación del webhook por Meta
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
// ─────────────────────────────────────────────
try {
  app.post('/webhook', async (req, res) => {
    // Verificación de Firma (Seguridad)
    const signature = req.headers['x-hub-signature-256'];
    const appSecret = (process.env.META_APP_SECRET || '').trim();

    if (appSecret && signature) {
    const expectedSignature = 'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');
    if (signature !== expectedSignature) {
      // TEMPORAL: no bloquea mientras diagnosticamos un problema de firma en
      // producción (el webhook dejó de recibir mensajes reales tras activar
      // este chequeo). Se sigue registrando para poder depurarlo, pero ya
      // no se rechaza la petición — evita dejar el bot sordo por este bug.
      console.warn('⚠️ Firma de webhook inválida (NO BLOQUEANTE por ahora, ver diagnóstico)');
      console.warn(`   Recibida:  ${signature}`);
      console.warn(`   Esperada:  ${expectedSignature}`);
      console.warn(`   Longitud del secreto usado: ${appSecret.length} caracteres`);
      console.warn(`   Bytes del body: ${req.rawBody ? req.rawBody.length : 'undefined'}`);
    }
    } else if (!appSecret) {
    console.warn('⚠️ META_APP_SECRET no configurado, se omite verificación de firma (no bloqueante).');
    } else if (!signature) {
    console.warn('⚠️ Petición sin firma X-Hub-Signature-256 (no bloqueante por ahora).');
    }

    // Responder 200 inmediatamente para que Meta no reintente
    res.sendStatus(200);

    const body = req.body;
    const eventId = body?.entry?.[0]?.id || 'unknown';
    console.log(`\n📨 Evento recibido de Instagram (ID: ${eventId})`);

    if (body.object !== 'instagram') return;

    for (const entry of body.entry || []) {
    // ─── MESSAGING EVENTS ───
    for (const event of entry.messaging || []) {
      // Message Echoes (confirmación de envío del bot)
      if (event.message?.is_echo) {
        await handleMessageEcho(event);
      }
      // Delivery Confirmations
      else if (event.delivery) {
        await handleDeliveryConfirmation(event);
      }
      // Read Receipts
      else if (event.read) {
        await handleReadReceipt(event);
      }
      // Typing Indicator
      else if (event.typing) {
        await handleTypingIndicator(event);
      }
      // Welcome Message Ads (Click en anuncio de bienvenida)
      else if (event.referral?.ref && event.referral.ref.includes('welcome')) {
        await handleWelcomeMessageAd(event);
      }
      // Postback (botones pulsados)
      else if (event.postback) {
        await handlePostback(event);
      }
      // Message Reactions (reacciones a comentarios)
      else if (event.message?.reaction) {
        await handleMessageReaction(event);
      }
      // Attachments (imágenes, videos, audios, archivos)
      else if (event.message?.attachments) {
        await handleAttachments(event);
      }
      // Location (ubicación compartida)
      else if (event.message?.location) {
        await handleLocation(event);
      }
      // Share (contenido compartido)
      else if (event.message?.shares) {
        await handleShare(event);
      }
      // Live Location (ubicación en tiempo real)
      else if (event.message?.live_location) {
        await handleLiveLocation(event);
      }
      // Referral (usuario viene de referral)
      else if (event.referral) {
        await handleUserReferral(event);
      }
      // Account Linking (vinculación de cuentas)
      else if (event.account_linking) {
        await handleAccountLinking(event);
      }
      // Messaging Handover (cambio bot/humano)
      else if (event.pass_thread_control) {
        await handleHandoverProtocol(event);
      }
      // Opt-in (confirmación de opt-in)
      else if (event.opt_in) {
        await handleOptIn(event);
      }
      // Payment (pagos integrados)
      else if (event.payment) {
        await handlePayment(event);
      }
      // Sponsored Messages
      else if (event.sponsored_message) {
        await handleSponsoredMessage(event);
      }
      // Mensaje editado
      else if (event.message_edit) {
        await handleMessageEdit(event);
      }
      // Mensajes regulares o quick replies
      else if (event.message?.text || event.message?.quick_reply) {
        await handleMessage(event);
      }
    }

    // ─── CHANGE EVENTS ───
    for (const change of entry.changes || []) {
      // Comentarios en publicaciones
      if (change.field === 'comments') {
        await handleComment(change.value);
      }
      // Comentarios en vivos (Live Comments)
      else if (change.field === 'live_comments') {
        await handleLiveComment(change.value);
      }
      // Menciones (@mentions en comentarios o captions)
      else if (change.field === 'mentions') {
        await handleMention(change.value);
      }
      // Story Reactions (reacciones a historias)
      else if (change.field === 'story_reactions') {
        await handleStoryReaction(change.value);
      }
      // Policy Enforcement (violación de política)
      else if (change.field === 'messaging_policy_enforcement') {
        await handlePolicyEnforcement(change.value);
      }
      // Message Tags (para mensajes fuera de 24h)
      else if (change.field === 'message_template_quality_update') {
        await handleMessageTags(change.value);
      }
      // Handover Protocol
      else if (change.field === 'messaging_handover') {
        await handleMessagingHandover(change.value);
      }
    }
    }
  });
} catch (err) {
  console.error('❌ Fallo al registrar POST /webhook:', err.message);
}

// ─────────────────────────────────────────────
// API REST para el Flow Builder
// ─────────────────────────────────────────────

// Leer flujos
app.get('/api/flows', (req, res) => {
  res.json(flowsConfig);
});

// Obtener publicaciones recientes de Instagram para selector de comentarios
app.get('/api/instagram/media', async (req, res) => {
  try {
    // Usa el token ya validado por initBot (no reintroduce el token muerto).
    const token = ACCESS_TOKEN;
    if (!token) return res.status(503).json({ error: 'No access token configured' });
    const r = await axios.get('https://graph.instagram.com/v21.0/me/media', {
      params: { fields: 'id,media_type,thumbnail_url,media_url,caption,timestamp,permalink', limit: 12, access_token: token }
    });
    const data = r.data;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Guardar flujos
app.post('/api/flows', async (req, res) => {
  try {
    const incoming = req.body;

    // Preserve defaultFlow and welcomeFlow
    if (!incoming.defaultFlow && flowsConfig.defaultFlow) incoming.defaultFlow = flowsConfig.defaultFlow;
    if (!incoming.welcomeFlow && flowsConfig.welcomeFlow) incoming.welcomeFlow = flowsConfig.welcomeFlow;

    // MERGE: upsert incoming flows into existing list instead of replacing
    const incomingIds = new Set((incoming.flows || []).map(f => f.id));
    const merged = flowsConfig.flows.filter(f => !incomingIds.has(f.id));
    const now = new Date().toISOString();
    for (const f of (incoming.flows || [])) {
      const existing = flowsConfig.flows.find(e => e.id === f.id);
      merged.push({
        ...(existing || {}),
        ...f,
        enabled: existing ? existing.enabled : (f.enabled !== false),
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      });
    }
    incoming.flows = merged;

    flowsConfig = incoming;
    await saveFlowsConfig();
    console.log('✅ Flujos actualizados desde el Builder (merge) y persistidos en Supabase');
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error guardando flows.json', err);
    res.status(500).json({ error: 'Failed to save' });
  }
});

// Obtener un flujo por ID
app.get('/api/flows/:id', (req, res) => {
  const flow = flowsConfig.flows.find(f => f.id === req.params.id);
  if (!flow) return res.status(404).json({ error: 'Flow not found' });
  res.json(flow);
});

// Actualizar campos de un flujo
app.patch('/api/flows/:id', async (req, res) => {
  try {
    const idx = flowsConfig.flows.findIndex(f => f.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Flow not found' });
    const allowed = ['name', 'enabled', 'keywords', 'matchType', 'steps'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) flowsConfig.flows[idx][key] = req.body[key];
    }
    flowsConfig.flows[idx].updatedAt = new Date().toISOString();
    await saveFlowsConfig();
    res.json(flowsConfig.flows[idx]);
  } catch (err) {
    console.error('Error updating flow:', err);
    res.status(500).json({ error: 'Failed to update flow' });
  }
});

// Eliminar un flujo
app.delete('/api/flows/:id', async (req, res) => {
  try {
    const idx = flowsConfig.flows.findIndex(f => f.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Flow not found' });
    flowsConfig.flows.splice(idx, 1);
    await saveFlowsConfig();
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting flow:', err);
    res.status(500).json({ error: 'Failed to delete flow' });
  }
});

// Duplicar un flujo
app.post('/api/flows/:id/duplicate', async (req, res) => {
  try {
    const original = flowsConfig.flows.find(f => f.id === req.params.id);
    if (!original) return res.status(404).json({ error: 'Flow not found' });
    const clone = JSON.parse(JSON.stringify(original));
    clone.id = 'flow_' + Date.now();
    clone.name = (original.name || 'Flow') + ' (Copia)';
    clone.enabled = false;
    clone.createdAt = new Date().toISOString();
    clone.updatedAt = new Date().toISOString();
    flowsConfig.flows.push(clone);
    await saveFlowsConfig();
    res.json(clone);
  } catch (err) {
    console.error('Error duplicating flow:', err);
    res.status(500).json({ error: 'Failed to duplicate flow' });
  }
});

// ─────────────────────────────────────────────
// LISTAR Welcome Message Flows desde Meta
app.get('/api/welcome-flows', async (req, res) => {
  try {
    if (!ACCESS_TOKEN) return res.status(503).json({ error: 'No access token configured' });
    const response = await axios.get(`https://graph.instagram.com/v26.0/me/welcome_message_flows`, {
      params: { access_token: ACCESS_TOKEN }
    });
    
    const mapped = (response.data.data || []).map(flow => {
      let wm = flow.welcome_message;
      if (typeof wm === 'string') {
          try { wm = JSON.parse(wm); } catch(e){}
      }
      
      // La API devuelve un objeto con .message o un array con {message}
      const msgObj = Array.isArray(wm) ? wm[0]?.message : (wm?.message || wm);

      return {
        id: flow.id,
        name: flow.name,
        message_text: msgObj?.text || '',
        quick_replies: msgObj?.quick_replies || [],
        is_used_in_ad: flow.is_used_in_ad || false,
        created_at: flow.last_update_time || new Date().toISOString()
      };
    });

    res.json(mapped);
  } catch (err) {
    console.error('Error getting welcome flows:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to get welcome flows from Meta' });
  }
});

// CREAR un Welcome Message Flow en Meta
app.post('/api/welcome-flows', express.json(), async (req, res) => {
  try {
    if (!ACCESS_TOKEN) return res.status(503).json({ error: 'No access token configured' });
    const { name, message_text, quick_replies } = req.body;
    
    if (!name || !message_text) {
      return res.status(400).json({ error: 'name y message_text son requeridos' });
    }

    const metaPayload = {
      eligible_platforms: ['instagram'],
      name: name,
      welcome_message_flow: [
        {
          message: {
            text: message_text,
            quick_replies: (quick_replies || []).map(qr => ({
              content_type: 'text',
              title: qr.title,
              payload: qr.payload
            }))
          }
        }
      ]
    };

    const response = await axios.post(`https://graph.instagram.com/v26.0/me/welcome_message_flows`, metaPayload, {
      params: { access_token: ACCESS_TOKEN }
    });

    res.json({ success: true, flow_id: response.data.flow_id });
  } catch (err) {
    console.error('Error creating welcome flow:', err?.response?.data || err.message);
    res.status(500).json({ error: err?.response?.data?.error?.message || 'Failed to create welcome flow in Meta' });
  }
});

// ACTUALIZAR un Welcome Message Flow en Meta
app.patch('/api/welcome-flows/:id', express.json(), async (req, res) => {
  try {
    if (!ACCESS_TOKEN) return res.status(503).json({ error: 'No access token configured' });
    const { name, message_text, quick_replies } = req.body;
    const flow_id = req.params.id;

    const params = new URLSearchParams();
    params.append('access_token', ACCESS_TOKEN);
    params.append('flow_id', flow_id);
    if (name) params.append('name', name);
    
    if (message_text) {
        const welcome_message_flow = [
            {
                message: {
                    text: message_text,
                    quick_replies: (quick_replies || []).map(qr => ({
                        content_type: 'text',
                        title: qr.title,
                        payload: qr.payload
                    }))
                }
            }
        ];
        params.append('welcome_message_flow', JSON.stringify(welcome_message_flow));
    }

    await axios.post(`https://graph.instagram.com/v26.0/me/welcome_message_flows`, params);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating welcome flow:', err?.response?.data || err.message);
    res.status(500).json({ error: err?.response?.data?.error?.message || 'Failed to update welcome flow in Meta' });
  }
});

// ELIMINAR un Welcome Message Flow en Meta
app.delete('/api/welcome-flows/:id', async (req, res) => {
  try {
    if (!ACCESS_TOKEN) return res.status(503).json({ error: 'No access token configured' });
    const flow_id = req.params.id;
    
    await axios.delete(`https://graph.instagram.com/v26.0/me/welcome_message_flows`, {
      params: { 
        access_token: ACCESS_TOKEN,
        flow_id: flow_id
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting welcome flow:', err?.response?.data || err.message);
    res.status(500).json({ error: err?.response?.data?.error?.message || 'Failed to delete welcome flow in Meta' });
  }
});

// Subir archivos (imágenes, audio, video, PDF)
app.post('/api/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo' });
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, mimetype: req.file.mimetype, originalname: req.file.originalname });
});

// ─────────────────────────────────────────────
// IA Asistente de Textos (Fase 4 - Opción 3)
// ─────────────────────────────────────────────
const aiAgentRateLimits = new Map();
const smartTriggerRateLimits = new Map();
const MAX_AI_AGENT_CALLS_PER_HOUR = 100;        // Conversación directa con el agente
const MAX_SMART_TRIGGER_CALLS_PER_HOUR = 30;   // Fallback de IA para detectar intención

function checkAiAgentRateLimit(key) {
  if (!key) return true;
  const now = Date.now();
  let timestamps = aiAgentRateLimits.get(key) || [];
  timestamps = timestamps.filter(ts => now - ts < 3600000);

  if (timestamps.length >= MAX_AI_AGENT_CALLS_PER_HOUR) {
    aiAgentRateLimits.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  aiAgentRateLimits.set(key, timestamps);
  return true;
}

function checkSmartTriggerRateLimit(key) {
  if (!key) return true;
  const now = Date.now();
  let timestamps = smartTriggerRateLimits.get(key) || [];
  timestamps = timestamps.filter(ts => now - ts < 3600000);

  if (timestamps.length >= MAX_SMART_TRIGGER_CALLS_PER_HOUR) {
    smartTriggerRateLimits.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  smartTriggerRateLimits.set(key, timestamps);
  return true;
}

// Recorta el historial AI de forma segura, evitando orphaned tool messages
function trimAiHistorySafely(history, maxMessages = 12) {
  if (history.length <= maxMessages) return history;

  const trimmed = history.slice(history.length - maxMessages);

  // Si empieza con un tool message, buscamos el tool_calls precedente
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i].role === 'tool') {
      // Buscar hacia atrás un message con tool_calls que coincida
      const toolCallId = trimmed[i].tool_call_id;
      let foundMatch = false;
      for (let j = i - 1; j >= 0; j--) {
        if (trimmed[j].role === 'assistant' && trimmed[j].tool_calls) {
          if (trimmed[j].tool_calls.some(tc => tc.id === toolCallId)) {
            foundMatch = true;
            break;
          }
        }
      }
      // Si no encontramos el tool_calls precedente, sacamos desde aquí (mínimo de 4 msgs)
      if (!foundMatch) {
        const cleaned = trimmed.slice(i + 1);
        // Pero no retornar menos de 2 pares de conversación (user-assistant) para mantener contexto
        return cleaned.length >= 4 ? cleaned : trimmed.slice(Math.max(0, trimmed.length - 4));
      }
      break;
    }
  }

  return trimmed;
}

app.get('/api/ai/status', (req, res) => {
  res.json({ configured: !!process.env.OPENAI_API_KEY });
});
app.post('/api/ai/improve-text', express.json(), async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Texto requerido' });
  if (text.length > 2000) return res.status(400).json({ error: 'Texto demasiado largo (máx 2000 caracteres)' });
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Falta configurar OPENAI_API_KEY en el backend' });
  }
  // Rate limit removido: protegido por requireAuth y de uso exclusivo del admin.

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'Eres un experto en copywriting para chatbots y marketing. Tu tarea es mejorar el texto proporcionado por el usuario para hacerlo más persuasivo, claro y amigable para WhatsApp/Instagram. Mantén la esencia original, corrige ortografía si es necesario, y puedes añadir emojis pertinentes. No uses comillas extras ni texto de relleno, solo devuelve el texto mejorado.'
          },
          { role: 'user', content: text }
        ],
        temperature: 0.7,
        max_tokens: 300
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const improvedText = response?.data?.choices?.[0]?.message?.content?.trim();
    if (!improvedText) throw new Error('Respuesta vacía o incompleta de OpenAI');
    res.json({ text: improvedText });
  } catch (error) {
    console.error('OpenAI API Error (/improve-text):', error.response?.status, error.message);
    res.status(500).json({ error: 'Error al procesar el texto con IA' });
  }
});

// ─────────────────────────────────────────────
// Generación Automática de Flujos con IA
// ─────────────────────────────────────────────
app.post('/api/ai/generate-flow', express.json(), async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt requerido' });
  if (prompt.length > 2000) return res.status(400).json({ error: 'Prompt demasiado largo (máx 2000 caracteres)' });
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Falta configurar OPENAI_API_KEY en el backend' });
  }
  // Rate limit removido: protegido por requireAuth y de uso exclusivo del admin.

  try {
    const systemInstruction = `
Eres un experto diseñador de Chatbots. El usuario pedirá que crees un flujo de conversación. Debes generar un objeto JSON estricto con dos arreglos: "nodes" y "connections".
Tipos de nodo ('type'): 'trigger', 'message', 'action', 'input', 'condition', 'delay', 'ai_agent'.

Formato esperado para cada nodo en "nodes":
- trigger: { "id": "1", "type": "trigger", "data": { "keywords": "palabra" }, "x": 100, "y": 200 }
- message: { "id": "2", "type": "message", "data": { "text": "¡Hola!" }, "x": 400, "y": 200 }
- input: { "id": "3", "type": "input", "data": { "prompt": "Dime tu email", "inputType": "email" }, "x": 700, "y": 200 }
- action: { "id": "4", "type": "action", "data": { "actionType": "add_tag", "tag": "nuevo" }, "x": 400, "y": 400 }
- delay: { "id": "5", "type": "delay", "data": { "seconds": 5 }, "x": 100, "y": 400 }
- ai_agent: { "id": "6", "type": "ai_agent", "data": { "system_prompt": "Eres experto en ventas" }, "x": 700, "y": 400 }

Formato de "connections":
[{ "from": "1", "to": "2" }]

Devuelve ÚNICAMENTE el JSON válido.
`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        response_format: { type: "json_object" },
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 1500
      },
      { 
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 15000 
      }
    );

    const generatedJSON = response?.data?.choices?.[0]?.message?.content?.trim();
    if (!generatedJSON) throw new Error('Respuesta vacía o incompleta de OpenAI');
    
    const parsedJSON = JSON.parse(generatedJSON);
    if (!parsedJSON || !parsedJSON.nodes || !Array.isArray(parsedJSON.nodes)) {
      throw new Error('Estructura JSON inválida devuelta por la IA');
    }
    
    res.json(parsedJSON);
  } catch (error) {
    console.error('OpenAI API Error (/generate-flow):', error.response?.status, error.message);
    res.status(500).json({ error: 'Error al generar flujo con IA' });
  }
});

// ─────────────────────────────────────────────
// FASE 4: Endpoint del Catálogo de Media
// ─────────────────────────────────────────────
app.get('/api/media-catalog', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase no conectado' });
  try {
    const { data, error } = await supabase
      .from('media_catalog')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error fetching media catalog:', err.message);
    res.status(500).json({ error: 'Error al obtener el catálogo de media' });
  }
});

// ─────────────────────────────────────────────
// FASE 7: Endpoint de Aprendizaje Humano
// ─────────────────────────────────────────────
app.post('/api/ai/learn', express.json(), async (req, res) => {
  if (!supabase || !process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Configuración incompleta' });
  try {
    const { question, answer } = req.body;
    if (!question || !answer) return res.status(400).json({ error: 'Faltan datos (question, answer)' });
    
    const embedRes = await axios.post(
      'https://api.openai.com/v1/embeddings',
      { input: question, model: 'text-embedding-3-small' },
      { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }, timeout: 15000 }
    );
    const queryEmbedding = embedRes.data.data[0].embedding;
    
    const { error } = await supabase.from('learned_responses').insert({
      question, answer, embedding: queryEmbedding
    });
    
    if (error) throw error;
    res.json({ success: true, message: 'Aprendizaje guardado correctamente' });
  } catch (err) {
    console.error('Error en /api/ai/learn:', err.message);
    res.status(500).json({ error: 'Error al guardar aprendizaje' });
  }
});

// ─────────────────────────────────────────────
// Endpoint de Configuración IA
// ─────────────────────────────────────────────
app.get('/api/ai/master-context', (req, res) => {
  res.json({ context: AI_MASTER_CONTEXT });
});

app.post('/api/ai/master-context', express.json(), async (req, res) => {
  const { context } = req.body;
  if (!context) return res.status(400).json({ error: 'Contexto vacío' });
  try {
    const contextPath = path.join(__dirname, 'Agente_IA_Faroles_Genius_Contexto_Maestro.md');
    await fs.promises.writeFile(contextPath, context, 'utf8');
    AI_MASTER_CONTEXT = context; // Update in memory
    const splitIdx = AI_MASTER_CONTEXT.indexOf('## 5. HISTORIAS DE ÉXITO');
    AI_BASE_PERSONA = splitIdx !== -1 ? AI_MASTER_CONTEXT.substring(0, splitIdx) : AI_MASTER_CONTEXT;
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving master context:', err);
    res.status(500).json({ error: 'Error al guardar el contexto maestro' });
  }
});

app.get('/api/ai/learned', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'No DB' });
  try {
    const { data, error } = await supabase.from('learned_responses').select('id, question, answer, created_at').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/ai/learned/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'No DB' });
  try {
    const { error } = await supabase.from('learned_responses').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ai/knowledge', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'No DB' });
  try {
    const { data, error } = await supabase.from('ai_knowledge').select('id, section_title, content, created_at').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/knowledge', express.json(), async (req, res) => {
  if (!supabase || !process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Configuración incompleta' });
  try {
    const { section_title, content } = req.body;
    if (!section_title || !content) return res.status(400).json({ error: 'Faltan datos' });
    
    // Create embedding
    const embedRes = await axios.post(
      'https://api.openai.com/v1/embeddings',
      { input: `${section_title}\n${content}`, model: 'text-embedding-3-small' },
      { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }, timeout: 15000 }
    );
    const embedding = embedRes.data.data[0].embedding;
    
    const { error } = await supabase.from('ai_knowledge').insert({ section_title, content, embedding });
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/ai/knowledge/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'No DB' });
  try {
    const { error } = await supabase.from('ai_knowledge').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// Endpoint de Contactos y Mensajes
// ─────────────────────────────────────────────
app.get('/api/contacts/:instagram_id/messages', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'No DB' });
  try {
    const { instagram_id } = req.params;
    const { data, error } = await supabase.from('messages').select('*').eq('instagram_id', instagram_id).order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/contacts/:instagram_id/send', express.json(), async (req, res) => {
  try {
    const { instagram_id } = req.params;
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensaje vacío' });

    // Enviar el mensaje usando la función existente
    await sendMessage(instagram_id, message);
    
    // Pausar el bot para este usuario (live chat takeover)
    if (supabase) {
      await supabase.from('customers').update({ bot_paused: true }).eq('instagram_id', instagram_id);
    }
    
    res.json({ success: true, message: 'Mensaje enviado y bot pausado.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/contacts/:instagram_id/toggle-bot', express.json(), async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'No DB' });
  try {
    const { instagram_id } = req.params;
    const { bot_paused } = req.body;
    const { error } = await supabase.from('customers').update({ bot_paused }).eq('instagram_id', instagram_id);
    if (error) throw error;
    res.json({ success: true, bot_paused });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Marcar mensajes como leídos
app.post('/api/contacts/:instagram_id/mark-read', express.json(), async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'No DB' });
  try {
    const { instagram_id } = req.params;
    const { error } = await supabase.from('messages')
      .update({ is_read: true })
      .eq('instagram_id', instagram_id)
      .eq('direction', 'inbound')
      .eq('is_read', false);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// FASE 8: Endpoint de Analytics del Agente IA
// ─────────────────────────────────────────────
app.get('/api/ai/analytics', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'No DB' });
  try {
    const { data, error } = await supabase
      .from('ai_analytics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);
      
    if (error) throw error;
    
    // Procesamiento básico
    const totalRequests = data.length;
    let totalPrompt = 0, totalCompletion = 0, totalCached = 0, totalLatency = 0, toolCalls = 0;
    
    data.forEach(r => {
      totalPrompt += r.prompt_tokens;
      totalCompletion += r.completion_tokens;
      totalCached += r.cached_tokens;
      totalLatency += r.latency_ms;
      if (r.has_tool_call) toolCalls++;
    });
    
    res.json({
      total_requests: totalRequests,
      avg_latency_ms: totalRequests ? Math.round(totalLatency / totalRequests) : 0,
      total_prompt_tokens: totalPrompt,
      total_completion_tokens: totalCompletion,
      total_cached_tokens: totalCached,
      saved_by_cache_percent: totalPrompt ? Math.round((totalCached / totalPrompt) * 100) : 0,
      tool_calls: toolCalls,
      recent_events: data.slice(0, 50)
    });
  } catch (err) {
    console.error('Error obteniendo analytics:', err.message);
    res.status(500).json({ error: 'Error al obtener métricas' });
  }
});

// ─────────────────────────────────────────────
// Obtener Perfil de Usuario
// ─────────────────────────────────────────────
async function getUserProfile(senderId) {
  try {
    const response = await axios.get(`${GRAPH_API}/${senderId}`, {
      params: {
        fields: 'name,profile_pic',
        access_token: ACCESS_TOKEN
      }
    });
    return response.data;
  } catch (err) {
    console.error(`❌ Error obteniendo perfil de ${senderId}:`, err.response?.data?.error?.message || err.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// Motor IA: Disparadores Inteligentes (Smart Triggers)
// ─────────────────────────────────────────────
async function detectIntentWithAI(text, flows, senderId) {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!checkSmartTriggerRateLimit(senderId)) {
    console.log(`[Smart Trigger] Fallback abortado: Límite de Smart Trigger excedido para ${senderId}`);
    return null;
  }
  
  // Extraer los flujos que tienen keywords
  const candidateFlows = flows.filter(f => f.enabled !== false && f.keywords && f.keywords.length > 0);
  if (candidateFlows.length === 0) return null;

  const intents = candidateFlows.map(f => {
    const isIntent = f.matchType === 'intent';
    const label = isIntent ? 'Intención descrita' : 'Palabras clave';
    return `- ID: ${f.id} | ${label}: ${f.keywords.join(', ')}`;
  }).join('\n');
  
  const systemPrompt = `Eres el motor de reconocimiento de intenciones de un chatbot.
Tus opciones de respuesta son ÚNICAMENTE el "ID" del flujo que mejor coincida con la intención del usuario, o la palabra "NULL" si ninguna coincide.
Aquí están los flujos disponibles y sus intenciones/palabras clave:
${intents}

Si el mensaje del usuario tiene la misma intención o significado que la "Intención descrita" o las "Palabras clave" de un flujo (sinónimos, faltas de ortografía, formas de decirlo), responde con su ID exacto. Si no coincide con ninguna intención clara, responde NULL. NO digas nada más, solo el ID o NULL.`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.0,
        max_tokens: 50
      },
      { 
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );
    
    const reply = response?.data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      console.log(`[Smart Trigger] Sin respuesta válida de OpenAI`);
      return null;
    }

    if (reply === 'NULL' || reply === 'null') {
      console.log(`[Smart Trigger] IA determinó que no hay coincidencia (NULL)`);
      return null;
    }

    // Validar que la respuesta sea uno de los IDs candidatos (protección contra inyección)
    const validIds = new Set(candidateFlows.map(f => f.id));
    if (!validIds.has(reply)) {
      console.log(`[Smart Trigger] Respuesta rechazada: "${reply}" no es un ID válido`);
      return null;
    }

    return reply;
  } catch (err) {
    console.error('OpenAI API Error (detectIntentWithAI):', err.response?.status, err.message);
  }
  return null;
}

// Utilidad: Quitar acentos de un texto
const removeAccents = (str) => str.normalize('NFD').replace(/[̀-ͯ]/g, '');

// ─────────────────────────────────────────────────────────────────
// Framework de Persuasión del Agente IA: Hall (momentos) + Cialdini
// (armas de influencia) + Grice (validación de claridad)
// ─────────────────────────────────────────────────────────────────

// Detecta en cuál de los 4 momentos del cliente (Hall) está la conversación,
// según las etiquetas guardadas en su registro.
function detectarMomento(customer) {
  const tags = customer?.tags || [];
  if (tags.includes('cliente_confirmado') || tags.includes('pagado')) return 'Momento 4: Post-Compra';
  if (tags.includes('considerando')) return 'Momento 3: Decisión';
  if (tags.includes('aliado_fase1') || tags.includes('cliente_detal')) return 'Momento 2: Consideración';
  return 'Momento 1: Primer Contacto';
}

const KEYWORDS_INTENCION = {
  escape_word: ['quiero hablar con un humano', 'asesor', 'persona real', 'necesito soporte', 'hablar con alguien', 'agente', 'representante', 'support', 'ayuda urgente'],
  listo_compra: ['dale', 'si me interesa', 'adelante', 'vamos', 'quiero empezar', 'procede'],
  objecion_caro: ['caro', 'costoso', 'mucho dinero', 'cara', 'expensive', 'mucho'],
  objecion_no_vender: ['vender', 'no se vender', 'no puedo vender', 'venta', 'miedo', 'asusta'],
  objecion_durabilidad: ['duran', 'dura', 'anos', 'resiste', 'rotura', 'quiebr'],
  objecion_arrepentimiento: ['arrepentir', 'cambiar de opinion', 'devolucion', 'cambio', 'garantia'],
  objecion_exterior: ['exterior', 'fuera', 'otro pais', 'enviaran', 'internacional'],
  pregunta_precio: ['precio', 'cuesta', 'costo', 'valor', 'plata', 'cuanto', 'pago'],
  pregunta_funciona: ['funciona', 'funcione', 'realmente', 'en serio', 'cierto', 'verdad'],
  pregunta_poliza: ['garantia', 'politica', 'cambio', 'devolu'],
};

// Detecta qué tipo de pregunta/objeción/intención tiene el mensaje del cliente,
// buscando palabras clave (ignorando acentos/mayúsculas).
function detectarIntencion(text) {
  const t = removeAccents(text).toLowerCase();
  const matches = (list) => list.some(k => t.includes(removeAccents(k).toLowerCase()));
  if (matches(KEYWORDS_INTENCION.escape_word)) return 'escape_word';
  if (matches(KEYWORDS_INTENCION.listo_compra)) return 'listo_compra';
  if (matches(KEYWORDS_INTENCION.objecion_caro)) return 'objecion_caro';
  if (matches(KEYWORDS_INTENCION.objecion_no_vender)) return 'objecion_no_vender';
  if (matches(KEYWORDS_INTENCION.objecion_durabilidad)) return 'objecion_durabilidad';
  if (matches(KEYWORDS_INTENCION.objecion_arrepentimiento)) return 'objecion_arrepentimiento';
  if (matches(KEYWORDS_INTENCION.objecion_exterior)) return 'objecion_exterior';
  if (matches(KEYWORDS_INTENCION.pregunta_precio)) return 'pregunta_precio';
  if (matches(KEYWORDS_INTENCION.pregunta_funciona)) return 'pregunta_funciona';
  if (matches(KEYWORDS_INTENCION.pregunta_poliza)) return 'pregunta_poliza';
  return 'desconocido';
}

// Selecciona qué arma de persuasión (Cialdini) conviene activar, según
// el momento del cliente (Hall) y la intención detectada en su mensaje.
function seleccionarArma(momento, intencion) {
  if (intencion === 'escape_word') return 'Confianza/Veracidad';
  if (momento === 'Momento 1: Primer Contacto') return 'Simpatía';
  if (momento === 'Momento 4: Post-Compra') return 'Reciprocidad';
  if (momento === 'Momento 3: Decisión') {
    return intencion === 'listo_compra' ? 'Compromiso' : 'Escasez';
  }
  if (momento === 'Momento 2: Consideración') {
    if (intencion === 'objecion_caro') return 'Autoridad';
    if (intencion === 'objecion_no_vender') return 'Prueba Social';
    if (intencion === 'objecion_durabilidad') return 'Autoridad';
    if (intencion === 'pregunta_precio' || intencion === 'pregunta_funciona') return 'Autoridad';
    if (intencion === 'objecion_arrepentimiento' || intencion === 'pregunta_poliza') return 'Confianza/Veracidad';
  }
  return 'Reciprocidad';
}

// Valida (sin bloquear) que la respuesta generada respete las máximas de Grice:
// ni muy larga ni muy corta, y con estructura clara si es extensa.
// Devuelve una lista de advertencias; vacía si todo está bien.
function validarGrice(respuesta) {
  const problemas = [];
  const palabras = respuesta.trim().split(/\s+/).length;
  if (palabras < 20 || palabras > 500) problemas.push(`Cantidad: ${palabras} palabras (ideal 50-300)`);
  const tieneEstructura = /[•✅→-]|(?:^|\n)\s*\d+\./.test(respuesta);
  if (!tieneEstructura && palabras > 100) problemas.push('Manera: respuesta larga sin estructura clara (bullets, numeración)');
  return problemas;
}

// ─────────────────────────────────────────────
// Ejecuta el Agente IA sobre un mensaje concreto: genera la respuesta con
// GPT-4o (contexto maestro + RAG + framework de persuasión + herramientas) y
// la envía. Se usa tanto cuando el cliente ya está en estado 'ai_agent' como
// al activarse un nodo Agente IA, para responder al mensaje que lo disparó.
async function runAiAgent(senderId, senderName, text, customer) {
  if (!process.env.OPENAI_API_KEY) {
    await sendMessage(senderId, "⚠️ El agente de IA no está configurado (Falta API Key).");
    return;
  }
  if (!checkAiAgentRateLimit(senderId)) {
    await sendMessage(senderId, "⚠️ Has alcanzado el límite de consultas a la IA por ahora. Intenta más tarde.");
    return;
  }
    // FASE 2: Construir el system prompt con Contexto Maestro + override del nodo.
  // Estructura: [Contexto Maestro fijo] + [Instrucciones adicionales del nodo]
  // El contexto maestro va PRIMERO para aprovechar el Prompt Caching de OpenAI.
  const nodePrompt = customer.current_ai_prompt || '';
  const ignoreMaster = customer.ignore_master_context || false;
  
  let systemPrompt;
  if (ignoreMaster || !AI_MASTER_CONTEXT) {
    // El nodo tiene activado "Ignorar contexto maestro" o no existe el archivo
    systemPrompt = nodePrompt || 'Eres un asistente útil y amigable.';
  } else {
    // FASE 6: RAG dinámico
    const dynamicContext = await retrieveDynamicContext(text);

    if (nodePrompt) {
      systemPrompt = dynamicContext + '\n\n---\n## INSTRUCCIONES ADICIONALES PARA ESTE FLUJO\n' + nodePrompt;
    } else {
      systemPrompt = dynamicContext;
    }
  }

  // Framework de Persuasión (Hall + Cialdini): se calcula en cada turno
  // y se inyecta como guía estratégica explícita, sin reemplazar el
  // razonamiento libre del modelo — solo lo orienta.
  const momento = detectarMomento(customer);
  const intencion = detectarIntencion(text);
  const arma = seleccionarArma(momento, intencion);
  const debeEscalarSugerido = intencion === 'escape_word' || intencion === 'listo_compra' || momento === 'Momento 4: Post-Compra';

  // Datos ya conocidos del cliente (para que el agente no vuelva a preguntarlos)
  const knownFields = customer.fields && Object.keys(customer.fields).length > 0
    ? Object.entries(customer.fields).map(([k, v]) => `  - ${k}: ${v}`).join('\n')
    : '  (ninguno todavía)';
  const knownTags = Array.isArray(customer.tags) && customer.tags.length > 0
    ? customer.tags.join(', ')
    : '(ninguno)';

  systemPrompt += `\n\n---\n## 🎯 GUÍA ESTRATÉGICA PARA ESTA RESPUESTA (Framework Hall + Cialdini)
- Momento del cliente: ${momento}
- Intención detectada en su mensaje: ${intencion}
- Arma de persuasión a activar: ${arma}
- Recuerda las 3 máximas de Grice: cantidad (ni mucho ni poco, ideal 50-300 palabras), calidad (solo verdad, números verificables), relación (responde SU pregunta específica) y manera (claro, estructurado, con bullets/números si es larga).${debeEscalarSugerido ? '\n- ⚠️ Señal fuerte de escalado: usa la herramienta escalate_to_human si el cliente confirma que quiere comprar, pide hablar con un asesor/humano, o ya es cliente confirmado.' : ''}

## 👤 DATOS QUE YA TIENES DEL CLIENTE (NO los vuelvas a pedir)
Nombre: ${customer.name || senderName}
Tags actuales: ${knownTags}
Campos guardados:
${knownFields}

## 💾 GUARDA DATOS NUEVOS
Cuando el cliente comparta información útil (ciudad, teléfono, comunidad, cantidad de faroles, fecha del evento, etc.) LLAMA a la herramienta save_customer_data para persistirla. También agrega tags cuando detectes su estado (considerando, listo_compra, objecion_precio, etc.). Esto es crítico para que el equipo humano y las próximas conversaciones tengan contexto.`;

  let history = customer.ai_history || [];
  
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: text }
  ];
  
  try {
    const aiStartTime = Date.now();
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: messages,
        tools: AI_TOOLS,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 500  // FASE 1: aumentado de 300 a 500 para respuestas de venta más completas
      },
      { 
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );
    
    const choice = response?.data?.choices?.[0];
    if (!choice) throw new Error('Respuesta vacía o incompleta de OpenAI');
    
    // Log de uso de tokens (útil para monitorear caching en Fase 8)
    const usage = response.data.usage;
    const cachedTokens = usage?.prompt_tokens_details?.cached_tokens || 0;
    if (cachedTokens > 0) {
      console.log(`💾 Prompt Cache activo: ${cachedTokens}/${usage.prompt_tokens} tokens cacheados (ahorro ~50%)`);
    }

    // Acumular tokens de ambas llamadas para analytics
    let totalPromptTokens = usage?.prompt_tokens || 0;
    let totalCompletionTokens = usage?.completion_tokens || 0;
    let totalCachedTokens = cachedTokens;

    history.push({ role: 'user', content: text });

    if (choice.finish_reason === 'tool_calls') {
      // FASE 5: Procesar las llamadas a herramientas
      if (!supabase) {
        console.error('⚠️ Supabase desconectado: no se pueden procesar herramientas del agente IA');
        await sendMessage(senderId, 'Lo siento, tuve un problema procesando tu solicitud. Por favor intenta de nuevo.');
        return;
      }

      history.push(choice.message); // Añadir el tool_call al historial
      let escalatedToHuman = false;

      for (const toolCall of choice.message.tool_calls) {
        let args;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (parseErr) {
          console.error(`Error parseando argumentos de herramienta ${toolCall.function.name}:`, parseErr.message);
          history.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: 'Error interno: argumentos inválidos en la herramienta.'
          });
          continue;
        }

        if (toolCall.function.name === 'send_product_media') {
          const { data: medias } = await supabase
            .from('media_catalog')
            .select('*')
            .overlaps('tags', args.search_tags || [])
            .eq('type', args.media_type)
            .eq('active', true)
            .limit(1);
          
          if (medias && medias.length > 0) {
            await sendMediaMessage(senderId, args.media_type, medias[0].url);
            if (args.caption) await sendMessage(senderId, args.caption);
            
            history.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `Enviado media exitosamente al cliente. URL: ${medias[0].url}`
            });
          } else {
            history.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: 'No se encontraron medias con esos tags en el catálogo.'
            });
            // Podríamos hacer una segunda llamada a OpenAI aquí para que se disculpe
          }
        } else if (toolCall.function.name === 'escalate_to_human') {
          escalatedToHuman = true;
          // Solo usar bot_paused (bandera canónica); mantener bot_state='active' para que si
          // el humano lo despausa después, no quede en un estado 'paused' extraño.
          await supabase.from('customers').update({ bot_paused: true }).eq('instagram_id', senderId);
          await sendMessage(senderId, "Perfecto, voy a pasarte con alguien de nuestro equipo para confirmar detalles... 🕯️");
          broadcastLog('ESCALATION', `${senderName}: ${args.reason}`);

          history.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: 'Escalado exitosamente a humano. El bot está pausado.'
          });
        } else if (toolCall.function.name === 'save_customer_data') {
          const updates = {};
          const summary = [];

          if (args.fields && typeof args.fields === 'object') {
            const newFields = { ...(customer.fields || {}), ...args.fields };
            updates.fields = newFields;
            customer.fields = newFields;
            summary.push(`fields: ${Object.keys(args.fields).join(', ')}`);
          }

          if (Array.isArray(args.tags_to_add) && args.tags_to_add.length > 0) {
            const currentTags = Array.isArray(customer.tags) ? customer.tags : [];
            const newTags = [...new Set([...currentTags, ...args.tags_to_add])];
            updates.tags = newTags;
            customer.tags = newTags;
            summary.push(`tags: ${args.tags_to_add.join(', ')}`);
          }

          if (Object.keys(updates).length > 0) {
            const { error: saveErr } = await supabase.from('customers').update(updates).eq('instagram_id', senderId);
            if (saveErr) {
              console.error('Error guardando customer data:', saveErr.message);
              history.push({ role: 'tool', tool_call_id: toolCall.id, content: `Error al guardar: ${saveErr.message}` });
            } else {
              broadcastLog('SYSTEM', `Datos guardados de ${senderName}: ${summary.join(' | ')}`);
              history.push({ role: 'tool', tool_call_id: toolCall.id, content: `Datos guardados correctamente: ${summary.join(' | ')}` });
            }
          } else {
            history.push({ role: 'tool', tool_call_id: toolCall.id, content: 'Nada que guardar (no se pasaron fields ni tags).' });
          }
        }
      }

      // SEGUNDA LLAMADA A OPENAI para respuesta final (se omite si ya se escaló a un humano,
      // el mensaje fijo de escalate_to_human ya es suficiente y el bot quedó en pausa)
      if (!escalatedToHuman) {
        try {
          const secondResponse = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
              model: 'gpt-4o',
              messages: [{ role: 'system', content: systemPrompt }, ...history],
              temperature: 0.7,
              max_tokens: 500
            },
            {
              headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
              timeout: 15000
            }
          );

          const finalChoice = secondResponse?.data?.choices?.[0];
          if (finalChoice && finalChoice.message?.content) {
            const finalReply = finalChoice.message.content.trim();
            const griceProblemas = validarGrice(finalReply);
            if (griceProblemas.length > 0) {
              console.warn(`⚠️ Grice (${senderName}): ${griceProblemas.join(' | ')}`);
            }
            history.push({ role: 'assistant', content: finalReply });
            await sendMessage(senderId, finalReply);
          } else {
            // Fallback si la segunda llamada no devuelve contenido
            console.warn(`⚠️ Segunda llamada de IA sin contenido válido (finish_reason: ${finalChoice?.finish_reason || 'unknown'})`);
            const fallbackReply = "Gracias por tu paciencia. Te conectaré con alguien para ayudarte mejor. 🕯️";
            history.push({ role: 'assistant', content: fallbackReply });
            await sendMessage(senderId, fallbackReply);
          }

          // Acumular tokens de la segunda llamada
          const secondUsage = secondResponse?.data?.usage;
          if (secondUsage) {
            totalPromptTokens += secondUsage.prompt_tokens || 0;
            totalCompletionTokens += secondUsage.completion_tokens || 0;
            const secondCachedTokens = secondUsage.prompt_tokens_details?.cached_tokens || 0;
            if (secondCachedTokens > 0) {
              totalCachedTokens += secondCachedTokens;
            }
          }
        } catch (secondErr) {
          console.error('Error en segunda llamada OpenAI:', secondErr.message);
          const errorFallback = "Disculpa, hubo un problema. Te conectaré con nuestro equipo. 🕯️";
          history.push({ role: 'assistant', content: errorFallback });
          await sendMessage(senderId, errorFallback);
        }
      }

      history = trimAiHistorySafely(history, 12);
      await supabase.from('customers').update({
        ai_history: history
      }).eq('instagram_id', senderId);

      broadcastLog('SYSTEM', `Agente IA usó herramientas y respondió a ${senderName} [${momento} | ${intencion} | ${arma}] (${Date.now() - aiStartTime}ms)`);
    } else {
      // Texto normal
      const aiReply = choice.message.content?.trim();
      if (!aiReply) throw new Error('Contenido de respuesta vacío de OpenAI');

      const griceProblemas = validarGrice(aiReply);
      if (griceProblemas.length > 0) {
        console.warn(`⚠️ Grice (${senderName}): ${griceProblemas.join(' | ')}`);
      }

      history.push({ role: 'assistant', content: aiReply });
      history = trimAiHistorySafely(history, 12);

      await supabase.from('customers').update({
        ai_history: history
      }).eq('instagram_id', senderId);

      await sendMessage(senderId, aiReply);
      broadcastLog('SYSTEM', `Agente IA respondió a ${senderName} [${momento} | ${intencion} | ${arma}] (${Date.now() - aiStartTime}ms)`);
    }

    // FASE 8: Registrar métricas de Analytics (incluyendo tokens de ambas llamadas)
    if (supabase) {
      const latency_ms = Date.now() - aiStartTime;
      supabase.from('ai_analytics').insert({
        instagram_id: senderId,
        prompt_tokens: totalPromptTokens,
        completion_tokens: totalCompletionTokens,
        cached_tokens: totalCachedTokens,
        latency_ms: latency_ms,
        has_tool_call: choice.finish_reason === 'tool_calls'
      }).then(({ error }) => {
        if (error) console.error('Error guardando analytics:', error.message);
      });
    }

  } catch (err) {
    console.error('OpenAI API Error (AI Agent):', err.response?.status, err.message);
    await sendMessage(senderId, 'Lo siento, tuve un problema procesando tu mensaje. Por favor intenta de nuevo en un momento.');
  }
}

// ─────────────────────────────────────────────
// Handler: Mensaje Directo (DM) y Postbacks
// DOC: https://developers.facebook.com/docs/messenger-platform/instagram/messages
// ─────────────────────────────────────────────
async function handleMessage(event) {
  const senderId     = event.sender?.id;
  const text         = event.message?.quick_reply?.payload || event.postback?.payload || event.message?.text || "";
  const storyMention = event.message?.story?.mention;
  const hasAttachments = event.message?.attachments && event.message.attachments.length > 0;

  // Ignorar eventos que no tengan ID de origen o sean del propio bot
  if (!senderId) return;
  if (String(senderId).trim() === String(INSTAGRAM_ACCOUNT_ID).trim()) return;

  // Si no hay texto, ni mención, ni adjuntos, ignoramos
  if (!text && !storyMention && !hasAttachments) return;

  const profile = await getUserProfile(senderId);
  const senderName = profile?.name || senderId;

  // 1. Manejo de menciones en Historias
  if (storyMention) {
    broadcastLog('STORY', `@${senderName} te mencionó en su historia.`, profile);
    logMessageToDB(senderId, 'inbound', 'story_mention', '[Mención en historia]');
    await sendMessage(senderId, `¡Hola @${senderName}! 👋 ¡Gracias por mencionarnos en tu historia! Nos encanta ❤️`);
    return;
  }

  // 2. Manejo de Mensajes Directos regulares (DM)
  broadcastLog('DM', `Recibido de ${senderName}: "${text}"`, profile);
  const msgExtra = {};
  if (event.message?.reply_to?.mid) msgExtra.reply_to_mid = event.message.reply_to.mid;
  if (event.message?.quick_reply) msgExtra.metadata = { quick_reply: event.message.quick_reply.payload };
  if (event.message?.referral) msgExtra.metadata = { ...msgExtra.metadata, referral: event.message.referral };
  logMessageToDB(senderId, 'inbound', 'text', text || (hasAttachments ? '[Adjunto/s]' : ''), event.message?.mid, msgExtra);

  // 3. Verificar si el bot está pausado o en recolección de datos
  let customer = null;
  if (supabase) {
    try {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('instagram_id', senderId)
        .single();

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

  // 3.5 Welcome Message: Primer contacto
  if (!customer && supabase) {
    try {
      const { data: newCustomer, error: insertErr } = await supabase
        .from('customers')
        .insert([{ instagram_id: senderId, name: senderName, profile_picture_url: profile?.profile_pic || null, tags: [], fields: {}, bot_paused: false, bot_state: 'active' }])
        .select()
        .single();

      if (!insertErr && newCustomer) {
        customer = newCustomer;
        broadcastLog('SYSTEM', `Nuevo contacto creado: ${senderName}`);
        if (flowsConfig.welcomeFlow?.steps?.length > 0) {
          broadcastLog('SYSTEM', `Ejecutando Welcome Flow para ${senderName}`);
          // Pasar `text` como triggerText para que si el Welcome Flow incluye un
          // nodo ai_agent, el agente responda de inmediato al primer mensaje del cliente.
          await processFlowSteps(flowsConfig.welcomeFlow.steps, senderId, senderName, new Set(), text);
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

  // 3.8 Máquina de Estados: Agente IA
  if (customer && customer.bot_state === 'ai_agent') {
    const lowerTxt = text.trim().toLowerCase().replace(/\s+/g, ' ');

    // Solo salir explícitamente si el usuario lo pide de forma clara (palabra completa)
    const exitPatterns = [/^(salir|exit|quit|menu|menú)$/, /^(volver al menú|menu principal)$/];
    const shouldExit = exitPatterns.some(pattern => pattern.test(lowerTxt));

    if (shouldExit) {
      try {
        await supabase.from('customers').update({ bot_state: 'active' }).eq('instagram_id', senderId);
        customer.bot_state = 'active';
        await sendMessage(senderId, "Saliendo del asistente IA...");
        // Continuar con el código para que dispare flujos normales si coincide
      } catch (e) {
        console.error('[DB] Error cambiando estado al salir del ai_agent:', e.message);
        await sendMessage(senderId, "Error al salir del asistente. Por favor intenta de nuevo.");
        return;
      }
    } else {
      // Palabras como "humano", "asesor", "agente" son manejadas por el agente IA mismo,
      // que tiene la herramienta escalate_to_human para ese caso
      await runAiAgent(senderId, senderName, text, customer);
      return;
    }
  }

  // 4. Máquina de Estados: Awaiting Input
  if (customer && customer.bot_state === 'awaiting_input') {
    const inputType = customer.awaiting_input_type;
    const lowerTxt = text.trim();
    let isValid = false;

    if (inputType === 'email') {
      isValid = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(lowerTxt);
    } else if (inputType === 'phone') {
      isValid = /^\+?[\d\s-]{7,15}$/.test(lowerTxt);
    } else if (inputType === 'number') {
      isValid = /^-?\d+(\.\d+)?$/.test(lowerTxt);
    } else if (inputType === 'url') {
      isValid = /^https?:\/\/.+\..+/.test(lowerTxt);
    } else if (inputType === 'date') {
      isValid = !isNaN(Date.parse(lowerTxt));
    } else if (inputType === 'choice') {
      const choices = (customer.awaiting_input_choices || '').split(',').map(c => c.trim().toLowerCase());
      isValid = choices.includes(lowerTxt.toLowerCase());
    } else {
      isValid = lowerTxt.length > 0;
    }

    if (isValid) {
      const updates = { bot_state: 'active' };
      if (customer.awaiting_input_field) {
        updates.fields = { ...(customer.fields || {}), [customer.awaiting_input_field]: lowerTxt };
      }
      await supabase.from('customers').update(updates).eq('instagram_id', senderId);
      broadcastLog('SYSTEM', `Dato capturado: ${lowerTxt} guardado en ${customer.awaiting_input_field}`);
      
      // Reanudar flujo por la ruta de éxito (guardada en current_flow_id)
      if (customer.current_flow_id) {
        const successFlow = flowsConfig.flows.find(f => f.id === `flow_${customer.current_flow_id}`);
        if (successFlow) await processFlowSteps(successFlow.steps, senderId, senderName);
      }
    } else {
      const retries = (customer.awaiting_input_retries || 0) + 1;
      if (retries >= 3) {
        await supabase.from('customers').update({ bot_state: 'active', awaiting_input_retries: 0 }).eq('instagram_id', senderId);
        broadcastLog('SYSTEM', `Fallo de input máximo alcanzado para ${senderName}`);
        
        // Reanudar flujo por la ruta de fallo (guardada en current_step_index)
        if (customer.current_step_index !== null && typeof customer.current_step_index === 'string') { // Lo usamos para el failPayload
          const failFlow = flowsConfig.flows.find(f => f.id === `flow_${customer.current_step_index}`);
          if (failFlow) await processFlowSteps(failFlow.steps, senderId, senderName);
        }
      } else {
        await supabase.from('customers').update({ awaiting_input_retries: retries }).eq('instagram_id', senderId);
        await sendMessage(senderId, customer.awaiting_input_prompt || "Ese formato no es válido. Intenta de nuevo:");
      }
    }
    return;
  }

  // 5. Normalizar el texto (quitar mayúsculas y acentos) para Trigger regular
  const normalizedText = removeAccents(text);
  const lowerText = normalizedText.toLowerCase();
  
  let matchedFlow = null;

  for (const flow of flowsConfig.flows) {
    if (flow.enabled === false) continue;
    if (!flow.keywords || flow.keywords.length === 0) continue;
    const matchType = flow.matchType || 'contains';

    if (matchType === 'contains') {
      const match = flow.keywords.find(kw => {
        const cleanKw = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return lowerText.includes(cleanKw);
      });
      if (match) { matchedFlow = flow; break; }
    } else if (matchType === 'exact') {
      const match = flow.keywords.find(kw => {
        const cleanKw = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return lowerText === cleanKw;
      });
      if (match) { matchedFlow = flow; break; }
    } else if (matchType === 'starts_with') {
      const match = flow.keywords.find(kw => {
        const cleanKw = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return lowerText.startsWith(cleanKw);
      });
      if (match) { matchedFlow = flow; break; }
    } else if (matchType === 'regex') {
      const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = flow.keywords.some(kw => {
        const cleanKw = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        try { return new RegExp('\\b' + escapeRegExp(cleanKw) + '\\b', 'i').test(lowerText); } catch (e) { return false; }
      });
      if (match) { matchedFlow = flow; break; }
    }
  }
  
  if (matchedFlow && matchedFlow.steps) {
    matchedFlow.executionCount = (matchedFlow.executionCount || 0) + 1;
    matchedFlow.lastExecutedAt = new Date().toISOString();
    saveFlowsConfig().catch(err => {
      console.warn('⚠️ Error guardando flujos (no-bloqueante):', err.message);
    });
    await processFlowSteps(matchedFlow.steps, senderId, senderName, new Set(), text);
  } else {
    // 6. Smart Triggers (IA Fallback)
    console.log(`[Smart Trigger] Buscando intención con IA para: "${text}"`);
    const smartFlowId = await detectIntentWithAI(text, flowsConfig.flows, senderId);
    
    if (smartFlowId) {
      console.log(`[Smart Trigger] Intención detectada. Ejecutando flujo: ${smartFlowId}`);
      const smartFlow = flowsConfig.flows.find(f => f.id === smartFlowId);
      if (smartFlow && smartFlow.steps) {
        smartFlow.executionCount = (smartFlow.executionCount || 0) + 1;
        smartFlow.lastExecutedAt = new Date().toISOString();
        saveFlowsConfig().catch(err => {
          console.warn('⚠️ Error guardando smart trigger (no-bloqueante):', err.message);
        });
        await processFlowSteps(smartFlow.steps, senderId, senderName, new Set(), text);
        return;
      }
    }

    // 7. Flujo por Defecto (Si la IA no detecta intención)
    if (flowsConfig.defaultFlow?.steps) {
      console.log(`[Router] No hubo coincidencia. Ejecutando Default Flow.`);
      await processFlowSteps(flowsConfig.defaultFlow.steps, senderId, senderName, new Set(), text);
    }
  }
}

// ─────────────────────────────────────────────
// Procesador de Pasos del Flujo
// ─────────────────────────────────────────────
async function processFlowSteps(steps, senderId, senderName, _visited = new Set(), triggerText = null) {
  let customer = null;
  if (supabase) {
    try {
      const { data } = await supabase.from('customers').select('*').eq('instagram_id', senderId).single();
      customer = data;
    } catch (e) {
      console.error('[DB] Error fetching customer for flow steps:', e.message);
    }
  }

  const interpolate = (txt) => {
    if (!txt || typeof txt !== 'string') return txt;
    let replaced = txt.replace('{username}', senderName);
    replaced = replaced.replace(/\{\{([\w\s_-]+)\}\}/g, (match, fieldName) => {
      const key = fieldName.trim();
      if (key === 'name' || key === 'username') return customer?.name || senderName;
      if (customer?.fields && customer.fields[key] !== undefined && customer.fields[key] !== null) {
        return customer.fields[key];
      }
      return '';
    });
    return replaced;
  };

  for (const step of steps) {
    if (step.type === 'text') {
      await sendMessage(senderId, interpolate(step.message));
    } else if (step.type === 'buttons') {
      await sendMessage(senderId, interpolate(step.message), step.buttons);
    } else if (step.type === 'template') {
      await sendTemplate(senderId, interpolate(step.message), step.buttons);
    } else if (step.type === 'card') {
      const cardData = { ...step.card, title: interpolate(step.card.title), subtitle: interpolate(step.card.subtitle) };
      await sendCard(senderId, cardData, interpolate(step.message));
    } else if (step.type === 'action') {
      await executeAction(senderId, senderName, step);
    } else if (step.type === 'condition') {
      let conditionMet = false;
      const fieldVal = (step.field === 'name') ? (customer?.name || '') : (customer?.fields?.[step.field] || '');
      
      const v1 = String(fieldVal).toLowerCase().trim();
      const v2 = String(step.value || '').toLowerCase().trim();
      
      if (step.operator === '==') conditionMet = (v1 === v2);
      else if (step.operator === '!=') conditionMet = (v1 !== v2);
      else if (step.operator === '>') conditionMet = (Number(v1) > Number(v2));
      else if (step.operator === '<') conditionMet = (Number(v1) < Number(v2));
      else if (step.operator === 'contains') conditionMet = (v1.includes(v2));
      else if (step.operator === 'not_contains') conditionMet = (!v1.includes(v2));
      
      const nextFlowId = conditionMet ? step.truePayload : step.falsePayload;
      if (nextFlowId && !_visited.has(nextFlowId)) {
        _visited.add(nextFlowId);
        const nextFlow = flowsConfig.flows.find(f => f.id === `flow_${nextFlowId}`);
        if (nextFlow) await processFlowSteps(nextFlow.steps, senderId, senderName, _visited, triggerText);
      }
      break; // Detiene el array lineal actual porque la condición bifurca
    } else if (step.type === 'randomizer') {
      if (step.paths && step.paths.length > 0) {
        const randomPayload = step.paths[Math.floor(Math.random() * step.paths.length)];
        if (randomPayload && !_visited.has(randomPayload)) {
          _visited.add(randomPayload);
          const nextFlow = flowsConfig.flows.find(f => f.id === `flow_${randomPayload}`);
          if (nextFlow) await processFlowSteps(nextFlow.steps, senderId, senderName, _visited, triggerText);
        }
      }
      break; // Detiene el array lineal actual
    } else if (step.type === 'input') {
      const replyText = interpolate(step.prompt) || 'Por favor responde:';
      await sendMessage(senderId, replyText);
      if (supabase) {
        await supabase.from('customers').update({
          bot_state: 'awaiting_input',
          awaiting_input_type: step.inputType || 'text',
          awaiting_input_field: step.field,
          awaiting_input_prompt: step.retryMessage || 'Intenta de nuevo:',
          awaiting_input_retries: 0,
          current_flow_id: step.successPayload, 
          current_step_index: step.failPayload 
        }).eq('instagram_id', senderId);
      }
      break; // Interrumpe la ejecución esperando respuesta
    } else if (step.type === 'carousel') {
      await sendCarousel(senderId, step.elements || []);
    } else if (step.type === 'gallery') {
      await sendGallery(senderId, step.images || [], step.delay_between_ms || 300);
    } else if (step.type === 'audio') {
      await sendAudio(senderId, step.audio_url);
    } else if (step.type === 'video') {
      await sendVideo(senderId, step.video_url);
    } else if (step.type === 'file') {
      await sendFile(senderId, step.file_url);
    } else if (step.type === 'delay') {
      const ms = Math.min((step.seconds || 1) * 1000, 15 * 60 * 1000); // máx 15 min
      await new Promise(resolve => setTimeout(resolve, ms));
    } else if (step.type === 'goto') {
      const targetId = step.flow_id;
      if (targetId && !_visited.has(targetId)) {
        _visited.add(targetId);
        const targetFlow = flowsConfig.flows.find(f => f.id === `flow_${targetId}` || f.id === targetId);
        if (targetFlow) await processFlowSteps(targetFlow.steps, senderId, senderName, _visited, triggerText);
        else broadcastLog('WARNING', `Goto: Flujo no encontrado: ${targetId}`);
      }
      break;
    } else if (step.type === 'ai_agent') {
      if (supabase) {
        await supabase.from('customers').update({
          bot_state: 'ai_agent',
          current_ai_prompt: step.system_prompt || '',
          ignore_master_context: step.ignore_master_context || false,  // FASE 3
          ai_history: []  // Limpiar historial al activar nuevo nodo para evitar contexto de flujo anterior
        }).eq('instagram_id', senderId);
        broadcastLog('SYSTEM', `Agente IA activado para ${senderName}${step.ignore_master_context ? ' (modo standalone)' : ' (con Contexto Maestro)'}`);

        // Responder de inmediato al mensaje que activó el flujo, en vez de
        // esperar a que el cliente escriba otra vez. Reflejamos los valores
        // recién guardados en el objeto local para que runAiAgent los use.
        if (triggerText && customer) {
          customer.current_ai_prompt = step.system_prompt || '';
          customer.ignore_master_context = step.ignore_master_context || false;
          customer.bot_state = 'ai_agent';
          await runAiAgent(senderId, senderName, triggerText, customer);
        }
      } else {
        console.warn('⚠️ Supabase no conectado. No se puede activar el Agente IA.');
      }
      break;
    }
  }
}

// ─────────────────────────────────────────────
// Ejecución de Acciones de Flujo (Fase C.3)
// ─────────────────────────────────────────────
async function executeAction(senderId, senderName, step) {
  if (!supabase) {
    console.warn('⚠️ Supabase no conectado. No se ejecutó la acción:', step.actionType);
    return;
  }
  
  const { actionType, params } = step;
  console.log(`[ACTION] Ejecutando acción: ${actionType} para el usuario ${senderId}`);
  
  try {
    // 1. Obtener o crear al cliente
    let { data: customer, error: fetchErr } = await supabase
      .from('customers')
      .select('*')
      .eq('instagram_id', senderId)
      .single();

    if (fetchErr || !customer) {
      const { data: newCust, error: insertErr } = await supabase
        .from('customers')
        .insert([{ instagram_id: senderId, name: senderName }])
        .select()
        .single();
      if (insertErr) {
        console.error('❌ Error creando cliente:', insertErr.message);
        return;
      }
      customer = newCust;
    }

    // 2. Procesar cada acción
    let updates = {};

    switch (actionType) {
      case 'add_tag': {
        const tag = params.tag?.trim();
        if (tag) {
          const tags = new Set(customer.tags || []);
          tags.add(tag);
          updates.tags = Array.from(tags);
        }
        break;
      }
      case 'remove_tag': {
        const tag = params.tag?.trim();
        if (tag) {
          const tags = new Set(customer.tags || []);
          tags.delete(tag);
          updates.tags = Array.from(tags);
        }
        break;
      }
      case 'set_field': {
        const field = params.field?.trim();
        const value = params.value?.trim();
        if (field) {
          updates.fields = { ...(updates.fields || customer.fields), [field]: value };
        }
        break;
      }
      case 'clear_field': {
        const field = params.field?.trim();
        if (field) {
          updates.fields = { ...(updates.fields || customer.fields) };
          delete updates.fields[field];
        }
        break;
      }
      case 'compute': {
        // Calcula field = operand1 (operador) operand2. Cada operando puede ser
        // el nombre de otro campo del cliente o un número literal.
        const field = params.field?.trim();
        const operator = params.operator || '*';
        const currentFields = updates.fields || customer.fields || {};
        const resolveOperand = (val) => {
          if (val === undefined || val === null || val === '') return NaN;
          const fieldVal = currentFields[val];
          return Number(fieldVal !== undefined ? fieldVal : val);
        };
        const a = resolveOperand(params.operand1);
        const b = resolveOperand(params.operand2);
        if (field && !isNaN(a) && !isNaN(b)) {
          let result;
          if (operator === '+') result = a + b;
          else if (operator === '-') result = a - b;
          else if (operator === '/') result = b !== 0 ? a / b : 0;
          else result = a * b;
          updates.fields = { ...currentFields, [field]: result };
        }
        break;
      }
      case 'delete_contact': {
        await supabase.from('customers').delete().eq('instagram_id', senderId);
        broadcastLog('SYSTEM', `Contacto eliminado permanentemente: ${senderName}`);
        return;
      }
      case 'pause_bot': {
        updates.bot_paused = true;
        break;
      }
      case 'resume_bot': {
        updates.bot_paused = false;
        break;
      }
      case 'mark_open': {
        updates.status = 'open';
        break;
      }
      case 'mark_closed': {
        updates.status = 'closed';
        break;
      }
      case 'subscribe_sequence': {
        const seqId = params.sequence_id;
        if (seqId) {
          await subscribeToSequence(senderId, seqId);
          broadcastLog('SYSTEM', `${senderName} suscrito a secuencia ${seqId}`);
        }
        return;
      }
      case 'unsubscribe_sequence': {
        const seqId = params.sequence_id;
        if (seqId) {
          await supabase.from('sequence_subscriptions')
            .update({ is_unsubscribed: true })
            .eq('instagram_id', senderId)
            .eq('sequence_id', seqId);
          broadcastLog('SYSTEM', `${senderName} desuscrito de secuencia ${seqId}`);
        }
        return;
      }
      default:
        // Por retrocompatibilidad con la version vieja (Acción de etiqueta legacy)
        if (step.tag) {
          console.log(`[ACTION] Legacy tag: ${step.tag}`);
          const tags = new Set(customer.tags || []);
          tags.add(step.tag);
          updates.tags = Array.from(tags);
        } else {
          console.log(`[ACTION] Tipo de acción desconocida: ${actionType}`);
        }
        break;
    }

    // 3. Aplicar actualización si hay cambios
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from('customers')
        .update(updates)
        .eq('instagram_id', senderId);

      if (updateErr) {
        console.error(`❌ Error actualizando cliente en acción ${actionType}:`, updateErr.message);
      } else {
        broadcastLog('SYSTEM', `Acción ${actionType || 'legacy'} ejecutada para ${senderName}`);
      }
    }
  } catch (error) {
    console.error('[ACTION] Excepción general:', error.message);
  }
}

// ─────────────────────────────────────────────
// Handler: Comentario en publicación
// DOC: https://developers.facebook.com/docs/instagram-platform/reference/ig-media/comments
// ─────────────────────────────────────────────
async function handleComment(value) {
  const commentId = value.id;
  const text      = value.text;
  const fromName  = value.from?.username;
  const fromId    = value.from?.id;

  if (fromId === INSTAGRAM_ACCOUNT_ID || (BOT_USERNAME && fromName === BOT_USERNAME)) return;

  if (recentReplies.has(commentId)) return;
  recentReplies.add(commentId);
  setTimeout(() => recentReplies.delete(commentId), 60_000);

  broadcastLog('COMMENT', `@${fromName} comentó: "${text}"`);

  const commentTriggers = flowsConfig.commentTriggers || [];
  const lowerText = removeAccents(text).toLowerCase();
  let matched = null;

  for (const trigger of commentTriggers) {
    if (!trigger.keywords || trigger.keywords.length === 0) continue;
    const matchType = trigger.matchType || 'contains';
    const found = trigger.keywords.find(kw => {
      const cleanKw = removeAccents(kw).toLowerCase();
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
      await replyComment(commentId, pick.replace('{username}', fromName));
    }
    if (matched.privateReply) await sendPrivateReply(commentId, matched.privateReply.replace('{username}', fromName));
    if (matched.dmFlowId) {
      const flow = flowsConfig.flows.find(f => f.id === matched.dmFlowId);
      if (flow) await sendPrivateReply(commentId, flow.steps?.[0]?.message || 'Hola, te escribimos por privado.');
    }
  } else {
    await replyComment(commentId, `Gracias @${fromName} por tu comentario! 🙌`);
    await sendPrivateReply(commentId, `Hola @${fromName}! Vimos tu comentario: "${text}". Te escribimos por aquí para darte una atención más personalizada. ¿En qué podemos ayudarte?`);
  }
}

// ─────────────────────────────────────────────
// Handler: Mención en Historia
// DOC: https://developers.facebook.com/docs/instagram-platform/reference/ig-user/tags
// ─────────────────────────────────────────────
async function handleMention(value) {
  // La API puede enviar un comment_id o un media_id dependiendo de dónde fue la mención
  const mentionId = value.comment_id || value.media_id;
  if (!mentionId) return;

  broadcastLog('MENTION', `Alguien te mencionó en una publicación o comentario (ID: ${mentionId}).`);

  // Revisar si hay un flujo configurado para Menciones
  if (flowsConfig.mentionFlow?.steps?.length > 0) {
    const firstStep = flowsConfig.mentionFlow.steps[0];
    let replyText = '¡Gracias por mencionarnos! 🙌';
    
    // Si el primer nodo es un mensaje, usamos ese texto. No se soportan botones ni carruseles.
    if (firstStep.type === 'message' && firstStep.message) {
      replyText = firstStep.message;
    }

    await replyToMention(mentionId, replyText);
  }
}

// DOC: https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/mentions
async function replyToMention(mentionId, text) {
  if (!ACCESS_TOKEN || !INSTAGRAM_ACCOUNT_ID) return;
  try {
    const payload = new URLSearchParams();
    payload.append('message', text);
    payload.append('access_token', ACCESS_TOKEN);
    
    // El parámetro requerido es comment_id o media_id.
    // Usaremos comment_id por defecto si es numérico/valido. Instagram lo procesa en su backend.
    if (mentionId) {
        payload.append('comment_id', mentionId); // o 'media_id' dependiendo del webhook real, intentamos comment_id
    }

    const res = await axios.post(
      `https://graph.instagram.com/v26.0/${INSTAGRAM_ACCOUNT_ID}/mentions`,
      payload
    );
    
    console.log(`✅ Respuesta a mención enviada a ${mentionId}`);
    broadcastLog('SYSTEM', `Comentario de respuesta publicado en la mención ${mentionId}`);
    return res.data;
  } catch (err) {
    console.error(`❌ Error enviando respuesta a mención ${mentionId}:`, err.response?.data || err.message);
    broadcastLog('ERROR', `Falló respuesta a mención: ${err.message}`);
  }
}

// ─────────────────────────────────────────────
// Message Echoes - Confirmación de envío del bot
// DOC: https://developers.facebook.com/docs/messenger-platform/reference/message-send
// ─────────────────────────────────────────────
async function handleMessageEcho(event) {
  const senderId = event.sender?.id;
  const messageId = event.message?.mid;
  const timestamp = event.timestamp;
  console.log(`✅ Message Echo - ID: ${messageId} enviado a ${senderId}`);
  broadcastLog('ECHO', `Mensaje confirmado (ID: ${messageId})`);
}

// ─────────────────────────────────────────────
// Delivery Confirmations - Confirmación de entrega
// DOC: https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/message-deliveries
// ─────────────────────────────────────────────
async function handleDeliveryConfirmation(event) {
  const senderId = event.sender?.id;
  const watermark = event.delivery?.watermark;
  console.log(`🚚 Delivery Confirmation - Entregado hasta: ${watermark}`);
  broadcastLog('DELIVERY', `Mensaje entregado a ${senderId}`);
}

// ─────────────────────────────────────────────
// Read Receipts - Confirmación de lectura
// DOC: https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/message-reads
// ─────────────────────────────────────────────
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
        await supabase.from('messages')
          .update({ is_read: true })
          .eq('instagram_id', senderId)
          .eq('direction', 'outbound')
          .eq('is_read', false)
          .lte('created_at', new Date(watermark).toISOString());
      }
    } catch (e) {
      console.error('Error actualizando read receipt:', e.message);
    }
  }
}

// ─────────────────────────────────────────────
// Typing Indicator - Usuario está escribiendo
// DOC: https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/typing
// ─────────────────────────────────────────────
async function handleTypingIndicator(event) {
  const senderId = event.sender?.id;
  console.log(`⌨️ Typing Indicator - ${senderId} está escribiendo...`);
  broadcastLog('TYPING', `Usuario está escribiendo...`);
}

// ─────────────────────────────────────────────
// Postback Events - Botones pulsados
// DOC: https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/postback
// ─────────────────────────────────────────────
async function handlePostback(event) {
  const senderId = event.sender?.id;
  const payload = event.postback?.payload;
  const title = event.postback?.title;
  const mid = event.postback?.mid;
  console.log(`🔘 Postback - ${title} (${payload}) desde ${senderId}`);
  broadcastLog('POSTBACK', `Usuario pulsó botón: ${title}`);
  logMessageToDB(senderId, 'inbound', 'postback', title || payload, mid, {
    metadata: { postback_payload: payload, postback_title: title }
  });

  await handleMessage({ sender: event.sender, message: { text: payload } });
}

// ─────────────────────────────────────────────
// Message Reactions - Reacciones a comentarios
// DOC: https://developers.facebook.com/docs/instagram-platform/webhooks/reference
// ─────────────────────────────────────────────
async function handleMessageReaction(event) {
  const senderId = event.sender?.id;
  const reactionData = event.reaction || event.message?.reaction;
  const emoji = reactionData?.emoji || reactionData;
  const action = reactionData?.action || 'react';
  const targetMid = reactionData?.mid;
  console.log(`😊 Message Reaction - ${emoji} (${action}) desde ${senderId}`);
  broadcastLog('REACTION', `Usuario reaccionó: ${emoji}`);
  if (action === 'react') {
    logMessageToDB(senderId, 'inbound', 'reaction', emoji, null, {
      metadata: { reaction: emoji, target_mid: targetMid, action }
    });
  }
}

// ─────────────────────────────────────────────
// Story Reactions - Reacciones a historias
// DOC: https://developers.facebook.com/docs/instagram-platform/webhooks/reference/story-reactions
// ─────────────────────────────────────────────
async function handleStoryReaction(value) {
  const fromId = value.from?.id;
  const fromUsername = value.from?.username;
  const reaction = value.reaction;
  const storyId = value.story?.id;

  console.log(`💬 Story Reaction - @${fromUsername} reaccionó con ${reaction}`);
  broadcastLog('STORY_REACTION', `@${fromUsername} reaccionó a tu historia: ${reaction}`, { id: fromId, name: fromUsername });

  if (supabase) {
    try {
      const { data: existing } = await supabase.from('customers').select('fields').eq('instagram_id', fromId).single();
      await supabase.from('customers').update({
        fields: { ...(existing?.fields || {}), last_story_reaction: reaction, story_reaction_at: new Date().toISOString() }
      }).eq('instagram_id', fromId);
    } catch (e) {
      console.error('Error guardando story reaction:', e.message);
    }
  }
}

// ─────────────────────────────────────────────
// Attachments - Archivos, imágenes, videos
// ─────────────────────────────────────────────
async function handleAttachments(event) {
  const senderId = event.sender?.id;
  const attachments = event.message?.attachments || [];
  const mid = event.message?.mid;

  for (const attachment of attachments) {
    const type = attachment.type;
    const url = attachment.payload?.url;
    console.log(`📎 Attachment - ${type} desde ${senderId}: ${url}`);
    broadcastLog('ATTACHMENT', `Usuario compartió ${type}`, { id: senderId });
    logMessageToDB(senderId, 'inbound', 'attachment', `[${type}]`, mid, {
      attachment_type: type,
      attachment_url: url
    });
  }
}

// ─────────────────────────────────────────────
// Location - Ubicación compartida
// ─────────────────────────────────────────────
async function handleLocation(event) {
  const senderId = event.sender?.id;
  const coords = event.message?.location?.coordinates;
  const mid = event.message?.mid;
  console.log(`📍 Location - Lat: ${coords?.lat}, Lng: ${coords?.long} desde ${senderId}`);
  broadcastLog('LOCATION', `Usuario compartió ubicación`);
  logMessageToDB(senderId, 'inbound', 'location', `📍 ${coords?.lat}, ${coords?.long}`, mid, {
    metadata: { lat: coords?.lat, lng: coords?.long }
  });

  if (supabase && coords) {
    try {
      const { data: existing } = await supabase.from('customers').select('fields').eq('instagram_id', senderId).single();
      await supabase.from('customers').update({
        fields: { ...(existing?.fields || {}), last_location_lat: coords.lat, last_location_lng: coords.long }
      }).eq('instagram_id', senderId);
    } catch (e) {
      console.error('Error guardando ubicación:', e.message);
    }
  }
}

// ─────────────────────────────────────────────
// Share - Contenido compartido
// ─────────────────────────────────────────────
async function handleShare(event) {
  const senderId = event.sender?.id;
  const shares = event.message?.shares || [];
  const mid = event.message?.mid;
  console.log(`🔗 Share - ${shares.length} contenidos compartidos desde ${senderId}`);
  broadcastLog('SHARE', `Usuario compartió contenido`);
  for (const share of shares) {
    const url = share.link || share.url || '';
    logMessageToDB(senderId, 'inbound', 'share', url || '[Contenido compartido]', mid, {
      attachment_type: 'share',
      attachment_url: url,
      metadata: { share }
    });
  }
}

// ─────────────────────────────────────────────
// Live Location - Ubicación en tiempo real
// ─────────────────────────────────────────────
async function handleLiveLocation(event) {
  const senderId = event.sender?.id;
  const liveLocation = event.message?.live_location;
  console.log(`🔴 Live Location - Desde ${senderId}`);
  broadcastLog('LIVE_LOCATION', `Usuario compartió ubicación en vivo`);
}

// ─────────────────────────────────────────────
// User Referral - Usuario viene de referral
// ─────────────────────────────────────────────
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
    } catch (e) {
      console.error('Error guardando referral:', e.message);
    }
  }
}

// ─────────────────────────────────────────────
// Account Linking - Vinculación de cuentas
// ─────────────────────────────────────────────
async function handleAccountLinking(event) {
  const senderId = event.sender?.id;
  const status = event.account_linking?.status; // linked, unlinked
  console.log(`🔗 Account Linking - ${status} para ${senderId}`);
  broadcastLog('ACCOUNT_LINKING', `Cuenta ${status} por ${senderId}`);
}

// ─────────────────────────────────────────────
// Handover Protocol - Pasar entre bot/humano
// ─────────────────────────────────────────────
async function handleHandoverProtocol(event) {
  const senderId = event.sender?.id;
  const metadata = event.pass_thread_control?.metadata;
  console.log(`👤 Handover - Thread pasado a humano (${metadata})`);
  broadcastLog('HANDOVER', `Conversación pasada a humano`, { id: senderId });

  if (supabase) {
    try {
      await supabase.from('customers').update({
        bot_state: 'paused',
        bot_paused: true
      }).eq('instagram_id', senderId);
    } catch (e) {
      console.error('Error en handover:', e.message);
    }
  }
}

// ─────────────────────────────────────────────
// Opt-in - Confirmación de opt-in
// ─────────────────────────────────────────────
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
    } catch (e) {
      console.error('Error guardando opt-in:', e.message);
    }
  }
}

// ─────────────────────────────────────────────
// Payment - Pagos integrados
// ─────────────────────────────────────────────
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
        fields: {
          ...(existing?.fields || {}),
          last_payment: amount,
          last_payment_currency: currency,
          last_payment_at: new Date().toISOString()
        }
      }).eq('instagram_id', senderId);
    } catch (e) {
      console.error('Error guardando pago:', e.message);
    }
  }
}

// ─────────────────────────────────────────────
// Sponsored Message - Mensajes patrocinados
// ─────────────────────────────────────────────
async function handleSponsoredMessage(event) {
  const senderId = event.sender?.id;
  const sponsoredMessage = event.sponsored_message;
  console.log(`🎯 Sponsored Message desde ${senderId}`);
  broadcastLog('SPONSORED', `Usuario vio mensaje patrocinado`);
}

// ─────────────────────────────────────────────
// Policy Enforcement - Violación de política
// ─────────────────────────────────────────────
async function handlePolicyEnforcement(value) {
  const action = value.action; // warn, block, unblock
  console.log(`⚠️ Policy Enforcement - Acción: ${action}`);
  broadcastLog('POLICY', `Acción de cumplimiento: ${action}`);
}

// ─────────────────────────────────────────────
// Message Tags - Para mensajes fuera de 24h
// ─────────────────────────────────────────────
async function handleMessageTags(value) {
  const quality = value.quality; // HIGH, MEDIUM, LOW
  console.log(`🏷️ Message Tags - Calidad: ${quality}`);
  broadcastLog('MESSAGE_TAGS', `Calidad de mensajes: ${quality}`);
}

// ─────────────────────────────────────────────
// Messaging Handover - Protocolo de handover
// ─────────────────────────────────────────────
async function handleMessagingHandover(value) {
  console.log(`🔄 Messaging Handover - ${value?.status || 'event'}`);
  broadcastLog('MESSAGING_HANDOVER', `Evento de handover detectado`);
}

// ─────────────────────────────────────────────
// Welcome Message Ads - Click en anuncio de bienvenida
// ─────────────────────────────────────────────
async function handleWelcomeMessageAd(event) {
  const senderId = event.sender?.id;
  const clickedButtonPayload = event.message?.quick_reply?.payload || event.postback?.payload;

  if (!senderId) return;

  console.log(`🎯 Welcome Message Ad - Usuario: ${senderId}, Botón: ${clickedButtonPayload}`);
  broadcastLog('WELCOME_AD', `Usuario hizo clic en anuncio de bienvenida (payload: ${clickedButtonPayload})`);

  // Registrar conversión en Supabase si existe
  if (supabase) {
    try {
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('instagram_id', senderId)
        .single();

      if (!existingCustomer) {
        // Nuevo cliente desde Welcome Message Ad
        await supabase.from('customers').insert({
          instagram_id: senderId,
          source: 'welcome_message_ad',
          welcome_flow_payload: clickedButtonPayload,
          created_at: new Date().toISOString()
        });
        console.log(`✅ Nuevo cliente registrado desde Welcome Message Ad: ${senderId}`);
      } else {
        // Actualizar fuente si viene de un Welcome Message Ad
        await supabase
          .from('customers')
          .update({
            source: 'welcome_message_ad',
            welcome_flow_payload: clickedButtonPayload
          })
          .eq('id', existingCustomer.id);
      }
    } catch (err) {
      console.error('❌ Error registrando cliente de Welcome Message Ad:', err.message);
    }
  }

  // Ejecutar el flujo asociado al payload del botón
  // Por ejemplo, si payload es "BTN_CATALOG", ejecutar el flujo de catálogo
  if (clickedButtonPayload) {
    const matchingFlow = flowsConfig.flows.find(f =>
      f.keywords && f.keywords.includes(clickedButtonPayload)
    );

    if (matchingFlow && matchingFlow.steps) {
      console.log(`▶️ Ejecutando flujo para Welcome Message Ad: ${matchingFlow.name}`);
      const profile = await getUserProfile(senderId);
      const senderName = profile?.name || senderId;
      matchingFlow.executionCount = (matchingFlow.executionCount || 0) + 1;
      matchingFlow.lastExecutedAt = new Date().toISOString();
      saveFlowsConfig().catch(err => {
        console.warn('⚠️ Error guardando ejecución de Welcome Message Ad (no-bloqueante):', err.message);
      });
      await processFlowSteps(matchingFlow.steps, senderId, senderName);
    }
  }
}

// ─────────────────────────────────────────────
// Log Message to DB (Historial de Contactos)
// ─────────────────────────────────────────────
async function logMessageToDB(instagram_id, direction, type, content, mid = null, extra = {}) {
  if (!supabase) return;
  try {
    const textContent = typeof content === 'string' ? content : JSON.stringify(content);
    const row = {
      instagram_id,
      mid,
      direction,
      message_type: type,
      content: textContent
    };
    if (extra.attachment_type) row.attachment_type = extra.attachment_type;
    if (extra.attachment_url) row.attachment_url = extra.attachment_url;
    if (extra.reply_to_mid) row.reply_to_mid = extra.reply_to_mid;
    if (extra.metadata && Object.keys(extra.metadata).length > 0) row.metadata = extra.metadata;
    await supabase.from('messages').insert(row);
  } catch (err) {
    console.error('⚠️ Error guardando mensaje en DB:', err.message);
  }
}

// ─────────────────────────────────────────────
// Enviar DM
// DOC: https://developers.facebook.com/docs/messenger-platform/send-messages
// ─────────────────────────────────────────────
async function sendMessage(recipientId, text, quickReplies = null) {
  try {
    if (!ACCESS_TOKEN) {
      console.error('❌ Error enviando DM: ACCESS_TOKEN no configurado');
      return;
    }

    const messagePayload = { text };

    // Si hay botones de respuesta rápida, agregarlos al formato de Meta
    if (quickReplies && quickReplies.length > 0) {
      messagePayload.quick_replies = quickReplies.map(qr => ({
        content_type: 'text',
        title: qr.title,
        payload: qr.payload || qr.title
      }));
    }

    await axios.post(
      `${GRAPH_API}/me/messages`,
      {
        recipient: { id: recipientId },
        message: messagePayload,
      },
      {
        params: { access_token: ACCESS_TOKEN },
      }
    );
    console.log(`✅ DM enviado a ${recipientId}`);
    broadcastLog('SYSTEM', `Respuesta enviada a ${recipientId}`);
    logMessageToDB(recipientId, 'outbound', 'text', text);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando DM:', errorMsg);
    broadcastLog('ERROR', `Error al responder: ${errorMsg}`);
  }
}

// ─────────────────────────────────────────────
// Enviar Plantilla de Botones (Button Template)
// ─────────────────────────────────────────────
async function sendTemplate(recipientId, text, buttons) {
  try {
    const formattedButtons = buttons.map(b => {
      if (b.type === 'web_url') {
        return { type: 'web_url', url: b.url, title: b.title };
      } else {
        return { type: 'postback', title: b.title, payload: b.payload };
      }
    });

    const messagePayload = {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: text,
          buttons: formattedButtons
        }
      }
    };

    await axios.post(
      `${GRAPH_API}/me/messages`,
      {
        recipient: { id: recipientId },
        message: messagePayload,
      },
      { params: { access_token: ACCESS_TOKEN } }
    );
    console.log(`✅ Plantilla enviada a ${recipientId}`);
    broadcastLog('SYSTEM', `Plantilla de botones enviada a ${recipientId}`);
    logMessageToDB(recipientId, 'outbound', 'template', text);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando Plantilla:', errorMsg);
    broadcastLog('ERROR', `Error al enviar plantilla: ${errorMsg}`);
  }
}

// ─────────────────────────────────────────────
// Ice Breakers - Preguntas sugeridas al abrir chat
// DOC: https://developers.facebook.com/docs/messenger-platform/discovery/ice-breakers
// ─────────────────────────────────────────────
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

    await axios.post(
      `${GRAPH_API}/me/messages`,
      {
        recipient: { id: recipientId },
        message: messagePayload,
      },
      { params: { access_token: ACCESS_TOKEN } }
    );
    console.log(`❄️ Ice Breaker enviado a ${recipientId}`);
    broadcastLog('SYSTEM', `Ice Breaker enviado a ${recipientId}`);
    logMessageToDB(recipientId, 'outbound', 'text', question);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando Ice Breaker:', errorMsg);
    broadcastLog('ERROR', `Error al enviar Ice Breaker: ${errorMsg}`);
  }
}

// ─────────────────────────────────────────────
// Quick Replies - Respuestas rápidas personalizadas
// ─────────────────────────────────────────────
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

    await axios.post(
      `${GRAPH_API}/me/messages`,
      {
        recipient: { id: recipientId },
        message: messagePayload,
      },
      { params: { access_token: ACCESS_TOKEN } }
    );
    console.log(`⚡ Quick Replies enviado a ${recipientId}`);
    broadcastLog('SYSTEM', `Quick Replies enviado a ${recipientId}`);
    logMessageToDB(recipientId, 'outbound', 'text', text);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando Quick Replies:', errorMsg);
    broadcastLog('ERROR', `Error al enviar Quick Replies: ${errorMsg}`);
  }
}

// ─────────────────────────────────────────────
// Enviar con Messaging Tag (para mensajes 24h+)
// DOC: https://developers.facebook.com/docs/messenger-platform/reference/send-api
// ─────────────────────────────────────────────
async function sendMessageWithTag(recipientId, text, messagingTag = 'ACCOUNT_UPDATE') {
  try {
    const messagePayload = { text };

    await axios.post(
      `${GRAPH_API}/me/messages`,
      {
        recipient: { id: recipientId },
        message: messagePayload,
        messaging_type: 'MESSAGE_TAG',
        tag: messagingTag // ACCOUNT_UPDATE, CONFIRMED_EVENT_UPDATE, POST_PURCHASE_UPDATE, HUMAN_AGENT
      },
      { params: { access_token: ACCESS_TOKEN } }
    );
    console.log(`🏷️ Mensaje con tag "${messagingTag}" enviado a ${recipientId}`);
    broadcastLog('SYSTEM', `Mensaje con tag "${messagingTag}" enviado`);
    logMessageToDB(recipientId, 'outbound', 'text', text);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando mensaje con tag:', errorMsg);
    broadcastLog('ERROR', `Error al enviar con tag: ${errorMsg}`);
  }
}

// ─────────────────────────────────────────────
// FASE 4: Enviar Media Autónomo (Agente IA)
// ─────────────────────────────────────────────
async function sendMediaMessage(recipientId, type, url) {
  try {
    await axios.post(
      `${GRAPH_API}/me/messages`,
      {
        recipient: { id: recipientId },
        message: {
          attachment: { type, payload: { url, is_reusable: true } }
        }
      },
      { params: { access_token: ACCESS_TOKEN }, timeout: 15000 }
    );
    console.log(`✅ Media (${type}) enviado a ${recipientId}`);
    broadcastLog('SYSTEM', `Media enviado a ${recipientId}`);
    logMessageToDB(recipientId, 'outbound', type, url);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando Media autónomo:', errorMsg);
    broadcastLog('ERROR', `Error al enviar media: ${errorMsg}`);
  }
}

// ─────────────────────────────────────────────
// Enviar Tarjeta / Carrusel (Generic Template)
// ─────────────────────────────────────────────
async function sendCard(recipientId, cardData, textFallback = null) {
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

    const messagePayload = {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [element]
        }
      }
    };

    // Meta recomienda enviar un texto introductorio separado antes del carrusel si hay textFallback, 
    // pero para mantenerlo simple, solo enviamos el attachment.
    
    await axios.post(
      `${GRAPH_API}/me/messages`,
      {
        recipient: { id: recipientId },
        message: messagePayload,
      },
      { params: { access_token: ACCESS_TOKEN } }
    );
    console.log(`✅ Tarjeta enviada a ${recipientId}`);
    broadcastLog('SYSTEM', `Tarjeta (Imagen) enviada a ${recipientId}`);
    logMessageToDB(recipientId, 'outbound', 'template', cardData.title);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando Tarjeta:', errorMsg);
    broadcastLog('ERROR', `Error al enviar tarjeta: ${errorMsg}`);
  }
}

// ─────────────────────────────────────────────
// Enviar Carrusel (Generic Template multi-elemento)
// DOC: https://developers.facebook.com/docs/messenger-platform/send-messages/template/generic
// ─────────────────────────────────────────────
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
    await axios.post(
      `${GRAPH_API}/me/messages`,
      {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: 'template',
            payload: { template_type: 'generic', elements: formattedElements }
          }
        }
      },
      { params: { access_token: ACCESS_TOKEN } }
    );
    broadcastLog('SYSTEM', `Carrusel (${formattedElements.length} tarjetas) enviado a ${recipientId}`);
    logMessageToDB(recipientId, 'outbound', 'template', '[Carrusel]');
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando carrusel:', msg);
    broadcastLog('ERROR', `Error al enviar carrusel: ${msg}`);
  }
}

// ─────────────────────────────────────────────
// Enviar Galería (múltiples imágenes con delay)
// ─────────────────────────────────────────────
async function sendGallery(recipientId, images, delayBetweenMs = 300) {
  for (const img of images) {
    try {
      await axios.post(
        `${GRAPH_API}/me/messages`,
        {
          recipient: { id: recipientId },
          message: { attachment: { type: 'image', payload: { url: img.url, is_reusable: true } } }
        },
        { params: { access_token: ACCESS_TOKEN } }
      );
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      console.error('❌ Error enviando imagen de galería:', msg);
    }
    if (delayBetweenMs > 0) await new Promise(r => setTimeout(r, delayBetweenMs));
  }
  broadcastLog('SYSTEM', `Galería (${images.length} imágenes) enviada a ${recipientId}`);
  logMessageToDB(recipientId, 'outbound', 'image', '[Galería de Imágenes]');
}

// ─────────────────────────────────────────────
// Enviar Audio
// ─────────────────────────────────────────────
async function sendAudio(recipientId, audioUrl) {
  try {
    await axios.post(
      `${GRAPH_API}/me/messages`,
      {
        recipient: { id: recipientId },
        message: { attachment: { type: 'audio', payload: { url: audioUrl, is_reusable: true } } }
      },
      { params: { access_token: ACCESS_TOKEN } }
    );
    broadcastLog('SYSTEM', `Audio enviado a ${recipientId}`);
    logMessageToDB(recipientId, 'outbound', 'audio', audioUrl);
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando audio:', msg);
    broadcastLog('ERROR', `Error al enviar audio: ${msg}`);
  }
}

// ─────────────────────────────────────────────
// Enviar Video
// ─────────────────────────────────────────────
async function sendVideo(recipientId, videoUrl) {
  try {
    await axios.post(
      `${GRAPH_API}/me/messages`,
      {
        recipient: { id: recipientId },
        message: { attachment: { type: 'video', payload: { url: videoUrl, is_reusable: true } } }
      },
      { params: { access_token: ACCESS_TOKEN } }
    );
    broadcastLog('SYSTEM', `Video enviado a ${recipientId}`);
    logMessageToDB(recipientId, 'outbound', 'video', videoUrl);
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando video:', msg);
    broadcastLog('ERROR', `Error al enviar video: ${msg}`);
  }
}

// ─────────────────────────────────────────────
// Enviar Archivo / PDF
// ─────────────────────────────────────────────
async function sendFile(recipientId, fileUrl) {
  try {
    await axios.post(
      `${GRAPH_API}/me/messages`,
      {
        recipient: { id: recipientId },
        message: { attachment: { type: 'file', payload: { url: fileUrl, is_reusable: true } } }
      },
      { params: { access_token: ACCESS_TOKEN } }
    );
    broadcastLog('SYSTEM', `Archivo enviado a ${recipientId}`);
    logMessageToDB(recipientId, 'outbound', 'file', fileUrl);
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando archivo:', msg);
    broadcastLog('ERROR', `Error al enviar archivo: ${msg}`);
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
      { params: { access_token: ACCESS_TOKEN } }
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
// Enviar respuesta privada (DM) a un comentario
// DOC: https://developers.facebook.com/docs/messenger-platform/instagram/features/private-replies
// ─────────────────────────────────────────────
async function sendPrivateReply(commentId, text) {
  try {
    await axios.post(
      `${GRAPH_API}/me/messages`,
      {
        recipient: { comment_id: commentId },
        message:   { text },
      },
      { params: { access_token: ACCESS_TOKEN } }
    );
    console.log(`✅ DM privado enviado al autor del comentario ${commentId}`);
    broadcastLog('SYSTEM', `DM enviado en privado al autor del comentario`);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando DM privado:', errorMsg);
    broadcastLog('ERROR', `Error al enviar DM privado: ${errorMsg}`);
  }
}

// ─────────────────────────────────────────────
// Secuencias / Drip Campaigns
// ─────────────────────────────────────────────
let sequencesConfig = [];
try {
  const rawSeq = fs.readFileSync(path.join(__dirname, 'sequences.json'));
  sequencesConfig = JSON.parse(rawSeq);
} catch (e) { /* no sequences.json yet */ }

async function subscribeToSequence(instagramId, sequenceId) {
  if (!supabase) return;
  const { data: existing } = await supabase.from('sequence_subscriptions')
    .select('id').eq('instagram_id', instagramId).eq('sequence_id', sequenceId).eq('is_completed', false).eq('is_unsubscribed', false).maybeSingle();
  if (existing) return;
  const seq = sequencesConfig.find(s => s.id === sequenceId);
  if (!seq || !seq.steps || seq.steps.length === 0) return;
  const firstDelay = (seq.steps[0].delay_hours || 0) * 3600000;
  await supabase.from('sequence_subscriptions').insert([{
    sequence_id: sequenceId,
    instagram_id: instagramId,
    current_step: 0,
    next_send_at: new Date(Date.now() + firstDelay).toISOString(),
    is_completed: false,
    is_unsubscribed: false
  }]);
}

async function processSequenceScheduler() {
  if (!supabase) return;
  try {
    const { data: pending } = await supabase.from('sequence_subscriptions')
      .select('*')
      .eq('is_completed', false)
      .eq('is_unsubscribed', false)
      .lte('next_send_at', new Date().toISOString())
      .limit(50);
    if (!pending || pending.length === 0) return;
    for (const sub of pending) {
      const seq = sequencesConfig.find(s => s.id === sub.sequence_id);
      if (!seq || !seq.steps) continue;
      const step = seq.steps[sub.current_step];
      if (!step) continue;
      const profile = await getUserProfile(sub.instagram_id);
      const name = profile?.name || sub.instagram_id;
      if (step.steps && step.steps.length > 0) {
        await processFlowSteps(step.steps, sub.instagram_id, name);
      }
      const nextIdx = sub.current_step + 1;
      if (nextIdx >= seq.steps.length) {
        await supabase.from('sequence_subscriptions').update({ is_completed: true }).eq('id', sub.id);
        broadcastLog('SYSTEM', `Secuencia ${seq.name || seq.id} completada para ${name}`);
      } else {
        const nextDelay = (seq.steps[nextIdx].delay_hours || 0) * 3600000;
        await supabase.from('sequence_subscriptions').update({
          current_step: nextIdx,
          next_send_at: new Date(Date.now() + nextDelay).toISOString()
        }).eq('id', sub.id);
      }
    }
  } catch (e) {
    console.error('[SEQUENCES] Error en scheduler:', e.message);
  }
}

setInterval(processSequenceScheduler, 60_000);

app.get('/api/sequences', (req, res) => res.json(sequencesConfig));

app.post('/api/sequences', async (req, res) => {
  try {
    sequencesConfig = req.body;
    await fs.promises.writeFile(path.join(__dirname, 'sequences.json'), JSON.stringify(sequencesConfig, null, 2));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// Broadcasts — Envío masivo
// ─────────────────────────────────────────────
const BROADCASTS_FILE = path.join(__dirname, 'broadcasts.json');
let activeBroadcasts = {};

function loadBroadcasts() {
  try {
    if (fs.existsSync(BROADCASTS_FILE)) {
      activeBroadcasts = JSON.parse(fs.readFileSync(BROADCASTS_FILE, 'utf8'));
    }
  } catch (e) { console.warn('⚠️ Error al cargar broadcasts:', e.message); }
}
function saveBroadcasts() {
  try { fs.writeFileSync(BROADCASTS_FILE, JSON.stringify(activeBroadcasts, null, 2)); }
  catch (e) { console.error('❌ Error al guardar broadcasts:', e.message); }
}
loadBroadcasts();

app.post('/api/broadcasts', async (req, res) => {
  const { name, message_steps, recipient_filter, scheduled_at } = req.body;
  const id = 'bc_' + Date.now();
  const broadcast = { id, name, message_steps, recipient_filter, scheduled_at, status: scheduled_at ? 'scheduled' : 'sending', total: 0, sent: 0, failed: 0, created_at: new Date().toISOString() };
  activeBroadcasts[id] = broadcast;
  saveBroadcasts();
  if (!scheduled_at) {
    executeBroadcast(broadcast);
  }
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
      try {
        await processFlowSteps(broadcast.message_steps || [], instagram_id, name || instagram_id);
        broadcast.sent++;
      } catch (e) {
        broadcast.failed++;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    broadcast.status = 'completed';
    broadcast.completed_at = new Date().toISOString();
    saveBroadcasts();
    broadcastLog('SYSTEM', `Broadcast "${broadcast.name}" completado: ${broadcast.sent}/${broadcast.total} enviados`);
  } catch (e) {
    broadcast.status = 'failed';
    saveBroadcasts();
    console.error('[BROADCAST] Error:', e.message);
  }
}

setInterval(() => {
  const now = new Date();
  for (const bc of Object.values(activeBroadcasts)) {
    if (bc.status === 'scheduled' && bc.scheduled_at && new Date(bc.scheduled_at) <= now) {
      executeBroadcast(bc);
      saveBroadcasts();
    }
  }
}, 60_000);

// ─────────────────────────────────────────────
// Welcome Flow API
// ─────────────────────────────────────────────
app.get('/api/welcome-flow', (req, res) => {
  res.json(flowsConfig.welcomeFlow || { steps: [] });
});

app.post('/api/welcome-flow', async (req, res) => {
  try {
    flowsConfig.welcomeFlow = req.body;
    await saveFlowsConfig();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// Opt-in Widgets — Generar enlaces de chat
// ─────────────────────────────────────────────
const INSTAGRAM_HANDLE = process.env.INSTAGRAM_HANDLE || '';

app.get('/api/widget-config', (req, res) => {
  res.json({
    instagram_handle: INSTAGRAM_HANDLE,
    chat_url: INSTAGRAM_HANDLE ? `https://ig.me/m/${INSTAGRAM_HANDLE}` : null,
    flows: flowsConfig.flows.map(f => ({ id: f.id, name: f.name }))
  });
});

app.get('/chat-init', (req, res) => {
  if (!INSTAGRAM_HANDLE) return res.status(400).json({ error: 'INSTAGRAM_HANDLE no configurado' });
  res.redirect(`https://ig.me/m/${INSTAGRAM_HANDLE}`);
});

// ─────────────────────────────────────────────
// Comment Triggers API
// ─────────────────────────────────────────────
app.get('/api/comment-triggers', (req, res) => {
  res.json(flowsConfig.commentTriggers || []);
});

app.post('/api/comment-triggers', async (req, res) => {
  try {
    flowsConfig.commentTriggers = req.body;
    await saveFlowsConfig();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// Instagram OAuth 2.0 (Business Login)
// ─────────────────────────────────────────────
const META_REDIRECT_URI = process.env.META_REDIRECT_URI || 'http://localhost:3000/auth/callback';

app.get('/auth/instagram', (req, res) => {
  const url = `https://www.instagram.com/oauth/authorize?client_id=${process.env.META_APP_ID}&redirect_uri=${META_REDIRECT_URI}&response_type=code&scope=instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish`;
  res.redirect(url);
});

app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send('Error: Código de autorización no proporcionado.');
  
  try {
    // 1. Obtener Token de corta duración
    const formData = new URLSearchParams();
    formData.append('client_id', process.env.META_APP_ID);
    formData.append('client_secret', process.env.META_APP_SECRET);
    formData.append('grant_type', 'authorization_code');
    formData.append('redirect_uri', META_REDIRECT_URI);
    formData.append('code', code.replace('#_', ''));

    const tokenRes = await axios.post('https://api.instagram.com/oauth/access_token', formData);
    const shortToken = tokenRes.data.access_token;
    
    // 2. Intercambiar por Token de larga duración (60 días)
    const longRes = await axios.get(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.META_APP_SECRET}&access_token=${shortToken}`);
    const longToken = longRes.data.access_token;
    
    // 3. Obtener el ID de la cuenta de Instagram usando el nuevo token
    const meRes = await axios.get(`https://graph.instagram.com/v21.0/me?fields=user_id,username&access_token=${longToken}`);
    const igAccountId = meRes.data.user_id || meRes.data.data?.[0]?.user_id; // Depende de la estructura de la API v21.0
    
    // 4. Guardar en Supabase
    if (supabase) {
      await supabase.from('app_config').upsert({ key: 'INSTAGRAM_ACCESS_TOKEN', value: longToken, updated_at: new Date() });
      if (igAccountId) {
        await supabase.from('app_config').upsert({ key: 'INSTAGRAM_ACCOUNT_ID', value: igAccountId, updated_at: new Date() });
      }
    }
    
    // 5. Actualizar memoria RAM
    ACCESS_TOKEN = longToken;
    if (igAccountId) INSTAGRAM_ACCOUNT_ID = igAccountId;
    
    res.send(`
      <div style="font-family:sans-serif; text-align:center; padding: 50px;">
        <h1 style="color:#22c55e;">✅ Conexión Exitosa</h1>
        <p>El CRM ha sido actualizado con el nuevo token OAuth 2.0 de Instagram.</p>
        <p>Puedes cerrar esta ventana y regresar al dashboard.</p>
        <script>setTimeout(() => window.close(), 3000);</script>
      </div>
    `);
  } catch (e) {
    const errMsg = e.response?.data?.error_message || e.message;
    console.error('Error OAuth:', errMsg, e.response?.data);
    res.send('<h1 style="color:red;">Error en Autenticación OAuth</h1><p>' + errMsg + '</p>');
  }
});

// Endpoint para verificar estado en frontend
app.get('/api/auth/status', (req, res) => {
  res.json({ connected: !!ACCESS_TOKEN });
});

// ─────────────────────────────────────────────
// Mention Flow API
// ─────────────────────────────────────────────
app.get('/api/mention-flow', (req, res) => {
  res.json(flowsConfig.mentionFlow || { steps: [] });
});

app.post('/api/mention-flow', async (req, res) => {
  try {
    flowsConfig.mentionFlow = req.body;
    await saveFlowsConfig();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// Sincronización Histórica de Meta
// ─────────────────────────────────────────────
app.post('/api/sync-conversations', express.json(), async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase no conectado' });
  if (!ACCESS_TOKEN) return res.status(503).json({ error: 'No access token configured' });
  if (!INSTAGRAM_ACCOUNT_ID) return res.status(503).json({ error: 'No account ID configured' });
  
  try {
    // 1. Obtener conversaciones
    const convResponse = await axios.get(`https://graph.instagram.com/v26.0/me/conversations?platform=instagram`, {
      params: { access_token: ACCESS_TOKEN }
    });
    
    const conversations = convResponse.data.data || [];
    let messagesSynced = 0;
    
    for (const conv of conversations) {
      try {
        // 2. Obtener mensajes de la conversación
        const msgListRes = await axios.get(`https://graph.instagram.com/v26.0/${conv.id}`, {
          params: { fields: 'messages', access_token: ACCESS_TOKEN }
        });
        
        const messages = msgListRes.data.messages?.data || [];
        
        for (const msg of messages) {
          try {
            // 3. Obtener detalle del mensaje
            const detailRes = await axios.get(`https://graph.instagram.com/v26.0/${msg.id}`, {
              params: { fields: 'id,created_time,from,to,message', access_token: ACCESS_TOKEN }
            });
            
            const detail = detailRes.data;
            if (!detail || !detail.from) continue;
            
            // Determinar quién es el cliente
            const isBot = String(detail.from.id).trim() === String(INSTAGRAM_ACCOUNT_ID).trim();
            const customerId = isBot ? detail.to?.data?.[0]?.id : detail.from.id;
            const customerName = isBot ? detail.to?.data?.[0]?.username : detail.from.username;
            
            if (!customerId) continue;
            
            // Guardar cliente en Supabase
            await supabase
              .from('customers')
              .upsert({
                instagram_id: customerId,
                name: customerName || 'Desconocido',
                platform: 'instagram'
              }, { onConflict: 'instagram_id' });
              
            // Guardar mensaje en Supabase
            await supabase
              .from('messages')
              .upsert({
                message_id: detail.id,
                customer_id: customerId,
                direction: isBot ? 'outbound' : 'inbound',
                text: detail.message || '',
                timestamp: detail.created_time
              }, { onConflict: 'message_id' });
              
            messagesSynced++;
          } catch (e) {
            console.error(`Error sync msg ${msg.id}:`, e.message);
          }
        }
      } catch (e) {
         console.error(`Error sync conv ${conv.id}:`, e.message);
      }
    }
    
    res.json({ success: true, conversations_checked: conversations.length, messages_synced: messagesSynced });
  } catch (err) {
    console.error('Error in sync-conversations:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to sync conversations' });
  }
});

// ─────────────────────────────────────────────
// Insights API — Métricas de Instagram
// ─────────────────────────────────────────────
app.get('/api/insights/profile', async (req, res) => {
  if (!ACCESS_TOKEN) return res.status(503).json({ error: 'No access token configured' });
  try {
    const response = await axios.get(`https://graph.instagram.com/v26.0/me`, {
      params: { 
        fields: 'id,username,name,followers_count,follows_count,media_count,profile_picture_url',
        access_token: ACCESS_TOKEN 
      }
    });
    res.json(response.data);
  } catch (err) {
    console.error('Error in /api/insights/profile:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch profile insights' });
  }
});

app.get('/api/insights/media', async (req, res) => {
  if (!ACCESS_TOKEN) return res.status(503).json({ error: 'No access token configured' });
  try {
    const response = await axios.get(`https://graph.instagram.com/v26.0/me/media`, {
      params: { 
        fields: 'id,caption,media_type,media_url,thumbnail_url,like_count,comments_count,timestamp,permalink',
        limit: 12,
        access_token: ACCESS_TOKEN 
      }
    });
    res.json(response.data);
  } catch (err) {
    console.error('Error in /api/insights/media:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch media insights' });
  }
});

// ─────────────────────────────────────────────
// Contactos API — Dashboard, filtros, exportar
// ─────────────────────────────────────────────
app.get('/api/contacts', async (req, res) => {
  if (!supabase) return res.json([]);
  try {
    const { search, tag, status, limit = 50, offset = 0 } = req.query;
    let query = supabase.from('customers').select('*');
    if (search) {
      // Allowlist estricto: solo letras, números, espacios y separadores comunes de nombres/usernames.
      // Bloquea , ( ) % " que tienen significado especial en la sintaxis de filtros de PostgREST.
      const safeSearch = search.replace(/[^a-zA-Z0-9À-ÿ\s._-]/g, '');
      if (safeSearch) {
        query = query.or(`name.ilike.%${safeSearch}%,instagram_id.ilike.%${safeSearch}%`);
      }
    }
    if (tag) query = query.contains('tags', [tag]);
    if (status) query = query.eq('status', status);
    query = query.order('updated_at', { ascending: false }).range(Number(offset), Number(offset) + Number(limit) - 1);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Enriquecer con conteo de mensajes y no leídos
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
      } catch (e) {
        console.warn('Stats de mensajes no disponibles:', e.message);
      }
    }

    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/contacts/count', async (req, res) => {
  if (!supabase) return res.json({ count: 0 });
  try {
    const { count, error } = await supabase.from('customers').select('*', { count: 'exact', head: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/contacts/:id', async (req, res) => {
  if (!supabase) return res.status(404).json({ error: 'No DB' });
  try {
    const { data, error } = await supabase.from('customers').select('*').eq('instagram_id', req.params.id).single();
    if (error) return res.status(404).json({ error: 'Contacto no encontrado' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/contacts/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'No DB' });
  try {
    const allowedFields = ['name', 'tags', 'status', 'fields', 'bot_paused'];
    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from('customers').update(updates).eq('instagram_id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/contacts-export', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'No DB' });
  try {
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false }).limit(10000);
    if (!data || data.length === 0) return res.status(404).json({ error: 'Sin contactos' });
    const headers = ['instagram_id', 'name', 'tags', 'status', 'bot_paused', 'bot_state', 'fields', 'created_at', 'updated_at'];
    const csvRows = [headers.join(',')];
    for (const row of data) {
      csvRows.push(headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(','));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="contactos.csv"');
    res.send(csvRows.join('\n'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/tags', async (req, res) => {
  if (!supabase) return res.json([]);
  try {
    const { data } = await supabase.from('customers').select('tags');
    const allTags = new Set();
    for (const row of (data || [])) {
      for (const tag of (row.tags || [])) allTags.add(tag);
    }
    res.json(Array.from(allTags).sort());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// Manejador de errores global Express
// ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[EXPRESS ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ─────────────────────────────────────────────
// Validación de configuración crítica
// ─────────────────────────────────────────────
if (!process.env.API_SECRET) {
  console.error('❌ FATAL: API_SECRET no está configurada.');
  console.error('   Configura esta variable de entorno y reinicia el servidor.');
  process.exit(1);
}

// ─────────────────────────────────────────────
// Arranque del servidor
// ─────────────────────────────────────────────
app.listen(PORT, async () => {
  await loadAppConfig(); // Cargar token desde DB
  console.log(`🚀 CRM 2.0 Webhook escuchando en http://localhost:${PORT}/webhook`);
  console.log(`   Account ID : ${INSTAGRAM_ACCOUNT_ID}`);
  console.log(`   Verify Token: ${VERIFY_TOKEN}`);
});
