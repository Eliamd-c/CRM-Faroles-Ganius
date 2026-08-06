if (typeof crypto === 'undefined') {
  global.crypto = require('crypto');
}
const { StateGraph, END } = require('@langchain/langgraph');
const { ChatOpenAI } = require('@langchain/openai');
const { PostgresSaver } = require('@langchain/langgraph-checkpoint-postgres');
const { Pool } = require('pg');
const supabase = require('../../db');
const { state } = require('../shared');
const meta = require('./meta.service');
const {
  getInstance: getInstructionService,
  CONTEXT_PLACEHOLDER
} = require('../domain/services/InstructionService.instance');

// ==========================================
// 1. ESTADO DE VENTAS (State Pattern)
// ==========================================
const OnboardingState = require('../domain/states/OnboardingState');
const DiscoveryState = require('../domain/states/DiscoveryState');
const RecommendationState = require('../domain/states/RecommendationState');
const CheckoutState = require('../domain/states/CheckoutState');

// Registro de estados (evita switch/case gigante)
const SALES_STATES = {
  ONBOARDING: new OnboardingState(),
  DISCOVERY: new DiscoveryState(),
  RECOMMENDATION: new RecommendationState(),
  CHECKOUT: new CheckoutState()
};

// ==========================================
// 2. HERRAMIENTAS DEL AGENTE (Command Pattern)
// ==========================================
const commandRegistry = require('../domain/commands/CommandRegistry');

// ==========================================
// 3. RESILIENCIA (Circuit Breaker Pattern)
// ==========================================
const { openAICircuitBreaker } = require('../utils/CircuitBreaker');

// ==========================================
// 4. CONFIGURACIÓN DEL LLM
// ==========================================
const llm = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.2
});

// ==========================================
// 5. DEFINICIÓN DEL GRAFO (State + Command Pattern)
// ==========================================

const graphState = {
  messages: {
    value: (x, y) => x.concat(y),
    default: () => []
  },
  customer: {
    value: (x, y) => y ? y : x,
    default: () => null
  },
  intent: {
    value: (x, y) => y,
    default: () => null
  },
  human_needed: {
    value: (x, y) => y,
    default: () => false
  },
  funnel_stage: {
    value: (x, y) => y || x,
    default: () => 'ONBOARDING'
  },
  tool_calls: {
    value: (x, y) => y || x,
    default: () => []
  },
  awaiting_quick_reply: {
    value: (x, y) => y !== undefined ? y : x,
    default: () => false
  }
};

