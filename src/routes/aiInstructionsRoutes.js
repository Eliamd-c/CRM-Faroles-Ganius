/**
 * AI Instructions Routes
 *
 * Rutas para gestionar instrucciones dinámicas de etapas.
 * Endpoints:
 * - GET /api/ai/instructions/:stage
 * - POST /api/ai/instructions/:stage
 * - GET /api/ai/instructions
 * - GET /api/ai/instructions/stats
 * - POST /api/ai/instructions/cache/invalidate
 *
 * Patrón: Express Router Factory
 */
const express = require('express');
const router = express.Router();

module.exports = function(instructionOverridesGateway, instructionService = null) {
  // Validar dependencias
  if (!instructionOverridesGateway) {
    throw new Error('instructionOverridesGateway is required for aiInstructionsRoutes');
  }

  // Instanciar controller
  const InstructionOverridesController = require('../adapters/controllers/InstructionOverridesController');
  const controller = new InstructionOverridesController(instructionOverridesGateway, instructionService);

  // GET /api/ai/instructions/stats (debe venir antes que /:stage para evitar que 'stats' sea tratado como stage)
  router.get('/instructions/stats', (req, res) => {
    controller.getCacheStats(req, res);
  });

  // POST /api/ai/instructions/cache/invalidate
  router.post('/instructions/cache/invalidate', express.json(), (req, res) => {
    controller.invalidateCache(req, res);
  });

  // GET /api/ai/instructions/:stage
  router.get('/instructions/:stage', (req, res) => {
    controller.getInstruction(req, res);
  });

  // POST /api/ai/instructions/:stage
  router.post('/instructions/:stage', express.json(), (req, res) => {
    controller.saveInstruction(req, res);
  });

  // GET /api/ai/instructions (retorna todas)
  router.get('/instructions', (req, res) => {
    controller.getAllInstructions(req, res);
  });

  return router;
};
