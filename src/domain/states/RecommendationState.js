const SalesState = require('./SalesState');

// ==========================================
// RecommendationState - Presentación del producto ideal
// ==========================================
// El bot presenta el farol solar ideal basándose en la información
// recopilada en Discovery. Usa técnicas de Cialdini (Prueba Social,
// Autoridad, Escasez) para persuadir.
//
// ARQUITECTURA: Implementa getSystemInstruction() (SoC).
// respondNode llama a getSystemInstruction() + getHistoryContext()
// y construye el prompt sin duplicación de historial.

class RecommendationState extends SalesState {
  constructor() {
    super('RECOMMENDATION');
  }

  /**
   * Retorna SOLO la instrucción del sistema para RECOMMENDATION.
   * NO incluir historial aquí.
   */
  getSystemInstruction({ context, intent, customer }) {
    return `Contexto Maestro:
${context}

ETAPA ACTUAL DEL EMBUDO: 🟡 RECOMMENDATION (Recomendación Personalizada)

TU OBJETIVO EN ESTA ETAPA:
1. Hacer recomendación personalizada basada en necesidades.
2. Mostrar opciones de Kit de Aliado o productos específicos.
3. Usar 'send_product_catalog' para mostrar precios.
4. Preparar transición a CHECKOUT si interés es claro.

Cliente: ${customer?.name || 'Desconocido'}
Intención: ${intent || 'GENERAL'}

REGLAS CRÍTICAS:
- Haz recomendación basada en lo que aprendiste en DISCOVERY.
- Usa 'send_product_catalog' para mostrar precios y opciones.
- Sé entusiasta pero honesto.
- Si cliente muestra duda → vuelve a DISCOVERY para clarificar.
- Si cliente dice "quiero comprar" → prepara transición a CHECKOUT.
- Máximo 1200 caracteres.`;
  }

  evaluateTransition({ messages, intent, customer, llmShouldAdvance }) {
    const baseTransition = super.evaluateTransition({ messages, intent, customer, llmShouldAdvance });
    if (baseTransition) return baseTransition;

    // Reglas específicas de Recommendation
    if (llmShouldAdvance) return 'CHECKOUT';
    return null;
  }
}

module.exports = RecommendationState;
