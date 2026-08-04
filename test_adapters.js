const WebhookController = require('./src/adapters/controllers/WebhookController');

// Simulación de req y res de Express
const mockReq = {
  body: {
    object: 'instagram',
    entry: [{
      messaging: [{
        sender: { id: '9876' },
        message: { text: 'quiero comprar' }
      }]
    }]
  }
};

const mockRes = {
  status: (code) => ({ send: (msg) => console.log(`[Express] Status ${code}: ${msg}`) }),
  sendStatus: (code) => console.log(`[Express] Send Status: ${code}`)
};

// Mock Use Case
class MockReceiveMessageUseCase {
  async execute(inputData) {
    console.log(`[UseCase] Recibido DTO con senderId: ${inputData.senderId}, text: "${inputData.text}"`);
  }
}

console.log('--- TEST: INTERFACE ADAPTERS ---');
const controller = new WebhookController(new MockReceiveMessageUseCase());
controller.handlePost(mockReq, mockRes).catch(console.error);
