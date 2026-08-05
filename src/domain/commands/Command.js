// ==========================================
// Command.js - Clase Base (Command Pattern)
// Node.js Design Patterns - Cap. 9
// ==========================================
// Cada herramienta del agente implementa esta interfaz.
// El agente IA "selecciona" el comando, y el sistema lo ejecuta.
// Esto desacopla la IA de las integraciones externas (Meta, Supabase, etc.)

class Command {
  constructor(name, description) {
    this.name = name;
    this.description = description;
  }

  /**
   * Retorna el schema de la herramienta para que el LLM sepa cómo invocarla.
   * Compatible con el formato OpenAI Function Calling.
   * @returns {Object} { name, description, parameters }
   */
  getToolSchema() {
    throw new Error(`[Command] getToolSchema() no implementado en "${this.name}"`);
  }

  /**
   * Ejecuta la acción concreta de la herramienta.
   * @param {Object} params - Los parámetros que el LLM decidió pasar.
   * @param {Object} context - { senderId, customer, meta, supabase }
   * @returns {Object} { success, message }
   */
  async execute(params, context) {
    throw new Error(`[Command] execute() no implementado en "${this.name}"`);
  }
}

module.exports = Command;
