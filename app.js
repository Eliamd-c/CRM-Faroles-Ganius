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
try {
  const rawData = fs.readFileSync(path.join(__dirname, 'flows.json'));
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
} catch (err) {
  console.error('❌ Error al cargar flows.json', err);
}

async function saveFlowsConfig() {
  await fs.promises.writeFile(
    path.join(__dirname, 'flows.json'),
    JSON.stringify(flowsConfig, null, 2)
  );
}

// ─────────────────────────────────────────────────────────────────
// FASE 2: Cargar Contexto Maestro del Agente IA al arrancar
// El archivo .md se lee una sola vez y se guarda en memoria.
// Al ponerlo al inicio del prompt se activa el Prompt Caching
// de OpenAI (50% ahorro en tokens de entrada, -80% latencia).
// ─────────────────────────────────────────────────────────────────
let AI_MASTER_CONTEXT = '';
let AI_BASE_PERSONA = ''; // FASE 6
try {
  const contextPath = path.join(__dirname, 'Agente_IA_Faroles_Genius_Contexto_Maestro.md');
  AI_MASTER_CONTEXT = fs.readFileSync(contextPath, 'utf8');
  console.log(`🧠 Contexto maestro cargado (${AI_MASTER_CONTEXT.length} caracteres / ~${Math.round(AI_MASTER_CONTEXT.length / 4)} tokens)`);
  
  const splitIdx = AI_MASTER_CONTEXT.indexOf('# SECCIÓN 5:');
  AI_BASE_PERSONA = splitIdx !== -1 ? AI_MASTER_CONTEXT.substring(0, splitIdx) : AI_MASTER_CONTEXT;
} catch (err) {
  console.warn('⚠️ Contexto maestro no encontrado. El agente usará prompt genérico. Asegúrate de que el archivo Agente_IA_Faroles_Genius_Contexto_Maestro.md existe en la raíz del proyecto.');
}

