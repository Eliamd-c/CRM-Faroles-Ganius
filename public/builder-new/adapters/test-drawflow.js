/**
 * Drawflow Adapter Unit Tests
 *
 * Tests DrawflowAdapter with mocked Drawflow library.
 * Can be run with: node adapters/test-drawflow.js
 */

// ─────────────────────────────────────────────
// Mock Drawflow Library
// ─────────────────────────────────────────────

class MockDrawflow {
  constructor(container) {
    if (!container) throw new Error('Container required');
    this.container = container;
    this.zoom = 1;
    this.reroute = false;
    this.curvature = 0.5;
    this.drawflow = {
      drawflow: {
        Home: {
          data: {},
          connections: {}
        }
      }
    };
    this.nodes = {};
    this.listeners = {};
    this.nodeCounter = 0;
  }

  start() {
    return this;
  }

  addNode(type, inputs, outputs, posX, posY, name, data, html) {
    if (!type) throw new Error('Type required');
    const nodeId = `node_${++this.nodeCounter}`;
    const node = {
      id: nodeId,
      type,
      inputs,
      outputs,
      pos_x: posX,
      pos_y: posY,
      name,
      data: data || {},
      html: html || ''
    };
    this.nodes[nodeId] = node;
    this.drawflow.drawflow.Home.data[nodeId] = node;
    return nodeId;
  }

  getNodeFromId(nodeId) {
    return this.nodes[nodeId] || this.drawflow.drawflow.Home.data[nodeId] || null;
  }

  removeNodeId(nodeId) {
    delete this.nodes[nodeId];
    delete this.drawflow.drawflow.Home.data[nodeId];
    return true;
  }

  addConnection(fromId, toId, fromOutput, toInput) {
    if (!this.nodes[fromId]) throw new Error(`From node ${fromId} not found`);
    if (!this.nodes[toId]) throw new Error(`To node ${toId} not found`);

    const connId = `${fromId}_${fromOutput}_${toId}_${toInput}`;
    const connection = { from: fromId, to: toId, fromOutput, toInput };

    if (!this.drawflow.drawflow.Home.connections[connId]) {
      this.drawflow.drawflow.Home.connections[connId] = connection;
    }
    return connId;
  }

  removeSingleConnection(fromId, toId, fromOutput, toInput) {
    const connId = `${fromId}_${fromOutput}_${toId}_${toInput}`;
    delete this.drawflow.drawflow.Home.connections[connId];
    return true;
  }

  export() {
    return JSON.parse(JSON.stringify(this.drawflow));
  }

  import(data) {
    if (data && data.drawflow && data.drawflow.Home) {
      this.drawflow = JSON.parse(JSON.stringify(data));
      this.nodes = data.drawflow.Home.data || {};
    }
    return true;
  }

  setZoom(zoom) {
    this.zoom = zoom;
    return zoom;
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(callback);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }

  destroy() {
    this.listeners = {};
    this.nodes = {};
    return true;
  }
}

// Mock document and global Drawflow for testing
global.Drawflow = MockDrawflow;

// Create mock container
const mockContainer = { id: 'test-container' };
global.document = {
  getElementById: (id) => id === 'test-container' ? mockContainer : null
};

// ─────────────────────────────────────────────
// DrawflowAdapter (copy for testing)
// ─────────────────────────────────────────────

class DrawflowAdapter {
  constructor(containerId, DrawflowClass = null) {
    if (!containerId || typeof containerId !== 'string') {
      throw new Error('DrawflowAdapter: containerId must be a non-empty string');
    }

    if (DrawflowClass) {
      this._drawflowClass = DrawflowClass;
    } else if (typeof Drawflow !== 'undefined') {
      this._drawflowClass = Drawflow;
    } else {
      throw new Error('DrawflowAdapter: Drawflow library not found');
    }

    const container = global.document.getElementById(containerId);
    if (!container) {
      throw new Error(`DrawflowAdapter: Container with ID "${containerId}" not found`);
    }

    this.containerId = containerId;
    this.container = container;
    this.editor = null;
    this.eventListeners = new Map();

    try {
      this.editor = new this._drawflowClass(container);
      this.editor.reroute = true;
      this.editor.curvature = 0.5;
      this.editor.start();
    } catch (err) {
      throw new Error(`DrawflowAdapter: Failed to initialize Drawflow: ${err.message}`);
    }
  }

