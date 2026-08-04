// Estado compartido mutable entre módulos.
// Todos los servicios leen/escriben a través de este objeto en lugar de
// variables sueltas, lo que permite extraer módulos sin duplicar estado.

const state = {
  ACCESS_TOKEN: null,
  INSTAGRAM_ACCOUNT_ID: null,
  BOT_USERNAME: null,
  GRAPH_API: 'https://graph.instagram.com/v21.0',
  AI_MASTER_CONTEXT: '',
  AI_BASE_PERSONA: '',
  flowsConfig: { flows: [], defaultFlow: null },
  sseClients: [],
  recentReplies: new Set(),
};

function broadcastLog(type, message, profile = null) {
  const logEntry = { type, message, profile, timestamp: Date.now() };
  console.log(`[${type}] ${message}`);
  state.sseClients.forEach(client => {
    client.res.write(`data: ${JSON.stringify(logEntry)}\n\n`);
  });
}

module.exports = { state, broadcastLog };
