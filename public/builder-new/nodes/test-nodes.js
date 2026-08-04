/**
 * Node Migration Tests
 *
 * Comprehensive tests for node module structure and registry.
 * Can be run with: node nodes/test-nodes.js
 */

// Test runner utilities
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

// Mock NodeRegistry for testing
class MockNodeRegistry {
  constructor() {
    this.nodes = new Map();
    this.nodeTypes = [];
  }

  register(type, config) {
    if (!type || !config) {
      throw new Error('NodeRegistry: type and config are required');
    }

    this.nodes.set(type, {
      type,
      label: config.label || type,
      icon: config.icon || '◻️',
      inputs: config.inputs || 1,
      outputs: config.outputs || 1,
      html: config.html || '',
      render: config.render || (() => ''),
      inspector: config.inspector || null,
      ...config,
    });

    this.nodeTypes.push(type);
  }

  get(type) {
    return this.nodes.get(type) || null;
  }

  getTypes() {
    return [...this.nodeTypes];
  }

  exists(type) {
    return this.nodes.has(type);
  }

  getHTML(type) {
    const config = this.get(type);
    return config ? config.html : '';
  }

  renderPreview(type, nodeId, nodeData) {
    const config = this.get(type);
    if (!config || !config.render) {
      return '<div style="padding:12px; text-align:center; color:#9ca3af;">Nodo no configurado</div>';
    }

    try {
      return config.render(nodeId, nodeData);
    } catch (err) {
      console.error(`Error rendering ${type} preview:`, err.message);
      return '<div style="padding:12px; text-align:center; color:#ef4444;">Error al renderizar</div>';
    }
  }

  getInspector(type, nodeId, nodeData) {
    const config = this.get(type);
    if (!config || !config.inspector) {
      return {
        title: config?.label || 'Nodo',
        html: '<p style="color:var(--text-muted); font-size:13px;">No hay configuraciones extra para este nodo.</p>'
      };
    }

    try {
      return config.inspector(nodeId, nodeData);
    } catch (err) {
      console.error(`Error getting ${type} inspector:`, err.message);
      return {
        title: config.label || 'Nodo',
        html: '<div style="color:#ef4444;">Error al cargar configuración</div>'
      };
    }
  }
}

// ─────────────────────────────────────────────
// Test Cases
// ─────────────────────────────────────────────

console.log('\n=== Node Migration Tests ===\n');

// Test 1: Registry initialization
test('NodeRegistry initializes correctly', () => {
  const registry = new MockNodeRegistry();
  assertNotNull(registry, 'Registry should be created');
  assertEquals(registry.nodeTypes.length, 0, 'Should start empty');
});

// Test 2: Register node
test('register() adds node to registry', () => {
  const registry = new MockNodeRegistry();
  registry.register('test', {
    label: 'Test Node',
    icon: '🧪',
    inputs: 1,
    outputs: 1,
    html: '<div>Test</div>',
  });

  assertTrue(registry.exists('test'), 'Node should exist');
  assertEquals(registry.getTypes().length, 1, 'Should have 1 node');
});

// Test 3: Get node configuration
test('get() retrieves node configuration', () => {
  const registry = new MockNodeRegistry();
  const config = { label: 'Test', icon: '🧪' };
  registry.register('test', config);

  const retrieved = registry.get('test');
  assertEquals(retrieved.label, 'Test', 'Should have label');
  assertEquals(retrieved.icon, '🧪', 'Should have icon');
});

// Test 4: Render preview with render function
test('renderPreview() calls render function', () => {
  const registry = new MockNodeRegistry();
  const renderFn = (nodeId, data) => `<div>Preview for ${nodeId}</div>`;

  registry.register('test', {
    label: 'Test',
    render: renderFn,
  });

  const preview = registry.renderPreview('test', 'node1', {});
  assertTrue(preview.includes('Preview for node1'), 'Should include node preview');
});

// Test 5: Get inspector configuration
test('getInspector() retrieves inspector config', () => {
  const registry = new MockNodeRegistry();
  const inspectorFn = (nodeId, data) => ({
    title: 'Test Inspector',
    html: '<div>Inspector</div>'
  });

  registry.register('test', {
    label: 'Test',
    inspector: inspectorFn,
  });

  const inspector = registry.getInspector('test', 'node1', {});
  assertEquals(inspector.title, 'Test Inspector', 'Should have inspector title');
});

// Test 6: Node type validation
test('register() throws without type or config', () => {
  const registry = new MockNodeRegistry();

  try {
    registry.register(null, {});
    throw new Error('Should have thrown');
  } catch (err) {
    assertTrue(err.message.includes('type and config'), 'Should validate parameters');
  }
});

// Test 7: Render error handling
test('renderPreview() handles render errors', () => {
  const registry = new MockNodeRegistry();
  registry.register('test', {
    label: 'Test',
    render: () => { throw new Error('Render error'); },
  });

  const preview = registry.renderPreview('test', 'node1', {});
  assertTrue(preview.includes('Error'), 'Should show error message');
});

// Test 8: Multiple nodes in registry
test('Multiple nodes can be registered', () => {
  const registry = new MockNodeRegistry();

  registry.register('trigger', { label: 'Trigger', icon: '⚡' });
  registry.register('message', { label: 'Message', icon: '💬' });
  registry.register('action', { label: 'Action', icon: '⚡' });

  const types = registry.getTypes();
  assertEquals(types.length, 3, 'Should have 3 nodes');
  assertTrue(registry.exists('trigger'), 'Trigger should exist');
  assertTrue(registry.exists('message'), 'Message should exist');
  assertTrue(registry.exists('action'), 'Action should exist');
});

// Test 9: Node metadata structure
test('Node configuration has required fields', () => {
  const registry = new MockNodeRegistry();
  registry.register('test', {
    label: 'Test Node',
    icon: '🧪',
    inputs: 2,
    outputs: 3,
  });

  const config = registry.get('test');
  assertEquals(config.type, 'test', 'Should have type');
  assertEquals(config.label, 'Test Node', 'Should have label');
  assertEquals(config.icon, '🧪', 'Should have icon');
  assertEquals(config.inputs, 2, 'Should have inputs');
  assertEquals(config.outputs, 3, 'Should have outputs');
});

// Test 10: Non-existent node handling
test('get() returns null for non-existent node', () => {
  const registry = new MockNodeRegistry();
  const config = registry.get('nonexistent');
  assertEquals(config, null, 'Should return null');
});

// Test 11: HTML template retrieval
test('getHTML() retrieves node template', () => {
  const registry = new MockNodeRegistry();
  const html = '<div class="test">Template</div>';
  registry.register('test', { html });

  const retrieved = registry.getHTML('test');
  assertEquals(retrieved, html, 'Should return HTML template');
});

// Test 12: Inspector defaults
test('getInspector() provides default when no inspector', () => {
  const registry = new MockNodeRegistry();
  registry.register('test', { label: 'Test' });

  const inspector = registry.getInspector('test', 'node1', {});
  assertEquals(inspector.title, 'Test', 'Should use node label as title');
  assertTrue(inspector.html.includes('No hay configuraciones'), 'Should show default message');
});

// Print summary
console.log(`\n=== Test Summary ===`);
console.log(`Total: ${testCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Success Rate: ${((passCount / testCount) * 100).toFixed(1)}%\n`);

process.exit(failCount > 0 ? 1 : 0);