// ─── Nodo 1: Analizar Intención + Evaluar Transición de Etapa ───
async function analyzeIntentNode(graphData) {
  const lastMessage = graphData.messages[graphData.messages.length - 1];
  const currentStage = graphData.funnel_stage || 'ONBOARDING';
  
  let intent = 'GENERAL';
  let shouldAdvance = false;
  
  try {
    // Usar Circuit Breaker para proteger a OpenAI
    const response = await openAICircuitBreaker.fire(() => llm.invoke(`Analiza este mensaje de un cliente: "${lastMessage.content}".

Etapa actual del embudo de ventas: ${currentStage}

Responde en formato JSON estricto con estas dos claves:
{
  "intent": "ESCALATE | OBJECTION | PURCHASE_INTENT | GENERAL",
  "should_advance": true | false
}

Reglas:
- ESCALATE: si pide explícitamente hablar con un humano o asesor.
- OBJECTION: si es una objeción de precio, garantía, duda sobre durabilidad.
- PURCHASE_INTENT: si muestra interés claro en comprar, pide precio, o dice "quiero comprar".
- GENERAL: cualquier otra cosa.
- should_advance: true si la conversación ya maduró lo suficiente para pasar a la siguiente etapa del embudo.

Devuelve SOLO el JSON, sin texto adicional.`));

    const raw = response.content.trim();
    if (raw.length > 50000) throw new Error('Payload to large for Event Loop');
    const parsed = JSON.parse(raw);
    intent = (parsed.intent || 'GENERAL').toUpperCase();
    shouldAdvance = parsed.should_advance === true;
  } catch (e) {
    if (e.name === 'CircuitOpenError' || e.isCircuitBreakerError) {
      console.warn('[CircuitBreaker] Circuito Abierto en analyzeIntentNode. Forzando contingencia.');
      return { intent: 'ESCALATE', human_needed: true, funnel_stage: currentStage };
    }
    // Fallback si el LLM no devuelve JSON válido o hay otro error lógico
    intent = 'GENERAL';
  }

  const human_needed = intent === 'ESCALATE';
  
  // Sanitizar estado inválido (Corrección #3 del Arquitecto)
  if (!SALES_STATES[currentStage]) {
    console.warn(`[StateMachine] ⚠️ Estado inválido "${currentStage}", reiniciando a ONBOARDING`);
    return { intent, human_needed, funnel_stage: 'ONBOARDING' };
  }

  // Evaluar transición de etapa usando el State Pattern
  // Corrección #1 del Arquitecto: El objeto de estado es la MÁXIMA AUTORIDAD.
  // Siempre llamamos a evaluateTransition, pasándole la opinión del LLM.
  let newStage = currentStage;
  const currentStateObj = SALES_STATES[currentStage];
  
  const nextStage = currentStateObj.evaluateTransition({
    messages: graphData.messages,
    intent,
    customer: graphData.customer,
    llmShouldAdvance: shouldAdvance
  });
  
  if (nextStage && SALES_STATES[nextStage]) {
    newStage = nextStage;
    console.log(`[StateMachine] 🔄 Transición: ${currentStage} → ${newStage}`);
  }

  return { intent, human_needed, funnel_stage: newStage };
}

