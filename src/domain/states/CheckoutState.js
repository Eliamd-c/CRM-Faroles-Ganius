const SalesState = require('./SalesState');

// ==========================================
// CheckoutState - Cierre de venta
// ==========================================
// El bot guía al cliente hacia la compra final: confirma producto,
// detalla precio, garantía, métodos de pago y pasos a seguir.
//
// ARQUITECTURA: Implementa getSystemInstruction() (SoC).
// respondNode llama a getSystemInstruction() + getHistoryContext()
// y construye el prompt sin duplicación de historial.

class CheckoutState extends SalesState {
  constructor() {
    super('CHECKOUT');
  }

  /**
   * Retorna SOLO la instrucción del sistema para CHECKOUT.
   * NO incluir historial aquí.
   */
  getSystemInstruction({ context, intent, customer }) {
    return `Contexto Maestro:
${context}

ETAPA ACTUAL DEL EMBUDO: 🟢 CHECKOUT (Cierre de Venta)

TU OBJETIVO EN ESTA ETAPA:
1. Facilitar el proceso de compra.
2. Responder dudas finales sobre envío, garantía, etc.
3. Proporcionar instrucciones claras para completar compra.
4. Escalar a humano si hay dudas complejas.

Cliente: ${customer?.name || 'Desconocido'}
Intención: ${intent || 'GENERAL'}

REGLAS CRÍTICAS:
- Sé claro y conciso.
- Proporciona info sobre formas de pago, envío, garantía.
- Si cliente tiene duda que NO puedas resolver → escala a humano.
- Usa 'query_knowledge_base' para preguntas sobre políticas.
- Si cliente dice "no quiero" → pregunta por qué y regresa a DISCOVERY.
- Máximo 1000 caracteres.`;
  }

  evaluateTransition({ messages, intent, customer, llmShouldAdvance }) {
    // En CHECKOUT, solo permaneces o escalas a humano
    if (intent === 'ESCALATE') {
      return null; // El controlador superior manejar human_needed
    }
    return null;
  }
}

module.exports = CheckoutState;
