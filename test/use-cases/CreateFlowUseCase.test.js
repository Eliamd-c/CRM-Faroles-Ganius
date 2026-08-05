const CreateFlowUseCase = require('../../src/use-cases/CreateFlowUseCase');

describe('CreateFlowUseCase - Ad Trigger Support', () => {
  let useCase;
  let mockRepository;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn().mockResolvedValue({
        id: 'flow_123',
        name: 'Test Flow',
        steps: []
      })
    };

    useCase = new CreateFlowUseCase({ flowRepository: mockRepository });
  });

  describe('Ad Trigger Flow Creation', () => {
    test('debe marcar flow como ad flow si primer paso es ad_trigger', async () => {
      const input = {
        name: 'Ad Campaign Flow',
        keywords: [],
        steps: [
          {
            type: 'ad_trigger',
            message: 'Welcome message',
            quick_replies: [
              { title: 'Yes', payload: 'YES' },
              { title: 'No', payload: 'NO' }
            ]
          }
        ]
      };

      const result = await useCase.execute(input);

      expect(result.isAdFlow).toBe(true);
      expect(result.message).toContain('Flujo de anuncio');
    });

    test('debe no marcar como ad flow si ad_trigger no es primer paso', async () => {
      const input = {
        name: 'Regular Flow',
        keywords: [],
        steps: [
          {
            type: 'text',
            message: 'Welcome'
          },
          {
            type: 'ad_trigger',
            message: 'Ad message',
            quick_replies: [{ title: 'Ok', payload: 'OK' }]
          }
        ]
      };

      expect(() => useCase.execute(input))
        .rejects
        .toThrow('Ad Trigger debe ser el primer paso');
    });
  });

  describe('Ad Trigger Validation', () => {
    test('debe validar que message sea requerido', async () => {
      const input = {
        name: 'Invalid Ad Flow',
        keywords: [],
        steps: [
          {
            type: 'ad_trigger',
            quick_replies: [{ title: 'Ok', payload: 'OK' }]
            // falta message
          }
        ]
      };

      expect(() => useCase.execute(input))
        .rejects
        .toThrow('ad_trigger requiere "message"');
    });

    test('debe validar que quick_replies sea requerido', async () => {
      const input = {
        name: 'Invalid Ad Flow',
        keywords: [],
        steps: [
          {
            type: 'ad_trigger',
            message: 'Welcome'
            // falta quick_replies
          }
        ]
      };

      expect(() => useCase.execute(input))
        .rejects
        .toThrow('ad_trigger requiere "quick_replies"');
    });

    test('debe validar al menos 1 botón', async () => {
      const input = {
        name: 'Invalid Ad Flow',
        keywords: [],
        steps: [
          {
            type: 'ad_trigger',
            message: 'Welcome',
            quick_replies: []
          }
        ]
      };

      expect(() => useCase.execute(input))
        .rejects
        .toThrow('requiere al menos 1 botón');
    });

    test('debe validar máximo 13 botones', async () => {
      const buttons = Array.from({ length: 14 }, (_, i) => ({
        title: `Btn ${i}`,
        payload: `P${i}`
      }));

      const input = {
        name: 'Invalid Ad Flow',
        keywords: [],
        steps: [
          {
            type: 'ad_trigger',
            message: 'Welcome',
            quick_replies: buttons
          }
        ]
      };

      expect(() => useCase.execute(input))
        .rejects
        .toThrow('máximo 13 botones');
    });

    test('debe rechazar variables en mensaje', async () => {
      const input = {
        name: 'Invalid Ad Flow',
        keywords: [],
        steps: [
          {
            type: 'ad_trigger',
            message: 'Hola {username}',
            quick_replies: [{ title: 'Ok', payload: 'OK' }]
          }
        ]
      };

      expect(() => useCase.execute(input))
        .rejects
        .toThrow('no permite variables');
    });

    test('debe aceptar ad_trigger válido', async () => {
      const input = {
        name: 'Valid Ad Flow',
        keywords: ['ad'],
        steps: [
          {
            type: 'ad_trigger',
            message: 'Welcome to our campaign',
            quick_replies: [
              { title: 'Interested', payload: 'INTEREST' },
              { title: 'Not now', payload: 'LATER' }
            ]
          }
        ]
      };

      const result = await useCase.execute(input);

      expect(result.status).toBe('success');
      expect(result.isAdFlow).toBe(true);
      expect(mockRepository.create).toHaveBeenCalled();
    });
  });

  describe('Backward Compatibility', () => {
    test('debe seguir soportando flujos sin ad_trigger', async () => {
      const input = {
        name: 'Regular Flow',
        keywords: ['hello'],
        steps: [
          {
            type: 'text',
            message: 'Hello'
          },
          {
            type: 'buttons',
            message: 'Choose an option',
            buttons: [{ title: 'Option 1', payload: 'OPT1' }]
          }
        ]
      };

      const result = await useCase.execute(input);

      expect(result.status).toBe('success');
      expect(result.isAdFlow).toBe(false);
    });

    test('debe validar otros tipos de paso normalmente', async () => {
      const input = {
        name: 'Flow with Condition',
        keywords: [],
        steps: [
          {
            type: 'condition'
            // falta field
          }
        ]
      };

      expect(() => useCase.execute(input))
        .rejects
        .toThrow('condition requiere "field"');
    });
  });
});
