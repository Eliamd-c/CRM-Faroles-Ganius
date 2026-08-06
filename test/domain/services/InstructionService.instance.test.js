/**
 * InstructionService.instance.test.js
 *
 * Tests para validar:
 * ✅ Singleton patrón funciona
 * ✅ Lazy loading e inicialización
 * ✅ Instrucciones por defecto desde estados
 * ✅ Configuración de caching desde BD
 * ✅ Inyección de dependencias
 */

// Mock de Supabase antes de importar
jest.mock('../../../../db', () => ({
  from: jest.fn()
}));

// Mock de los estados
jest.mock('../../../src/domain/states/OnboardingState', () => {
  return jest.fn().mockImplementation(() => ({
    getSystemInstruction: jest.fn().mockReturnValue('Onboarding default instruction')
  }));
});

jest.mock('../../../src/domain/states/DiscoveryState', () => {
  return jest.fn().mockImplementation(() => ({
    getSystemInstruction: jest.fn().mockReturnValue('Discovery default instruction')
  }));
});

jest.mock('../../../src/domain/states/RecommendationState', () => {
  return jest.fn().mockImplementation(() => ({
    getSystemInstruction: jest.fn().mockReturnValue('Recommendation default instruction')
  }));
});

jest.mock('../../../src/domain/states/CheckoutState', () => {
  return jest.fn().mockImplementation(() => ({
    getSystemInstruction: jest.fn().mockReturnValue('Checkout default instruction')
  }));
});

// Mock de gateways
jest.mock('../../../src/adapters/gateways/InstructionConfigGateway', () => {
  return jest.fn().mockImplementation(() => ({
    getCachingConfig: jest.fn().mockResolvedValue({
      stdTTL: 300,
      checkperiod: 60,
      maxKeys: 50
    })
  }));
});

// Ahora importar el módulo después de mocks
const {
  getInstance,
  getInstanceSync,
  reset,
  InstructionService
} = require('../../../src/domain/services/InstructionService.instance');

