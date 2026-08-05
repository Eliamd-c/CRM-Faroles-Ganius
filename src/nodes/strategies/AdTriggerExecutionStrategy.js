const ExecutionStrategy = require('./ExecutionStrategy');
const axios = require('axios');

/**
 * AdTriggerExecutionStrategy - Ejecuta lógica del disparador de anuncios
 */
class AdTriggerExecutionStrategy extends ExecutionStrategy {
  constructor(metaService, welcomeFlowsService) {
    super();
    this.metaService = metaService;
    this.welcomeFlowsService = welcomeFlowsService;
  }

  async validatePreconditions(step, context) {
    // Validaciones antes de crear el Welcome Flow
    if (!step.message || step.message.trim().length === 0) {
      throw new Error('Ad Trigger: Mensaje requerido');
    }

    if (!step.quick_replies || step.quick_replies.length === 0) {
      throw new Error('Ad Trigger: Mínimo 1 botón de respuesta rápida requerido');
    }

    if (step.quick_replies.length > 13) {
      throw new Error('Ad Trigger: Máximo 13 botones permitidos (limitación Meta)');
    }

    // Verificar que no hay variables en el primer mensaje (limitación Meta)
    if (step.message.includes('{{') || step.message.includes('{username}')) {
      throw new Error('Ad Trigger: No se permiten variables en el mensaje inicial (limitación Meta)');
    }

    return true;
  }

  async execute(step, context) {
    try {
      // 1. Crear Welcome Message Flow en Meta
      const flowId = await this.createWelcomeMessageFlow(step, context);

      // 2. Guardar en DB (tabla welcome_ad_flows)
      await this.saveAdTriggerMetadata(flowId, step, context);

      // 3. Notificar al usuario
      context.broadcastLog?.('AD_TRIGGER', `Disparador de anuncio creado: ${flowId}`);

      return {
        success: true,
        flowId,
        message: `Welcome Message Flow creado exitosamente`
      };
    } catch (error) {
      await this.rollback(step, context, error);
      throw error;
    }
  }

  async createWelcomeMessageFlow(step, context) {
    // Construcción del payload para Meta API
    const metaPayload = {
      eligible_platforms: ['instagram'],
      name: step.flowName || `Ad Flow ${Date.now()}`,
      welcome_message_flow: [{
        message: {
          text: step.message,
          quick_replies: (step.quick_replies || []).map(qr => ({
            content_type: 'text',
            title: qr.title,
            payload: qr.payload
          }))
        }
      }]
    };

    // Llamar a Meta API
    const response = await axios.post(
      `https://graph.instagram.com/v26.0/me/welcome_message_flows`,
      metaPayload,
      {
        params: { access_token: context.accessToken }
      }
    );

    if (!response.data.flow_id) {
      throw new Error('Meta no devolvió flow_id');
    }

    return response.data.flow_id;
  }

  async saveAdTriggerMetadata(flowId, step, context) {
    if (!context.supabase) return;

    await context.supabase
      .from('welcome_ad_flows')
      .insert({
        flow_id: flowId,
        meta_flow_id: flowId,
        flow_name: step.flowName,
        message: step.message,
        quick_replies: step.quick_replies,
        linked_flow_id: step.linkedFlowId,
        created_by: context.userId,
        created_at: new Date().toISOString()
      });
  }

  async rollback(step, context, error) {
    console.error('AdTrigger rollback:', error.message);
    context.broadcastLog?.('ERROR', `Error creando Welcome Flow: ${error.message}`);
  }
}

module.exports = AdTriggerExecutionStrategy;
