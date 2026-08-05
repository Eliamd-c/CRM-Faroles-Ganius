const SalesState = require('./SalesState');

// ==========================================
// RecommendationState - Presentación del producto ideal
// ==========================================
// El bot presenta el farol solar ideal basándose en la información
// recopilada en Discovery. Usa técnicas de Cialdini (Prueba Social,
// Autoridad, Escasez) para persuadir.

class RecommendationState extends SalesState {
  constructor() {
    super('RECOMMENDATION');
  }

  getPrompt({ context, messages, intent, customer }) {
    const lastMessages = messages.slice(-6).map(m => `[${m.role}]: ${m.content}`).join('\n');
    
    return `
Contexto Maestro:
${context}

ETAPA ACTUAL DEL EMBUDO: 💡 RECOMMENDATION (Recomendación Personalizada)

TU OBJETIVO EN ESTA ETAPA:
1. Basándote en lo que descubriste del cliente, recomienda el farol solar IDEAL.
2. Usa las técnicas de Cialdini del Contexto Maestro:
   - Prueba Social: "Más de X familias en tu zona ya usan este modelo..."
   - Autoridad: "Nuestros ingenieros diseñaron este modelo específicamente para..."
   - Reciprocidad: Ofrece un beneficio extra ("te incluimos envío gratis" o "garantía extendida").
   - Escasez: "Este modelo tiene disponibilidad limitada este mes."
3. Maneja objeciones con elegancia. Si el cliente dice "es caro", reenmarca el valor (costo vs. inversión a largo plazo).
4. Si el cliente muestra interés de compra, guíalo hacia el cierre.

Historial:
${lastMessages}

Intención detectada: ${intent}
${customer ? `Datos del cliente: ${JSON.stringify(customer)}` : ''}

REGLAS:
- CRÍTICO: Usa SIEMPRE la herramienta 'send_product_catalog' para mostrar las opciones. NUNCA inventes nombres de productos ni precios.
- Sé persuasivo pero NUNCA agresivo.
- Si es una OBJECTION, responde con la técnica de Cialdini más apropiada.
- Máximo 800 caracteres.
`;
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