// ─── Nodo 2: Generar Respuesta (Delegada al State Pattern) ───
// ARQUITECTURA (Corrección de Alucinaciones):
// Usa getSystemInstruction() + getHistoryContext() en lugar de getPrompt().
// Esto previene duplicación de historial y separación clara de responsabilidades (SoC).
async function respondNode(graphData) {
  const context = state.AI_MASTER_CONTEXT || "Eres Faroles Genius, vendes faroles solares apoyando comunidades.";
  const currentStage = graphData.funnel_stage || 'ONBOARDING';

  // Obtener la clase de estado correspondiente
  const stateObj = SALES_STATES[currentStage];

  /**
   * Recordatorio de herramientas, generado desde el CommandRegistry.
   * Vive en el código (no en la BD) para que una edición del operador no pueda
   * borrar la regla anti-alucinación.
   */
  function toolsReminder() {
    try {
      const names = (commandRegistry.getAllToolSchemas() || [])
        .map(s => s?.function?.name || s?.name)
        .filter(Boolean);
      if (names.length === 0) return '';
      return [
        '## HERRAMIENTAS',
        `Dispones de: ${names.join(', ')}.`,
        'REGLA ANTI-INVENCIÓN: si te preguntan por materiales, especificaciones,',
        'precios, costos de envío o garantía, DEBES llamar a \'query_knowledge_base\'',
        'antes de responder. Nunca respondas esos datos de memoria ni los inventes.',
        'Si la herramienta no devuelve el dato, dilo y ofrece escalar a un humano.'
      ].join('\n');
    } catch (_) {
      return '';
    }
  }

  /**
   * Compone el prompt de sistema con jerarquía explícita:
   *   Contexto Global (identidad, precios, políticas) → Etapa → Herramientas
   *
   * Es idempotente: si la instrucción ya trae el contexto (por marcador o
   * literal), no lo duplica. Duplicarlo produciría dos versiones en conflicto.
   */
  function composeSystemInstruction(stageInstruction) {
    // El contexto se lee de disco con CRLF y los overrides llegan por JSON con LF.
    // Sin normalizar, la detección del Caso B falla siempre y el contexto se duplica.
    const norm = s => String(s == null ? '' : s).replace(/\r\n/g, '\n');
    const stage = norm(stageInstruction);
    const ctx = norm(context);

    // Caso A: default de estado con marcador → sustituir por el contexto real
    if (stage.includes(CONTEXT_PLACEHOLDER)) {
      return joinBlocks([stage.split(CONTEXT_PLACEHOLDER).join(ctx), toolsReminder()]);
    }

    // Si el contexto no se pudo cargar, no lo rotules como "fuente de verdad":
    // darle autoridad a un stub de una línea es peor que omitirlo.
    if (ctx.trim().length < 200) {
      return joinBlocks([stage, toolsReminder()]);
    }

    // Caso B: la instrucción ya embebe el contexto literal → no duplicar.
    // Se usa una firma de 3 fragmentos (inicio/medio/fin) en vez del encabezado,
    // que cambia cada vez que se edita el título o la versión del documento.
    const frag = [ctx.slice(0, 200), ctx.slice(Math.floor(ctx.length / 2), Math.floor(ctx.length / 2) + 200)]
      .map(s => s.trim())
      .filter(s => s.length >= 50);
    if (frag.length && frag.every(f => stage.includes(f))) {
      return joinBlocks([stage, toolsReminder()]);
    }

    // Caso C: override escrito por el operador → el contexto es COMPLEMENTO.
    // Jerarquía por dimensión: identidad/tono manda la etapa; los datos de
    // producto los manda el RAG, NO este documento (puede quedar desactualizado).
    return joinBlocks([
      '## CONTEXTO GLOBAL (identidad, misión, tono, políticas de conversación)',
      ctx,
      [
        `## INSTRUCCIÓN DE ESTA ETAPA — ${currentStage}`,
        '(Define el objetivo y el tono de este turno. Si contradice al CONTEXTO GLOBAL',
        'en nombre, género o estilo, MANDA esta sección. Para MATERIALES, PRECIOS,',
        "ESPECIFICACIONES o GARANTÍA manda siempre 'query_knowledge_base', no el texto de arriba.)",
        stage
      ].join('\n'),
      toolsReminder()
    ]);
  }

  /** Une bloques con línea en blanco, descartando los vacíos. */
  function joinBlocks(blocks) {
    return blocks.filter(b => b && String(b).trim()).join('\n\n');
  }

  /**
   * Helper: Obtener instrucción del sistema
   * Intenta usar InstructionService (con caching), fallback a state por defecto
   */
  async function getSystemInstruction() {
    try {
      // Intentar obtener del servicio de instrucciones (con caching)
      const instructionService = await getInstructionService();
      const cached = await instructionService.getInstruction(currentStage);

      if (cached) {
        const stats = instructionService.getStats();
        console.debug(`[RespondNode] 📦 Instruction loaded (cache hit: ${stats.cacheHits}, miss: ${stats.cacheMisses})`);
        return composeSystemInstruction(cached);
      }
    } catch (err) {
      console.warn(`[RespondNode] ⚠️ InstructionService error, falling back to state:`, err.message);
    }

    // Fallback: usar la instrucción del estado por defecto
    if (stateObj) {
      return composeSystemInstruction(stateObj.getSystemInstruction({
        context,
        intent: graphData.intent,
        customer: graphData.customer
      }));
    }

    // Última línea de defensa
    return composeSystemInstruction(
      `Eres el asesor de Faroles Genius. Etapa actual: ${currentStage}. Guía al cliente hacia el cierre.`
    );
  }

  if (!stateObj) {
    console.error(`[StateMachine] Estado desconocido: ${currentStage}, usando ONBOARDING`);
    const fallback = SALES_STATES['ONBOARDING'];

    // Obtener instrucción (con caching y fallback)
    const systemInstr = await getSystemInstruction();
    const historyContext = fallback.getHistoryContext({
      messages: graphData.messages
    });
    const prompt = systemInstr + '\n\n' + historyContext;

    try {
      // Con tools: el prompt anuncia query_knowledge_base, así que deben ir
      // disponibles o el modelo narraría la llamada en texto plano.
      const response = await openAICircuitBreaker.fire(() =>
        llm.invoke(prompt, { tools: commandRegistry.getAllToolSchemas() })
      );
      return { messages: [{ role: 'assistant', content: response.content }] };
    } catch (e) {
      if (e.name === 'CircuitOpenError' || e.isCircuitBreakerError) {
        return { messages: [{ role: 'assistant', content: "Disculpa, estoy experimentando intermitencias. Un asesor te responderá pronto." }] };
      }
      return { messages: [{ role: 'assistant', content: "Hubo un error procesando tu solicitud." }] };
    }
  }

  // Obtener instrucción (con caching y fallback)
  const systemInstr = await getSystemInstruction();
  const historyContext = stateObj.getHistoryContext({
    messages: graphData.messages
  });
  const prompt = systemInstr + '\n\n' + historyContext;

  // Obtener las herramientas disponibles del CommandRegistry
  const tools = commandRegistry.getAllToolSchemas();

  try {
    // Invocar al LLM CON herramientas protegiéndolo con el Circuit Breaker
    const response = await openAICircuitBreaker.fire(() => llm.invoke(prompt, { tools }));

    // Si el LLM quiere usar una herramienta, guardar las tool_calls
    if (response.additional_kwargs?.tool_calls?.length > 0) {
      const toolCalls = response.additional_kwargs.tool_calls;
      console.log(`[RespondNode] 🔧 LLM solicita ${toolCalls.length} herramienta(s): ${toolCalls.map(t => t.function.name).join(', ')}`);
      return {
        messages: [{ role: 'assistant', content: response.content || '' }],
        tool_calls: toolCalls
      };
    }

    return { messages: [{ role: 'assistant', content: response.content }], tool_calls: [] };

  } catch (e) {
    if (e.name === 'CircuitOpenError' || e.isCircuitBreakerError) {
      console.warn('[CircuitBreaker] Circuito Abierto en respondNode');
      return {
        messages: [{ role: 'assistant', content: "Disculpa, estoy experimentando intermitencias. Un asesor te responderá pronto." }],
        tool_calls: []
      };
    }
    console.error('[RespondNode] Error:', e.message);
    return { messages: [{ role: 'assistant', content: "Hubo un error procesando tu solicitud." }], tool_calls: [] };
  }
}

