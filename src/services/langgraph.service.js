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
async function respondNode(graphData) {
  const context = state.AI_MASTER_CONTEXT || "Eres Faroles Genius, vendes faroles solares apoyando comunidades.";
  const currentStage = graphData.funnel_stage || 'ONBOARDING';
  
  // Obtener la clase de estado correspondiente
  const stateObj = SALES_STATES[currentStage];
  
  if (!stateObj) {
    console.error(`[StateMachine] Estado desconocido: ${currentStage}, usando ONBOARDING`);
    const fallback = SALES_STATES['ONBOARDING'];
    const prompt = fallback.getPrompt({
      context,
      messages: graphData.messages,
      intent: graphData.intent,
      customer: graphData.customer
    });
    try {
      const response = await openAICircuitBreaker.fire(() => llm.invoke(prompt));
      return { messages: [{ role: 'assistant', content: response.content }] };
    } catch (e) {
      if (e.name === 'CircuitOpenError' || e.isCircuitBreakerError) {
        return { messages: [{ role: 'assistant', content: "Disculpa, estoy experimentando intermitencias en mi sistema. 😔 ¡Pero no te preocupes! Un asesor humano te responderá a la brevedad." }] };
      }
      return { messages: [{ role: 'assistant', content: "Hubo un error procesando tu solicitud." }] };
    }
  }

  // Delegar la generación del prompt al objeto de estado (State Pattern)
  const prompt = stateObj.getPrompt({
    context,
    messages: graphData.messages,
    intent: graphData.intent,
    customer: graphData.customer
  });

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
      console.warn('[CircuitBreaker] Circuito Abierto en respondNode. Retornando fallback.');
      return { 
        messages: [{ role: 'assistant', content: "Disculpa, estoy experimentando intermitencias en mi sistema. 😔 ¡Pero no te preocupes! Un asesor humano te responderá a la brevedad." }], 
        tool_calls: [] 
      };
    }
    return { messages: [{ role: 'assistant', content: "Hubo un error generando mi respuesta." }], tool_calls: [] };
  }
}

// ─── Router: Decidir si responder o escalar ───
function routerNode(graphData) {
  if (graphData.human_needed) return "END_GRAPH";
  return "RESPOND";
}

// ─── Router post-respuesta: Decidir si ejecutar herramientas o terminar ───
function postRespondRouter(graphData) {
  if (graphData.tool_calls && graphData.tool_calls.length > 0) return "TOOLS";
  return "END_GRAPH";
}

// ─── Nodo 3: Ejecutar Herramientas (Command Pattern + ReAct Feedback Loop) ───
async function toolNode(graphData) {
  const toolCalls = graphData.tool_calls || [];
  const toolResults = [];
  
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

    // Ejecutar el Comando correspondiente (Command Pattern)
    const context = {
      senderId: graphData.customer?.instagram_id || 'unknown',
      customer: graphData.customer,
      meta,
      supabase
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

  // Devolver los resultados como mensajes y limpiar tool_calls
  return { messages: toolResults, tool_calls: [] };
}

// ─── Compilar el Grafo (con ReAct Loop para herramientas) ───
const workflow = new StateGraph({ channels: graphState })
  .addNode("analyzeIntent", analyzeIntentNode)
  .addNode("respond", respondNode)
  .addNode("tools", toolNode)
  .addEdge("__start__", "analyzeIntent")
  .addConditionalEdges("analyzeIntent", routerNode, {
    "END_GRAPH": END,
    "RESPOND": "respond"
  })
  .addConditionalEdges("respond", postRespondRouter, {
    "TOOLS": "tools",
    "END_GRAPH": END
  })
  // Corrección del Arquitecto: después de ejecutar herramientas,
  // volver a 'respond' para que el LLM genere respuesta natural
  // basada en los resultados (ReAct Feedback Loop).
  .addEdge("tools", "respond");

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
      
      const inputs = {
        messages: [{ role: 'user', content: text }],
        customer: customerProfile
      };

      const result = await this.appGraph.invoke(inputs, threadConfig);
      
      if (result.human_needed) {
        return { 
          action: 'pause_bot', 
          reply: '¡Entendido! Un asesor humano se pondrá en contacto contigo en breve para ayudarte personalmente. 🙌',
          funnel_stage: result.funnel_stage
        };
      }

      const lastMsg = result.messages[result.messages.length - 1];
      return { 
        action: 'send_message', 
        reply: lastMsg.content,
        funnel_stage: result.funnel_stage 
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