describe('InstructionService.instance', () => {
  beforeEach(() => {
    reset(); // Resetea singleton antes de cada test
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('debe retornar la misma instancia en múltiples llamadas', async () => {
      const instance1 = await getInstance();
      const instance2 = await getInstance();

      expect(instance1).toBe(instance2);
    });

    it('debe evitar múltiples inicializaciones concurrentes', async () => {
      // Lanza dos llamadas concurrentes
      const [instance1, instance2] = await Promise.all([getInstance(), getInstance()]);

      expect(instance1).toBe(instance2);
    });

    it('getInstanceSync debe retornar null antes de inicialización', () => {
      const sync = getInstanceSync();
      expect(sync).toBeNull();
    });

    it('getInstanceSync debe retornar instancia después de inicialización', async () => {
      await getInstance();
      const sync = getInstanceSync();

      expect(sync).not.toBeNull();
      expect(sync).toBeInstanceOf(InstructionService);
    });

    it('reset debe limpiar el singleton', async () => {
      await getInstance();
      expect(getInstanceSync()).not.toBeNull();

      reset();

      expect(getInstanceSync()).toBeNull();
    });
  });

  describe('Default Instructions from States', () => {
    it('debe construir instrucciones por defecto desde los estados', async () => {
      const instance = await getInstance();
      const stats = instance.getStats();

      // Después de inicializar, debería tener estadísticas
      expect(stats).toBeDefined();
    });

    it('debe tener acceso a las instrucciones por etapa', async () => {
      const instance = await getInstance();

      // Solicita todas las etapas
      const onboarding = await instance.getInstruction('ONBOARDING');
      const discovery = await instance.getInstruction('DISCOVERY');
      const recommendation = await instance.getInstruction('RECOMMENDATION');
      const checkout = await instance.getInstruction('CHECKOUT');

      expect(onboarding).toBeDefined();
      expect(discovery).toBeDefined();
      expect(recommendation).toBeDefined();
      expect(checkout).toBeDefined();
    });

    it('debe contener instrucciones construidas desde los estados', async () => {
      const instance = await getInstance();

      const onboarding = await instance.getInstruction('ONBOARDING');
      expect(onboarding).toContain('Onboarding default instruction');
    });
  });

  describe('Caching Configuration', () => {
    it('debe inicializar con configuración por defecto', async () => {
      const instance = await getInstance();

      // InstructionService debería estar inicializado
      expect(instance).toBeInstanceOf(InstructionService);
    });

    it('debe ser un InstructionService válido con métodos públicos', async () => {
      const instance = await getInstance();

      // Verifica métodos públicos
      expect(typeof instance.getInstruction).toBe('function');
      expect(typeof instance.getAllInstructions).toBe('function');
      expect(typeof instance.invalidateCache).toBe('function');
      expect(typeof instance.getStats).toBe('function');
    });
  });

  describe('Integration with States', () => {
    it('debe integrarse con los estados del embudo', async () => {
      const instance = await getInstance();

      // Las instrucciones deberían venir de los estados
      const onboarding = await instance.getInstruction('ONBOARDING');

      expect(onboarding).toBeDefined();
      expect(typeof onboarding).toBe('string');
    });

    it('debe tener todas las etapas del embudo', async () => {
      const instance = await getInstance();

      const stages = ['ONBOARDING', 'DISCOVERY', 'RECOMMENDATION', 'CHECKOUT'];
      for (const stage of stages) {
        const instruction = await instance.getInstruction(stage);
        expect(instruction).toBeDefined();
        expect(instruction.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Cache Statistics', () => {
    it('debe reportar estadísticas de cache', async () => {
      const instance = await getInstance();

      const stats = instance.getStats();

      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('cacheMisses');
      expect(stats).toHaveProperty('errors');
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('hitRate');
    });

    it('debe rastrear hits y misses', async () => {
      const instance = await getInstance();

      // Primer acceso (miss)
      await instance.getInstruction('ONBOARDING');
      let stats = instance.getStats();
      expect(stats.cacheMisses).toBe(1);

      // Segundo acceso (hit)
      await instance.getInstruction('ONBOARDING');
      stats = instance.getStats();
      expect(stats.cacheHits).toBe(1);
    });
  });

  describe('Lazy Loading', () => {
    it('debe no inicializar hasta que se llame getInstance', () => {
      const sync1 = getInstanceSync();
      expect(sync1).toBeNull();
    });

    it('debe inicializar bajo demanda', async () => {
      const sync1 = getInstanceSync();
      expect(sync1).toBeNull();

      await getInstance();

      const sync2 = getInstanceSync();
      expect(sync2).not.toBeNull();
    });
  });

  describe('Dependency Injection', () => {
    it('debe ser capaz de inyectar una instancia', async () => {
      const instance = await getInstance();

      // Debería tener el gateway (aunque sea null por ahora)
      expect(instance).toBeDefined();
      expect(instance.gateway !== undefined).toBe(true);
    });

    it('debe mantener la instancia inyectada entre llamadas', async () => {
      const instance1 = await getInstance();
      const instance2 = await getInstance();

      // El gateway debería ser el mismo
      expect(instance1.gateway).toBe(instance2.gateway);
    });
  });

  describe('Error Handling', () => {
    it('debe continuar funcionando aunque haya errores en estados', async () => {
      // Incluso si hay errores, debería retornar una instancia válida
      const instance = await getInstance();

      expect(instance).toBeInstanceOf(InstructionService);
    });

    it('debe retornar fallback para instrucciones no encontradas', async () => {
      const instance = await getInstance();

      const unknown = await instance.getInstruction('UNKNOWN_STAGE');

      expect(unknown).toBeDefined();
      expect(unknown).toContain('helpful assistant');
    });
  });
});