// ─── Router: Decidir si responder o escalar ───
function routerNode(graphData) {
  if (graphData.human_needed) return "END_GRAPH";
  return "RESPOND";
}

// ─── Router post-respuesta: Decidir si ejecutar herramientas o terminar ───
// CRITICAL FIX (578a021): SIEMPRE ejecutar herramientas si existen
// El router NO debe retornar "PAUSE_FOR_INPUT" aquí: eso rompe el flujo
// La pausa se detecta DESPUÉS de toolNode (ver flujo del grafo)
function postRespondRouter(graphData) {
  const toolCalls = graphData.tool_calls || [];

  // SIEMPRE ejecutar si hay herramientas (incluyendo send_quick_replies)
  if (toolCalls.length > 0) return "TOOLS";

  return "END_GRAPH";
}

// ─── Nodo 2.5: Pausa Conversacional (Arquitectura de Quick Replies) ───
// CRITICAL FIX (578a021): Este nodo se ejecuta DESPUÉS de toolNode
// Solo marca el estado si toolNode ya ejecutó send_quick_replies
// Patrón: Ejecución de herramienta (toolNode) → Pausa conversacional (pauseForInputNode)
//
// ARQUITECTURA (Corrección de Alucinaciones):
// Este nodo OMITE la clave 'messages' en su retorno.
// Si omites una clave en graphState.value, el reductor NO es invocado
// y el estado anterior se preserva en el checkpoint de PostgreSQL.
// Esto previene que un graphData.messages vacío sobrescriba el historial.
async function pauseForInputNode(graphData) {
  // Verificar si toolNode seteó el flag de pausa
  // (toolNode lo setea cuando ejecuta send_quick_replies)
  if (graphData.awaiting_quick_reply === true) {
    console.log('[PauseForInputNode] ⏸️ Pausa activada - preservando checkpoint');
    // Retornar SOLO el flag de estado, omitir messages
    // → el reductor messages no es invocado
    // → checkpoint preserva historial anterior
    return {
      awaiting_quick_reply: true
      // Omitir messages intentionalmente
    };
  }

  // Fallback: Si no hay pausa pendiente, solo retornar flag
  return {
    awaiting_quick_reply: false
    // Omitir messages intentionalmente
  };
}

