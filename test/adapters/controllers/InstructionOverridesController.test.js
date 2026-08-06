/**
 * InstructionOverridesController.test.js
 *
 * Tests para validar:
 * ✅ GET /api/ai/instructions/:stage
 * ✅ POST /api/ai/instructions/:stage
 * ✅ GET /api/ai/instructions
 * ✅ GET /api/ai/instructions/stats
 * ✅ POST /api/ai/instructions/cache/invalidate
 */

const InstructionOverridesController = require('../../../src/adapters/controllers/InstructionOverridesController');

describe('InstructionOverridesController', () => {
  let controller;
  let mockGateway;
  let mockInstructionService;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    // Mock gateway
    mockGateway = {
      getInstructionOverride: jest.fn(),
      saveInstructionOverride: jest.fn(),
      getAllInstructionOverrides: jest.fn()
    };

    // Mock instruction service
    mockInstructionService = {
      getStats: jest.fn().mockReturnValue({
        cacheHits: 10,
        cacheMisses: 5,
        errors: 0,
        cacheSize: 15,
        hitRate: 0.667
      }),
      invalidateCache: jest.fn(),
      invalidateAllCache: jest.fn()
    };

    // Mock Express request/response
    mockReq = {
      params: {},
      body: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    // Crear controlador
    controller = new InstructionOverridesController(mockGateway, mockInstructionService);
  });

  describe('Constructor', () => {
    it('debe requerir InstructionOverridesGateway', () => {
      expect(() => new InstructionOverridesController(null)).toThrow('InstructionOverridesGateway is required');
    });

    it('debe inicializarse con gateway e instruction service opcionales', () => {
      const controller1 = new InstructionOverridesController(mockGateway);
      expect(controller1.gateway).toBe(mockGateway);
      expect(controller1.instructionService).toBeNull();

      const controller2 = new InstructionOverridesController(mockGateway, mockInstructionService);
      expect(controller2.gateway).toBe(mockGateway);
      expect(controller2.instructionService).toBe(mockInstructionService);
    });
  });

  describe('getInstruction', () => {
    it('debe retornar instrucción para una etapa válida', async () => {
      mockGateway.getInstructionOverride.mockResolvedValue('Test instruction');
      mockReq.params.stage = 'ONBOARDING';

      await controller.getInstruction(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        stage: 'ONBOARDING',
        instruction: 'Test instruction'
      });
    });

    it('debe retornar null si la instrucción no existe', async () => {
      mockGateway.getInstructionOverride.mockResolvedValue(null);
      mockReq.params.stage = 'UNKNOWN';

      await controller.getInstruction(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        stage: 'UNKNOWN',
        instruction: null
      });
    });

    it('debe validar el parámetro stage', async () => {
      mockReq.params.stage = null;

      await controller.getInstruction(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Stage parameter is required'
      });
    });

    it('debe manejar errores de gateway', async () => {
      mockGateway.getInstructionOverride.mockRejectedValue(new Error('DB Error'));
      mockReq.params.stage = 'ONBOARDING';

      await controller.getInstruction(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('saveInstruction', () => {
    it('debe guardar una instrucción válida', async () => {
      mockGateway.saveInstructionOverride.mockResolvedValue(true);
      mockReq.params.stage = 'ONBOARDING';
      mockReq.body.instruction_text = 'This is a valid instruction that is longer than 50 characters';

      await controller.saveInstruction(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          stage: 'ONBOARDING'
        })
      );
    });

    it('debe rechazar instrucciones menores a 50 caracteres', async () => {
      mockReq.params.stage = 'ONBOARDING';
      mockReq.body.instruction_text = 'Short';

      await controller.saveInstruction(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Instruction must be at least 50 characters'
        })
      );
    });

    it('debe rechazar instrucciones mayores a 5000 caracteres', async () => {
      mockReq.params.stage = 'ONBOARDING';
      mockReq.body.instruction_text = 'x'.repeat(5001);

      await controller.saveInstruction(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Instruction must not exceed 5000 characters'
        })
      );
    });

    it('debe validar el parámetro stage', async () => {
      mockReq.params.stage = null;
      mockReq.body.instruction_text = 'This is a valid instruction that is longer than 50 characters';

      await controller.saveInstruction(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Stage parameter is required'
      });
    });

    it('debe manejar errores de gateway', async () => {
      mockGateway.saveInstructionOverride.mockRejectedValue(new Error('DB Error'));
      mockReq.params.stage = 'ONBOARDING';
      mockReq.body.instruction_text = 'This is a valid instruction that is longer than 50 characters';

      await controller.saveInstruction(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getAllInstructions', () => {
    it('debe retornar todas las instrucciones', async () => {
      mockGateway.getAllInstructionOverrides.mockResolvedValue({
        ONBOARDING: 'Onboarding instruction',
        DISCOVERY: 'Discovery instruction'
      });

      await controller.getAllInstructions(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        instructions: {
          ONBOARDING: 'Onboarding instruction',
          DISCOVERY: 'Discovery instruction'
        }
      });
    });

    it('debe retornar objeto vacío si no hay instrucciones', async () => {
      mockGateway.getAllInstructionOverrides.mockResolvedValue({});

      await controller.getAllInstructions(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        instructions: {}
      });
    });

    it('debe manejar errores de gateway', async () => {
      mockGateway.getAllInstructionOverrides.mockRejectedValue(new Error('DB Error'));

      await controller.getAllInstructions(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getCacheStats', () => {
    it('debe retornar estadísticas de cache', async () => {
      await controller.getCacheStats(mockReq, mockRes);

      const call = mockRes.json.mock.calls[0][0];
      expect(call.success).toBe(true);
      expect(call.stats.cacheHits).toBe(10);
      expect(call.stats.cacheMisses).toBe(5);
      expect(call.stats.hitRate).toBe(0.667);
      expect(call.stats.timestamp).toBeDefined();
    });

    it('debe retornar error si InstructionService no está disponible', async () => {
      const controllerNoService = new InstructionOverridesController(mockGateway, null);

      await controllerNoService.getCacheStats(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'InstructionService not available',
        stats: null
      });
    });

    it('debe manejar errores del servicio', async () => {
      mockInstructionService.getStats.mockImplementation(() => {
        throw new Error('Service error');
      });

      await controller.getCacheStats(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('invalidateCache', () => {
    // invalidateCache(stage) hace `if (!stageName) return;`, así que llamarlo sin
    // argumento no borraba nada. Vaciar todo el cache exige invalidateAllCache().
    it('debe vaciar TODO el cache (no invalidateCache sin etapa)', async () => {
      await controller.invalidateCache(mockReq, mockRes);

      expect(mockInstructionService.invalidateAllCache).toHaveBeenCalled();
      expect(mockInstructionService.invalidateCache).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Cache invalidated successfully',
          timestamp: expect.any(String)
        })
      );
    });

    it('debe retornar error si InstructionService no está disponible', async () => {
      const controllerNoService = new InstructionOverridesController(mockGateway, null);

      await controllerNoService.invalidateCache(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'InstructionService not available'
      });
    });

    it('debe manejar errores del servicio', async () => {
      mockInstructionService.invalidateAllCache.mockImplementation(() => {
        throw new Error('Service error');
      });

      await controller.invalidateCache(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});
