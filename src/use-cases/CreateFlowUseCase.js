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

    // NUEVO: Si el primer paso es ad_trigger, marcar como flujo de anuncio
    const isAdFlow = steps[0]?.type === 'ad_trigger';
    const flowData = {
      name: name.trim(),
      keywords: (keywords || []).map(k => k.toLowerCase().trim()).filter(Boolean),
      matchType: matchType || 'contains',
      steps,
      isAdFlow // NUEVO
    };

    const flow = await this.flowRepository.create(flowData);

    return {
      status: 'success',
      flow,
      isAdFlow,
      message: isAdFlow
        ? `Flujo de anuncio "${flow.name}" creado exitosamente`
        : `Flujo "${flow.name}" creado exitosamente`
    };
  }

  _validateSteps(steps) {
    // ACTUALIZADO: Agregar 'ad_trigger' a tipos válidos
    const validTypes = [
      'text', 'buttons', 'template', 'card', 'carousel', 'gallery',
      'audio', 'video', 'file', 'delay', 'input', 'condition',
      'randomizer', 'goto', 'action', 'ai_agent',
      'ad_trigger'  // NUEVO
    ];

    for (const [index, step] of steps.entries()) {
      if (!step.type || !validTypes.includes(step.type)) {
        throw new Error(`Paso ${index}: tipo inválido: ${step.type}`);
      }

      // NUEVO: ad_trigger solo permitido como primer paso
      if (step.type === 'ad_trigger' && index !== 0) {
        throw new Error('Ad Trigger debe ser el primer paso del flujo');
      }

      // Validaciones específicas por tipo
      this._validateStepByType(step, index);
    }
  }

  /**
   * Validar cada paso según su tipo
   */
  _validateStepByType(step, index) {
    switch (step.type) {
      case 'text':
        if (!step.message) throw new Error(`Paso ${index}: text requiere "message"`);
        break;
      case 'buttons':
        if (!step.message || !Array.isArray(step.buttons)) {
          throw new Error(`Paso ${index}: buttons requiere "message" y "buttons"`);
        }
        break;
      case 'ad_trigger':
        // Ad Trigger es solo un disparador, sin validación de contenido
        // El contenido del anuncio se configura en Meta Ads Manager
        break;
      case 'condition':
        if (!step.field) throw new Error(`Paso ${index}: condition requiere "field"`);
        break;
      // ... otros validaciones
    }
  }
}

module.exports = CreateFlowUseCase;
