const axios = require('axios');
const { state, broadcastLog } = require('../shared');
const supabase = require('../../db');
const meta = require('./meta.service');

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
          reason: { type: 'string', description: 'Razón del escalamiento (para el equipo interno)' }
        },
        required: ['reason']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'save_customer_data',
      description: 'Guarda datos del cliente: campos libres y/o tags. Úsalo cuando el cliente diga su ciudad, teléfono, cantidad, o cualquier dato relevante.',
      parameters: {
        type: 'object',
        properties: {
          fields: {
            type: 'object',
            description: 'Pares clave-valor a guardar. Ej: {"ciudad": "Bogotá", "cantidad": "50"}'
          },
          tags_to_add: {
            type: 'array', items: { type: 'string' },
            description: 'Tags a añadir al cliente. Ej: ["considerando", "bogota"]'
          }
        }
      }
    }
  }
];

// Rate limiters
const aiAgentRateLimits = new Map();
const smartTriggerRateLimits = new Map();
const MAX_AI_AGENT_CALLS_PER_HOUR = 100;
const MAX_SMART_TRIGGER_CALLS_PER_HOUR = 30;

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

function trimAiHistorySafely(history, maxMessages = 12) {
  if (history.length <= maxMessages) return history;
  const trimmed = history.slice(history.length - maxMessages);
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i].role === 'tool') {
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
      if (!foundMatch) {
        const cleaned = trimmed.slice(i + 1);
        return cleaned.length >= 4 ? cleaned : trimmed.slice(Math.max(0, trimmed.length - 4));
      }
      break;
    }
  }
  return trimmed;
}

// RAG retrieval via pgvector embeddings
async function retrieveDynamicContext(query) {
  if (!supabase || !process.env.OPENAI_API_KEY) return '';
  try {
    const embedRes = await axios.post(
      'https://api.openai.com/v1/embeddings',
      { input: query, model: 'text-embedding-3-small' },
      { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }, timeout: 15000 }
    );
    const queryEmbedding = embedRes.data.data[0].embedding;

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

// Persuasion framework
const removeAccents = (str) => str.normalize('NFD').replace(/[̀-ͯ]/g, '');

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

function validarGrice(respuesta) {
  const problemas = [];
  const palabras = respuesta.trim().split(/\s+/).length;
  if (palabras < 20 || palabras > 500) problemas.push(`Cantidad: ${palabras} palabras (ideal 50-300)`);
  const tieneEstructura = /[•✅→-]|(?:^|\n)\s*\d+\./.test(respuesta);
  if (!tieneEstructura && palabras > 100) problemas.push('Manera: respuesta larga sin estructura clara (bullets, numeración)');
  return problemas;
}

// Smart trigger intent detection
async function detectIntentWithAI(text, flows, senderId) {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!checkSmartTriggerRateLimit(senderId)) {
    console.log(`[Smart Trigger] Fallback abortado: Límite de Smart Trigger excedido para ${senderId}`);
    return null;
  }
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
    if (!reply) return null;
    if (reply === 'NULL' || reply === 'null') return null;

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


module.exports = {
  AI_TOOLS,
  checkAiAgentRateLimit,
  checkSmartTriggerRateLimit,
  trimAiHistorySafely,
  retrieveDynamicContext,
  removeAccents,
  detectarMomento,
  detectarIntencion,
  seleccionarArma,
  validarGrice,
  detectIntentWithAI,
};