// ─── Nodo 3: Ejecutar Herramientas (Command Pattern + ReAct Feedback Loop) ───
async function toolNode(graphData) {
  const toolCalls = graphData.tool_calls || [];
  const toolResults = [];
  let wasQuickReplyExecuted = false;  // CRITICAL FIX: Flag para detectar send_quick_replies

  for (const toolCall of toolCalls) {
    const fnName = toolCall.function?.name;
    let fnArgs = {};
    try {
      const rawArgs = toolCall.function?.arguments || '{}';
      if (rawArgs.length > 50000) throw new Error('Tool args too large');
      fnArgs = JSON.parse(rawArgs);
    } catch (e) {
      console.error(`[ToolNode] Error parseando argumentos de ${fnName}:`, e.message);
      toolResults.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: fnName,
        content: JSON.stringify({ success: false, message: 'Error parseando argumentos' })
      });
      continue;
    }

    // CRITICAL FIX: Detectar si esta herramienta es send_quick_replies
    if (fnName === 'send_quick_replies') {
      wasQuickReplyExecuted = true;
      console.log('[ToolNode] 🔔 Detectado send_quick_replies - se activará pausa conversacional después');
    }

    // Ejecutar el Comando correspondiente (Command Pattern)
    const supabaseGateway = require('../adapters/gateways/supabaseGateway.instance');
    const context = {
      senderId: graphData.customer?.instagramId || 'unknown',
      customer: graphData.customer,
      meta,
      supabase,
      supabaseGateway // ← Inyectar para que SendQuickRepliesCommand pueda marcar pausa en BD
    };

    let resultContent;
    try {
      const result = await commandRegistry.execute(fnName, fnArgs, context);
      resultContent = JSON.stringify(result);
    } catch (err) {
      console.error(`[ToolNode] 🚨 Falló ${fnName}:`, err.message);
      // 🚨 CLAVE: Informar al LLM del fallo en lugar de romper el grafo
      resultContent = JSON.stringify({
        error: "La ejecución de la herramienta falló. Informa al usuario de forma natural y ofrécele una disculpa o alternativa.",
        details: err.message
      });
    }

    // Crítico: Devolver el resultado como mensaje tipo 'tool' (OpenAI ReAct)
    toolResults.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      name: fnName,
      content: resultContent
    });
  }

  // CRITICAL FIX: Retornar awaiting_quick_reply para pausar después si fue send_quick_replies
  // Devolver los resultados como mensajes y limpiar tool_calls
  return {
    messages: toolResults,
    tool_calls: [],
    awaiting_quick_reply: wasQuickReplyExecuted  // ← Flag para pausar en siguiente condicional
  };
}

// ─── Compilar el Grafo (con ReAct Loop para herramientas) ───
// CRITICAL FIX (578a021): Flujo correcto para pausas conversacionales
const workflow = new StateGraph({ channels: graphState })
  .addNode("analyzeIntent", analyzeIntentNode)
  .addNode("respond", respondNode)
  .addNode("tools", toolNode)
  .addNode("pauseForInput", pauseForInputNode)
  .addEdge("__start__", "analyzeIntent")
  .addConditionalEdges("analyzeIntent", routerNode, {
    "END_GRAPH": END,
    "RESPOND": "respond"
  })
  .addConditionalEdges("respond", postRespondRouter, {
    "TOOLS": "tools",
    "END_GRAPH": END
    // ← Removido "PAUSE_FOR_INPUT" (no debe ir aquí)
  })
  // CRITICAL FIX: Después de ejecutar herramientas, decidir si pausar o continuar
  // Si toolNode seteó awaiting_quick_reply=true (send_quick_replies fue ejecutado),
  // pausar. Sino, continuar con ReAct Loop (volver a respond).
  .addConditionalEdges("tools", (graphData) => {
    if (graphData.awaiting_quick_reply === true) {
      return "pauseForInput"; // Pausar conversación
    }
    return "respond"; // ReAct Loop: generar respuesta basada en resultados
  }, {
    "pauseForInput": "pauseForInput",
    "respond": "respond"
  })
  // Después de pausar, terminar el flujo
  // El usuario debe hacer click en un botón para continuar
  .addEdge("pauseForInput", END);