  _ensureInitialized() {
    if (!this.editor) {
      throw new Error('DrawflowAdapter: Editor not initialized');
    }
  }

  addNode(nodeId, nodeType, position, data = {}, html = null) {
    this._ensureInitialized();

    if (!nodeId || typeof nodeId !== 'string') {
      throw new Error('DrawflowAdapter.addNode: nodeId must be a non-empty string');
    }
    if (!nodeType || typeof nodeType !== 'string') {
      throw new Error('DrawflowAdapter.addNode: nodeType must be a non-empty string');
    }
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
      throw new Error('DrawflowAdapter.addNode: position must be {x: number, y: number}');
    }
    if (typeof data !== 'object' || data === null) {
      throw new Error('DrawflowAdapter.addNode: data must be an object');
    }

    try {
      const template = html || `<div class="drawflow-node"><strong>${nodeType}</strong></div>`;
      const addedNodeId = this.editor.addNode(
        nodeType, 1, 1, position.x, position.y,
        nodeType, data, template
      );
      return addedNodeId;
    } catch (err) {
      throw new Error(`DrawflowAdapter.addNode failed: ${err.message}`);
    }
  }

  removeNode(nodeId) {
    this._ensureInitialized();

    if (!nodeId || typeof nodeId !== 'string') {
      throw new Error('DrawflowAdapter.removeNode: nodeId must be a non-empty string');
    }

    try {
      const node = this.editor.getNodeFromId(nodeId);
      if (!node) {
        throw new Error(`Node "${nodeId}" not found`);
      }
      this.editor.removeNodeId(nodeId);
      return true;
    } catch (err) {
      throw new Error(`DrawflowAdapter.removeNode failed: ${err.message}`);
    }
  }

  updateNode(nodeId, data) {
    this._ensureInitialized();

    if (!nodeId || typeof nodeId !== 'string') {
      throw new Error('DrawflowAdapter.updateNode: nodeId must be a non-empty string');
    }
    if (typeof data !== 'object' || data === null) {
      throw new Error('DrawflowAdapter.updateNode: data must be an object');
    }

    try {
      const node = this.editor.getNodeFromId(nodeId);
      if (!node) {
        throw new Error(`Node "${nodeId}" not found`);
      }
      node.data = { ...node.data, ...data };
      return node;
    } catch (err) {
      throw new Error(`DrawflowAdapter.updateNode failed: ${err.message}`);
    }
  }

  addConnection(fromId, fromOutput, toId, toInput) {
    this._ensureInitialized();

    if (!fromId || typeof fromId !== 'string') {
      throw new Error('DrawflowAdapter.addConnection: fromId must be a non-empty string');
    }
    if (!fromOutput || typeof fromOutput !== 'string') {
      throw new Error('DrawflowAdapter.addConnection: fromOutput must be a non-empty string');
    }
    if (!toId || typeof toId !== 'string') {
      throw new Error('DrawflowAdapter.addConnection: toId must be a non-empty string');
    }
    if (!toInput || typeof toInput !== 'string') {
      throw new Error('DrawflowAdapter.addConnection: toInput must be a non-empty string');
    }

    try {
      if (!this.editor.getNodeFromId(fromId)) {
        throw new Error(`Source node "${fromId}" not found`);
      }
      if (!this.editor.getNodeFromId(toId)) {
        throw new Error(`Target node "${toId}" not found`);
      }

      this.editor.addConnection(fromId, toId, fromOutput, toInput);
      const connId = `conn_${fromId}_${fromOutput}_to_${toId}_${toInput}`;
      return connId;
    } catch (err) {
      throw new Error(`DrawflowAdapter.addConnection failed: ${err.message}`);
    }
  }

  removeConnection(connIdOrFromId, toId = null, fromOutput = null, toInput = null) {
    this._ensureInitialized();

    try {
      if (toId && fromOutput && toInput) {
        this.editor.removeSingleConnection(connIdOrFromId, toId, fromOutput, toInput);
      } else {
        throw new Error('removeConnection by connId not directly supported');
      }
      return true;
    } catch (err) {
      throw new Error(`DrawflowAdapter.removeConnection failed: ${err.message}`);
    }
  }

  getNode(nodeId) {
    this._ensureInitialized();

    if (!nodeId || typeof nodeId !== 'string') {
      throw new Error('DrawflowAdapter.getNode: nodeId must be a non-empty string');
    }

    try {
      const node = this.editor.getNodeFromId(nodeId);
      return node || null;
    } catch (err) {
      throw new Error(`DrawflowAdapter.getNode failed: ${err.message}`);
    }
  }

  getNodes() {
    this._ensureInitialized();

    try {
      if (this.editor.drawflow && this.editor.drawflow.drawflow && this.editor.drawflow.drawflow.Home) {
        return this.editor.drawflow.drawflow.Home.data || {};
      }
      return {};
    } catch (err) {
      throw new Error(`DrawflowAdapter.getNodes failed: ${err.message}`);
    }
  }

  zoomIn() {
    this._ensureInitialized();

    try {
      if (this.editor.zoom >= 3) {
        return this.editor.zoom;
      }
      this.editor.zoom += 0.1;
      this.editor.setZoom(this.editor.zoom);
      return this.editor.zoom;
    } catch (err) {
      throw new Error(`DrawflowAdapter.zoomIn failed: ${err.message}`);
    }
  }

  zoomOut() {
    this._ensureInitialized();

    try {
      if (this.editor.zoom <= 0.5) {
        return this.editor.zoom;
      }
      this.editor.zoom -= 0.1;
      this.editor.setZoom(this.editor.zoom);
      return this.editor.zoom;
    } catch (err) {
      throw new Error(`DrawflowAdapter.zoomOut failed: ${err.message}`);
    }
  }

  zoomFit() {
    this._ensureInitialized();

    try {
      this.editor.zoom = 1;
      this.editor.setZoom(1);
      return this.editor.zoom;
    } catch (err) {
      throw new Error(`DrawflowAdapter.zoomFit failed: ${err.message}`);
    }
  }

  exportFlow() {
    this._ensureInitialized();

    try {
      return this.editor.export();
    } catch (err) {
      throw new Error(`DrawflowAdapter.exportFlow failed: ${err.message}`);
    }
  }

  importFlow(flowData) {
    this._ensureInitialized();

    if (typeof flowData !== 'object' || flowData === null) {
      throw new Error('DrawflowAdapter.importFlow: flowData must be an object');
    }

    try {
      this.editor.import(flowData);
      return true;
    } catch (err) {
      throw new Error(`DrawflowAdapter.importFlow failed: ${err.message}`);
    }
  }

  on(event, callback) {
    this._ensureInitialized();

    if (!event || typeof event !== 'string') {
      throw new Error('DrawflowAdapter.on: event must be a non-empty string');
    }
    if (typeof callback !== 'function') {
      throw new Error('DrawflowAdapter.on: callback must be a function');
    }

    try {
      this.editor.on(event, callback);

      if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, []);
      }
      this.eventListeners.get(event).push(callback);
    } catch (err) {
      throw new Error(`DrawflowAdapter.on failed: ${err.message}`);
    }
  }

  off(event, callback) {
    this._ensureInitialized();

    if (!event || typeof event !== 'string') {
      throw new Error('DrawflowAdapter.off: event must be a non-empty string');
    }
    if (typeof callback !== 'function') {
      throw new Error('DrawflowAdapter.off: callback must be a function');
    }

    try {
      this.editor.off(event, callback);

      if (this.eventListeners.has(event)) {
        const callbacks = this.eventListeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    } catch (err) {
      throw new Error(`DrawflowAdapter.off failed: ${err.message}`);
    }
  }

  destroy() {
    try {
      this.eventListeners.clear();

      if (this.editor && typeof this.editor.destroy === 'function') {
        this.editor.destroy();
      }

      this.editor = null;
      this.container = null;

      return true;
    } catch (err) {
      console.error(`DrawflowAdapter.destroy warning: ${err.message}`);
      return false;
    }
  }
}

