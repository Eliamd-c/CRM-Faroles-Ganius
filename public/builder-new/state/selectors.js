/**
 * State Selectors
 *
 * Read-only query functions for accessing state.
 * Pure functions that derive values from state.
 * Never modify state.
 */

/**
 * Get a single node by ID
 * @param {Object} state - Current state
 * @param {string} nodeId - Node ID
 * @returns {Object|null} Node object or null if not found
 */
export function getNode(state, nodeId) {
  if (!state || !state.nodes) {
    return null;
  }
  return state.nodes[nodeId] || null;
}

/**
 * Get all nodes
 * @param {Object} state - Current state
 * @returns {Object} All nodes { nodeId: nodeObject }
 */
export function getNodes(state) {
  if (!state || !state.nodes) {
    return {};
  }
  return state.nodes;
}

/**
 * Get all connections
 * @param {Object} state - Current state
 * @returns {Object} All connections { connId: connObject }
 */
export function getConnections(state) {
  if (!state || !state.connections) {
    return {};
  }
  return state.connections;
}

/**
 * Get the currently selected node
 * @param {Object} state - Current state
 * @returns {Object|null} Selected node or null
 */
export function getSelectedNode(state) {
  if (!state || !state.selectedNodeId) {
    return null;
  }
  return state.nodes[state.selectedNodeId] || null;
}

/**
 * Check if state is marked as dirty
 * @param {Object} state - Current state
 * @returns {boolean} True if state has unsaved changes
 */
export function isDirty(state) {
  if (!state) {
    return false;
  }
  return state.isDirty === true;
}

/**
 * Check if undo is available
 * @param {Object} state - Current state
 * @returns {boolean} True if there are previous states to undo to
 */
export function canUndo(state) {
  if (!state || !state.history) {
    return false;
  }
  return state.historyPointer > 0;
}

/**
 * Check if redo is available
 * @param {Object} state - Current state
 * @returns {boolean} True if there are future states to redo to
 */
export function canRedo(state) {
  if (!state || !state.history) {
    return false;
  }
  return state.historyPointer < state.history.length - 1;
}