// ==========================================
// 6. FACHADA DEL SERVICIO (Facade & Singleton Pattern)
// ==========================================
class LangGraphService {
  constructor() {
    this.appGraph = null;
    this.isInitialized = false;
    this.initializationPromise = null;
    this.pool = null;
  }

  // Patrón "Local Initialization Check" (Node.js Design Patterns - Cap. 11)
  async initialize() {
    if (this.isInitialized) return;
    
    if (!this.initializationPromise) {
      this.initializationPromise = (async () => {
        try {
          if (!process.env.SUPABASE_DB_URL) {
            throw new Error('Falta la variable de entorno SUPABASE_DB_URL (PostgreSQL Connection String)');
          }

          this.pool = new Pool({
            connectionString: process.env.SUPABASE_DB_URL,
            ssl: { rejectUnauthorized: false } 
          });

          const checkpointer = new PostgresSaver(this.pool);
          await checkpointer.setup(); 

          this.appGraph = workflow.compile({ checkpointer });
          this.isInitialized = true;
          console.log('[LangGraphService] ✅ PostgresSaver + State Machine inicializados.');
        } catch (error) {
          console.error('[LangGraphService] Error inicializando:', error.message);
          this.initializationPromise = null;
          throw error;
        }
      })();
    }
    await this.initializationPromise;
  }

