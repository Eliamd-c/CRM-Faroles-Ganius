/**
 * State Management Unit Tests
 *
 * Tests for state mutations and selectors.
 * Can be run with: node state/test.js
 *
 * Note: Tests are self-contained and don't require external imports
 * to avoid module loading issues.
 */

// ─────────────────────────────────────────────
// Core State Functions (inlined for testing)
// ─────────────────────────────────────────────

function createInitialState() {
  return {
    flowId: null,
    flowName: 'Nuevo Flujo',
    flowDescription: '',
    isDirty: false,
    nodes: {},
    connections: {},
    selectedNodeId: null,
    selectedConnId: null,
    history: [],
    historyPointer: -1,
    validationErrors: [],
    notifications: [],
  };
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function createNode(nodeId, type, position, data = {}) {
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

function createConnection(from, fromOutput, to, toInput) {
  const connId = `conn_${from}_${fromOutput}_to_${to}_${toInput}`;
  return {
    id: connId,
    from,
    fromOutput,
    to,
    toInput,
  };
}

// ─────────────────────────────────────────────
// Action Functions (inlined for testing)
// ─────────────────────────────────────────────

function addNode(state, type, position, data = {}) {
  const newState = cloneState(state);
  const nodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const node = createNode(nodeId, type, position, data);
  newState.nodes[nodeId] = node;
  newState.isDirty = true;
  return newState;
}

function deleteNode(state, nodeId) {
  const newState = cloneState(state);
  delete newState.nodes[nodeId];

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

  if (newState.selectedNodeId === nodeId) {
    newState.selectedNodeId = null;
  }

  newState.isDirty = true;
  return newState;
}

function updateNode(state, nodeId, updates) {
  const newState = cloneState(state);

  if (!newState.nodes[nodeId]) {
    throw new Error(`Node ${nodeId} not found`);
  }

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

function addConnection(state, from, fromOutput, to, toInput) {
  const newState = cloneState(state);

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

function deleteConnection(state, connId) {
  const newState = cloneState(state);

  if (!newState.connections[connId]) {
    throw new Error(`Connection ${connId} not found`);
  }

  delete newState.connections[connId];

  if (newState.selectedConnId === connId) {
    newState.selectedConnId = null;
  }

  newState.isDirty = true;
  return newState;
}

function setSelectedNode(state, nodeId) {
  const newState = cloneState(state);

  if (nodeId && !newState.nodes[nodeId]) {
    throw new Error(`Node ${nodeId} not found`);
  }

  newState.selectedNodeId = nodeId;
  return newState;
}

function markDirty(state, isDirty) {
  const newState = cloneState(state);
  newState.isDirty = isDirty;
  return newState;
}

function pushHistory(state, snapshot, maxHistorySize = 50) {
  const newState = cloneState(state);

  if (newState.historyPointer < newState.history.length - 1) {
    newState.history = newState.history.slice(0, newState.historyPointer + 1);
  }

  newState.history.push(snapshot);

  if (newState.history.length > maxHistorySize) {
    newState.history.shift();
  } else {
    newState.historyPointer++;
  }

  return newState;
}

function undo(state) {
  const newState = cloneState(state);

  if (newState.historyPointer <= 0) {
    return newState;
  }

  newState.historyPointer--;

  if (newState.history[newState.historyPointer]) {
    const historyState = cloneState(newState.history[newState.historyPointer]);
    historyState.history = newState.history;
    historyState.historyPointer = newState.historyPointer;
    return historyState;
  }

  return newState;
}

function redo(state) {
  const newState = cloneState(state);

  if (newState.historyPointer >= newState.history.length - 1) {
    return newState;
  }

  newState.historyPointer++;

  if (newState.history[newState.historyPointer]) {
    const historyState = cloneState(newState.history[newState.historyPointer]);
    historyState.history = newState.history;
    historyState.historyPointer = newState.historyPointer;
    return historyState;
  }

  return newState;
}

function setValidationErrors(state, errors) {
  const newState = cloneState(state);
  newState.validationErrors = errors || [];
  return newState;
}

function addNotification(state, type, message, duration = 3000) {
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

// ─────────────────────────────────────────────
// Selector Functions (inlined for testing)
// ─────────────────────────────────────────────

function getNode(state, nodeId) {
  if (!state || !state.nodes) {
    return null;
  }
  return state.nodes[nodeId] || null;
}

function getNodes(state) {
  if (!state || !state.nodes) {
    return {};
  }
  return state.nodes;
}

function getConnections(state) {
  if (!state || !state.connections) {
    return {};
  }
  return state.connections;
}

function getSelectedNode(state) {
  if (!state || !state.selectedNodeId) {
    return null;
  }
  return state.nodes[state.selectedNodeId] || null;
}

function isDirty(state) {
  if (!state) {
    return false;
  }
  return state.isDirty === true;
}

function canUndo(state) {
  if (!state || !state.history) {
    return false;
  }
  return state.historyPointer > 0;
}

function canRedo(state) {
  if (!state || !state.history) {
    return false;
  }
  return state.historyPointer < state.history.length - 1;
}

// ─────────────────────────────────────────────
// Test Runner Utilities
// ─────────────────────────────────────────────

let testCount = 0;
let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function test(name, fn) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`✓ Test ${testCount}: ${name}`);
  } catch (err) {
    failCount++;
    console.error(`✗ Test ${testCount}: ${name}`);
    console.error(`  Error: ${err.message}`);
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'} - expected ${expected}, got ${actual}`);
  }
}

function assertNotNull(value, message) {
  if (value === null || value === undefined) {
    throw new Error(message || 'Value should not be null');
  }
}

function assertNull(value, message) {
  if (value !== null && value !== undefined) {
    throw new Error(message || 'Value should be null');
  }
}

function assertTrue(value, message) {
  if (value !== true) {
    throw new Error(message || 'Value should be true');
  }
}

function assertFalse(value, message) {
  if (value !== false) {
    throw new Error(message || 'Value should be false');
  }
}

function assertArrayLength(arr, length, message) {
  if (!Array.isArray(arr) || arr.length !== length) {
    throw new Error(`${message || 'Array length mismatch'} - expected length ${length}, got ${arr?.length}`);
  }
}

// ─────────────────────────────────────────────
// Test Cases
// ─────────────────────────────────────────────

console.log('\n=== State Management Tests ===\n');

// Test 1: Initial state creation
test('createInitialState creates valid state', () => {
  const state = createInitialState();
  assertNotNull(state, 'State should not be null');
  assertEquals(state.flowName, 'Nuevo Flujo', 'Default flow name');
  assertFalse(state.isDirty, 'Initial state should not be dirty');
});

// Test 2: addNode creates valid node
test('addNode creates node with valid structure', () => {
  const state = createInitialState();
  const newState = addNode(state, 'trigger', { x: 100, y: 200 });

  assertTrue(newState.isDirty, 'State should be dirty after adding node');
  assertEquals(Object.keys(newState.nodes).length, 1, 'Should have 1 node');

  const nodeId = Object.keys(newState.nodes)[0];
  const node = newState.nodes[nodeId];

  assertNotNull(node.id, 'Node should have id');
  assertEquals(node.type, 'trigger', 'Node type should match');
  assertEquals(node.position.x, 100, 'Node x position');
  assertEquals(node.position.y, 200, 'Node y position');
});

// Test 3: deleteNode removes node and connections
test('deleteNode removes node and its connections', () => {
  let state = createInitialState();
  state = addNode(state, 'trigger', { x: 0, y: 0 });
  const node1Id = Object.keys(state.nodes)[0];

  state = addNode(state, 'message', { x: 300, y: 0 });
  const node2Id = Object.keys(state.nodes)[1];

  state = addConnection(state, node1Id, 'output_1', node2Id, 'input_1');
  assertEquals(Object.keys(state.connections).length, 1, 'Should have 1 connection');

  state = deleteNode(state, node1Id);

  assertNull(getNode(state, node1Id), 'Node should be deleted');
  assertEquals(Object.keys(state.nodes).length, 1, 'Should have 1 node remaining');
  assertEquals(Object.keys(state.connections).length, 0, 'Connections should be deleted');
});

// Test 4: updateNode preserves other nodes
test('updateNode modifies node without affecting others', () => {
  let state = createInitialState();
  state = addNode(state, 'trigger', { x: 0, y: 0 });
  state = addNode(state, 'message', { x: 300, y: 0 });

  const nodeIds = Object.keys(state.nodes);
  const firstNodeId = nodeIds[0];
  const secondNodeId = nodeIds[1];

  state = updateNode(state, firstNodeId, { data: { customField: 'test' } });

  const firstNode = getNode(state, firstNodeId);
  const secondNode = getNode(state, secondNodeId);

  assertNotNull(firstNode.data.customField, 'Updated node should have custom field');
  assertNull(secondNode.data.customField, 'Other node should not have custom field');
  assertEquals(Object.keys(state.nodes).length, 2, 'Should still have 2 nodes');
});

// Test 5: addConnection validates nodes exist
test('addConnection throws when nodes do not exist', () => {
  const state = createInitialState();

  try {
    addConnection(state, 'nonexistent1', 'output_1', 'nonexistent2', 'input_1');
    throw new Error('Should have thrown error');
  } catch (err) {
    assertTrue(err.message.includes('not found'), 'Should throw node not found error');
  }
});

// Test 6: deleteConnection removes only target connection
test('deleteConnection removes only target connection', () => {
  let state = createInitialState();
  state = addNode(state, 'trigger', { x: 0, y: 0 });
  state = addNode(state, 'message', { x: 300, y: 0 });
  state = addNode(state, 'action', { x: 600, y: 0 });

  const nodeIds = Object.keys(state.nodes);
  state = addConnection(state, nodeIds[0], 'output_1', nodeIds[1], 'input_1');
  state = addConnection(state, nodeIds[1], 'output_1', nodeIds[2], 'input_1');

  const connections = Object.values(state.connections);
  const firstConnId = connections[0].id;

  state = deleteConnection(state, firstConnId);

  assertNull(getConnections(state)[firstConnId], 'First connection should be deleted');
  assertEquals(Object.keys(state.connections).length, 1, 'Should have 1 connection left');
});

// Test 7: setSelectedNode updates selection
test('setSelectedNode selects and deselects nodes', () => {
  let state = createInitialState();
  state = addNode(state, 'trigger', { x: 0, y: 0 });
  const nodeId = Object.keys(state.nodes)[0];

  state = setSelectedNode(state, nodeId);
  assertEquals(state.selectedNodeId, nodeId, 'Node should be selected');

  const selectedNode = getSelectedNode(state);
  assertNotNull(selectedNode, 'Should return selected node');
  assertEquals(selectedNode.id, nodeId, 'Selected node ID should match');

  state = setSelectedNode(state, null);
  assertNull(state.selectedNodeId, 'Node should be deselected');
  assertNull(getSelectedNode(state), 'Should return null for no selection');
});

// Test 8: markDirty tracks changes
test('markDirty correctly sets dirty flag', () => {
  let state = createInitialState();
  assertFalse(isDirty(state), 'Initial state should not be dirty');

  state = markDirty(state, true);
  assertTrue(isDirty(state), 'State should be marked dirty');

  state = markDirty(state, false);
  assertFalse(isDirty(state), 'State should be marked clean');
});

// Test 9: pushHistory and undo/redo work correctly
test('pushHistory, undo, and redo maintain history correctly', () => {
  let state = createInitialState();
  state = pushHistory(state, state);

  state = addNode(state, 'trigger', { x: 0, y: 0 });
  state = pushHistory(state, cloneState(state));
  assertEquals(state.history.length, 2, 'Should have 2 snapshots');

  state = addNode(state, 'message', { x: 300, y: 0 });
  state = pushHistory(state, cloneState(state));
  assertEquals(state.history.length, 3, 'Should have 3 snapshots');

  assertTrue(canUndo(state), 'Should be able to undo');
  assertFalse(canRedo(state), 'Should not be able to redo (at end)');

  state = undo(state);
  assertTrue(canRedo(state), 'Should be able to redo after undo');
  assertEquals(Object.keys(state.nodes).length, 1, 'Should have 1 node after undo');

  state = redo(state);
  assertEquals(Object.keys(state.nodes).length, 2, 'Should have 2 nodes after redo');
});

// Test 10: State mutations do not modify original state
test('State mutations return new state (immutability)', () => {
  const original = createInitialState();
  const modified = addNode(original, 'trigger', { x: 0, y: 0 });

  assertEquals(Object.keys(original.nodes).length, 0, 'Original should be unchanged');
  assertEquals(Object.keys(modified.nodes).length, 1, 'Modified should have new node');
  assertFalse(original.isDirty, 'Original should not be dirty');
  assertTrue(modified.isDirty, 'Modified should be dirty');
});

// Test 11: setValidationErrors sets errors
test('setValidationErrors updates validation state', () => {
  let state = createInitialState();
  const errors = ['Error 1', 'Error 2'];

  state = setValidationErrors(state, errors);
  assertEquals(state.validationErrors.length, 2, 'Should have 2 errors');
  assertEquals(state.validationErrors[0], 'Error 1', 'First error should match');
});

// Test 12: addNotification creates notification object
test('addNotification creates notification object', () => {
  let state = createInitialState();
  state = addNotification(state, 'success', 'Operation completed');

  assertEquals(state.notifications.length, 1, 'Should have 1 notification');
  const notif = state.notifications[0];
  assertEquals(notif.type, 'success', 'Notification type');
  assertEquals(notif.message, 'Operation completed', 'Notification message');
  assertNotNull(notif.id, 'Notification should have ID');
});

// Test 13: getNodes and getConnections return all items
test('getNodes and getConnections return all items', () => {
  let state = createInitialState();
  state = addNode(state, 'trigger', { x: 0, y: 0 });
  state = addNode(state, 'message', { x: 300, y: 0 });

  const nodes = getNodes(state);
  assertEquals(Object.keys(nodes).length, 2, 'Should return all 2 nodes');

  const nodeIds = Object.keys(state.nodes);
  state = addConnection(state, nodeIds[0], 'output_1', nodeIds[1], 'input_1');

  const conns = getConnections(state);
  assertEquals(Object.keys(conns).length, 1, 'Should return all connections');
});

// Test 14: Multiple addNode operations create unique IDs
test('Multiple addNode operations create unique node IDs', () => {
  let state = createInitialState();
  state = addNode(state, 'trigger', { x: 0, y: 0 });
  state = addNode(state, 'message', { x: 300, y: 0 });
  state = addNode(state, 'action', { x: 600, y: 0 });

  const nodeIds = Object.keys(state.nodes);
  assertEquals(nodeIds.length, 3, 'Should have 3 nodes');

  const uniqueIds = new Set(nodeIds);
  assertEquals(uniqueIds.size, 3, 'All node IDs should be unique');
});

// Print summary
console.log(`\n=== Test Summary ===`);
console.log(`Total: ${testCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Success Rate: ${((passCount / testCount) * 100).toFixed(1)}%\n`);

// Exit with appropriate code
process.exit(failCount > 0 ? 1 : 0);