// ─────────────────────────────────────────────────────────────────
// FASE 6: Recuperación de Contexto (RAG con pgvector)
// ─────────────────────────────────────────────────────────────────
async function retrieveRelevantContext(query) {
  if (!supabase || !process.env.OPENAI_API_KEY) return AI_MASTER_CONTEXT;
  try {
    const embedRes = await axios.post(
      'https://api.openai.com/v1/embeddings',
      { input: query, model: 'text-embedding-3-small' },
      { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }, timeout: 15000 }
    );
    const queryEmbedding = embedRes.data.data[0].embedding;
    
    // FASE 7: Buscar primero en respuestas aprendidas
    let learnedContext = "";
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
    
    if (error || !chunks || chunks.length === 0) return AI_MASTER_CONTEXT;
    
    let ragContext = "\n\n=== CONOCIMIENTO RECUPERADO (RAG) ===\nÚsalo para responder al cliente:\n";
    chunks.forEach(c => ragContext += `\n[${c.section_title}]\n${c.content}\n`);
    
    return AI_BASE_PERSONA + learnedContext + ragContext;
  } catch (err) {
    console.error('Error en RAG:', err.message);
    return AI_MASTER_CONTEXT;
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

// Fallback: si no está INSTAGRAM_ACCESS_TOKEN, usa PAGE_ACCESS_TOKEN
const ACCESS_TOKEN = INSTAGRAM_ACCESS_TOKEN || PAGE_ACCESS_TOKEN;

const GRAPH_API = 'https://graph.facebook.com/v21.0';

// ─────────────────────────────────────────────
// Inicialización del Bot (Cargar datos propios)
// ─────────────────────────────────────────────
let BOT_USERNAME = process.env.BOT_USERNAME || null;
const recentReplies = new Set(); // Para guardar textos de respuestas recientes y evitar ecos

async function initBot() {
  try {
    const res = await axios.get(`${GRAPH_API}/${INSTAGRAM_ACCOUNT_ID}`, {
      params: { fields: 'username', access_token: ACCESS_TOKEN }
    });
    BOT_USERNAME = res.data.username;
    console.log(`🤖 Bot inicializado. Username: @${BOT_USERNAME}`);
    // No podemos hacer broadcast aquí porque aún no hay clientes conectados,
    // pero guardamos el estado.
  } catch (err) {
    console.error('❌ Error obteniendo datos del bot en inicio:', err.response?.data || err.message);
  }
}
if (!BOT_USERNAME) {
  initBot();
}

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
app.post('/webhook', async (req, res) => {
  // Verificación de Firma (Seguridad)
  const signature = req.headers['x-hub-signature-256'];
  const appSecret = process.env.META_APP_SECRET;
  
  if (appSecret && signature) {
    const expectedSignature = 'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');
    if (signature !== expectedSignature) {
      console.warn('❌ Firma de webhook inválida');
      return res.status(403).send('Invalid signature');
    }
  } else if (!appSecret) {
    console.error('❌ META_APP_SECRET no configurado, bloqueando petición.');
    return res.status(500).send('Server misconfiguration');
  } else if (!signature) {
    console.warn('❌ Petición sin firma X-Hub-Signature-256');
    return res.status(403).send('Missing signature');
  }

  // Responder 200 inmediatamente para que Meta no reintente
  res.sendStatus(200);

  const body = req.body;
  const eventId = body?.entry?.[0]?.id || 'unknown';
  console.log(`\n📨 Evento recibido de Instagram (ID: ${eventId})`);

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
// API REST para el Flow Builder
// ─────────────────────────────────────────────

// Leer flujos
app.get('/api/flows', (req, res) => {
  res.json(flowsConfig);
});

// Obtener publicaciones recientes de Instagram para selector de comentarios
app.get('/api/instagram/media', async (req, res) => {
  try {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;
    if (!token) return res.status(503).json({ error: 'No access token configured' });
    const url = `https://graph.facebook.com/v21.0/me/media?fields=id,media_type,thumbnail_url,media_url,caption,timestamp,permalink&limit=12&access_token=${token}`;
    const r = await fetch(url);
    const data = await r.json();
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

    await fs.promises.writeFile(path.join(__dirname, 'flows.json'), JSON.stringify(incoming, null, 2));
    flowsConfig = incoming;
    console.log('✅ flows.json actualizado desde el Builder (merge)');
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
const aiRateLimits = new Map();
const MAX_AI_CALLS_PER_HOUR = 10;
// setInterval(() => aiRateLimits.clear(), 3600000); eliminado
function checkAiRateLimit(key) {
  if (!key) return true;
  const now = Date.now();
  let timestamps = aiRateLimits.get(key) || [];
  // Limpiar timestamps más antiguos de 1 hora
  timestamps = timestamps.filter(ts => now - ts < 3600000);
  
  if (timestamps.length >= MAX_AI_CALLS_PER_HOUR) {
    aiRateLimits.set(key, timestamps); // Guardar el array limpio
    return false;
  }
  timestamps.push(now);
  aiRateLimits.set(key, timestamps);
  return true;
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
  if (!checkAiRateLimit(senderId)) {
    console.log(`[Smart Trigger] Fallback abortado: Límite de IA excedido para ${senderId}`);
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
    return reply;
  } catch (err) {
    console.error('OpenAI API Error (detectIntentWithAI):', err.response?.status, err.message);
  }
  return null;
}

// Utilidad: Quitar acentos de un texto
const removeAccents = (str) => str.normalize('NFD').replace(/[̀-ͯ]/g, '');

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
    await sendMessage(senderId, `¡Hola @${senderName}! 👋 ¡Gracias por mencionarnos en tu historia! Nos encanta ❤️`);
    return;
  }

  // 2. Manejo de Mensajes Directos regulares (DM)
  broadcastLog('DM', `Recibido de ${senderName}: "${text}"`, profile);

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
      const { error: insertErr } = await supabase
        .from('customers')
        .insert([{ instagram_id: senderId, name: senderName, tags: [], fields: {}, bot_paused: false, bot_state: 'active' }]);
      if (!insertErr) {
        broadcastLog('SYSTEM', `Nuevo contacto creado: ${senderName}`);
        if (flowsConfig.welcomeFlow?.steps?.length > 0) {
          broadcastLog('SYSTEM', `Ejecutando Welcome Flow para ${senderName}`);
          await processFlowSteps(flowsConfig.welcomeFlow.steps, senderId, senderName);
          return;
        }
      }
    } catch (e) {
      console.error('[DB] Error creando nuevo contacto:', e.message);
    }
  }

  // 3.8 Máquina de Estados: Agente IA
  if (customer && customer.bot_state === 'ai_agent') {
    const escapeWords = ['salir', 'menu', 'menú', 'humano', 'asesor', 'agente'];
    const lowerTxt = text.trim().toLowerCase();
    
    if (escapeWords.includes(lowerTxt)) {
      await supabase.from('customers').update({ bot_state: 'active' }).eq('instagram_id', senderId);
      await sendMessage(senderId, "Saliendo del asistente IA...");
      customer.bot_state = 'active'; 
      // Continuar con el código para que dispare flujos normales si coincide
    } else {
      if (!process.env.OPENAI_API_KEY) {
        await sendMessage(senderId, "⚠️ El agente de IA no está configurado (Falta API Key).");
        return;
      }
      if (!checkAiRateLimit(senderId)) {
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
        const dynamicContext = await retrieveRelevantContext(text);
        
        if (nodePrompt) {
          systemPrompt = dynamicContext + '\n\n---\n## INSTRUCCIONES ADICIONALES PARA ESTE FLUJO\n' + nodePrompt;
        } else {
          systemPrompt = dynamicContext;
        }
      }
      
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
        
        history.push({ role: 'user', content: text });
        
        if (choice.finish_reason === 'tool_calls') {
          // FASE 5: Procesar las llamadas a herramientas
          history.push(choice.message); // Añadir el tool_call al historial
          let escalatedToHuman = false;

          for (const toolCall of choice.message.tool_calls) {
            const args = JSON.parse(toolCall.function.arguments);
            
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
              await supabase.from('customers').update({ bot_state: 'paused' }).eq('instagram_id', senderId);
              await sendMessage(senderId, "Perfecto, voy a pasarte con alguien de nuestro equipo para confirmar detalles... 🕯️");
              broadcastLog('ESCALATION', `${senderName}: ${args.reason}`);

              history.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: 'Escalado exitosamente a humano. El bot está pausado.'
              });
            }
          }

          // SEGUNDA LLAMADA A OPENAI para respuesta final (se omite si ya se escaló a un humano,
          // el mensaje fijo de escalate_to_human ya es suficiente y el bot quedó en pausa)
          if (!escalatedToHuman) {
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
              history.push({ role: 'assistant', content: finalReply });
              await sendMessage(senderId, finalReply);
            }
          }

          if (history.length > 15) history = history.slice(history.length - 15);
          await supabase.from('customers').update({
            ai_history: history
          }).eq('instagram_id', senderId);
          
          broadcastLog('SYSTEM', `Agente IA usó herramientas y respondió a ${senderName} (${Date.now() - aiStartTime}ms)`);
        } else {
          // Texto normal
          const aiReply = choice.message.content?.trim();
          if (!aiReply) throw new Error('Contenido de respuesta vacío de OpenAI');
          
          history.push({ role: 'assistant', content: aiReply });
          if (history.length > 10) history = history.slice(history.length - 10);
          
          await supabase.from('customers').update({
            ai_history: history
          }).eq('instagram_id', senderId);
          
          await sendMessage(senderId, aiReply);
          broadcastLog('SYSTEM', `Agente IA respondió a ${senderName} (${Date.now() - aiStartTime}ms)`);
        }

        // FASE 8: Registrar métricas de Analytics
        if (supabase) {
          const latency_ms = Date.now() - aiStartTime;
          supabase.from('ai_analytics').insert({
            instagram_id: senderId,
            prompt_tokens: usage?.prompt_tokens || 0,
            completion_tokens: usage?.completion_tokens || 0,
            cached_tokens: cachedTokens,
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
        updates.fields = { ...customer.fields, [customer.awaiting_input_field]: lowerTxt };
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
    saveFlowsConfig().catch(() => {});
    await processFlowSteps(matchedFlow.steps, senderId, senderName);
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
        saveFlowsConfig().catch(() => {});
        await processFlowSteps(smartFlow.steps, senderId, senderName);
        return;
      }
    }

    // 7. Flujo por Defecto (Si la IA no detecta intención)
    if (flowsConfig.defaultFlow?.steps) {
      console.log(`[Router] No hubo coincidencia. Ejecutando Default Flow.`);
      await processFlowSteps(flowsConfig.defaultFlow.steps, senderId, senderName);
    }
  }
}

