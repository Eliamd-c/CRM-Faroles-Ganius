class CreateFlowUseCase {
  constructor({ flowRepository }) {
    this.flowRepository = flowRepository;
  }

  async execute(input) {
    const { name, keywords, matchType, steps } = input;

    if (!name || typeof name !== 'string') {
      throw new Error('El nombre del flujo es requerido');
    }

    if (!Array.isArray(steps) || steps.length === 0) {
      throw new Error('El flujo debe tener al menos un paso');
    }

    this._validateSteps(steps);

    const flowData = {
      name: name.trim(),
      keywords: (keywords || []).map(k => k.toLowerCase().trim()).filter(Boolean),
      matchType: matchType || 'contains',
      steps
    };

    const flow = await this.flowRepository.create(flowData);

    return {
      status: 'success',
      flow,
      message: `Flujo "${flow.name}" creado exitosamente`
    };
  }

  _validateSteps(steps) {
    const validTypes = [
      'text', 'buttons', 'template', 'card', 'carousel', 'gallery',
      'audio', 'video', 'file', 'delay', 'input', 'condition',
      'randomizer', 'goto', 'action', 'ai_agent'
    ];

    for (const step of steps) {
      if (!step.type || !validTypes.includes(step.type)) {
        throw new Error(`Tipo de paso inválido: ${step.type}`);
      }

      if (step.type === 'text' && !step.message) {
        throw new Error('Paso de texto debe tener un mensaje');
      }

      if (step.type === 'buttons' && (!step.message || !Array.isArray(step.buttons))) {
        throw new Error('Paso de botones debe tener mensaje y botones');
      }

      if (step.type === 'condition' && !step.field) {
        throw new Error('Paso de condición debe especificar un campo');
      }
    }
  }
}

module.exports = CreateFlowUseCase;
