const ExecutionStrategy = require('../../src/nodes/strategies/ExecutionStrategy');

/**
 * MockAdTriggerStrategy - Mock para testing
 */
class MockAdTriggerStrategy extends ExecutionStrategy {
  constructor() {
    super();
    this.executeCalled = false;
    this.lastStep = null;
    this.lastContext = null;
  }

  async validatePreconditions(step, context) {
    return true;
  }

  async execute(step, context) {
    this.executeCalled = true;
    this.lastStep = step;
    this.lastContext = context;

    return {
      success: true,
      flowId: 'mock_flow_' + Date.now(),
      message: 'Mock Welcome Message Flow creado'
    };
  }

  async rollback(step, context, error) {
    console.log('Mock rollback called:', error.message);
  }
}

module.exports = MockAdTriggerStrategy;
