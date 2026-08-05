const SalesState = require('./SalesState');

// ==========================================
// OnboardingState - Primera impresión
// ==========================================
// El bot se presenta, establece su identidad espiritual/humana
// y hace la primera pregunta para perfilar al cliente.

class OnboardingState extends SalesState {
  constructor() {
    super('ONBOARDING');
  }

  getPrompt({ context, messages, intent, customer }) {
    const lastMessages = messages.slice(-4).map(m => `[${m.role}]: ${m.content}`).join('\n');
    
    return `
Contexto Maestro:
${context}

ETAPA ACTUAL DEL EMBUDO: 🟢 ONBOARDING (Primera Impresión)

TU OBJETIVO EN ESTA ETAPA:
1. Presentarte como Faroles Genius de forma cálida y memorable.
2. Generar confianza inmediata (usa Prueba Social si aplica: "más de X familias ya iluminan sus hogares").
3. Hacer UNA pregunta abierta para descubrir qué necesita el cliente (ej. "¿Qué espacio te gustaría iluminar?").
4. NO intentes vender todavía. Solo conoce al cliente.

Historial:
${lastMessages}

Intención detectada: ${intent}

REGLAS:
- Sé breve, cálido y curioso.
- Máximo 800 caracteres.
- Si el cliente ya mostró interés claro en un producto, sugiere avanzar a Discovery.
- CRÍTICO (RAG): Si el cliente pregunta detalles técnicos, precios, especificaciones o políticas desde el inicio, DEBES usar la herramienta "query_knowledge_base" para buscar la respuesta exacta en los manuales antes de contestar. No inventes datos.
`;
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
