const ReceiveMessageUseCase = require('./src/use-cases/ReceiveMessageUseCase');
const MessageGateway = require('./src/use-cases/contracts/MessageGateway');
const DatabaseGateway = require('./src/use-cases/contracts/DatabaseGateway');
const AiGateway = require('./src/use-cases/contracts/AiGateway');

// Mock Gateways (Implementando las interfaces para el Test)
class MockMessageGateway extends MessageGateway {
  async getUserProfile(id) { return { name: 'TestUser', profile_pic: 'url' }; }
  async sendMessage(id, text) { console.log(`[MockMeta] 📤 Enviando mensaje a ${id}: "${text}"`); }
}

class MockDbGateway extends DatabaseGateway {
  async getCustomerByInstagramId(id) { 
    return id === 'new_user' ? null : { instagram_id: id, name: 'TestUser', bot_paused: false, bot_state: 'active' }; 
  }
  async createCustomer(data) {
    console.log(`[MockDB] 💾 Creado cliente: ${data.instagram_id}`);
    return data;
  }
  async logMessage(senderId, direction, type, text) {
    console.log(`[MockDB] 📝 Log: ${direction} - ${type} - "${text}"`);
  }
}

class MockAiGateway extends AiGateway {
  removeAccents(text) { return text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  async detectIntentWithAI() { return null; } // Simulamos que no detecta nada
}

class MockProcessFlowUseCase {
  async execute({ steps, senderName }) { console.log(`[MockFlow] ⚡ Ejecutando flujo para ${senderName} con ${steps.length} pasos.`); }
}

const flowsConfig = {
  welcomeFlow: { steps: [{ message: 'Welcome!' }] },
  flows: [{ id: 'flow_1', keywords: ['hola'], matchType: 'exact', steps: [{ message: 'Hola a ti tambien' }] }]
};

async function runTest() {
  console.log('\n--- TEST: USE CASE (Usuario Existente con Flow Match) ---');
  const useCase = new ReceiveMessageUseCase({
    messageGateway: new MockMessageGateway(),
    dbGateway: new MockDbGateway(),
    aiGateway: new MockAiGateway(),
    processFlowUseCase: new MockProcessFlowUseCase(),
    flowsConfig
  });

  await useCase.execute({ senderId: '123', text: 'hola' });

  console.log('\n--- TEST: USE CASE (Usuario Nuevo -> Welcome Flow) ---');
  await useCase.execute({ senderId: 'new_user', text: 'quisiera info' });
}

runTest().catch(console.error);
