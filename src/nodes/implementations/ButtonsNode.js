const BaseNode = require('../base/BaseNode');

/**
 * ButtonsNode - Nodo para mensajes con botones
 */
class ButtonsNode extends BaseNode {
  constructor(config) {
    super({
      type: 'buttons',
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
      throw new Error('Buttons: "message" debe ser un string');
    }

    if (!Array.isArray(step.buttons)) {
      throw new Error('Buttons: "buttons" debe ser un array');
    }

    if (step.buttons.length === 0) {
      throw new Error('Buttons: Mínimo 1 botón requerido');
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
    return { success: true, message: 'Buttons message sent' };
  }
}

module.exports = ButtonsNode;
