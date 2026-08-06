/**
 * InstructionOverridesController
 *
 * Controlador para endpoints de instrucciones dinámicas.
 * Implementa Clean Architecture: Lógica de negocio separada de HTTP.
 *
 * Use Cases:
 * - GET /api/ai/instructions/:stage → Obtener instrucción
 * - POST /api/ai/instructions/:stage → Guardar instrucción
 * - GET /api/ai/instructions/stats → Ver estadísticas de cache
 * - DELETE /api/ai/instructions/cache → Invalidar cache
 */
class InstructionOverridesController {
  /**
   * @param {InstructionOverridesGateway} instructionOverridesGateway
   * @param {InstructionService|Function|null} instructionService - Instancia, o una
   *   función que la resuelva (p.ej. el getInstance() del singleton). Pasar la
   *   función evita crear una segunda instancia: si el CRM invalidara el cache de
   *   una instancia distinta a la que usa el agente, el cambio no surtiría efecto.
   */
  constructor(instructionOverridesGateway, instructionService = null) {
    if (!instructionOverridesGateway) {
      throw new Error('InstructionOverridesGateway is required');
    }
    this.gateway = instructionOverridesGateway;
    this.instructionService = instructionService;
  }

  /** Resuelve el servicio, acepte instancia o proveedor. */
  async _getService() {
    if (!this.instructionService) return null;
    if (typeof this.instructionService === 'function') {
      try {
        return await this.instructionService();
      } catch (err) {
        console.error('[InstructionOverridesController] No se pudo resolver InstructionService:', err.message);
        return null;
      }
    }
    return this.instructionService;
  }

  /**
   * GET /api/ai/instructions/:stage
   * Retorna la instrucción override para una etapa, o null si no existe.
   */
  async getInstruction(req, res) {
    try {
      const { stage } = req.params;
      if (!stage || typeof stage !== 'string') {
        return res.status(400).json({ error: 'Stage parameter is required' });
      }

      const instruction = await this.gateway.getInstructionOverride(stage);

      res.json({
        success: true,
        stage: stage.toUpperCase(),
        instruction: instruction || null
      });
    } catch (error) {
      console.error('[InstructionOverridesController.getInstruction]', error.message);
      res.status(500).json({ error: 'Failed to retrieve instruction' });
    }
  }

  /**
   * POST /api/ai/instructions/:stage
   * Guarda una instrucción override para una etapa.
   * Body: { instruction_text: "..." }
   */
  async saveInstruction(req, res) {
    try {
      const { stage } = req.params;
      const { instruction_text } = req.body;

      // Validaciones
      if (!stage || typeof stage !== 'string') {
        return res.status(400).json({ error: 'Stage parameter is required' });
      }

      if (!instruction_text || typeof instruction_text !== 'string') {
        return res.status(400).json({ error: 'instruction_text is required' });
      }

      const trimmed = instruction_text.trim();
      if (trimmed.length < 50) {
        return res.status(400).json({
          error: 'Instruction must be at least 50 characters',
          current_length: trimmed.length
        });
      }

      if (trimmed.length > 5000) {
        return res.status(400).json({
          error: 'Instruction must not exceed 5000 characters',
          current_length: trimmed.length
        });
      }

      // Guardar
      const success = await this.gateway.saveInstructionOverride(stage, trimmed);

      if (!success) {
        return res.status(500).json({ error: 'Failed to save instruction' });
      }

      // Sin esto el agente seguiría sirviendo la versión anterior hasta que
      // expire el TTL (300s). Con esto el cambio aplica en el siguiente mensaje.
      let applied = false;
      try {
        const svc = await this._getService();
        if (svc) {
          svc.invalidateCache(stage);
          applied = true;
        }
      } catch (err) {
        console.error('[InstructionOverridesController] Cache invalidation failed:', err.message);
      }

      res.json({
        success: true,
        stage: stage.toUpperCase(),
        message: applied
          ? 'Instrucción guardada y activa de inmediato.'
          : 'Instrucción guardada. Puede tardar hasta 5 minutos en aplicarse.',
        character_count: trimmed.length
      });
    } catch (error) {
      console.error('[InstructionOverridesController.saveInstruction]', error.message);
      res.status(500).json({ error: error.message || 'Failed to save instruction' });
    }
  }

  /**
   * GET /api/ai/instructions (sin parámetro)
   * Retorna TODAS las instrucciones override.
   */
  async getAllInstructions(req, res) {
    try {
      const allInstructions = await this.gateway.getAllInstructionOverrides();

      res.json({
        success: true,
        instructions: allInstructions
      });
    } catch (error) {
      console.error('[InstructionOverridesController.getAllInstructions]', error.message);
      res.status(500).json({ error: 'Failed to retrieve instructions' });
    }
  }

  /**
   * GET /api/ai/instructions/stats
   * Retorna estadísticas del cache de InstructionService.
   */
  async getCacheStats(req, res) {
    try {
      const svc = await this._getService();
      if (!svc) {
        return res.status(503).json({
          error: 'InstructionService not available',
          stats: null
        });
      }

      const stats = svc.getStats();

      res.json({
        success: true,
        stats: {
          cacheHits: stats.cacheHits || 0,
          cacheMisses: stats.cacheMisses || 0,
          errors: stats.errors || 0,
          cacheSize: stats.cacheSize || 0,
          hitRate: stats.hitRate || 0,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[InstructionOverridesController.getCacheStats]', error.message);
      res.status(500).json({ error: 'Failed to retrieve cache stats' });
    }
  }

  /**
   * POST /api/ai/instructions/cache/invalidate
   * Invalida el cache de instrucciones.
   */
  async invalidateCache(req, res) {
    try {
      const svc = await this._getService();
      if (!svc) {
        return res.status(503).json({
          error: 'InstructionService not available'
        });
      }

      // invalidateCache(stage) ignora la llamada si no recibe etapa;
      // para vaciar todo el cache hay que usar invalidateAllCache().
      svc.invalidateAllCache();

      res.json({
        success: true,
        message: 'Cache invalidated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[InstructionOverridesController.invalidateCache]', error.message);
      res.status(500).json({ error: 'Failed to invalidate cache' });
    }
  }
}

module.exports = InstructionOverridesController;
