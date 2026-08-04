/**
 * State Management - Core Module
 *
 * Central state management for the builder application.
 * Defines the state shape and provides state creation/initialization.
 */

/**
 * Create initial empty state for the builder
 * @returns {Object} Initial application state
 */
export function createInitialState() {
  return {
    // Flow metadata
    flowId: null,
    flowName: 'Nuevo Flujo',
    flowDescription: '',
    isDirty: false,

    // Nodes in the flow
    nodes: {},           // { nodeId: { id, type, name, data, position } }
    connections: {},     // { connId: { id, from, fromOutput, to, toInput } }

    // UI State
    selectedNodeId: null,
    selectedConnId: null,

    // Undo/Redo History
    history: [],
    historyPointer: -1,

    // Validation
    validationErrors: [],

    // UI Notifications
    notifications: [],   // { id, type, message, duration }
  };
}

/**
 * Get the state schema definition
 * @returns {Object} Schema with validation rules
 */
export function getStateSchema() {
  return {
    flowId: { type: 'string|null' },
    flowName: { type: 'string', required: true },
    flowDescription: { type: 'string' },
    isDirty: { type: 'boolean', required: true },
    nodes: { type: 'object', required: true },
    connections: { type: 'object', required: true },
    selectedNodeId: { type: 'string|null' },
    selectedConnId: { type: 'string|null' },
    history: { type: 'array', required: true },
    historyPointer: { type: 'number', required: true },
    validationErrors: { type: 'array', required: true },
    notifications: { type: 'array', required: true },
  };
}

/**
 * Node state shape validation
 */
export function getNodeSchema() {
  return {
    id: { type: 'string', required: true },
    type: { type: 'string', required: true },
    name: { type: 'string', required: true },
    data: { type: 'object', required: true },
    position: {
      type: 'object',
      required: true,
      properties: {
        x: { type: 'number', required: true },
        y: { type: 'number', required: true },
      },
    },
    inputs: { type: 'number', default: 1 },
    outputs: { type: 'number', default: 1 },
  };
}

/**
 * Connection state shape validation
 */
export function getConnectionSchema() {
  return {
    id: { type: 'string', required: true },
    from: { type: 'string', required: true },
    fromOutput: { type: 'string', required: true },
    to: { type: 'string', required: true },
    toInput: { type: 'string', required: true },
  };
}

/**
 * Create a new node state object
 * @param {string} nodeId - Unique node identifier
 * @param {string} type - Node type (trigger, message, action, etc)
 * @param {Object} position - Node position {x, y}
 * @param {Object} data - Node configuration data
 * @returns {Object} Node state object
 */
export function createNode(nodeId, type, position, data = {}) {
  return {
    id: nodeId,
    type,
    name: `${type}_${nodeId}`,
    data: {
      ...data,
      _blocks: data._blocks || '[]',
      _action: data._action || '{}',
      _input: data._input || '{}',
      _condition: data._condition || '{}',
      _randomizer: data._randomizer || '{}',
      _carousel: data._carousel || '{}',
      _gallery: data._gallery || '{}',
      _audio: data._audio || '{}',
      _video: data._video || '{}',
      _file: data._file || '{}',
      _delay: data._delay || '{}',
      _goto: data._goto || '{}',
      _ai: data._ai || '{}',
    },
    position: {
      x: position.x || 0,
      y: position.y || 0,
    },
    inputs: data.inputs || 1,
    outputs: data.outputs || 1,
  };
}

/**
 * Create a new connection state object
 * @param {string} from - Source node ID
 * @param {string} fromOutput - Source output port (e.g., 'output_1')
 * @param {string} to - Target node ID
 * @param {string} toInput - Target input port (e.g., 'input_1')
 * @returns {Object} Connection state object
 */
export function createConnection(from, fromOutput, to, toInput) {
  const connId = `conn_${from}_${fromOutput}_to_${to}_${toInput}`;
  return {
    id: connId,
    from,
    fromOutput,
    to,
    toInput,
  };
}

/**
 * Deep clone state for history snapshots
 * @param {Object} state - State to clone
 * @returns {Object} Cloned state
 */
export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}