  async destroy() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('[LangGraphService] 🛑 PostgresSaver (Pool) cerrado.');
    }
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  async processConversation(senderId, text, customerProfile) {
    try {
      await this.initialize();

      const threadConfig = { configurable: { thread_id: senderId } };

      // 🔧 FIX CRÍTICO: Recuperar checkpoint anterior (historial acumulado)
      let accumulatedMessages = [];
      try {
        const historyGenerator = await this.appGraph.getStateHistory(threadConfig);
        for await (const snapshot of historyGenerator) {
          // El snapshot más reciente contiene el estado acumulado
          accumulatedMessages = snapshot.values.messages || [];
          console.log(`[LangGraphService] ✅ Recuperado checkpoint anterior con ${accumulatedMessages.length} mensajes`);
          break;  // Solo necesitamos el más reciente
        }
      } catch (e) {
        console.warn(`[LangGraphService] ⚠️ Sin historial previo para thread ${senderId}: ${e.message}`);
        // Fallback: comenzar desde cero (primer mensaje del usuario)
        accumulatedMessages = [];
      }

      // Acumular: mensajes previos + mensaje actual
      const inputs = {
        messages: [
          ...accumulatedMessages,
          { role: 'user', content: text }
        ],
        customer: customerProfile,
        // Preservar estados anteriores si existen
        funnel_stage: customerProfile?.funnel_stage || 'ONBOARDING',
        intent: customerProfile?.intent || null
      };

      // 📊 LOGGING PARA VISIBILIDAD
      console.log(`[LangGraphService] 📨 Procesando mensaje:`);
      console.log(`   Thread ID: ${senderId}`);
      console.log(`   Historial: ${accumulatedMessages.length} mensajes previos`);
      console.log(`   Nuevo mensaje: "${text.substring(0, 50)}..."`);
      console.log(`   Total en inputs: ${inputs.messages.length} mensajes`);
      console.log(`   Customer state: ${customerProfile?.bot_state || 'unknown'}`);

      const result = await this.appGraph.invoke(inputs, threadConfig);

      if (result.human_needed) {
        return {
          action: 'pause_bot',
          reply: '¡Entendido! Un asesor humano se pondrá en contacto contigo en breve para ayudarte personalmente. 🙌',
          funnel_stage: result.funnel_stage,
          awaiting_quick_reply: result.awaiting_quick_reply || false
        };
      }

      // CRITICAL FIX: Filtrar tool messages - solo tomar assistant messages para reply
      // Los tool messages contienen JSON de resultados internos que NO deben verse al usuario
      const assistantMsgs = result.messages.filter(m => m.role === 'assistant');
      const lastAssistantMsg = assistantMsgs.length > 0
        ? assistantMsgs[assistantMsgs.length - 1]
        : null;

      // Si estamos pausando para quick_reply y no hay mensaje assistant, no enviar nada
      if (!lastAssistantMsg && result.awaiting_quick_reply) {
        console.log(`[LangGraphService] ⏸️ Pausa de conversación (quick_reply) - sin reply adicional`);
        return {
          action: 'pause_for_input',
          reply: '',
          funnel_stage: result.funnel_stage,
          awaiting_quick_reply: true
        };
      }

      // 🔍 LOGGING DE RESULTADO
      console.log(`[LangGraphService] ✅ Respuesta generada:`);
      console.log(`   Etapa: ${result.funnel_stage}`);
      console.log(`   Intención: ${result.intent}`);
      console.log(`   Respuesta: "${lastAssistantMsg?.content?.substring(0, 50)}..."`);
      console.log(`   Awaiting quick_reply: ${result.awaiting_quick_reply || false}`);

      return {
        action: lastAssistantMsg ? 'send_message' : 'pause_for_input',
        reply: lastAssistantMsg?.content || '',
        funnel_stage: result.funnel_stage,
        awaiting_quick_reply: result.awaiting_quick_reply || false
      };

    } catch (err) {
      console.error('[LangGraphService] Error procesando conversacion:', err);
      return { action: 'error', reply: err.message || err.toString() };
    }
  }

  // ==========================================
  // HERRAMIENTAS DE INSPECCIÓN Y TIME TRAVEL
  // ==========================================
  
  async getGraphDiagram() {
    await this.initialize();
    if (!this.appGraph) return null;
    return this.appGraph.getGraph().drawMermaid();
  }

  /**
   * Devuelve las etapas del embudo registradas (State Pattern).
   * Fuente única de verdad para la UI: evita números hardcodeados en el HTML.
   */
  getSalesStates() {
    return Object.keys(SALES_STATES).map((key) => ({
      id: key,
      name: SALES_STATES[key].name || key
    }));
  }

  async getStateHistory(threadId, limit = 10) {
    await this.initialize();
    const config = { configurable: { thread_id: threadId } };
    const stateHistory = [];
    
    try {
      const historyGenerator = await this.appGraph.getStateHistory(config);
      let count = 0;
      for await (const stateSnapshot of historyGenerator) {
        if (count >= limit) break;
        stateHistory.push({
          checkpoint_id: stateSnapshot.config.configurable.checkpoint_id,
          created_at: stateSnapshot.createdAt,
          values: stateSnapshot.values,
          next: stateSnapshot.next
        });
        count++;
      }
      return stateHistory;
    } catch (err) {
      console.error('[LangGraphService] Error obteniendo historial:', err);
      throw err;
    }
  }

  async updateState(threadId, payload, checkpointId = null) {
    await this.initialize();
    const config = { configurable: { thread_id: threadId } };
    if (checkpointId) {
      config.configurable.checkpoint_id = checkpointId;
    }
    
    try {
      await this.appGraph.updateState(config, payload);
      return { success: true };
    } catch (err) {
      console.error('[LangGraphService] Error inyectando estado:', err);
      throw err;
    }
  }
}

module.exports = new LangGraphService();
