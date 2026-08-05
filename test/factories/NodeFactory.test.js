const NodeFactory = require('../../src/nodes/factories/NodeFactory');
const AdTriggerNode = require('../../src/nodes/implementations/AdTriggerNode');
const TextNode = require('../../src/nodes/implementations/TextNode');

describe('NodeFactory', () => {
  beforeEach(() => {
    // Limpiar el registro antes de cada test
    NodeFactory.registry.clear();
  });

  test('debe registrar un tipo de nodo', () => {
    NodeFactory.register('test', AdTriggerNode);

    expect(NodeFactory.isRegistered('test')).toBe(true);
  });

  test('debe crear nodo del tipo registrado', () => {
    NodeFactory.register('ad_trigger', AdTriggerNode);

    const config = { executionStrategy: {} };
    const node = NodeFactory.create('ad_trigger', config);

    expect(node).toBeInstanceOf(AdTriggerNode);
    expect(node.type).toBe('ad_trigger');
  });

  test('debe lanzar error si tipo no está registrado', () => {
    expect(() => {
      NodeFactory.create('unregistered_type', {});
    }).toThrow('Tipo de nodo no registrado');
  });

  test('debe inyectar dependencias al crear nodo', () => {
    const mockService = { name: 'mock' };
    NodeFactory.register('test', TextNode, { mockService });

    const node = NodeFactory.create('test', {});

    expect(node.mockService).toEqual(mockService);
  });

  test('debe retornar todos los tipos registrados', () => {
    NodeFactory.register('ad_trigger', AdTriggerNode);
    NodeFactory.register('text', TextNode);

    const types = NodeFactory.getRegisteredTypes();

    expect(types).toContain('ad_trigger');
    expect(types).toContain('text');
    expect(types.length).toBe(2);
  });

  test('debe verificar si tipo está registrado', () => {
    NodeFactory.register('ad_trigger', AdTriggerNode);

    expect(NodeFactory.isRegistered('ad_trigger')).toBe(true);
    expect(NodeFactory.isRegistered('nonexistent')).toBe(false);
  });
});
