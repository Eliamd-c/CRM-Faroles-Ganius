/**
 * NodeRegistry - Registra todos los tipos de nodos disponibles
 * Ejecutar en app.js durante la inicialización
 */
const NodeFactory = require('./NodeFactory');
const TextNode = require('../implementations/TextNode');
const ButtonsNode = require('../implementations/ButtonsNode');
const AdTriggerNode = require('../implementations/AdTriggerNode');
// ... otros nodos

function initializeNodeRegistry(dependencies) {
  // Nodos existentes
  NodeFactory.register('text', TextNode, dependencies);
  NodeFactory.register('buttons', ButtonsNode, dependencies);

  // Nodo nuevo
  NodeFactory.register('ad_trigger', AdTriggerNode, dependencies);

  console.log(`✅ Node Registry inicializado con ${NodeFactory.getRegisteredTypes().length} tipos`);
}

module.exports = { initializeNodeRegistry };
