const Command = require('./Command');

class TriggerStaticFlowCommand extends Command {
  constructor() {
    super(
      'trigger_static_flow',
      'Ejecuta un flujo visual predefinido para el usuario. Úsalo si el usuario quiere iniciar una secuencia específica (ej. ver menú principal, solicitar hablar con asesor). Requiere el ID del flujo.'
    );
  }

  getToolSchema() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: 'object',
          properties: {
            flow_id: {
              type: 'string',
              description: 'El ID del flujo a ejecutar (ej. "flow_123456789")'
            }
          },
          required: ['flow_id']
        }
      }
    };
  }

  async execute(args, context) {
    try {
      const { flow_id } = args;
      const { senderId, customer } = context;
      
      const flowService = require('../../services/flow.service');
      const { state } = require('../../shared');

      if (!state || !state.flowsConfig) {
        return { status: 'error', message: 'Configuración de flujos no disponible' };
      }

      const flow = state.flowsConfig.flows.find(f => f.id === flow_id || f.id === `flow_${flow_id}`);
      
      if (!flow || !flow.steps) {
        return { status: 'error', message: `Flujo ${flow_id} no encontrado o vacío` };
      }

      const senderName = customer?.name || senderId;
      await flowService.processFlowSteps(flow.steps, senderId, senderName, new Set(), "");
      return { status: 'success', message: `Flujo ${flow.name || flow_id} ejecutado correctamente.` };

    } catch (error) {
      console.error('[TriggerStaticFlowCommand] Error:', error);
      return { status: 'error', message: error.message };
    }
  }
}

module.exports = TriggerStaticFlowCommand;
