const BaseNode = require('../base/BaseNode');

/**
 * AdTriggerNode - Nodo disparador de anuncios Instagram
 * Integra Welcome Message Ads al Flow Builder
 */
class AdTriggerNode extends BaseNode {
  constructor(config) {
    super({
      type: 'ad_trigger',
      ...config
    });
    this.executionStrategy = config.executionStrategy;
    this.validator = config.validator;
  }

  /**
   * Validar estructura del paso (sobrescribe BaseNode)
   */
  validate(step) {
    super.validate(step);

    // Validaciones específicas de Ad Trigger
    if (!step.message || typeof step.message !== 'string') {
      throw new Error('Ad Trigger: "message" debe ser un string');
    }

    if (step.message.trim().length === 0) {
      throw new Error('Ad Trigger: "message" no puede estar vacío');
    }

    if (!Array.isArray(step.quick_replies)) {
      throw new Error('Ad Trigger: "quick_replies" debe ser un array');
    }

    if (step.quick_replies.length === 0) {
      throw new Error('Ad Trigger: Mínimo 1 botón requerido');
    }

    if (step.quick_replies.length > 13) {
      throw new Error('Ad Trigger: Máximo 13 botones permitidos');
    }

    // Validar estructura de cada quick reply
    for (let i = 0; i < step.quick_replies.length; i++) {
      const qr = step.quick_replies[i];
      if (!qr.title || !qr.payload) {
        throw new Error(`Ad Trigger: Quick reply ${i} debe tener "title" y "payload"`);
      }
      if (qr.title.length > 20) {
        throw new Error(`Ad Trigger: Título de botón no puede exceder 20 caracteres`);
      }
    }

    // Validar que no hay variables en primer mensaje (limitación Meta)
    if (step.message.includes('{{') || step.message.includes('{username}')) {
      throw new Error('Ad Trigger: No se permiten variables en el mensaje (limitación Meta)');
    }
  }

  /**
   * Implementación específica (ejecuta el strategy)
   */
  async executeImpl(step, context) {
    return await this.executionStrategy.execute(step, context);
  }

  /**
   * Marcar que este es un nodo especial que crea un Welcome Flow
   */
  createsWelcomeFlow() {
    return true;
  }

  /**
   * El nodo debe ser el primero en el flujo
   */
  isFirstNodeOnly() {
    return true;
  }
}

module.exports = AdTriggerNode;
