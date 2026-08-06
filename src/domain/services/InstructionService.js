/**
 * InstructionService
 *
 * Servicio de dominio que centraliza la obtención de instrucciones del agente.
 * Implementa caching (NodeCache) y Strategy Pattern para múltiples fuentes.
 *
 * Patrones aplicados:
 * - Strategy Pattern: diferentes estrategias para obtener instrucciones
 * - Dependency Injection: gateway inyectable para BD
 * - Cache Pattern: NodeCache para reducir latencia (100ms → 2ms)
 * - Null Object Pattern: fallback a instrucción por defecto
 *
 * TTL: 5 minutos (300 segundos)
 * MaxKeys: 50
 * Performance goal: 100ms (BD) → 2ms (cached)
 */

const NodeCache = require('node-cache');

/**
 * Estrategia base para obtención de instrucciones
 * Patrón: Template Method + Strategy
 */
class InstructionStrategy {
  async fetch(stageName) {
    throw new Error('fetch() debe ser implementado por la estrategia');
  }
}

/**
 * Estrategia 1: Obtener instrucciones override de BD
 */
class OverrideInstructionStrategy extends InstructionStrategy {
  constructor(instructionOverridesGateway) {
    super();
    this.gateway = instructionOverridesGateway;
  }

  async fetch(stageName) {
    if (!this.gateway) return null;
    try {
      const instruction = await this.gateway.getInstructionOverride(stageName);
      if (instruction) {
        console.debug(`[InstructionService] Override encontrado para ${stageName}`);
      }
      return instruction;
    } catch (err) {
      console.error(`[InstructionService] Error obteniendo override para ${stageName}:`, err.message);
      return null;
    }
  }
}

/**
 * Estrategia 2: Instrucciones por defecto hardcodeadas
 */
class DefaultInstructionStrategy extends InstructionStrategy {
  constructor(defaultInstructions = {}) {
    super();
    this.defaults = defaultInstructions;
  }

  async fetch(stageName) {
    const instruction = this.defaults[stageName] || null;
    if (instruction) {
      console.debug(`[InstructionService] Default encontrado para ${stageName}`);
    }
    return instruction;
  }
}

/**
 * Estrategia 3: Instrucciones desde archivo/config estático
 */
class ConfigFileInstructionStrategy extends InstructionStrategy {
  constructor(configFile = {}) {
    super();
    this.config = configFile;
  }

  async fetch(stageName) {
    const instruction = this.config[stageName] || null;
    if (instruction) {
      console.debug(`[InstructionService] Config encontrado para ${stageName}`);
    }
    return instruction;
  }
}

/**
 * Servicio de Instrucciones
 *
 * Orquesta múltiples estrategias y caching.
 * Encadena: Override → Default → Fallback
 */
