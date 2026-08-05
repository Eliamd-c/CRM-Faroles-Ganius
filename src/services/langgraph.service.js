const { StateGraph, END } = require('@langchain/langgraph');
const { ChatOpenAI } = require('@langchain/openai');
const { BaseCheckpointSaver } = require('@langchain/langgraph-checkpoint');
const supabase = require('../../db');

// ==========================================
// 1. CHECKPOINTER CUSTOM PARA SUPABASE JS
// ==========================================
class SupabaseSaver extends BaseCheckpointSaver {
  constructor(client) {
    super();
    this.client = client;
    this.tableName = 'langgraph_checkpoints';
  }

  async put(config, checkpoint, metadata, newVersions) {
    const threadId = config.configurable.thread_id;
    if (!threadId) throw new Error('thread_id is required');
    
    // Convertir el checkpoint a JSON seguro
    // NOTA ARQUITECTÓNICA: En el futuro, implementar truncado de 'messages' en el estado
    // para evitar cuellos de botella al parsear/stringificar en el Event Loop.
    const cp = JSON.stringify(checkpoint);
    
    // Upsert a Supabase
    const { error } = await this.client
      .from(this.tableName)
      .upsert({
        thread_id: threadId,
        checkpoint: cp,
        metadata: metadata ? JSON.stringify(metadata) : null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'thread_id' });
      
    if (error) {
      console.error('[SupabaseSaver] Error saving checkpoint:', error);
      // Principio "Fail Fast": Lanzar el error para no dejar la app en estado inconsistente
      throw error;
    }

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: config.configurable.checkpoint_ns,
        checkpoint_id: checkpoint.id,
      },
    };
  }

  async getTuple(config) {
    const threadId = config.configurable.thread_id;
    const { data, error } = await this.client
      .from(this.tableName)
      .select('checkpoint, metadata')
      .eq('thread_id', threadId)
      .single();

    if (error || !data) return undefined;
    
    try {
      const checkpoint = typeof data.checkpoint === 'string' ? JSON.parse(data.checkpoint) : data.checkpoint;
      const metadata = data.metadata ? (typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata) : {};
      
      return {
        checkpoint,
        metadata,
        config,
      };
    } catch(err) {
      console.error('[SupabaseSaver] Error parsing checkpoint:', err);
      return undefined;
    }
  }

  async *list(config, options) {
      yield* [];
  }
}

// ==========================================
// 2. DEFINICIÓN DEL GRAFO
// ==========================================
const llm = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.2
});

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

// Compilar con checkpointer
const checkpointer = new SupabaseSaver(supabase);
// Removemos interruptBefore porque ruteamos directamente a END cuando requiere humano
const appGraph = workflow.compile({ checkpointer });

// ==========================================
// 3. FACHADA DEL SERVICIO (Facade Pattern)
// ==========================================
class LangGraphService {
  async processConversation(senderId, text, customerProfile) {
    try {
      // Invocación del grafo de manera asíncrona
      const threadConfig = { configurable: { thread_id: senderId } };
      
      const inputs = {
        messages: [{ role: 'user', content: text }],
        customer: customerProfile
      };

      const result = await appGraph.invoke(inputs, threadConfig);
      
      if (result.human_needed) {
        return { action: 'pause_bot', reply: '¡Entendido! Un asesor humano (como María o uno de nuestros expertos) se pondrá en contacto contigo en breve para ayudarte personalmente.' };
      }

      const lastMsg = result.messages[result.messages.length - 1];
      return { action: 'send_message', reply: lastMsg.content };
      
    } catch (err) {
      console.error('[LangGraphService] Error procesando conversacion:', err);
      return { action: 'error' };
    }
  }
}

module.exports = new LangGraphService();
