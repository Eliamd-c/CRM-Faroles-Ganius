const { StateGraph, END } = require('@langchain/langgraph');
const { ChatOpenAI } = require('@langchain/openai');
const { PostgresSaver } = require('@langchain/langgraph-checkpoint-postgres');
const { Pool } = require('pg');
const supabase = require('../../db');

// ==========================================
// 1. CONFIGURACIÓN DEL LLM
// ==========================================
const llm = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.2
});

// ==========================================
// 2. DEFINICIÓN DEL GRAFO
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
  }
};

async function analyzeIntentNode(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  
  const response = await llm.invoke(`Analiza este mensaje de un cliente: "${lastMessage.content}". 
  Responde únicamente con una de estas categorías: 
  - ESCALATE (si pide explícitamente hablar con un humano o asesor)
  - OBJECTION (si es una objeción de precio, garantía, duda sobre durabilidad o proceso)
  - GENERAL (cualquier otra cosa)`);

  const category = response.content.trim().toUpperCase();
  let human_needed = category.includes('ESCALATE');
  
  return { intent: category, human_needed };
}

async function respondNode(state) {
  // Cargar contexto maestro desde la variable global inyectada por app.js
  const context = global.AI_MASTER_CONTEXT || "Eres Faroles Genius, vendes faroles solares apoyando comunidades.";
  
  const response = await llm.invoke(`
    Contexto Maestro (Reglas, Cialdini, Grice):
    ${context}

    Historial reciente de la conversación:
    ${state.messages.slice(-4).map(m => `[${m.role}]: ${m.content}`).join('\n')}

    Intención detectada: ${state.intent}
    
    Genera una respuesta apropiada, cálida y persuasiva basándote en las directrices del Contexto Maestro.
    Si es una objeción (OBJECTION), usa la técnica correspondiente (Autoridad, Prueba Social, etc.).
    
    REGLA CRÍTICA DE INSTAGRAM: Tu respuesta DEBE ser concisa y NUNCA superar los 800 caracteres en total. Si superas este límite, el mensaje fallará. Sé breve y directo.
  `);

  return { messages: [{ role: 'assistant', content: response.content }] };
}

function routerNode(state) {
  if (state.human_needed) return "END_GRAPH";
  return "RESPOND";
}

const workflow = new StateGraph({ channels: graphState })
  .addNode("analyzeIntent", analyzeIntentNode)
  .addNode("respond", respondNode)
  .addEdge("__start__", "analyzeIntent")
  .addConditionalEdges("analyzeIntent", routerNode, {
    "END_GRAPH": END,
    "RESPOND": "respond"
  })
  .addEdge("respond", END);

// ==========================================
// 3. FACHADA DEL SERVICIO (Facade & Singleton Pattern)
// ==========================================
class LangGraphService {
  constructor() {
    this.appGraph = null;
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  // Patrón "Local Initialization Check" (Node.js Design Patterns - Cap. 11)
  // Garantiza que la BD y LangGraph se preparen de forma segura antes de usarse.
  async initialize() {
    if (this.isInitialized) return;
    
    if (!this.initializationPromise) {
      this.initializationPromise = (async () => {
        try {
          if (!process.env.SUPABASE_DB_URL) {
            throw new Error('Falta la variable de entorno SUPABASE_DB_URL (PostgreSQL Connection String)');
          }

          // Usar la cadena de conexión nativa de Postgres
          const pool = new Pool({
            connectionString: process.env.SUPABASE_DB_URL,
            // Importante para conexiones remotas y SSL con Supabase
            ssl: { rejectUnauthorized: false } 
          });

          const checkpointer = new PostgresSaver(pool);
          
          // Ejecuta las migraciones internas (crea checkpoints, checkpoint_blobs, etc.)
          await checkpointer.setup(); 

          this.appGraph = workflow.compile({ checkpointer });
          this.isInitialized = true;
          console.log('[LangGraphService] PostgresSaver inicializado exitosamente en Supabase.');
        } catch (error) {
          console.error('[LangGraphService] Error inicializando checkpointer:', error.message);
          this.initializationPromise = null; // Permite reintento en caso de fallo
          throw error;
        }
      })();
    }
    
    await this.initializationPromise;
  }

  async processConversation(senderId, text, customerProfile) {
    try {
      // 1. Garantizamos de manera asíncrona que la infraestructura esté lista.
      await this.initialize();

      // 2. Invocación del grafo compilado
      const threadConfig = { configurable: { thread_id: senderId } };
      
      const inputs = {
        messages: [{ role: 'user', content: text }],
        customer: customerProfile
      };

      const result = await this.appGraph.invoke(inputs, threadConfig);
      
      if (result.human_needed) {
        return { action: 'pause_bot', reply: '¡Entendido! Un asesor humano (como María o uno de nuestros expertos) se pondrá en contacto contigo en breve para ayudarte personalmente.' };
      }

      const lastMsg = result.messages[result.messages.length - 1];
      return { action: 'send_message', reply: lastMsg.content };
      
    } catch (err) {
      console.error('[LangGraphService] Error procesando conversacion:', err);
      return { action: 'error', reply: err.message || err.toString() };
    }
  }
}

module.exports = new LangGraphService();
