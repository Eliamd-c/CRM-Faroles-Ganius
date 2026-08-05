const SalesState = require('./SalesState');

// ==========================================
// CheckoutState - Cierre de venta
// ==========================================
// El bot guía al cliente hacia la compra final: confirma producto,
// detalla precio, garantía, métodos de pago y pasos a seguir.

class CheckoutState extends SalesState {
  constructor() {
    super('CHECKOUT');
  }

  getPrompt({ context, messages, intent, customer }) {
    const lastMessages = messages.slice(-6).map(m => `[${m.role}]: ${m.content}`).join('\n');
    
    return `
Contexto Maestro:
${context}

ETAPA ACTUAL DEL EMBUDO: 🛒 CHECKOUT (Cierre de Venta)

TU OBJETIVO EN ESTA ETAPA:
1. Confirmar el producto que el cliente desea.
2. Detallar claramente: Precio final, garantía, tiempo de entrega y métodos de pago.
3. Usar Urgencia y Compromiso (Cialdini): "Si confirmas hoy, te garantizamos el envío para esta semana."
4. Si el cliente tiene dudas finales, resolverlas con confianza y calidez.
5. Si el cliente confirma la compra, felicitarlo y darle los pasos a seguir (link de pago, datos de transferencia, etc.).
6. Si el cliente NO quiere comprar ahora, no presionar. Ofrecer seguimiento amable.

Historial:
${lastMessages}

Intención detectada: ${intent}
${customer ? `Datos del cliente: ${JSON.stringify(customer)}` : ''}

REGLAS:
- Sé claro y directo con los números (precio, garantía).
- Transmite seguridad y profesionalismo.
- Si el cliente pide hablar con un humano, respétalo inmediatamente.
- Máximo 800 caracteres.
`;
  }

  evaluateTransition({ messages, intent, customer, llmShouldAdvance }) {
    // Checkout es la etapa final. No aplica la regla global de PURCHASE_INTENT
    // porque ya estamos en CHECKOUT.
    return null;
  }
}

module.exports = CheckoutState;