// ─────────────────────────────────────────────
// Procesador de Pasos del Flujo
// ─────────────────────────────────────────────
async function processFlowSteps(steps, senderId, senderName, _visited = new Set()) {
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
        if (nextFlow) await processFlowSteps(nextFlow.steps, senderId, senderName, _visited);
      }
      break; // Detiene el array lineal actual porque la condición bifurca
    } else if (step.type === 'randomizer') {
      if (step.paths && step.paths.length > 0) {
        const randomPayload = step.paths[Math.floor(Math.random() * step.paths.length)];
        if (randomPayload && !_visited.has(randomPayload)) {
          _visited.add(randomPayload);
          const nextFlow = flowsConfig.flows.find(f => f.id === `flow_${randomPayload}`);
          if (nextFlow) await processFlowSteps(nextFlow.steps, senderId, senderName, _visited);
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
        if (targetFlow) await processFlowSteps(targetFlow.steps, senderId, senderName, _visited);
        else broadcastLog('WARNING', `Goto: Flujo no encontrado: ${targetId}`);
      }
      break;
    } else if (step.type === 'ai_agent') {
      if (supabase) {
        await supabase.from('customers').update({
          bot_state: 'ai_agent',
          current_ai_prompt: step.system_prompt || '',
          ignore_master_context: step.ignore_master_context || false  // FASE 3
        }).eq('instagram_id', senderId);
        broadcastLog('SYSTEM', `Agente IA activado para ${senderName}${step.ignore_master_context ? ' (modo standalone)' : ' (con Contexto Maestro)'}`);
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
  const from = value.from?.username;
  broadcastLog('MENTION', `@${from} te mencionó en una historia.`);

  if (flowsConfig.mentionFlow?.steps?.length > 0) {
    const senderId = value.from?.id;
    if (senderId) {
      await processFlowSteps(flowsConfig.mentionFlow.steps, senderId, from || senderId);
    }
  }
}

// ─────────────────────────────────────────────
// Enviar DM
// DOC: https://developers.facebook.com/docs/messenger-platform/send-messages
// ─────────────────────────────────────────────
async function sendMessage(recipientId, text, quickReplies = null) {
  try {
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
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando Plantilla:', errorMsg);
    broadcastLog('ERROR', `Error al enviar plantilla: ${errorMsg}`);
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
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error enviando Media autónomo:', errorMsg);
    broadcastLog('ERROR', `Error al enviar media: ${errorMsg}`);
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
    await fs.promises.writeFile(path.join(__dirname, 'flows.json'), JSON.stringify(flowsConfig, null, 2));
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
    await fs.promises.writeFile(path.join(__dirname, 'flows.json'), JSON.stringify(flowsConfig, null, 2));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
    await fs.promises.writeFile(path.join(__dirname, 'flows.json'), JSON.stringify(flowsConfig, null, 2));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
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
app.listen(PORT, () => {
  console.log(`🚀 CRM 2.0 Webhook escuchando en http://localhost:${PORT}/webhook`);
  console.log(`   Account ID : ${INSTAGRAM_ACCOUNT_ID}`);
  console.log(`   Verify Token: ${VERIFY_TOKEN}`);
});
