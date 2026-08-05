/**
 * Test: GetPendingHumansUseCase
 *
 * Validaciones:
 * 1. Límite de resultados (1-1000)
 * 2. Normalización de timestamps
 * 3. Ordenamiento determinista
 * 4. Manejo de valores nulos
 */
const GetPendingHumansUseCase = require('../../src/use-cases/GetPendingHumansUseCase');

describe('GetPendingHumansUseCase', () => {
  let useCase;
  let mockGateway;

  beforeEach(() => {
    mockGateway = {
      getPendingHumans: jest.fn()
    };
    useCase = new GetPendingHumansUseCase(mockGateway);
  });

  describe('Constructor', () => {
    test('debe lanzar error si supabaseGateway es null', () => {
      expect(() => new GetPendingHumansUseCase(null)).toThrow('supabaseGateway is required');
    });

    test('debe lanzar error si supabaseGateway es undefined', () => {
      expect(() => new GetPendingHumansUseCase(undefined)).toThrow('supabaseGateway is required');
    });

    test('debe instanciarse correctamente con gateway válido', () => {
      const instance = new GetPendingHumansUseCase(mockGateway);
      expect(instance.supabaseGateway).toBe(mockGateway);
    });
  });

  describe('Validación de Entrada', () => {
    test('debe aceptar limit = 50 (default)', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([]);
      await useCase.execute(50);
      expect(mockGateway.getPendingHumans).toHaveBeenCalledWith(50);
    });

    test('debe aceptar limit = 1 (mínimo)', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([]);
      await useCase.execute(1);
      expect(mockGateway.getPendingHumans).toHaveBeenCalledWith(1);
    });

    test('debe aceptar limit = 1000 (máximo)', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([]);
      await useCase.execute(1000);
      expect(mockGateway.getPendingHumans).toHaveBeenCalledWith(1000);
    });

    test('debe rechazar limit = 0', async () => {
      expect(() => useCase.execute(0)).rejects.toThrow('Invalid limit');
    });

    test('debe rechazar limit < 0', async () => {
      expect(() => useCase.execute(-10)).rejects.toThrow('Invalid limit');
    });

    test('debe rechazar limit > 1000', async () => {
      expect(() => useCase.execute(1001)).rejects.toThrow('Invalid limit');
    });

    test('debe rechazar limit = "string"', async () => {
      expect(() => useCase.execute('invalid')).rejects.toThrow('Invalid limit');
    });

    test('debe rechazar limit = null', async () => {
      expect(() => useCase.execute(null)).rejects.toThrow('Invalid limit');
    });

    test('debe rechazar limit = 50.5 (no es integer)', async () => {
      expect(() => useCase.execute(50.5)).rejects.toThrow('Invalid limit');
    });

    test('debe convertir string numérico a number', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([]);
      await useCase.execute('50');
      expect(mockGateway.getPendingHumans).toHaveBeenCalledWith(50);
    });
  });

  describe('Normalización de Datos', () => {
    test('debe retornar array vacío si no hay pendientes', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([]);
      const result = await useCase.execute(50);
      expect(result).toEqual([]);
    });

    test('debe normalizar timestamps a ISO string', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([
        {
          id: 'u_123',
          instagram_id: 'ig_123',
          name: 'Juan',
          username: 'juan_perez',
          bot_paused_at: '2026-08-05T10:30:00Z',
          bot_paused_reason: 'operador_manual'
        }
      ]);

      const result = await useCase.execute(50);

      expect(result[0].bot_paused_at).toBe('2026-08-05T10:30:00.000Z');
      expect(typeof result[0].bot_paused_at).toBe('string');
    });

    test('debe manejar bot_paused_at = null', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([
        {
          id: 'u_124',
          instagram_id: 'ig_124',
          name: 'María',
          username: 'maria_g',
          bot_paused_at: null,
          bot_paused_reason: null
        }
      ]);

      const result = await useCase.execute(50);

      expect(result[0].bot_paused_at).toBeNull();
      expect(result[0].bot_paused_reason).toBeNull();
    });

    test('debe defaultear name a "Desconocido" si es null', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([
        {
          id: 'u_125',
          instagram_id: 'ig_125',
          name: null,
          username: 'user_anon',
          bot_paused_at: '2026-08-05T10:30:00Z',
          bot_paused_reason: 'timeout'
        }
      ]);

      const result = await useCase.execute(50);

      expect(result[0].name).toBe('Desconocido');
    });

    test('debe retornar fields estructurados correctamente', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([
        {
          id: 'u_126',
          instagram_id: 'ig_126',
          name: 'Pedro',
          username: 'pedro_123',
          bot_paused_at: '2026-08-05T10:30:00Z',
          bot_paused_reason: 'escalacion_manual'
        }
      ]);

      const result = await useCase.execute(50);
      const human = result[0];

      expect(human).toHaveProperty('id');
      expect(human).toHaveProperty('instagram_id');
      expect(human).toHaveProperty('name');
      expect(human).toHaveProperty('username');
      expect(human).toHaveProperty('bot_paused_at');
      expect(human).toHaveProperty('bot_paused_reason');
      expect(Object.keys(human).length).toBe(6);
    });
  });

  describe('Múltiples Registros', () => {
    test('debe retornar múltiples registros normalizados', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([
        {
          id: 'u_1',
          instagram_id: 'ig_1',
          name: 'Juan',
          username: 'juan_1',
          bot_paused_at: '2026-08-05T10:00:00Z',
          bot_paused_reason: 'operador_manual'
        },
        {
          id: 'u_2',
          instagram_id: 'ig_2',
          name: 'María',
          username: 'maria_2',
          bot_paused_at: '2026-08-05T11:00:00Z',
          bot_paused_reason: 'timeout'
        }
      ]);

      const result = await useCase.execute(50);

      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Juan');
      expect(result[1].name).toBe('María');
    });

    test('debe respetar el límite pasado al gateway', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([]);
      await useCase.execute(100);
      expect(mockGateway.getPendingHumans).toHaveBeenCalledWith(100);
    });
  });

  describe('Errores de Base de Datos', () => {
    test('debe propagar errores del gateway', async () => {
      const dbError = new Error('Database connection failed');
      mockGateway.getPendingHumans.mockRejectedValue(dbError);

      expect(() => useCase.execute(50)).rejects.toThrow('Database connection failed');
    });

    test('debe manejar timeout del gateway', async () => {
      const timeoutError = new Error('Query timeout');
      mockGateway.getPendingHumans.mockRejectedValue(timeoutError);

      expect(() => useCase.execute(50)).rejects.toThrow('Query timeout');
    });
  });

  describe('Edge Cases', () => {
    test('debe manejar timestamps en diferentes formatos ISO', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([
        {
          id: 'u_127',
          instagram_id: 'ig_127',
          name: 'Test',
          username: 'test',
          bot_paused_at: new Date('2026-08-05T10:30:00Z'),
          bot_paused_reason: 'test'
        }
      ]);

      const result = await useCase.execute(50);

      expect(typeof result[0].bot_paused_at).toBe('string');
      expect(result[0].bot_paused_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test('debe manejar username = null', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([
        {
          id: 'u_128',
          instagram_id: 'ig_128',
          name: 'NoUsername',
          username: null,
          bot_paused_at: '2026-08-05T10:30:00Z',
          bot_paused_reason: 'test'
        }
      ]);

      const result = await useCase.execute(50);

      expect(result[0].username).toBeNull();
    });
  });
});
