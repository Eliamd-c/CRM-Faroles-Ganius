const Command = require('./Command');

// ==========================================
// SaveCustomerDataCommand
// ==========================================
// Guarda información recopilada del cliente en la base de datos.
// El LLM invoca este comando cuando detecta que el cliente
// ha compartido datos relevantes (nombre, ubicación, presupuesto, etc.)

class SaveCustomerDataCommand extends Command {
  constructor() {
    super(
      'save_customer_data',
      'Guarda datos relevantes del cliente recopilados en la conversación (nombre, ubicación, presupuesto, cantidad de faroles, etc.) en la base de datos para personalizar futuras interacciones.'
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
            field_name: {
              type: 'string',
              description: 'Nombre del campo a guardar (ej. "presupuesto", "ubicacion", "cantidad_faroles", "espacio_a_iluminar")'
            },
            field_value: {
              type: 'string',
              description: 'Valor del campo (ej. "200000 COP", "Bogotá", "3", "jardín trasero")'
            }
          },
          required: ['field_name', 'field_value']
        }
      }
    };
  }

  async execute(params, context) {
    const { supabase, senderId } = context;
    const { field_name, field_value } = params;

    try {
      // Obtener campos actuales del cliente
      const { data: customer } = await supabase
        .from('customers')
        .select('fields')
        .eq('instagram_id', senderId)
        .single();

      const currentFields = customer?.fields || {};
      currentFields[field_name] = field_value;

      // Actualizar en la BD
      await supabase
        .from('customers')
        .update({ fields: currentFields, updated_at: new Date().toISOString() })
        .eq('instagram_id', senderId);

      console.log(`[SaveCustomerData] ✅ Guardado: ${field_name} = "${field_value}" para ${senderId}`);
      return { success: true, message: `Dato "${field_name}" guardado exitosamente` };

    } catch (err) {
      console.error('[SaveCustomerData] Error:', err.message);
      return { success: false, message: err.message };
    }
  }
}

module.exports = SaveCustomerDataCommand;
