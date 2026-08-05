/**
 * ExecutionStrategy - Interfaz para diferentes estrategias de ejecución
 * Strategy Pattern del libro (Cap. 9 - Behavioral Patterns)
 */
class ExecutionStrategy {
  async execute(step, context) {
    throw new Error('execute() must be implemented');
  }

  /**
   * Verificar pre-condiciones antes de ejecutar
   */
  async validatePreconditions(step, context) {
    return true;
  }

  /**
   * Rollback si falla la ejecución
   */
  async rollback(step, context, error) {
    console.warn(`Rollback para ${this.constructor.name}:`, error.message);
  }
}

module.exports = ExecutionStrategy;
