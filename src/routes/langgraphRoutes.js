const express = require('express');
const router = express.Router();
const GetGraphStateUseCase = require('../use-cases/langgraph/getGraphState');
const InjectHumanMessageUseCase = require('../use-cases/langgraph/injectHumanMessage');
const langGraphService = require('../services/langgraph.service');

module.exports = function(di) {
  if (!di) {
    throw new Error('DI container required for langgraph routes');
  }

  // Instanciar Use Cases
  // Inyectamos las dependencias, que algunas vienen de la ruta (di) y el servicio central
  const getGraphStateUseCase = new GetGraphStateUseCase(langGraphService);
  
  // Asumimos que `di.customerGateway` o `di.metaGateway` existen si los necesitamos
  // En este caso, el flow routes o webhook handlers ya usan los repositorios directamente. 
  // O podemos usar los requeridos globalmente como meta.service.js
  const meta = require('../services/meta.service');
  
  // Vamos a usar supabase directamente para actualizar el cliente
  const supabase = require('../../db');
  
  // Creamos un wrapper simplificado para el gateway de cliente
  const customerGateway = {
    update: async (instagramId, payload) => {
      await supabase.from('customers').update(payload).eq('instagram_id', instagramId);
    }
  };

  const injectHumanMessageUseCase = new InjectHumanMessageUseCase(
    langGraphService, 
    customerGateway, 
    meta
  );

  // GET /api/langgraph/diagram - Obtener diagrama Mermaid
  router.get('/diagram', (req, res) => {
    try {
      const diagram = langGraphService.getGraphDiagram();
      res.json({ success: true, diagram });
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
