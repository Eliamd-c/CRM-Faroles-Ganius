class InjectHumanMessageUseCase {
  constructor(langGraphService, customerGateway, metaGateway) {
    this.langGraphService = langGraphService;
    this.customerGateway = customerGateway;
    this.metaGateway = metaGateway;
  }

  async execute({ threadId, message, checkpointId = null }) {
    if (!threadId || !message) {
      throw new Error('threadId and message are required');
    }

    try {
      // 1. Inyectar el mensaje como si fuera del 'assistant'
      // Opcionalmente, si es Human in the loop, a veces se inyecta como 'user' o 'assistant'. 
      // Si el humano responde en nombre del bot, el rol es 'assistant'.
      const payload = {
        messages: [{ role: 'assistant', content: message }],
        human_needed: false // Reseteamos la bandera de escalamiento
      };

      await this.langGraphService.updateState(threadId, payload, checkpointId);

      // 2. Opcional: Enviar el mensaje realmente por Instagram (si no lo enviaron por otro lado)
      // Asumiremos que el CRM usará esto para responder directamente
      if (this.metaGateway) {
        await this.metaGateway.sendMessage(threadId, message);
      }

      // 3. Reanudar el bot en la base de datos (bot_paused = false)
      if (this.customerGateway) {
        await this.customerGateway.update(threadId, { bot_paused: false });
      }

      return {
        success: true,
        message: 'Message injected and bot resumed'
      };
    } catch (error) {
      throw new Error(`Failed to inject human message: ${error.message}`);
    }
  }
}

module.exports = InjectHumanMessageUseCase;
