/**
 * State Mutations/Actions
 *
 * Pure state mutation functions.
 * All functions return new state (immutable).
 * No direct mutation of input state.
 */

import { cloneState, createNode, createConnection } from './index.js';

/**
 * Add a new node to the flow
 * @param {Object} state - Current state
 * @param {string} type - Node type
 * @param {Object} position - Position {x, y}
 * @param {Object} data - Node data
 * @returns {Object} New state with node added
 */
export function addNode(state, type, position, data = {}) {
  const newState = cloneState(state);
  const nodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const node = createNode(nodeId, type, position, data);

  newState.nodes[nodeId] = node;
  newState.isDirty = true;

  return newState;
}

/**
 * Delete a node and all its connections
 * @param {Object} state - Current state
 * @param {string} nodeId - Node ID to delete
 * @returns {Object} New state with node deleted
 */
export function deleteNode(state, nodeId) {
  const newState = cloneState(state);

  // Remove the node
  delete newState.nodes[nodeId];

  // Remove all connections to/from this node
  const connectionsToRemove = [];
  for (const connId in newState.connections) {
    const conn = newState.connections[connId];
    if (conn.from === nodeId || conn.to === nodeId) {
      connectionsToRemove.push(connId);
    }
  }

  connectionsToRemove.forEach(connId => {
    delete newState.connections[connId];
  });

  // Clear selection if this node was selected
  if (newState.selectedNodeId === nodeId) {
    newState.selectedNodeId = null;
  }

  newState.isDirty = true;

  return newState;
}

/**
 * Update node data/properties
 * @param {Object} state - Current state
 * @param {string} nodeId - Node ID to update
 * @param {Object} updates - Fields to update
 * @returns {Object} New state with node updated
 */
export function updateNode(state, nodeId, updates) {
  const newState = cloneState(state);

  if (!newState.nodes[nodeId]) {
    throw new Error(`Node ${nodeId} not found`);
  }

  // Create new node object with updates applied
  newState.nodes[nodeId] = {
    ...newState.nodes[nodeId],
    ...updates,
    data: {
      ...newState.nodes[nodeId].data,
      ...(updates.data || {}),
    },
  };

  newState.isDirty = true;

  return newState;
}

/**
 * Add a connection between two nodes
 * @param {Object} state - Current state
 * @param {string} from - Source node ID
 * @param {string} fromOutput - Source output port
 * @param {string} to - Target node ID
 * @param {string} toInput - Target input port
 * @returns {Object} New state with connection added
 */
export function addConnection(state, from, fromOutput, to, toInput) {
  const newState = cloneState(state);

  // Validate nodes exist
  if (!newState.nodes[from]) {
    throw new Error(`Source node ${from} not found`);
  }
  if (!newState.nodes[to]) {
    throw new Error(`Target node ${to} not found`);
  }

  const conn = createConnection(from, fromOutput, to, toInput);
  newState.connections[conn.id] = conn;
  newState.isDirty = true;

  return newState;
}

/**
 * Delete a connection
 * @param {Object} state - Current state
 * @param {string} connId - Connection ID
 * @returns {Object} New state with connection deleted
 */
export function deleteConnection(state, connId) {
  const newState = cloneState(state);

  if (!newState.connections[connId]) {
    throw new Error(`Connection ${connId} not found`);
  }

  delete newState.connections[connId];

  // Clear selection if this connection was selected
  if (newState.selectedConnId === connId) {
    newState.selectedConnId = null;
  }

  newState.isDirty = true;

  return newState;
}

/**
 * Set the currently selected node
 * @param {Object} state - Current state
 * @param {string|null} nodeId - Node ID to select (or null to deselect)
 * @returns {Object} New state with selection updated
 */
export function setSelectedNode(state, nodeId) {
  const newState = cloneState(state);

  if (nodeId && !newState.nodes[nodeId]) {
    throw new Error(`Node ${nodeId} not found`);
  }

  newState.selectedNodeId = nodeId;

  return newState;
}

/**
 * Mark state as dirty/modified
 * @param {Object} state - Current state
 * @param {boolean} isDirty - Dirty flag
 * @returns {Object} New state with dirty flag set
 */
export function markDirty(state, isDirty) {
  const newState = cloneState(state);
  newState.isDirty = isDirty;
  return newState;
}

/**
 * Add state snapshot to history
 * @param {Object} state - Current state
 * @param {Object} snapshot - State snapshot to add
 * @param {number} maxHistorySize - Maximum history size
 * @returns {Object} New state with snapshot added to history
 */
export function pushHistory(state, snapshot, maxHistorySize = 50) {
  const newState = cloneState(state);

  // Remove any redo history if we're not at the end
  if (newState.historyPointer < newState.history.length - 1) {
    newState.history = newState.history.slice(0, newState.historyPointer + 1);
  }

  // Add new snapshot
  newState.history.push(snapshot);

  // Trim history if it exceeds max size
  if (newState.history.length > maxHistorySize) {
    newState.history.shift();
  } else {
    newState.historyPointer++;
  }

  return newState;
}

/**
 * Undo to previous state
 * @param {Object} state - Current state
 * @returns {Object} Previous state from history (or same state if at beginning)
 */
export function undo(state) {
  const newState = cloneState(state);

  if (newState.historyPointer <= 0) {
    return newState; // Already at beginning
  }

  newState.historyPointer--;

  // Return the state at this history point
  if (newState.history[newState.historyPointer]) {
    const historyState = cloneState(newState.history[newState.historyPointer]);
    historyState.history = newState.history;
    historyState.historyPointer = newState.historyPointer;
    return historyState;
  }

  return newState;
}

/**
 * Redo to next state
 * @param {Object} state - Current state
 * @returns {Object} Next state from history (or same state if at end)
 */
export function redo(state) {
  const newState = cloneState(state);

  if (newState.historyPointer >= newState.history.length - 1) {
    return newState; // Already at end
  }

  newState.historyPointer++;

  // Return the state at this history point
  if (newState.history[newState.historyPointer]) {
    const historyState = cloneState(newState.history[newState.historyPointer]);
    historyState.history = newState.history;
    historyState.historyPointer = newState.historyPointer;
    return historyState;
  }

  return newState;
}

/**
 * Set validation errors
 * @param {Object} state - Current state
 * @param {Array} errors - Validation errors
 * @returns {Object} New state with validation errors set
 */
export function setValidationErrors(state, errors) {
  const newState = cloneState(state);
  newState.validationErrors = errors || [];
  return newState;
}

/**
 * Add a notification
 * @param {Object} state - Current state
 * @param {string} type - Notification type (info, warning, error, success)
 * @param {string} message - Notification message
 * @param {number} duration - Duration in ms (0 = persistent)
 * @returns {Object} New state with notification added
 */
export function addNotification(state, type, message, duration = 3000) {
  const newState = cloneState(state);
  const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  newState.notifications.push({
    id: notificationId,
    type,
    message,
    duration,
    timestamp: Date.now(),
  });

  return newState;
}
