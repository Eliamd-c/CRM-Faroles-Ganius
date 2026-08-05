const SalesState = require('./SalesState');

// ==========================================
// OnboardingState - Primera impresión
// ==========================================
// El bot se presenta, establece su identidad espiritual/humana
// y hace la primera pregunta para perfilar al cliente.
//
// ARQUITECTURA: Implementa getSystemInstruction() (SoC).
// respondNode llama a getSystemInstruction() + getHistoryContext()
// y construye el prompt sin duplicación de historial.

class OnboardingState extends SalesState {
  constructor() {
    super('ONBOARDING');
  }

  /**
   * Retorna SOLO la instrucción del sistema para ONBOARDING.
   * NO incluir historial aquí.
   */
  getSystemInstruction({ context, intent, customer }) {
    return `Contexto Maestro:
${context}

ETAPA ACTUAL DEL EMBUDO: 🟢 ONBOARDING (Primera Impresión)

TU OBJETIVO EN ESTA ETAPA:
1. Presentarte como Faroles Genius de forma cálida y memorable.
2. Generar confianza inmediata (usa Prueba Social si aplica: "más de X familias ya iluminan sus hogares").
3. Hacer UNA pregunta abierta para descubrir qué necesita el cliente (ej. "¿Qué espacio te gustaría iluminar?").
4. NO intentes vender todavía. Solo conoce al cliente.

Intención detectada: ${intent || 'GENERAL'}
${customer?.name ? `Cliente: ${customer.name}` : ''}

REGLAS CRÍTICAS:
- Sé breve, máximo 800 caracteres.
- Si preguntan detalles técnicos → usa 'query_knowledge_base' obligatoriamente.
- Si muestran interés claro → sugiere avanzar a DISCOVERY.
- NUNCA incluyas precios aquí - usarás tools para eso.
- Sé cálido, curioso, NO vendedor.`;
  }

  evaluateTransition({ messages, intent, customer, llmShouldAdvance }) {
    // Primero aplicar reglas globales de la clase base
    const baseTransition = super.evaluateTransition({ messages, intent, customer, llmShouldAdvance });
    if (baseTransition) return baseTransition;

    // Reglas específicas de Onboarding
    if (messages.length >= 4 || llmShouldAdvance) return 'DISCOVERY';
    if (intent && (intent.includes('OBJECTION') || intent.includes('PRODUCT'))) return 'DISCOVERY';
    return null;
  }
}

module.exports = OnboardingState;
