/**
 * GetPendingHumansUseCase
 *
 * Use case para recuperar clientes con bot pausado (escalados a humano).
 * Implementa Clean Architecture: lógica pura sin dependencias de Express.
 *
 * Principios aplicados:
 * - Validación de entrada (limit entre 1 y 1000)
 * - Normalización de timestamps (ISO strings para JSON)
 * - Ordenamiento determinista (bot_paused_at ascendente)
 */
class GetPendingHumansUseCase {
  constructor(supabaseGateway) {
    if (!supabaseGateway) {
      throw new Error('supabaseGateway is required');
    }
    this.supabaseGateway = supabaseGateway;
  }

  /**
   * Ejecuta la recuperación de humanos pendientes.
   *
   * @param {number} limit - Número máximo de registros a retornar (default 50)
   * @returns {Promise<Array>} Array de humanos con campos normalizados
   * @throws {Error} Si limit está fuera de rango [1, 1000]
   */
  async execute(limit = 50) {
    // ───────────────────────────────────────
    // VALIDACIÓN: limit dentro de rango seguro
    // ───────────────────────────────────────
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
      throw new Error(`Invalid limit: must be integer between 1 and 1000, got ${limit}`);
    }

    // ───────────────────────────────────────
    // RECUPERACIÓN: delegar al gateway
    // ───────────────────────────────────────
    const humans = await this.supabaseGateway.getPendingHumans(parsedLimit);

    // ───────────────────────────────────────
    // NORMALIZACIÓN: timestamps a ISO string
    // ───────────────────────────────────────
    const normalized = humans.map(human => ({
      id: human.id,
      instagram_id: human.instagram_id,
      name: human.name || 'Desconocido',
      username: human.username || null,
      bot_paused_at: human.bot_paused_at
        ? new Date(human.bot_paused_at).toISOString()
        : null,
      bot_paused_reason: human.bot_paused_reason || null
    }));

    return normalized;
  }
}

module.exports = GetPendingHumansUseCase;