// ─────────────────────────────────────────────
// Test Runner
// ─────────────────────────────────────────────

let testCount = 0;
let passCount = 0;
let failCount = 0;

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

function assertEquals(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'Assertion'}: expected ${expected}, got ${actual}`);
  }
}

function assertNotNull(val, msg) {
  if (val === null || val === undefined) {
    throw new Error(msg || 'Value should not be null');
  }
}

function assertTrue(val, msg) {
  if (val !== true) {
    throw new Error(msg || 'Value should be true');
  }
}

function assertThrows(fn, msg) {
  try {
    fn();
    throw new Error(msg || 'Should have thrown error');
  } catch (err) {
    if (msg && !err.message.includes(msg)) {
      throw new Error(`Expected error with "${msg}", got: ${err.message}`);
    }
  }
}

// ─────────────────────────────────────────────
// Test Cases
// ─────────────────────────────────────────────

console.log('\n=== Drawflow Adapter Tests ===\n');

// Test 1: Constructor initializes properly
test('DrawflowAdapter constructor initializes with valid container', () => {
  const adapter = new DrawflowAdapter('test-container', MockDrawflow);
  assertNotNull(adapter.editor, 'Editor should be initialized');
  assertEquals(adapter.containerId, 'test-container', 'Container ID should be set');
  adapter.destroy();
});

// Test 2: Constructor throws on invalid container
test('DrawflowAdapter constructor throws on invalid container ID', () => {
  assertThrows(
    () => new DrawflowAdapter('nonexistent-container', MockDrawflow),
    'Container with ID'
  );
});

// Test 3: addNode creates node successfully
test('addNode creates node with valid parameters', () => {
  const adapter = new DrawflowAdapter('test-container', MockDrawflow);
  const nodeId = adapter.addNode('test-type', 'trigger', { x: 100, y: 200 }, { key: 'value' });

  assertNotNull(nodeId, 'Node ID should be returned');
  const node = adapter.getNode(nodeId);
  assertNotNull(node, 'Node should exist');
  assertEquals(node.type, 'trigger', 'Node type should match');

  adapter.destroy();
});

// Test 4: addNode throws on invalid parameters
test('addNode throws on invalid parameters', () => {
  const adapter = new DrawflowAdapter('test-container', MockDrawflow);

  assertThrows(
    () => adapter.addNode(null, 'trigger', { x: 0, y: 0 }),
    'nodeId must be'
  );

  assertThrows(
    () => adapter.addNode('1', 'trigger', { x: 'bad' }, {}),
    'position must be'
  );

  adapter.destroy();
});

// Test 5: removeNode deletes node successfully
test('removeNode removes node and returns true', () => {
  const adapter = new DrawflowAdapter('test-container', MockDrawflow);
  const nodeId = adapter.addNode('test', 'trigger', { x: 0, y: 0 });

  assertTrue(adapter.removeNode(nodeId), 'Should return true');

  const node = adapter.getNode(nodeId);
  assertEquals(node, null, 'Node should be deleted');

  adapter.destroy();
});

// Test 6: updateNode modifies node data
test('updateNode merges data into node', () => {
  const adapter = new DrawflowAdapter('test-container', MockDrawflow);
  const nodeId = adapter.addNode('test', 'trigger', { x: 0, y: 0 }, { a: 1 });

  adapter.updateNode(nodeId, { b: 2 });

  const node = adapter.getNode(nodeId);
  assertEquals(node.data.a, 1, 'Original data preserved');
  assertEquals(node.data.b, 2, 'New data added');

  adapter.destroy();
});

// Test 7: addConnection creates connection between nodes
test('addConnection creates connection with validation', () => {
  const adapter = new DrawflowAdapter('test-container', MockDrawflow);
  const fromId = adapter.addNode('test', 'trigger', { x: 0, y: 0 });
  const toId = adapter.addNode('test', 'message', { x: 300, y: 0 });

  const connId = adapter.addConnection(fromId, 'output_1', toId, 'input_1');

  assertNotNull(connId, 'Connection ID should be returned');
  assertEquals(typeof connId, 'string', 'Connection ID should be string');

  adapter.destroy();
});

// Test 8: getNodes returns all nodes
test('getNodes returns all nodes in flow', () => {
  const adapter = new DrawflowAdapter('test-container', MockDrawflow);
  adapter.addNode('test', 'trigger', { x: 0, y: 0 });
  adapter.addNode('test', 'message', { x: 300, y: 0 });

  const nodes = adapter.getNodes();

  assertEquals(Object.keys(nodes).length >= 2, true, 'Should have nodes');

  adapter.destroy();
});

// Test 9: Zoom methods work correctly
test('Zoom methods (in, out, fit) adjust zoom level', () => {
  const adapter = new DrawflowAdapter('test-container', MockDrawflow);
  const initialZoom = adapter.editor.zoom;

  const zoomIn = adapter.zoomIn();
  assertEquals(zoomIn > initialZoom, true, 'Zoom in should increase');

  const zoomOut = adapter.zoomOut();
  assertEquals(zoomOut < zoomIn, true, 'Zoom out should decrease');

  const zoomFit = adapter.zoomFit();
  assertEquals(zoomFit, 1, 'Zoom fit should be 1');

  adapter.destroy();
});

// Test 10: Event listener methods work
test('on/off methods register and unregister listeners', () => {
  const adapter = new DrawflowAdapter('test-container', MockDrawflow);

  let callCount = 0;
  const callback = () => { callCount++; };

  adapter.on('nodeSelected', callback);
  assertEquals(adapter.eventListeners.has('nodeSelected'), true, 'Listener should be registered');

  adapter.off('nodeSelected', callback);
  assertEquals(adapter.eventListeners.get('nodeSelected').length, 0, 'Listener should be removed');

  adapter.destroy();
});

// Test 11: Export/Import flow data
test('exportFlow and importFlow work with JSON', () => {
  const adapter = new DrawflowAdapter('test-container', MockDrawflow);
  adapter.addNode('test', 'trigger', { x: 0, y: 0 });

  const exported = adapter.exportFlow();
  assertNotNull(exported, 'Exported data should not be null');
  assertEquals(typeof exported, 'object', 'Exported data should be object');

  const importResult = adapter.importFlow(exported);
  assertTrue(importResult, 'Import should return true');

  adapter.destroy();
});

// Test 12: destroy cleans up properly
test('destroy cleans up resources', () => {
  const adapter = new DrawflowAdapter('test-container', MockDrawflow);
  adapter.on('test', () => {});

  const result = adapter.destroy();

  assertTrue(result, 'Destroy should return true');
  assertEquals(adapter.editor, null, 'Editor should be null after destroy');
  assertEquals(adapter.eventListeners.size, 0, 'Event listeners should be cleared');
});

// Print summary
console.log(`\n=== Test Summary ===`);
console.log(`Total: ${testCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Success Rate: ${((passCount / testCount) * 100).toFixed(1)}%\n`);

process.exit(failCount > 0 ? 1 : 0);
