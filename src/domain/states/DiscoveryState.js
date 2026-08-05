const SalesState = require('./SalesState');

// ==========================================
// DiscoveryState - Calificación del cliente
// ==========================================
// El bot hace preguntas inteligentes para entender las necesidades
// del cliente: presupuesto, espacio a iluminar, uso deseado.

class DiscoveryState extends SalesState {
  constructor() {
    super('DISCOVERY');
  }

  getPrompt({ context, messages, intent, customer }) {
    const lastMessages = messages.slice(-6).map(m => `[${m.role}]: ${m.content}`).join('\n');
    
    return `
Contexto Maestro:
${context}

ETAPA ACTUAL DEL EMBUDO: 🔍 DISCOVERY (Descubrimiento de Necesidades)

TU OBJETIVO EN ESTA ETAPA:
1. Calificar al cliente haciendo preguntas sobre sus necesidades específicas.
2. Descubrir: ¿Qué espacio quiere iluminar? ¿Cuántos faroles necesita? ¿Tiene presupuesto definido?
3. Escuchar activamente y mostrar empatía (Máxima de Relevancia de Grice).
4. Si el cliente menciona un problema concreto (oscuridad, inseguridad, falta de energía), valídalo emocionalmente.
5. Cuando tengas suficiente información, prepárate para recomendar el producto ideal.

Historial:
${lastMessages}

Intención detectada: ${intent}
${customer ? `Datos del cliente: ${JSON.stringify(customer)}` : ''}

REGLAS:
- Haz máximo 1-2 preguntas por mensaje. No interrogues.
- Usa lenguaje natural y cálido.
- Máximo 800 caracteres.
- CRÍTICO: Si el cliente pregunta detalles técnicos, precios o políticas, DEBES usar "query_knowledge_base".
- CRÍTICO: Cada vez que el cliente te dé un dato valioso (presupuesto, ubicación, espacio), usa la herramienta 'save_customer_data' inmediatamente para registrarlo.
`;
  }

  evaluateTransition({ messages, intent, customer, llmShouldAdvance }) {
    const baseTransition = super.evaluateTransition({ messages, intent, customer, llmShouldAdvance });
    if (baseTransition) return baseTransition;

    // Reglas específicas de Discovery
    if (llmShouldAdvance) return 'RECOMMENDATION';
    if (intent && intent.includes('OBJECTION')) return 'RECOMMENDATION';
    return null;
  }
}

module.exports = DiscoveryState;
