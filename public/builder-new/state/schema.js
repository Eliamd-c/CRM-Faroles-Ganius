/**
 * State Validation Schema
 *
 * Defines validation rules for the state shape.
 * Ensures referential integrity and required fields.
 */

/**
 * Validate complete state object
 * @param {Object} state - State to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateState(state) {
  const errors = [];

  if (!state) {
    errors.push('State is null or undefined');
    return { valid: false, errors };
  }

  // Validate root-level required fields
  if (!state.hasOwnProperty('flowName')) {
    errors.push('Missing required field: flowName');
  }
  if (!state.hasOwnProperty('isDirty') || typeof state.isDirty !== 'boolean') {
    errors.push('Missing or invalid required field: isDirty (must be boolean)');
  }
  if (!state.hasOwnProperty('nodes') || typeof state.nodes !== 'object') {
    errors.push('Missing or invalid required field: nodes (must be object)');
  }
  if (!state.hasOwnProperty('connections') || typeof state.connections !== 'object') {
    errors.push('Missing or invalid required field: connections (must be object)');
  }
  if (!state.hasOwnProperty('history') || !Array.isArray(state.history)) {
    errors.push('Missing or invalid required field: history (must be array)');
  }
  if (!state.hasOwnProperty('historyPointer') || typeof state.historyPointer !== 'number') {
    errors.push('Missing or invalid required field: historyPointer (must be number)');
  }
  if (!state.hasOwnProperty('validationErrors') || !Array.isArray(state.validationErrors)) {
    errors.push('Missing or invalid required field: validationErrors (must be array)');
  }
  if (!state.hasOwnProperty('notifications') || !Array.isArray(state.notifications)) {
    errors.push('Missing or invalid required field: notifications (must be array)');
  }

  // Validate nodes
  if (state.nodes && typeof state.nodes === 'object') {
    for (const nodeId in state.nodes) {
      const nodeErrors = validateNode(state.nodes[nodeId], nodeId);
      errors.push(...nodeErrors);
    }
  }

  // Validate connections
  if (state.connections && typeof state.connections === 'object') {
    for (const connId in state.connections) {
      const connErrors = validateConnection(state.connections[connId], state.nodes);
      errors.push(...connErrors);
    }
  }

  // Validate referential integrity
  if (state.selectedNodeId && state.nodes && !state.nodes[state.selectedNodeId]) {
    errors.push(`selectedNodeId references non-existent node: ${state.selectedNodeId}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a single node
 * @param {Object} node - Node to validate
 * @param {string} nodeId - Node ID for error reporting
 * @returns {string[]} Array of error messages
 */
export function validateNode(node, nodeId) {
  const errors = [];

  if (!node) {
    errors.push(`Node ${nodeId} is null or undefined`);
    return errors;
  }

  if (!node.id || typeof node.id !== 'string') {
    errors.push(`Node ${nodeId}: missing or invalid id field`);
  }

  if (!node.type || typeof node.type !== 'string') {
    errors.push(`Node ${nodeId}: missing or invalid type field`);
  }

  if (!node.data || typeof node.data !== 'object') {
    errors.push(`Node ${nodeId}: missing or invalid data field (must be object)`);
  }

  if (!node.position || typeof node.position !== 'object') {
    errors.push(`Node ${nodeId}: missing or invalid position field (must be object)`);
  } else {
    if (typeof node.position.x !== 'number') {
      errors.push(`Node ${nodeId}: position.x must be a number`);
    }
    if (typeof node.position.y !== 'number') {
      errors.push(`Node ${nodeId}: position.y must be a number`);
    }
  }

  return errors;
}

/**
 * Validate a single connection
 * @param {Object} connection - Connection to validate
 * @param {Object} nodes - All nodes (for referential integrity check)
 * @returns {string[]} Array of error messages
 */
export function validateConnection(connection, nodes) {
  const errors = [];

  if (!connection) {
    errors.push('Connection is null or undefined');
    return errors;
  }

  if (!connection.id || typeof connection.id !== 'string') {
    errors.push('Connection: missing or invalid id field');
  }

  if (!connection.from || typeof connection.from !== 'string') {
    errors.push('Connection: missing or invalid from field');
  } else if (nodes && !nodes[connection.from]) {
    errors.push(`Connection: from node "${connection.from}" does not exist`);
  }

  if (!connection.to || typeof connection.to !== 'string') {
    errors.push('Connection: missing or invalid to field');
  } else if (nodes && !nodes[connection.to]) {
    errors.push(`Connection: to node "${connection.to}" does not exist`);
  }

  if (!connection.fromOutput || typeof connection.fromOutput !== 'string') {
    errors.push('Connection: missing or invalid fromOutput field');
  }

  if (!connection.toInput || typeof connection.toInput !== 'string') {
    errors.push('Connection: missing or invalid toInput field');
  }

  return errors;
}
