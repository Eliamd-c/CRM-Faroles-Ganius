const AdTriggerNode = require('../../src/nodes/implementations/AdTriggerNode');
const MockAdTriggerStrategy = require('../mocks/MockAdTriggerStrategy');

describe('AdTriggerNode', () => {
  let node;
  let mockStrategy;

  beforeEach(() => {
    mockStrategy = new MockAdTriggerStrategy();
    node = new AdTriggerNode({
      executionStrategy: mockStrategy
    });
  });

  describe('Validación de mensaje', () => {
    test('debe validar mensaje requerido', () => {
      const step = {
        type: 'ad_trigger',
        quick_replies: [{ title: 'Btn', payload: 'P1' }]
        // falta: message
      };

      expect(() => node.validate(step)).toThrow('message');
    });

    test('debe validar que mensaje no esté vacío', () => {
      const step = {
        type: 'ad_trigger',
        message: '   ',
        quick_replies: [{ title: 'Btn', payload: 'P1' }]
      };

      expect(() => node.validate(step)).toThrow('vacío');
    });

    test('debe rechazar variables en mensaje', () => {
      const step = {
        type: 'ad_trigger',
        message: 'Hola {username}',
        quick_replies: [{ title: 'Btn', payload: 'P1' }]
      };

      expect(() => node.validate(step)).toThrow('variables');
    });

    test('debe rechazar variables con {{}}', () => {
      const step = {
        type: 'ad_trigger',
        message: 'Hola {{name}}',
        quick_replies: [{ title: 'Btn', payload: 'P1' }]
      };

      expect(() => node.validate(step)).toThrow('variables');
    });

    test('debe aceptar mensaje válido', () => {
      const step = {
        type: 'ad_trigger',
        message: 'Mensaje de prueba',
        quick_replies: [{ title: 'Btn', payload: 'P1' }]
      };

      expect(() => node.validate(step)).not.toThrow();
    });
  });

  describe('Validación de botones', () => {
    test('debe validar quick_replies es array', () => {
      const step = {
        type: 'ad_trigger',
        message: 'Test',
        quick_replies: 'not an array'
      };

      expect(() => node.validate(step)).toThrow('array');
    });

    test('debe validar al menos 1 botón', () => {
      const step = {
        type: 'ad_trigger',
        message: 'Test',
        quick_replies: []
      };

      expect(() => node.validate(step)).toThrow('1 botón');
    });

    test('debe validar máximo 13 botones', () => {
      const buttons = Array.from({ length: 14 }, (_, i) => ({
        title: `Btn ${i}`,
        payload: `P${i}`
      }));

      const step = {
        type: 'ad_trigger',
        message: 'Test',
        quick_replies: buttons
      };

      expect(() => node.validate(step)).toThrow('13');
    });

    test('debe validar estructura de cada botón', () => {
      const step = {
        type: 'ad_trigger',
        message: 'Test',
        quick_replies: [
          { title: 'Btn1', payload: 'P1' },
          { title: 'Btn2' } // falta payload
        ]
      };

      expect(() => node.validate(step)).toThrow('payload');
    });

    test('debe validar longitud máxima de título (20 caracteres)', () => {
      const step = {
        type: 'ad_trigger',
        message: 'Test',
        quick_replies: [
          { title: 'Este es un título muy largo que excede 20 caracteres', payload: 'P1' }
        ]
      };

      expect(() => node.validate(step)).toThrow('20 caracteres');
    });

    test('debe aceptar 13 botones válidos', () => {
      const buttons = Array.from({ length: 13 }, (_, i) => ({
        title: `Opción ${i + 1}`,
        payload: `OPT${i + 1}`
      }));

      const step = {
        type: 'ad_trigger',
        message: 'Selecciona una opción',
        quick_replies: buttons
      };

      expect(() => node.validate(step)).not.toThrow();
    });
  });

  describe('Ejecución', () => {
    test('debe ejecutar strategy correctamente', async () => {
      const step = {
        type: 'ad_trigger',
        message: 'Mensaje de prueba',
        quick_replies: [
          { title: 'Opción 1', payload: 'OPT1' },
          { title: 'Opción 2', payload: 'OPT2' }
        ]
      };

      const context = { accessToken: 'test_token' };
      await node.execute(step, context);

      expect(mockStrategy.executeCalled).toBe(true);
      expect(mockStrategy.lastStep).toBe(step);
    });

    test('debe marcar que crea Welcome Flow', () => {
      expect(node.createsWelcomeFlow()).toBe(true);
    });

    test('debe marcar que solo puede ser primer nodo', () => {
      expect(node.isFirstNodeOnly()).toBe(true);
    });
  });

  describe('Validación de tipo', () => {
    test('debe validar que el tipo sea ad_trigger', () => {
      const step = {
        type: 'text', // tipo incorrecto
        message: 'Test',
        quick_replies: [{ title: 'Btn', payload: 'P1' }]
      };

      expect(() => node.validate(step)).toThrow('Tipo de paso incorrecto');
    });
  });

  describe('Integración completa', () => {
    test('debe ejecutar flujo completo sin errores', async () => {
      const step = {
        type: 'ad_trigger',
        message: 'Bienvenido a nuestro anuncio',
        quick_replies: [
          { title: 'Sí', payload: 'YES' },
          { title: 'No', payload: 'NO' },
          { title: 'Más info', payload: 'INFO' }
        ],
        flowName: 'Ad Flow 1',
        linkedFlowId: 'flow_123'
      };

      const context = {
        accessToken: 'test_token',
        trackExecution: true,
        executionLog: []
      };

      await expect(node.execute(step, context)).resolves.toBeDefined();
    });
  });
});
