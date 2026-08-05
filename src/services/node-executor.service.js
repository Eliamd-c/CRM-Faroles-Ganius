/**
 * NodeExecutorService - Orquesta la ejecución de nodos
 * Middleware Pattern del libro (Cap. 9)
 */
class NodeExecutorService {
  constructor(nodeFactory, logger) {
    this.nodeFactory = nodeFactory;
    this.logger = logger;
  }

  /**
   * Ejecutar un paso del flujo
   */
  async executeStep(step, context) {
    try {
      // 1. Crear instancia del nodo
      const node = this.nodeFactory.create(step.type, {
        executionStrategy: context.strategies[step.type]
      });

      // 2. Ejecutar (con validación, preparación, etc)
      const result = await node.execute(step, context);

      return result;
    } catch (error) {
      this.logger.error(`Error ejecutando nodo ${step.type}:`, error);
      throw error;
    }
  }

  /**
   * Ejecutar todos los pasos de un flujo
   */
  async executeFlow(steps, context) {
    const executionLog = [];
    context.executionLog = executionLog;

    for (const step of steps) {
      try {
        const result = await this.executeStep(step, context);
        executionLog.push({
          stepId: step.id,
          type: step.type,
          status: 'success',
          result
        });
      } catch (error) {
        executionLog.push({
          stepId: step.id,
          type: step.type,
          status: 'error',
          error: error.message
        });
        throw error;
      }
    }

    return executionLog;
  }
}

module.exports = NodeExecutorService;
