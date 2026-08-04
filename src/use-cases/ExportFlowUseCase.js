class ExportFlowUseCase {
  constructor({ flowRepository }) {
    this.flowRepository = flowRepository;
  }

  async execute(input) {
    const { flowId, format = 'json' } = input;

    if (!flowId) {
      throw new Error('El ID del flujo es requerido');
    }

    const flow = await this.flowRepository.read(flowId);
    if (!flow) {
      throw new Error(`Flujo no encontrado: ${flowId}`);
    }

    if (format === 'json') {
      return {
        status: 'success',
        format: 'json',
        data: {
          id: flow.id,
          name: flow.name,
          keywords: flow.keywords,
          matchType: flow.matchType,
          steps: flow.steps,
          enabled: flow.enabled,
          createdAt: flow.createdAt,
          updatedAt: flow.updatedAt
        },
        filename: `${flow.id}_${new Date().toISOString().slice(0, 10)}.json`
      };
    }

    throw new Error(`Formato no soportado: ${format}`);
  }
}

module.exports = ExportFlowUseCase;
