const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const { state, broadcastLog } = require('../src/shared');
const supabase = require('../db');
const bootstrap = require('../src/infrastructure/bootstrap');

async function runLocalTest() {
  console.log('🔄 Inicializando dependencias...');
  state.ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;
  state.INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID || '123456789';

  const di = bootstrap({
    state,
    flowsConfig: state.flowsConfig,
    supabaseClient: supabase,
    broadcastLog,
    recentReplies: state.recentReplies
  });

  const mockPayload = {
    senderId: '999999999999999', // NUEVO ID
    text: 'Hola necesito ayuda',
    storyMention: false,
    hasAttachments: false,
    event: {
      sender: { id: '999999999999999' },
      message: { text: 'Hola necesito ayuda', mid: 'mid.1234567890' }
    }
  };

  console.log('📨 Simulando recepción de webhook (texto: "Hola necesito ayuda")...');
  try {
    const result = await di.handleMessage.execute(mockPayload);
    console.log('✅ Resultado de la ejecución:', result);
  } catch (err) {
    console.error('❌ Error en el Use Case:', err);
  }

  process.exit(0);
}

runLocalTest();
