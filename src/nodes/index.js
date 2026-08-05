/**
 * Exports centralizados para el módulo de Nodos
 */

// Base classes
const BaseNode = require('./base/BaseNode');

// Strategies
const ExecutionStrategy = require('./strategies/ExecutionStrategy');
const AdTriggerExecutionStrategy = require('./strategies/AdTriggerExecutionStrategy');

// Factories
const NodeFactory = require('./factories/NodeFactory');
const { initializeNodeRegistry } = require('./factories/NodeRegistry');

// Implementations
const TextNode = require('./implementations/TextNode');
const ButtonsNode = require('./implementations/ButtonsNode');
const AdTriggerNode = require('./implementations/AdTriggerNode');

module.exports = {
  // Base classes
  BaseNode,

  // Strategies
  ExecutionStrategy,
  AdTriggerExecutionStrategy,

  // Factories
  NodeFactory,
  initializeNodeRegistry,

  // Implementations
  TextNode,
  ButtonsNode,
  AdTriggerNode
};
