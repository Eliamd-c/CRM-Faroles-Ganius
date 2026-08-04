class UpdateFlowUseCase {
  constructor({ flowRepository }) {
    this.flowRepository = flowRepository;
  }

  async execute(input) {
    const { flowId, name, keywords, matchType, steps, enabled } = input;

    if (!flowId) {
      throw new Error('El ID del flujo es requerido');
    }

    const flow = await this.flowRepository.read(flowId);
    if (!flow) {
      throw new Error(`Flujo no encontrado: ${flowId}`);
    }

    const updates = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        throw new Error('El nombre del flujo debe ser una cadena no vacía');
      }
      updates.name = name.trim();
    }

    if (keywords !== undefined) {
      if (!Array.isArray(keywords)) {
        throw new Error('Las palabras clave deben ser un array');
      }
      updates.keywords = keywords.map(k => k.toLowerCase().trim()).filter(Boolean);
    }

    if (matchType !== undefined) {
      const validTypes = ['contains', 'exact', 'starts_with', 'regex'];
      if (!validTypes.includes(matchType)) {
        throw new Error(`Tipo de coincidencia inválido: ${matchType}`);
      }
      updates.matchType = matchType;
    }

    if (steps !== undefined) {
      if (!Array.isArray(steps) || steps.length === 0) {
        throw new Error('El flujo debe tener al menos un paso');
      }
      this._validateSteps(steps);
      updates.steps = steps;
    }

    if (enabled !== undefined) {
      updates.enabled = Boolean(enabled);
    }

    const updated = await this.flowRepository.update(flowId, updates);

    return {
      status: 'success',
      flow: updated,
      message: `Flujo "${updated.name}" actualizado exitosamente`
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
    }
  }
}

module.exports = UpdateFlowUseCase;
