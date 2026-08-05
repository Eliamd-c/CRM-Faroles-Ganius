/**
 * BaseNode - Clase base abstracta para todos los tipos de nodos
 * Sigue el patrón Template Method del libro (Cap. 9)
 */
class BaseNode {
  constructor(config = {}) {
    this.id = config.id || `node_${Date.now()}`;
    this.type = config.type || 'unknown';
    this.enabled = config.enabled !== false;
    this.metadata = {
      createdAt: config.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    };
  }

  /**
   * Template Method Pattern - Define estructura pero delega implementación
   */
  async execute(step, context) {
    // 1. Validar
    this.validate(step);

    // 2. Preparar
    const preparedStep = this.prepare(step, context);

    // 3. Ejecutar (delegado a subclase)
    await this.executeImpl(preparedStep, context);

    // 4. Post-procesar
    await this.postProcess(preparedStep, context);
  }

  /**
   * Validar estructura del paso
   * DEBE ser sobrescrito en subclases
   */
  validate(step) {
    if (!step || typeof step !== 'object') {
      throw new Error(`Paso inválido: se esperaba objeto, recibió ${typeof step}`);
    }
    if (step.type !== this.type) {
      throw new Error(`Tipo de paso incorrecto: esperado ${this.type}, recibió ${step.type}`);
    }
  }

  /**
   * Preparar datos antes de ejecutar
   */
  prepare(step, context) {
    return {
      ...step,
      _executedAt: new Date().toISOString(),
      _context: context
    };
  }

  /**
   * Implementación específica del nodo
   * DEBE ser sobrescrito en subclases
   */
  async executeImpl(step, context) {
    throw new Error(`${this.constructor.name} must implement executeImpl()`);
  }

  /**
   * Post-procesamiento (logging, análitica, etc)
   */
  async postProcess(step, context) {
    // Registrar ejecución
    if (context.trackExecution) {
      context.executionLog.push({
        nodeId: this.id,
        nodeType: this.type,
        executedAt: step._executedAt,
        success: true
      });
    }
  }
}

module.exports = BaseNode;
