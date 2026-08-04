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

// Main AI agent execution
async function runAiAgent(senderId, senderName, text, customer) {
  if (!process.env.OPENAI_API_KEY) {
    await meta.sendMessage(senderId, "⚠️ El agente de IA no está configurado (Falta API Key).");
    return;
  }
  if (!checkAiAgentRateLimit(senderId)) {
    await meta.sendMessage(senderId, "⚠️ Has alcanzado el límite de consultas a la IA por ahora. Intenta más tarde.");
    return;
  }

  const nodePrompt = customer.current_ai_prompt || '';
  const ignoreMaster = customer.ignore_master_context || false;

  let systemPrompt;
  if (ignoreMaster || !state.AI_MASTER_CONTEXT) {
    systemPrompt = nodePrompt || 'Eres un asistente útil y amigable.';
  } else {
    const dynamicContext = await retrieveDynamicContext(text);
    if (nodePrompt) {
      systemPrompt = dynamicContext + '\n\n---\n## INSTRUCCIONES ADICIONALES PARA ESTE FLUJO\n' + nodePrompt;
    } else {
      systemPrompt = dynamicContext;
    }
  }

  const momento = detectarMomento(customer);
  const intencion = detectarIntencion(text);
  const arma = seleccionarArma(momento, intencion);
  const debeEscalarSugerido = intencion === 'escape_word' || intencion === 'listo_compra' || momento === 'Momento 4: Post-Compra';

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
        messages,
        tools: AI_TOOLS,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 500
      },
      {
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );

    const choice = response?.data?.choices?.[0];
    if (!choice) throw new Error('Respuesta vacía o incompleta de OpenAI');

    const usage = response.data.usage;
    const cachedTokens = usage?.prompt_tokens_details?.cached_tokens || 0;
    if (cachedTokens > 0) {
      console.log(`💾 Prompt Cache activo: ${cachedTokens}/${usage.prompt_tokens} tokens cacheados (ahorro ~50%)`);
    }

    let totalPromptTokens = usage?.prompt_tokens || 0;
    let totalCompletionTokens = usage?.completion_tokens || 0;
    let totalCachedTokens = cachedTokens;

    history.push({ role: 'user', content: text });

    if (choice.finish_reason === 'tool_calls') {
      if (!supabase) {
        console.error('⚠️ Supabase desconectado: no se pueden procesar herramientas del agente IA');
        await meta.sendMessage(senderId, 'Lo siento, tuve un problema procesando tu solicitud. Por favor intenta de nuevo.');
        return;
      }

      history.push(choice.message);
      let escalatedToHuman = false;

      for (const toolCall of choice.message.tool_calls) {
        let args;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (parseErr) {
          console.error(`Error parseando argumentos de herramienta ${toolCall.function.name}:`, parseErr.message);
          history.push({ role: 'tool', tool_call_id: toolCall.id, content: 'Error interno: argumentos inválidos en la herramienta.' });
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
            await meta.sendMediaMessage(senderId, args.media_type, medias[0].url);
            if (args.caption) await meta.sendMessage(senderId, args.caption);
            history.push({ role: 'tool', tool_call_id: toolCall.id, content: `Enviado media exitosamente al cliente. URL: ${medias[0].url}` });
          } else {
            history.push({ role: 'tool', tool_call_id: toolCall.id, content: 'No se encontraron medias con esos tags en el catálogo.' });
          }
        } else if (toolCall.function.name === 'escalate_to_human') {
          escalatedToHuman = true;
          await supabase.from('customers').update({ bot_paused: true }).eq('instagram_id', senderId);
          await meta.sendMessage(senderId, "Perfecto, voy a pasarte con alguien de nuestro equipo para confirmar detalles... 🕯️");
          broadcastLog('ESCALATION', `${senderName}: ${args.reason}`);
          history.push({ role: 'tool', tool_call_id: toolCall.id, content: 'Escalado exitosamente a humano. El bot está pausado.' });
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
            await meta.sendMessage(senderId, finalReply);
          } else {
            const fallbackReply = "Gracias por tu paciencia. Te conectaré con alguien para ayudarte mejor. 🕯️";
            history.push({ role: 'assistant', content: fallbackReply });
            await meta.sendMessage(senderId, fallbackReply);
          }

          const secondUsage = secondResponse?.data?.usage;
          if (secondUsage) {
            totalPromptTokens += secondUsage.prompt_tokens || 0;
            totalCompletionTokens += secondUsage.completion_tokens || 0;
            const secondCachedTokens = secondUsage.prompt_tokens_details?.cached_tokens || 0;
            if (secondCachedTokens > 0) totalCachedTokens += secondCachedTokens;
          }
        } catch (secondErr) {
          console.error('Error en segunda llamada OpenAI:', secondErr.message);
          const errorFallback = "Disculpa, hubo un problema. Te conectaré con nuestro equipo. 🕯️";
          history.push({ role: 'assistant', content: errorFallback });
          await meta.sendMessage(senderId, errorFallback);
        }
      }

      history = trimAiHistorySafely(history, 12);
      await supabase.from('customers').update({ ai_history: history }).eq('instagram_id', senderId);
      broadcastLog('SYSTEM', `Agente IA usó herramientas y respondió a ${senderName} [${momento} | ${intencion} | ${arma}] (${Date.now() - aiStartTime}ms)`);
    } else {
      const aiReply = choice.message.content?.trim();
      if (!aiReply) throw new Error('Contenido de respuesta vacío de OpenAI');

      const griceProblemas = validarGrice(aiReply);
      if (griceProblemas.length > 0) {
        console.warn(`⚠️ Grice (${senderName}): ${griceProblemas.join(' | ')}`);
      }

      history.push({ role: 'assistant', content: aiReply });
      history = trimAiHistorySafely(history, 12);
      await supabase.from('customers').update({ ai_history: history }).eq('instagram_id', senderId);
      await meta.sendMessage(senderId, aiReply);
      broadcastLog('SYSTEM', `Agente IA respondió a ${senderName} [${momento} | ${intencion} | ${arma}] (${Date.now() - aiStartTime}ms)`);
    }

    if (supabase) {
      const latency_ms = Date.now() - aiStartTime;
      supabase.from('ai_analytics').insert({
        instagram_id: senderId,
        prompt_tokens: totalPromptTokens,
        completion_tokens: totalCompletionTokens,
        cached_tokens: totalCachedTokens,
        latency_ms,
        has_tool_call: choice.finish_reason === 'tool_calls'
      }).then(({ error }) => {
        if (error) console.error('Error guardando analytics:', error.message);
      });
    }

  } catch (err) {
    console.error('OpenAI API Error (AI Agent):', err.response?.status, err.message);
    await meta.sendMessage(senderId, 'Lo siento, tuve un problema procesando tu mensaje. Por favor intenta de nuevo en un momento.');
  }
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
  runAiAgent,
};
