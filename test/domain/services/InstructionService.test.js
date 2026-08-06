/**
 * InstructionService.test.js
 *
 * Suite de tests para validar:
 * ✅ Caching funciona (hits, misses)
 * ✅ Strategy Chain funciona (override → default → fallback)
 * ✅ Invalidación de cache
 * ✅ Manejo de errores
 * ✅ Estadísticas
 */

const { InstructionService, OverrideInstructionStrategy, DefaultInstructionStrategy } = require('../../../src/domain/services/InstructionService');

describe('InstructionService', () => {
  let service;
  let mockGateway;

  beforeEach(() => {
    // Mock del gateway
    mockGateway = {
      getInstructionOverride: jest.fn(),
      getAllInstructionOverrides: jest.fn()
    };
  });

  describe('Cache Behavior', () => {
    it('debe cachear instrucciones después del primer fetch', async () => {
      mockGateway.getInstructionOverride.mockResolvedValue('Override Instruction');

      service = new InstructionService(mockGateway, {}, { stdTTL: 300, maxKeys: 50 });

      const result1 = await service.getInstruction('ONBOARDING');
      const result2 = await service.getInstruction('ONBOARDING');

      expect(result1).toBe('Override Instruction');
      expect(result2).toBe('Override Instruction');
      expect(mockGateway.getInstructionOverride).toHaveBeenCalledTimes(1); // Solo 1 llamada a BD
      expect(service.getStats().cacheHits).toBe(1); // 1 cache hit
    });

    it('debe distinguir entre cache hit y miss', async () => {
      mockGateway.getInstructionOverride.mockResolvedValue('Test Instruction');
      service = new InstructionService(mockGateway, {});

      await service.getInstruction('DISCOVERY');
      await service.getInstruction('DISCOVERY');

      const stats = service.getStats();
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(1);
    });

    it('debe invalidar cache para una etapa específica', async () => {
      mockGateway.getInstructionOverride
        .mockResolvedValueOnce('First')
        .mockResolvedValueOnce('Second');

      service = new InstructionService(mockGateway, {});

      const result1 = await service.getInstruction('ONBOARDING');
      expect(result1).toBe('First');

      service.invalidateCache('ONBOARDING');

      const result2 = await service.getInstruction('ONBOARDING');
      expect(result2).toBe('Second');
      expect(mockGateway.getInstructionOverride).toHaveBeenCalledTimes(2);
    });

    it('debe limpiar TODO el cache', async () => {
      mockGateway.getInstructionOverride.mockResolvedValue('Instruction');
      service = new InstructionService(mockGateway, {});

      await service.getInstruction('ONBOARDING');
      await service.getInstruction('DISCOVERY');

      service.invalidateAllCache();

      const stats = service.getStats();
      expect(stats.cacheSize).toBe(0);
    });
  });

  describe('Strategy Chain', () => {
    it('debe priorizar Override > Default > Fallback', async () => {
      mockGateway.getInstructionOverride.mockResolvedValue('Override Text');

      const defaults = { ONBOARDING: 'Default Text' };
      service = new InstructionService(mockGateway, defaults);

      const result = await service.getInstruction('ONBOARDING');

      expect(result).toBe('Override Text');
    });

    it('debe usar Default si no hay Override', async () => {
      mockGateway.getInstructionOverride.mockResolvedValue(null);

      const defaults = { ONBOARDING: 'Default Text' };
      service = new InstructionService(mockGateway, defaults);

      const result = await service.getInstruction('ONBOARDING');

      expect(result).toBe('Default Text');
    });

    it('debe usar Fallback si no hay Override ni Default', async () => {
      mockGateway.getInstructionOverride.mockResolvedValue(null);

      service = new InstructionService(mockGateway, {});

      const result = await service.getInstruction('UNKNOWN_STAGE');

      expect(result).toContain('helpful assistant');
      expect(result).toContain('UNKNOWN_STAGE');
    });
  });

  describe('Error Handling', () => {
    it('debe retornar fallback si el gateway falla', async () => {
      mockGateway.getInstructionOverride.mockRejectedValue(new Error('DB Error'));

      service = new InstructionService(mockGateway, {});

      const result = await service.getInstruction('ONBOARDING');

      expect(result).toContain('helpful assistant');
      expect(service.getStats().errors).toBe(1);
    });

    it('debe ignorar stageName inválido', async () => {
      service = new InstructionService(mockGateway, {});

      const result1 = await service.getInstruction(null);
      const result2 = await service.getInstruction(undefined);
      const result3 = await service.getInstruction(123);

      expect(result1).toContain('helpful assistant');
      expect(result2).toContain('helpful assistant');
      expect(result3).toContain('helpful assistant');
      expect(service.getStats().errors).toBe(3);
    });
  });

  describe('getAllInstructions', () => {
    it('debe obtener todas las instrucciones y cachearlas', async () => {
      mockGateway.getAllInstructionOverrides.mockResolvedValue({
        ONBOARDING: 'Onboarding Instruction',
        DISCOVERY: 'Discovery Instruction'
      });

      const defaults = { CHECKOUT: 'Default Checkout' };
      service = new InstructionService(mockGateway, defaults);

      const all = await service.getAllInstructions();

      expect(all).toEqual({
        ONBOARDING: 'Onboarding Instruction',
        DISCOVERY: 'Discovery Instruction',
        CHECKOUT: 'Default Checkout'
      });

      // Verifica que se cachearon
      const result = await service.getInstruction('ONBOARDING');
      expect(mockGateway.getInstructionOverride).not.toHaveBeenCalled(); // No debería hacer otra llamada
    });
  });

  describe('Statistics', () => {
    it('debe reportar estadísticas correctas', async () => {
      mockGateway.getInstructionOverride.mockResolvedValue('Test');
      service = new InstructionService(mockGateway, {});

      await service.getInstruction('STAGE1'); // MISS
      await service.getInstruction('STAGE1'); // HIT
      await service.getInstruction('STAGE2'); // MISS

      const stats = service.getStats();

      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(2);
      expect(stats.totalRequests).toBe(3);
      expect(stats.hitRate).toBe('33.33%');
    });

    it('debe reportar tamaño del cache', async () => {
      mockGateway.getInstructionOverride.mockResolvedValue('Test');
      service = new InstructionService(mockGateway, {}, { maxKeys: 50 });

      await service.getInstruction('STAGE1');
      await service.getInstruction('STAGE2');

      const stats = service.getStats();

      expect(stats.cacheSize).toBe(2);
    });
  });

  describe('Custom Strategies', () => {
    it('debe permitir añadir estrategias personalizadas', async () => {
      service = new InstructionService(mockGateway, {});

      const customStrategy = {
        fetch: jest.fn().mockResolvedValue('Custom Instruction')
      };

      service.addStrategy(customStrategy);
      const result = await service.getInstruction('CUSTOM_STAGE');

      expect(result).toBe('Custom Instruction');
    });

    it('debe rechazar estrategias sin método fetch', () => {
      service = new InstructionService(mockGateway, {});

      expect(() => service.addStrategy({})).toThrow('must have a fetch() method');
    });
  });
});
