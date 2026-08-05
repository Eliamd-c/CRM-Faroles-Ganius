// ==========================================
// SalesState.js - Clase Base (State Pattern)
// Node.js Design Patterns - Cap. 9
// ==========================================
// Cada etapa del embudo de ventas implementa esta interfaz.
// El nodo `respondNode` de LangGraph delega el prompt
// a la clase de estado correspondiente según `funnel_stage`.

class SalesState {
  constructor(name) {
    this.name = name;
  }

  /**
   * Retorna el prompt específico para esta etapa del embudo.
   * @param {Object} params - { context, messages, intent, customer }
   * @returns {string} El prompt completo para el LLM.
   */
  getPrompt({ context, messages, intent, customer }) {
    throw new Error(`[SalesState] getPrompt() no implementado en estado "${this.name}"`);
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
