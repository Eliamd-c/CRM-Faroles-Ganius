// ==========================================
// CommandRegistry - Registro Centralizado
// ==========================================
// Actúa como un "catálogo" de todas las herramientas disponibles.
// LangGraph consulta este registro para saber qué herramientas
// puede ofrecer al LLM en cada invocación.

const SendProductCatalogCommand = require('./SendProductCatalogCommand');
const SaveCustomerDataCommand = require('./SaveCustomerDataCommand');
const SendQuickRepliesCommand = require('./SendQuickRepliesCommand');
const TriggerStaticFlowCommand = require('./TriggerStaticFlowCommand');

class CommandRegistry {
  constructor() {
    this.commands = new Map();
  }

  /**
   * Registra un comando en el catálogo.
   * @param {Command} command - Instancia de un comando.
   */
  register(command) {
    this.commands.set(command.name, command);
  }

  /**
   * Obtiene un comando por nombre.
   * @param {string} name
   * @returns {Command|null}
   */
  get(name) {
    return this.commands.get(name) || null;
  }

  /**
   * Retorna los schemas de TODAS las herramientas registradas.
   * Se inyecta como `tools` en la llamada al LLM (OpenAI Function Calling).
   * @returns {Array} Lista de tool schemas.
   */
  getAllToolSchemas() {
    return Array.from(this.commands.values()).map(cmd => cmd.getToolSchema());
  }

  /**
   * Ejecuta un comando por nombre.
   * @param {string} name - Nombre del comando.
   * @param {Object} params - Parámetros del LLM.
   * @param {Object} context - { senderId, customer, meta, supabase }
   * @returns {Object} Resultado de la ejecución.
   */
  async execute(name, params, context) {
    const command = this.get(name);
    if (!command) {
      console.warn(`[CommandRegistry] ⚠️ Comando desconocido: "${name}"`);
      return { success: false, message: `Herramienta "${name}" no encontrada` };
    }
    console.log(`[CommandRegistry] 🔧 Ejecutando: ${name}`);
    return command.execute(params, context);
  }
}

// Crear e inicializar el registro global (Singleton)
const registry = new CommandRegistry();
registry.register(new SendProductCatalogCommand());
registry.register(new SaveCustomerDataCommand());
registry.register(new SendQuickRepliesCommand());
registry.register(new TriggerStaticFlowCommand());

module.exports = registry;
