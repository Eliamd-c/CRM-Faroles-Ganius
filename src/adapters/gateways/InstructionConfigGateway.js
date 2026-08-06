/**
 * InstructionConfigGateway
 *
 * Adapter para persistencia de configuración de instrucciones en BD.
 * Implementa Clean Architecture: Inyectable, testeable, sin coupling a Express.
 *
 * Responsabilidades:
 * 1. Acceder a app_config para leer/escribir configuraciones del sistema
 * 2. Acceder a instruction_overrides para obtener instrucciones por defecto
 * 3. Proporcionar métodos para obtener configuración de caching (TTL, maxKeys, etc.)
 * 4. Cachear configuraciones para evitar accesos frecuentes a BD
 *
 * Patrón: Repository Gateway (GoF)
 * - getCachingConfig() → { stdTTL, maxKeys, checkperiod, enabled }
 * - getDefaultInstructions() → { ONBOARDING: '...', DISCOVERY: '...', ... }
 * - getConfigValue(key) → value o null
 * - setConfigValue(key, value) → boolean
 * - getFullConfig() → objeto con toda la configuración
 */

class InstructionConfigGateway {
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error('Supabase client is required');
    }
    this.supabase = supabaseClient;

    // Cache local de configuración (simple, sin expiración)
    this.configCache = null;
    this.cacheTimestamp = null;
    this.CACHE_DURATION = 60000; // 1 minuto en ms
  }

  /**
   * Obtiene la configuración de caching
   *
   * @returns {Promise<Object>} { stdTTL, maxKeys, checkperiod, enabled }
   */
  async getCachingConfig() {
    try {
      const config = await this._getFullConfig();

      return {
        stdTTL: parseInt(config.instruction_cache_ttl || '300', 10),
        maxKeys: parseInt(config.instruction_cache_maxkeys || '50', 10),
        checkperiod: parseInt(config.instruction_cache_checkperiod || '60', 10),
        enabled: config.instruction_cache_enabled !== 'false'
      };
    } catch (err) {
      console.error('[InstructionConfigGateway] Error obteniendo caching config:', err.message);
      // Retorna defaults seguros si hay error
      return {
        stdTTL: 300,
        maxKeys: 50,
        checkperiod: 60,
        enabled: true
      };
    }
  }

  /**
   * Obtiene las instrucciones por defecto desde instruction_overrides
   *
   * @returns {Promise<Object>} { ONBOARDING: '...', DISCOVERY: '...', ... }
   */
  async getDefaultInstructions() {
    try {
      const { data, error } = await this.supabase
        .from('instruction_overrides')
        .select('stage_name, instruction_text');

      if (error) {
        console.error('[InstructionConfigGateway] Error fetching defaults:', error.message);
        return {};
      }

      const result = {};
      if (data && Array.isArray(data)) {
        for (const row of data) {
          result[row.stage_name] = row.instruction_text;
        }
      }

      return result;
    } catch (err) {
      console.error('[InstructionConfigGateway] Unexpected error in getDefaultInstructions:', err.message);
      return {};
    }
  }

  /**
   * Obtiene un valor específico de configuración
   *
   * @param {string} key - Clave de configuración
   * @returns {Promise<string|null>} Valor o null si no existe
   */
  async getConfigValue(key) {
    if (!key || typeof key !== 'string') {
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('app_config')
        .select('value')
        .eq('key', key)
        .maybeSingle();

      if (error) {
        console.error(`[InstructionConfigGateway] Error fetching ${key}:`, error.message);
        return null;
      }

      return data ? data.value : null;
    } catch (err) {
      console.error(`[InstructionConfigGateway] Unexpected error:`, err.message);
      return null;
    }
  }

  /**
   * Establece un valor de configuración
   *
   * @param {string} key - Clave de configuración
   * @param {string} value - Valor a guardar
   * @returns {Promise<boolean>} True si se guardó correctamente
   */
  async setConfigValue(key, value) {
    if (!key || typeof key !== 'string' || value === null || value === undefined) {
      throw new Error('key and value are required');
    }

    try {
      const { error } = await this.supabase
        .from('app_config')
        .upsert({
          key: key,
          value: String(value),
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      if (error) {
        console.error(`[InstructionConfigGateway] Error saving ${key}:`, error.message);
        return false;
      }

      // Invalida el cache local
      this.configCache = null;
      this.cacheTimestamp = null;

      return true;
    } catch (err) {
      console.error('[InstructionConfigGateway] Unexpected error:', err.message);
      return false;
    }
  }

  /**
   * Obtiene la configuración completa del sistema de instrucciones
   * Incluye: configuración de caching, instrucciones por defecto, etc.
   *
   * @returns {Promise<Object>} Configuración completa
   */
  async getFullConfig() {
    return this._getFullConfig(false); // Force refresh
  }

  /**
   * Obtiene la configuración completa (con caché local)
   *
   * @private
   * @param {boolean} useCache - Si usar cache local
   * @returns {Promise<Object>} Configuración completa
   */
  async _getFullConfig(useCache = true) {
    // Verifica cache local
    if (useCache && this.configCache && this.cacheTimestamp) {
      const now = Date.now();
      if (now - this.cacheTimestamp < this.CACHE_DURATION) {
        console.debug('[InstructionConfigGateway] Usando config cache local');
        return this.configCache;
      }
    }

    try {
      const { data, error } = await this.supabase
        .from('app_config')
        .select('key, value');

      if (error) {
        console.error('[InstructionConfigGateway] Error fetching full config:', error.message);
        return {};
      }

      const config = {};
      if (data && Array.isArray(data)) {
        for (const row of data) {
          config[row.key] = row.value;
        }
      }

      // Cachea localmente
      this.configCache = config;
      this.cacheTimestamp = Date.now();

      return config;
    } catch (err) {
      console.error('[InstructionConfigGateway] Unexpected error:', err.message);
      return {};
    }
  }

  /**
   * Invalida el cache local de configuración
   */
  invalidateCache() {
    this.configCache = null;
    this.cacheTimestamp = null;
    console.debug('[InstructionConfigGateway] Local config cache invalidated');
  }

  /**
   * Comprueba si el caching de instrucciones está habilitado
   *
   * @returns {Promise<boolean>}
   */
  async isCachingEnabled() {
    try {
      const enabled = await this.getConfigValue('instruction_cache_enabled');
      return enabled !== 'false';
    } catch (err) {
      console.error('[InstructionConfigGateway] Error checking if caching is enabled:', err.message);
      return true; // Default: enabled
    }
  }
}

module.exports = InstructionConfigGateway;
