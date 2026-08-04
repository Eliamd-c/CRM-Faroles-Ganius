class TestFlowUseCase {
  constructor({ flowRepository, metaGateway }) {
    this.flowRepository = flowRepository;
    this.metaGateway = metaGateway;
  }

  async execute(input) {
    const { flowId, senderId, senderName } = input;

    if (!flowId) {
      throw new Error('El ID del flujo es requerido');
    }

    if (!senderId) {
      throw new Error('El ID del remitente es requerido');
    }

    const flow = await this.flowRepository.read(flowId);
    if (!flow) {
      throw new Error(`Flujo no encontrado: ${flowId}`);
    }

    if (!flow.enabled) {
      return {
        status: 'warning',
        message: 'El flujo está deshabilitado',
        flow
      };
    }

    const testResult = {
      status: 'success',
      flowId: flow.id,
      flowName: flow.name,
      testInput: {
        senderId,
        senderName: senderName || 'Usuario Prueba'
      },
      stepsCount: flow.steps.length,
      message: `Flujo "${flow.name}" listo para ejecutar con ${flow.steps.length} pasos`
    };

    return testResult;
  }
}

module.exports = TestFlowUseCase;
