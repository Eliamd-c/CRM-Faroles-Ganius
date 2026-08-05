// ==========================================
// SalesState.js - Clase Base (State Pattern)
// Node.js Design Patterns - Cap. 9
// Separation of Concerns: Instrucciones del sistema + Contexto histórico
// ==========================================
// Cada etapa del embudo de ventas implementa esta interfaz.
// El nodo `respondNode` de LangGraph delega el prompt
// a la clase de estado correspondiente según `funnel_stage`.
//
// ARQUITECTURA (Corrección de Alucinaciones):
// Separamos getPrompt() en dos métodos:
// 1. getSystemInstruction() - instrucciones específicas de etapa
// 2. getHistoryContext() - contexto histórico formateado (base)
//
// Razón: Prevenir que el historial se incluya múltiples veces
// o que se formatea incorrectamente. Cada componente es responsable
// de su parte, sin duplicación (SoC).

class SalesState {
  constructor(name) {
    this.name = name;
  }

  /**
   * NUEVA ARQUITECTURA: Retorna SOLO la instrucción del sistema para esta etapa.
   * Cada subclase implementa esto de forma única.
   * NO incluir historial aquí - eso es responsabilidad de getHistoryContext().
   * @param {Object} params - { context, intent, customer }
   * @returns {string} Instrucción del sistema (sin historial).
   */
  getSystemInstruction({ context, intent, customer }) {
    throw new Error(`[SalesState] getSystemInstruction() no implementado en estado "${this.name}"`);
  }

  /**
   * NUEVA ARQUITECTURA: Retorna SOLO el contexto histórico formateado.
   * Implementación base para todas las subclases (no necesita override).
   * @param {Object} params - { messages }
   * @returns {string} Historial reciente formateado.
   */
  getHistoryContext({ messages }) {
    if (!messages || messages.length === 0) {
      return '(Sin historial previo)';
    }
    // Tomar últimos 4 mensajes para contexto (evita ventana de contexto gigante)
    const lastMessages = messages
      .slice(-4)
      .map(m => `[${m.role}]: ${m.content}`)
      .join('\n');
    return `Historial reciente:\n${lastMessages}`;
  }

  /**
   * DEPRECATED (Mantener por retrocompatibilidad 1 sprint).
   * Combina getSystemInstruction() + getHistoryContext().
   * Usa esto SOLO si no puedes refactorizar a getSystemInstruction() + getHistoryContext() aún.
   * @param {Object} params - { context, messages, intent, customer }
   * @returns {string} El prompt completo (DEPRECATED).
   */
  getPrompt({ context, messages, intent, customer }) {
    console.warn(
      `[SalesState] DEPRECATED: getPrompt() en "${this.name}" - ` +
      `usar getSystemInstruction() + getHistoryContext() en su lugar`
    );
    const systemInstr = this.getSystemInstruction({ context, intent, customer });
    const historyInstr = this.getHistoryContext({ messages });
    return systemInstr + '\n\n' + historyInstr;
  }

  /**
   * Evalúa si el cliente debe avanzar a la siguiente etapa del embudo.
   * Las clases hijas deben llamar a super.evaluateTransition() primero
   * para aplicar las reglas globales de transición.
   * @param {Object} params - { messages, intent, customer, llmShouldAdvance }
   * @returns {string|null} El nombre de la siguiente etapa, o null si permanece.
   */
  evaluateTransition({ messages, intent, customer, llmShouldAdvance }) {
    // Si hay intención de compra, verificar si ya sabemos qué quiere
    if (intent === 'PURCHASE_INTENT') {
      const hasProductInterest = customer?.fields?.modelo_interes || customer?.fields?.espacio_a_iluminar;
      return hasProductInterest ? 'CHECKOUT' : 'DISCOVERY';
    }
    return null;
  }
}

module.exports = SalesState;