class InstructionService {
  /**
   * @param {InstructionOverridesGateway} instructionOverridesGateway - Gateway a BD
   * @param {Object} defaultInstructions - Instrucciones por defecto
   * @param {Object} config - Config con TTL y maxKeys
   */
  constructor(instructionOverridesGateway, defaultInstructions = {}, config = {}) {
    this.gateway = instructionOverridesGateway;
    this.defaultInstructions = defaultInstructions;

    // Configuración de cache
    const { stdTTL = 300, checkperiod = 60, maxKeys = 50 } = config;
    this.cache = new NodeCache({ stdTTL, checkperiod, maxKeys });

    // Estrategias en orden de prioridad
    this.strategies = [
      new OverrideInstructionStrategy(this.gateway),
      new DefaultInstructionStrategy(defaultInstructions)
    ];

    // Estadísticas
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0
    };
  }

  /**
   * Obtiene la instrucción para una etapa.
   * Primero intenta cache, luego encadena estrategias.
   *
   * @param {string} stageName - Nombre de la etapa (ONBOARDING, DISCOVERY, etc.)
   * @returns {Promise<string>} Instrucción o fallback
   */
  async getInstruction(stageName) {
    if (!stageName || typeof stageName !== 'string') {
      this.stats.errors++;
      return this._getFallback();
    }

    const cacheKey = `instruction:${stageName.toUpperCase()}`;

    // Intenta obtener del cache
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      this.stats.cacheHits++;
      console.debug(`[InstructionService] CACHE HIT: ${stageName}`);
      return cached;
    }

    this.stats.cacheMisses++;
    console.debug(`[InstructionService] CACHE MISS: ${stageName}`);

    // Encadena estrategias: primera que devuelva un valor gana
    let instruction = null;
    for (const strategy of this.strategies) {
      try {
        instruction = await strategy.fetch(stageName);
        if (instruction) {
          break; // Encontró, detén la cadena
        }
      } catch (err) {
        console.error(`[InstructionService] Error en estrategia:`, err.message);
        this.stats.errors++;
      }
    }

    // Si no encontró nada, usa fallback
    if (!instruction) {
      console.warn(`[InstructionService] No instruction found for ${stageName}, using fallback`);
      instruction = this._getFallback(stageName);
    }

    // Cachea el resultado (incluso si es fallback)
    this.cache.set(cacheKey, instruction);

    return instruction;
  }

  /**
   * Obtiene todas las instrucciones (sin cache por ahora)
   *
   * @returns {Promise<Object>} { ONBOARDING: '...', DISCOVERY: '...', ... }
   */
  async getAllInstructions() {
    if (!this.gateway) return this.defaultInstructions;

    try {
      const all = await this.gateway.getAllInstructionOverrides();
      // Mezcla overrides con defaults (defaults como fallback)
      const merged = { ...this.defaultInstructions, ...all };

      // Cachea cada uno individualmente
      Object.entries(merged).forEach(([stageName, instruction]) => {
        const cacheKey = `instruction:${stageName.toUpperCase()}`;
        this.cache.set(cacheKey, instruction);
      });

      return merged;
    } catch (err) {
      console.error('[InstructionService] Error en getAllInstructions:', err.message);
      this.stats.errors++;
      return this.defaultInstructions;
    }
  }

  /**
   * Invalida el cache para una etapa específica
   *
   * @param {string} stageName - Nombre de la etapa a invalidar
   */
  invalidateCache(stageName) {
    if (!stageName) return;
    const cacheKey = `instruction:${stageName.toUpperCase()}`;
    this.cache.del(cacheKey);
    console.debug(`[InstructionService] Cache invalidated for ${stageName}`);
  }

  /**
   * Invalida TODO el cache
   */
  invalidateAllCache() {
    this.cache.flushAll();
    console.debug('[InstructionService] All cache cleared');
  }

  /**
   * Obtiene estadísticas del cache
   *
   * @returns {Object} { cacheHits, cacheMisses, errors, cacheSize, keys }
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.getStats().ksize,
      totalRequests: this.stats.cacheHits + this.stats.cacheMisses,
      hitRate: this.stats.cacheHits + this.stats.cacheMisses > 0
        ? ((this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100).toFixed(2) + '%'
        : 'N/A'
    };
  }

  /**
   * Instrucción de fallback
   * Se usa cuando no hay override ni default
   *
   * @private
   * @param {string} stageName - Nombre de la etapa
   * @returns {string} Instrucción genérica
   */
  _getFallback(stageName = 'UNKNOWN') {
    return `You are a helpful assistant. You are in the ${stageName} stage. Guide the user through this conversation.`;
  }

  /**
   * Añade una estrategia personalizada
   *
   * @param {InstructionStrategy} strategy - Nueva estrategia
   */
  addStrategy(strategy) {
    if (!strategy || typeof strategy.fetch !== 'function') {
      throw new Error('Strategy must have a fetch() method');
    }
    this.strategies.push(strategy);
  }
}

module.exports = {
  InstructionService,
  InstructionStrategy,
  OverrideInstructionStrategy,
  DefaultInstructionStrategy,
  ConfigFileInstructionStrategy
};
