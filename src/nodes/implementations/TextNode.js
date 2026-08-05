const BaseNode = require('../base/BaseNode');

/**
 * TextNode - Nodo para mensajes de texto
 */
class TextNode extends BaseNode {
  constructor(config) {
    super({
      type: 'text',
      ...config
    });
    this.executionStrategy = config.executionStrategy;
  }

  /**
   * Validar estructura del paso
   */
  validate(step) {
    super.validate(step);

    if (!step.message || typeof step.message !== 'string') {
      throw new Error('Text: "message" debe ser un string');
    }

    if (step.message.trim().length === 0) {
      throw new Error('Text: "message" no puede estar vacío');
    }
  }

  /**
   * Implementación específica
   */
  async executeImpl(step, context) {
    if (this.executionStrategy) {
      return await this.executionStrategy.execute(step, context);
    }
    // Default implementation
    return { success: true, message: 'Text message sent' };
  }
}

module.exports = TextNode;
