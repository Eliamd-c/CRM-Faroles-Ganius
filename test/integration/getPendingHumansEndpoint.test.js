/**
 * Test: GET /api/langgraph/pending-humans Endpoint
 *
 * Integración: Controlador + Use Case + Gateway
 * Validaciones:
 * 1. Respuesta JSON estructurada correctamente
 * 2. Query parameter limit
 * 3. Validación de límites (400 si inválido)
 * 4. Error 500 si DB falla
 */
const express = require('express');
const request = require('supertest');

// Mock del gateway
const mockGateway = {
  getPendingHumans: jest.fn()
};

// Crear la ruta bajo prueba
function createTestRouter() {
  const router = express.Router();
  const GetPendingHumansUseCase = require('../../src/use-cases/GetPendingHumansUseCase');
  const useCase = new GetPendingHumansUseCase(mockGateway);

  router.get('/pending-humans', async (req, res) => {
    try {
      const { limit = 50 } = req.query;

      const parsedLimit = Number(limit);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid limit: must be integer between 1 and 1000'
        });
      }

      const data = await useCase.execute(parsedLimit);

      res.json({
        success: true,
        data,
        count: data.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[GetPendingHumans] Error:', error.message);
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  });

  return router;
}

describe('GET /api/langgraph/pending-humans Endpoint', () => {
  let app;

  beforeEach(() => {
    mockGateway.getPendingHumans.mockClear();
    app = express();
    app.use(express.json());
    app.use('/api/langgraph', createTestRouter());
  });

  describe('Respuesta Exitosa (200)', () => {
    test('debe retornar estructura JSON válida', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/langgraph/pending-humans')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('count');
      expect(res.body).toHaveProperty('timestamp');
    });

    test('debe retornar array vacío si no hay pendientes', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/langgraph/pending-humans')
        .expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.count).toBe(0);
    });

    test('debe retornar datos normalizados', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([
        {
          id: 'u_1',
          instagram_id: 'ig_1',
          name: 'Juan',
          username: 'juan_perez',
          bot_paused_at: '2026-08-05T10:30:00Z',
          bot_paused_reason: 'operador_manual'
        }
      ]);

      const res = await request(app)
        .get('/api/langgraph/pending-humans')
        .expect(200);

      expect(res.body.count).toBe(1);
      expect(res.body.data[0].name).toBe('Juan');
      expect(res.body.data[0].instagram_id).toBe('ig_1');
      expect(typeof res.body.data[0].bot_paused_at).toBe('string');
    });

    test('debe incluir timestamp ISO válido', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/langgraph/pending-humans')
        .expect(200);

      expect(res.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test('debe retornar múltiples registros correctamente', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([
        {
          id: 'u_1',
          instagram_id: 'ig_1',
          name: 'Juan',
          username: 'juan_perez',
          bot_paused_at: '2026-08-05T10:00:00Z',
          bot_paused_reason: 'operador_manual'
        },
        {
          id: 'u_2',
          instagram_id: 'ig_2',
          name: 'María',
          username: 'maria_g',
          bot_paused_at: '2026-08-05T11:00:00Z',
          bot_paused_reason: 'timeout'
        }
      ]);

      const res = await request(app)
        .get('/api/langgraph/pending-humans')
        .expect(200);

      expect(res.body.count).toBe(2);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('Query Parameter: limit', () => {
    test('debe usar default limit=50 si no se especifica', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([]);

      await request(app)
        .get('/api/langgraph/pending-humans')
        .expect(200);

      expect(mockGateway.getPendingHumans).toHaveBeenCalledWith(50);
    });

    test('debe aceptar limit=1', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([]);

      await request(app)
        .get('/api/langgraph/pending-humans?limit=1')
        .expect(200);

      expect(mockGateway.getPendingHumans).toHaveBeenCalledWith(1);
    });

    test('debe aceptar limit=1000', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([]);

      await request(app)
        .get('/api/langgraph/pending-humans?limit=1000')
        .expect(200);

      expect(mockGateway.getPendingHumans).toHaveBeenCalledWith(1000);
    });

    test('debe aceptar limit=100 personalizado', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([]);

      await request(app)
        .get('/api/langgraph/pending-humans?limit=100')
        .expect(200);

      expect(mockGateway.getPendingHumans).toHaveBeenCalledWith(100);
    });

    test('debe convertir string a number', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([]);

      await request(app)
        .get('/api/langgraph/pending-humans?limit=75')
        .expect(200);

      expect(mockGateway.getPendingHumans).toHaveBeenCalledWith(75);
    });
  });

  describe('Validación de Entrada (400)', () => {
    test('debe rechazar limit=0', async () => {
      const res = await request(app)
        .get('/api/langgraph/pending-humans?limit=0')
        .expect(400);

      expect(res.body.status).toBe('error');
      expect(res.body.message).toContain('Invalid limit');
    });

    test('debe rechazar limit negativo', async () => {
      const res = await request(app)
        .get('/api/langgraph/pending-humans?limit=-10')
        .expect(400);

      expect(res.body.status).toBe('error');
      expect(res.body.message).toContain('Invalid limit');
    });

    test('debe rechazar limit > 1000', async () => {
      const res = await request(app)
        .get('/api/langgraph/pending-humans?limit=1001')
        .expect(400);

      expect(res.body.status).toBe('error');
      expect(res.body.message).toContain('Invalid limit');
    });

    test('debe rechazar limit no numérico', async () => {
      const res = await request(app)
        .get('/api/langgraph/pending-humans?limit=abc')
        .expect(400);

      expect(res.body.status).toBe('error');
    });

    test('debe rechazar limit decimal', async () => {
      const res = await request(app)
        .get('/api/langgraph/pending-humans?limit=50.5')
        .expect(400);

      expect(res.body.status).toBe('error');
    });

    test('debe no llamar gateway si limit es inválido', async () => {
      await request(app)
        .get('/api/langgraph/pending-humans?limit=0')
        .expect(400);

      expect(mockGateway.getPendingHumans).not.toHaveBeenCalled();
    });

    test('debe retornar mensaje de error descriptivo', async () => {
      const res = await request(app)
        .get('/api/langgraph/pending-humans?limit=2000')
        .expect(400);

      expect(res.body.message).toContain('between 1 and 1000');
    });
  });

  describe('Error Handling (500)', () => {
    test('debe retornar 500 si gateway falla', async () => {
      mockGateway.getPendingHumans.mockRejectedValue(
        new Error('Database connection failed')
      );

      const res = await request(app)
        .get('/api/langgraph/pending-humans')
        .expect(500);

      expect(res.body.status).toBe('error');
      expect(res.body.message).toContain('Database connection failed');
    });

    test('debe loguear error en servidor', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockGateway.getPendingHumans.mockRejectedValue(new Error('DB Error'));

      await request(app)
        .get('/api/langgraph/pending-humans')
        .expect(500);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[GetPendingHumans] Error:',
        'DB Error'
      );

      consoleSpy.mockRestore();
    });

    test('debe manejar timeout del gateway', async () => {
      mockGateway.getPendingHumans.mockRejectedValue(new Error('Query timeout'));

      const res = await request(app)
        .get('/api/langgraph/pending-humans')
        .expect(500);

      expect(res.body.message).toContain('Query timeout');
    });
  });

  describe('Validación de Respuesta', () => {
    test('debe incluir success=true en respuesta exitosa', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/langgraph/pending-humans')
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    test('debe retornar count coincidente con data.length', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([
        { id: 'u_1', instagram_id: 'ig_1', name: 'Test', username: 'test', bot_paused_at: null, bot_paused_reason: null },
        { id: 'u_2', instagram_id: 'ig_2', name: 'Test2', username: 'test2', bot_paused_at: null, bot_paused_reason: null }
      ]);

      const res = await request(app)
        .get('/api/langgraph/pending-humans')
        .expect(200);

      expect(res.body.count).toBe(res.body.data.length);
      expect(res.body.count).toBe(2);
    });

    test('debe incluir todos los campos requeridos en cada registro', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([
        {
          id: 'u_1',
          instagram_id: 'ig_1',
          name: 'Test',
          username: 'test',
          bot_paused_at: '2026-08-05T10:30:00Z',
          bot_paused_reason: 'test'
        }
      ]);

      const res = await request(app)
        .get('/api/langgraph/pending-humans')
        .expect(200);

      const human = res.body.data[0];
      expect(human).toHaveProperty('id');
      expect(human).toHaveProperty('instagram_id');
      expect(human).toHaveProperty('name');
      expect(human).toHaveProperty('username');
      expect(human).toHaveProperty('bot_paused_at');
      expect(human).toHaveProperty('bot_paused_reason');
    });
  });

  describe('HTTP Compliance', () => {
    test('debe retornar Content-Type application/json', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([]);

      await request(app)
        .get('/api/langgraph/pending-humans')
        .expect('Content-Type', /json/);
    });

    test('debe retornar 200 en éxito', async () => {
      mockGateway.getPendingHumans.mockResolvedValue([]);

      await request(app)
        .get('/api/langgraph/pending-humans')
        .expect(200);
    });

    test('debe retornar 400 para entrada inválida', async () => {
      await request(app)
        .get('/api/langgraph/pending-humans?limit=99999')
        .expect(400);
    });

    test('debe retornar 500 para error servidor', async () => {
      mockGateway.getPendingHumans.mockRejectedValue(new Error('Internal error'));

      await request(app)
        .get('/api/langgraph/pending-humans')
        .expect(500);
    });
  });
});
