/**
 * Use Case: inyectar la respuesta de un operador humano y reanudar el bot.
 *
 * Dependency Injection por constructor (Node.js Design Patterns, cap. 7) para
 * testeabilidad: langGraphService (checkpointer), supabaseGateway (estado del bot)
 * y metaGateway (canal de salida).
 *
 * Orden de operaciones (importante):
 *   1. LangGraph: updateState -> resetea human_needed en el checkpoint.
 *   2. Canal: enviar el mensaje al usuario (troceado, límite Instagram ~1000 chars).
 *   3. DB: resumeBot() -> limpia bot_paused/bot_paused_at/bot_paused_reason.
 * Reanudar la DB al final evita que un mensaje entrante llegue al bot mientras
 * el checkpoint aún tiene human_needed = true.
 */
class InjectHumanMessageUseCase {
  constructor(langGraphService, supabaseGateway, metaGateway) {
    this.langGraphService = langGraphService;
    this.supabaseGateway = supabaseGateway;
    this.metaGateway = metaGateway;
  }

  async execute({ threadId, message, checkpointId = null }) {
    if (!threadId || !message) {
      throw new Error('threadId and message are required');
    }

    try {
      // 1. Inyectar el mensaje como 'assistant' (el humano responde en nombre del bot)
      const payload = {
        messages: [{ role: 'assistant', content: message }],
        human_needed: false // Reseteamos la bandera de escalamiento
      };

      await this.langGraphService.updateState(threadId, payload, checkpointId);

      // 2. Enviar realmente por Instagram, troceado (Bug A: sendMessage truncaba >1000)
      if (this.metaGateway) {
        await this.metaGateway.sendMessageInChunks(threadId, message);
      }

      // 3. Reanudar el bot en la base de datos, limpiando el invariante completo
      if (this.supabaseGateway) {
        await this.supabaseGateway.resumeBot(threadId);
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
