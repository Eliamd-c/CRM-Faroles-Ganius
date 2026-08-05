const express = require('express');
const router = express.Router();
const GetGraphStateUseCase = require('../use-cases/langgraph/getGraphState');
const InjectHumanMessageUseCase = require('../use-cases/langgraph/injectHumanMessage');
const langGraphService = require('../services/langgraph.service');
const commandRegistry = require('../domain/commands/CommandRegistry');

module.exports = function(di) {
  if (!di) {
    throw new Error('DI container required for langgraph routes');
  }

  // Instanciar Use Cases
  // Inyectamos las dependencias, que algunas vienen de la ruta (di) y el servicio central
  const getGraphStateUseCase = new GetGraphStateUseCase(langGraphService);
  
  const meta = require('../services/meta.service');

  // Usamos el SupabaseGateway del contenedor DI (fallback al singleton compartido)
  // para que la reanudación pase por resumeBot() y limpie bot_paused_at/reason.
  const supabaseGateway = di.gateways?.supabaseGateway
    || require('../adapters/gateways/supabaseGateway.instance');

  const injectHumanMessageUseCase = new InjectHumanMessageUseCase(
    langGraphService,
    supabaseGateway,
    meta
  );

  // GET /api/langgraph/diagram - Obtener diagrama Mermaid
  router.get('/diagram', async (req, res) => {
    try {
      const diagram = await langGraphService.getGraphDiagram();
      res.json({ success: true, diagram });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // GET /api/langgraph/tools - Obtener herramientas registradas
  router.get('/tools', (req, res) => {
    try {
      const tools = commandRegistry.getAllToolSchemas();
      res.json({ success: true, tools });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // GET /api/langgraph/states - Etapas del embudo registradas (State Pattern)
  router.get('/states', (req, res) => {
    try {
      const states = langGraphService.getSalesStates();
      res.json({ success: true, states });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // GET /api/langgraph/state/:thread_id - Obtener el historial de estado de un hilo
  router.get('/state/:thread_id', async (req, res) => {
    try {
      const { thread_id } = req.params;
      const { limit } = req.query;
      
      const result = await getGraphStateUseCase.execute({
        threadId: thread_id,
        limit: limit ? parseInt(limit, 10) : 10
      });
      
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // POST /api/langgraph/resume/:thread_id - Inyectar un mensaje humano y reanudar el bot
  router.post('/resume/:thread_id', async (req, res) => {
    try {
      const { thread_id } = req.params;
      const { message, checkpoint_id } = req.body;
      
      if (!message) {
        return res.status(400).json({ status: 'error', message: 'Message is required' });
      }

      const result = await injectHumanMessageUseCase.execute({
        threadId: thread_id,
        message,
        checkpointId: checkpoint_id
      });
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  return router;
};
