const langGraphService = require('../src/services/langGraph.service.js');
const { state } = require('../src/shared.js');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

async function test() {
  console.log('Testing processConversation...');
  const customerProfile = { bot_state: 'unknown', funnel_stage: 'ONBOARDING' };
  try {
    const result = await langGraphService.processConversation('123456789', 'Hola', customerProfile, null);
    console.log('SUCCESS:', result);
  } catch (err) {
    console.error('CAUGHT ERROR:', err);
  }
  process.exit(0);
}
test();
