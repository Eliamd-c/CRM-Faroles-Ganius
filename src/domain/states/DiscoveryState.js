const SalesState = require('./SalesState');

// ==========================================
// DiscoveryState - Calificación del cliente
// ==========================================
// El bot hace preguntas inteligentes para entender las necesidades
// del cliente: presupuesto, espacio a iluminar, uso deseado.
//
// ARQUITECTURA: Implementa getSystemInstruction() (SoC).
// respondNode llama a getSystemInstruction() + getHistoryContext()
// y construye el prompt sin duplicación de historial.

class DiscoveryState extends SalesState {
  constructor() {
    super('DISCOVERY');
  }

  /**
   * Retorna SOLO la instrucción del sistema para DISCOVERY.
   * NO incluir historial aquí.
   */
  getSystemInstruction({ context, intent, customer }) {
    return `Contexto Maestro:
${context}

ETAPA ACTUAL DEL EMBUDO: 🔵 DISCOVERY (Descubrimiento de Necesidades)

TU OBJETIVO EN ESTA ETAPA:
1. Entender profundamente qué necesita el cliente.
2. Hacer preguntas sobre espacio, presupuesto, durabilidad.
3. Acumular información técnica sobre preferencias.
4. Preparar la recomendación personalizada.

Intención: ${intent || 'GENERAL'}
Cliente: ${customer?.name || 'Desconocido'}

REGLAS CRÍTICAS:
- Formula 1-2 preguntas específicas por mensaje.
- Si preguntan precios o especificaciones → usa 'query_knowledge_base' o 'send_product_catalog'.
- Mantén conversación natural y curiosa.
- NO hagas recomendaciones aún - solo descubre.
- Máximo 1000 caracteres por respuesta.`;
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
