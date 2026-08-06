/**
 * InstructionConfigGateway.test.js
 *
 * Suite de tests para validar:
 * ✅ Acceso a app_config
 * ✅ Acceso a instruction_overrides
 * ✅ Cache local de configuración
 * ✅ Manejo de errores
 */

const InstructionConfigGateway = require('../../../src/adapters/gateways/InstructionConfigGateway');

describe('InstructionConfigGateway', () => {
  let gateway;
  let mockSupabaseClient;

  beforeEach(() => {
    mockSupabaseClient = {
      from: jest.fn()
    };
  });

  describe('Constructor', () => {
    it('debe requerir un cliente Supabase', () => {
      expect(() => new InstructionConfigGateway(null)).toThrow('Supabase client is required');
    });

    it('debe inicializarse correctamente con cliente Supabase', () => {
      gateway = new InstructionConfigGateway(mockSupabaseClient);
      expect(gateway.supabase).toBe(mockSupabaseClient);
    });
  });

  describe('getCachingConfig', () => {
    it('debe retornar configuración de caching desde app_config', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          data: [
            { key: 'instruction_cache_ttl', value: '300' },
            { key: 'instruction_cache_maxkeys', value: '50' },
            { key: 'instruction_cache_checkperiod', value: '60' }
          ],
          error: null
        })
      });

      gateway = new InstructionConfigGateway(mockSupabaseClient);
      const config = await gateway.getCachingConfig();

      expect(config.stdTTL).toBe(300);
      expect(config.maxKeys).toBe(50);
      expect(config.checkperiod).toBe(60);
      expect(config.enabled).toBe(true);
    });

    it('debe retornar valores por defecto si hay error', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          data: null,
          error: new Error('DB Error')
        })
      });

      gateway = new InstructionConfigGateway(mockSupabaseClient);
      const config = await gateway.getCachingConfig();

      expect(config.stdTTL).toBe(300);
      expect(config.maxKeys).toBe(50);
      expect(config.enabled).toBe(true);
    });

    it('debe respetar instruction_cache_enabled = false', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          data: [
            { key: 'instruction_cache_enabled', value: 'false' }
          ],
          error: null
        })
      });

      gateway = new InstructionConfigGateway(mockSupabaseClient);
      const config = await gateway.getCachingConfig();

      expect(config.enabled).toBe(false);
    });
  });

  describe('getDefaultInstructions', () => {
    it('debe obtener instrucciones por defecto desde instruction_overrides', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          data: [
            { stage_name: 'ONBOARDING', instruction_text: 'Onboarding Instruction' },
            { stage_name: 'DISCOVERY', instruction_text: 'Discovery Instruction' }
          ],
          error: null
        })
      });

      gateway = new InstructionConfigGateway(mockSupabaseClient);
      const instructions = await gateway.getDefaultInstructions();

      expect(instructions).toEqual({
        ONBOARDING: 'Onboarding Instruction',
        DISCOVERY: 'Discovery Instruction'
      });
    });

    it('debe retornar objeto vacío si hay error', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          data: null,
          error: new Error('DB Error')
        })
      });

      gateway = new InstructionConfigGateway(mockSupabaseClient);
      const instructions = await gateway.getDefaultInstructions();

      expect(instructions).toEqual({});
    });
  });

  describe('getConfigValue', () => {
    it('debe obtener un valor específico de configuración', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockReturnValue({
              data: { value: 'custom_ttl_value' },
              error: null
            })
          })
        })
      });

      gateway = new InstructionConfigGateway(mockSupabaseClient);
      const value = await gateway.getConfigValue('instruction_cache_ttl');

      expect(value).toBe('custom_ttl_value');
    });

    it('debe retornar null si la clave no existe', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockReturnValue({
              data: null,
              error: null
            })
          })
        })
      });

      gateway = new InstructionConfigGateway(mockSupabaseClient);
      const value = await gateway.getConfigValue('nonexistent_key');

      expect(value).toBeNull();
    });

    it('debe rechazar claves inválidas', async () => {
      gateway = new InstructionConfigGateway(mockSupabaseClient);

      const result1 = await gateway.getConfigValue(null);
      const result2 = await gateway.getConfigValue(undefined);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe('setConfigValue', () => {
    it('debe guardar un valor de configuración', async () => {
      const mockUpsert = jest.fn().mockReturnValue({ error: null });
      mockSupabaseClient.from.mockReturnValue({
        upsert: mockUpsert
      });

      gateway = new InstructionConfigGateway(mockSupabaseClient);
      const result = await gateway.setConfigValue('instruction_cache_ttl', '600');

      expect(result).toBe(true);
      expect(mockUpsert).toHaveBeenCalled();
    });

    it('debe convertir valor a string', async () => {
      const mockUpsert = jest.fn().mockReturnValue({ error: null });
      mockSupabaseClient.from.mockReturnValue({
        upsert: mockUpsert
      });

      gateway = new InstructionConfigGateway(mockSupabaseClient);
      await gateway.setConfigValue('instruction_cache_maxkeys', 100);

      const call = mockUpsert.mock.calls[0][0];
      expect(typeof call.value).toBe('string');
      expect(call.value).toBe('100');
    });

    it('debe invalidar cache local después de guardar', async () => {
      const mockUpsert = jest.fn().mockReturnValue({ error: null });
      mockSupabaseClient.from.mockReturnValue({
        upsert: mockUpsert
      });

      gateway = new InstructionConfigGateway(mockSupabaseClient);
      gateway.configCache = { test: 'value' };
      gateway.cacheTimestamp = Date.now();

      await gateway.setConfigValue('test_key', 'test_value');

      expect(gateway.configCache).toBeNull();
      expect(gateway.cacheTimestamp).toBeNull();
    });

    it('debe retornar false si hay error', async () => {
      mockSupabaseClient.from.mockReturnValue({
        upsert: jest.fn().mockReturnValue({ error: new Error('DB Error') })
      });

      gateway = new InstructionConfigGateway(mockSupabaseClient);
      const result = await gateway.setConfigValue('test_key', 'test_value');

      expect(result).toBe(false);
    });

    it('debe rechazar valores null o undefined', async () => {
      gateway = new InstructionConfigGateway(mockSupabaseClient);

      expect(() => gateway.setConfigValue('key', null)).toThrow();
      expect(() => gateway.setConfigValue('key', undefined)).toThrow();
    });
  });

  describe('Local Caching', () => {
    it('debe cachear configuración localmente durante 1 minuto', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        data: [{ key: 'test', value: 'value' }],
        error: null
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect
      });

      gateway = new InstructionConfigGateway(mockSupabaseClient);

      // Primera llamada
      await gateway._getFullConfig(true);
      const firstCallCount = mockSelect.mock.calls.length;

      // Segunda llamada (debería usar cache)
      await gateway._getFullConfig(true);
      const secondCallCount = mockSelect.mock.calls.length;

      expect(firstCallCount).toBe(secondCallCount); // No debe haber otra llamada
    });

    it('debe permitir forzar refresco de cache', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        data: [],
        error: null
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect
      });

      gateway = new InstructionConfigGateway(mockSupabaseClient);

      await gateway._getFullConfig(true);
      const firstCallCount = mockSelect.mock.calls.length;

      await gateway.getFullConfig(); // Force refresh
      const secondCallCount = mockSelect.mock.calls.length;

      expect(secondCallCount).toBeGreaterThan(firstCallCount);
    });

    it('debe permitir invalidar cache manualmente', async () => {
      gateway = new InstructionConfigGateway(mockSupabaseClient);
      gateway.configCache = { test: 'value' };
      gateway.cacheTimestamp = Date.now();

      gateway.invalidateCache();

      expect(gateway.configCache).toBeNull();
      expect(gateway.cacheTimestamp).toBeNull();
    });
  });

  describe('isCachingEnabled', () => {
    it('debe retornar true si caching está habilitado', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockReturnValue({
              data: { value: 'true' },
              error: null
            })
          })
        })
      });

      gateway = new InstructionConfigGateway(mockSupabaseClient);
      const enabled = await gateway.isCachingEnabled();

      expect(enabled).toBe(true);
    });

    it('debe retornar false si caching está deshabilitado', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockReturnValue({
              data: { value: 'false' },
              error: null
            })
          })
        })
      });

      gateway = new InstructionConfigGateway(mockSupabaseClient);
      const enabled = await gateway.isCachingEnabled();

      expect(enabled).toBe(false);
    });

    it('debe retornar true como default si hay error', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockReturnValue({
              data: null,
              error: new Error('DB Error')
            })
          })
        })
      });

      gateway = new InstructionConfigGateway(mockSupabaseClient);
      const enabled = await gateway.isCachingEnabled();

      expect(enabled).toBe(true);
    });
  });
});
