const express = require('express');
const router = express.Router();

module.exports = function(di) {
  if (!di) {
    throw new Error('DI container required for flow routes');
  }

  const {
    createFlow,
    updateFlow,
    deleteFlow,
    testFlow,
    exportFlow,
    gateways
  } = di;

  const flowRepository = gateways.flowRepository;

  // POST /api/flows - Create new flow
  router.post('/', async (req, res) => {
    try {
      const { name, keywords, matchType, steps } = req.body;

      const result = await createFlow.execute({
        name,
        keywords,
        matchType,
        steps
      });

      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  });

  // GET /api/flows - List all flows
  router.get('/', async (req, res) => {
    try {
      const { enabled, search } = req.query;

      const filters = {};
      if (enabled !== undefined) {
        filters.enabled = enabled === 'true';
      }
      if (search) {
        filters.search = search;
      }

      const flows = await flowRepository.list(filters);

      res.json({
        status: 'success',
        count: flows.length,
        flows
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  });

  // GET /api/flows/:id - Get flow details
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const flow = await flowRepository.read(id);
      if (!flow) {
        return res.status(404).json({
          status: 'error',
          message: `Flujo no encontrado: ${id}`
        });
      }

      res.json({
        status: 'success',
        flow
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  });

  // PUT /api/flows/:id - Update flow
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, keywords, matchType, steps, enabled } = req.body;

      const result = await updateFlow.execute({
        flowId: id,
        name,
        keywords,
        matchType,
        steps,
        enabled
      });

      res.json(result);
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  });

  // DELETE /api/flows/:id - Delete flow
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const result = await deleteFlow.execute({
        flowId: id
      });

      res.json(result);
    } catch (error) {
      if (error.message.includes('no encontrado')) {
        return res.status(404).json({
          status: 'error',
          message: error.message
        });
      }
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  });

  // POST /api/flows/:id/test - Test flow
  router.post('/:id/test', async (req, res) => {
    try {
      const { id } = req.params;
      const { senderId, senderName } = req.body;

      if (!senderId) {
        return res.status(400).json({
          status: 'error',
          message: 'senderId es requerido para probar flujo'
        });
      }

      const result = await testFlow.execute({
        flowId: id,
        senderId,
        senderName: senderName || 'Test User'
      });

      res.json(result);
    } catch (error) {
      if (error.message.includes('no encontrado')) {
        return res.status(404).json({
          status: 'error',
          message: error.message
        });
      }
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  });

  // POST /api/flows/:id/export - Export flow
  router.post('/:id/export', async (req, res) => {
    try {
      const { id } = req.params;
      const { format = 'json' } = req.body;

      const result = await exportFlow.execute({
        flowId: id,
        format
      });

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.json(result.data);
      } else {
        res.json(result);
      }
    } catch (error) {
      if (error.message.includes('no encontrado')) {
        return res.status(404).json({
          status: 'error',
          message: error.message
        });
      }
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  });

  // GET /api/flows/search/:keyword - Search flows by keyword
  router.get('/search/:keyword', async (req, res) => {
    try {
      const { keyword } = req.params;

      if (!keyword || keyword.trim().length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Palabra clave requerida'
        });
      }

      const flows = await flowRepository.search(keyword);

      res.json({
        status: 'success',
        keyword,
        count: flows.length,
        flows
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  });

  return router;
};
