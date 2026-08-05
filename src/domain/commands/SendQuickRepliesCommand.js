const Command = require('./Command');

// ==========================================
// SendQuickRepliesCommand
// ==========================================
// Envía botones de respuesta rápida al cliente.
// Útil para guiar la conversación de forma interactiva
// (ej. "¿Te interesa más el modelo A o el B?").

class SendQuickRepliesCommand extends Command {
  constructor() {
    super(
      'send_quick_replies',
      'Envía un mensaje con botones de respuesta rápida al cliente para guiar la conversación. Úsalo cuando necesites que el cliente elija entre opciones concretas.'
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
            message: {
              type: 'string',
              description: 'El mensaje de texto que acompaña los botones'
            },
            options: {
              type: 'array',
              description: 'Lista de opciones para los botones (máx. 13)',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Texto visible del botón (máx 20 chars)' },
                  payload: { type: 'string', description: 'Identificador interno del botón' }
                },
                required: ['title']
              }
            }
          },
          required: ['message', 'options']
        }
      }
    };
  }

  async execute(params, context) {
    const { meta, senderId } = context;
    const { message, options } = params;

    try {
      const quickReplies = (options || []).slice(0, 13).map(opt => ({
        content_type: 'text',
        title: (opt.title || '').substring(0, 20),
        payload: opt.payload || opt.title
      }));

      await meta.sendQuickReplies(senderId, message, quickReplies);
      return { success: true, message: `Quick Replies enviados con ${quickReplies.length} opciones` };

    } catch (err) {
      console.error('[SendQuickReplies] Error:', err.message);
      return { success: false, message: err.message };
    }
  }
}

module.exports = SendQuickRepliesCommand;
