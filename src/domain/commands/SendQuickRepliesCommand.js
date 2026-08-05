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
    const { meta, senderId, supabaseGateway } = context;
    const { message, options } = params;

    try {
      const quickReplies = (options || []).slice(0, 13).map(opt => ({
        content_type: 'text',
        title: (opt.title || '').substring(0, 20),
        payload: opt.payload || opt.title
      }));

      await meta.sendQuickReplies(senderId, message, quickReplies);

      // CRITICAL FIX: Marcar estado de espera EN BD con validación correcta
      // Esto permite que webhook.handlers valide contra las opciones correctas
      if (supabaseGateway && senderId) {
        try {
          // Extraer payloads válidos para validación posterior
          const validChoices = quickReplies.map(qr => qr.payload.toLowerCase()).join(',');

          await supabaseGateway.db
            .from('customers')
            .update({
              bot_state: 'awaiting_input',              // Estado transitorio: esperando click
              awaiting_input_type: 'choice',             // Tipo: respuesta múltiple
              awaiting_input_choices: validChoices      // CRITICAL FIX: Setear opciones válidas
            })
            .eq('instagram_id', String(senderId))
            .catch(err => console.warn('⚠️ Error marcando awaiting_input:', err.message));
        } catch (err) {
          console.warn('[SendQuickReplies] ⚠️ No se pudo marcar pausa en BD:', err.message);
          // No romper el flujo si falla actualizar la BD
        }
      }

      return {
        success: true,
        message: `Quick Replies enviados con ${quickReplies.length} opciones`,
        awaiting_input: true
      };

    } catch (err) {
      console.error('[SendQuickReplies] Error:', err.message);
      throw err;
    }
  }
}

module.exports = SendQuickRepliesCommand;
