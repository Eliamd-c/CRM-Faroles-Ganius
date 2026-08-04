class DeleteFlowUseCase {
  constructor({ flowRepository }) {
    this.flowRepository = flowRepository;
  }

  async execute(input) {
    const { flowId } = input;

    if (!flowId) {
      throw new Error('El ID del flujo es requerido');
    }

    const flow = await this.flowRepository.read(flowId);
    if (!flow) {
      throw new Error(`Flujo no encontrado: ${flowId}`);
    }

    const deleted = await this.flowRepository.delete(flowId);

    if (!deleted) {
      throw new Error('No se pudo eliminar el flujo');
    }

    return {
      status: 'success',
      deletedFlowId: flow.id,
      deletedFlowName: flow.name,
      message: `Flujo "${flow.name}" eliminado exitosamente`
    };
  }
}

module.exports = DeleteFlowUseCase;
