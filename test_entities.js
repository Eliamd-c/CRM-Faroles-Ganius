const Contact = require('./src/domain/entities/Contact');
const Message = require('./src/domain/entities/Message');
const FlowRule = require('./src/domain/entities/FlowRule');

console.log('--- TEST: ENTITIES ---');

try {
  const contact = new Contact({ id: '12345', name: 'Eliam' });
  console.log('✅ Contact creado:', contact);
  console.log('✅ canReceiveAutomatedMessages:', contact.canReceiveAutomatedMessages());
  contact.disableBot();
  console.log('✅ Después de disableBot() canReceiveAutomatedMessages:', contact.canReceiveAutomatedMessages());

  const msg = new Message({ senderId: '12345', receiverId: 'me', text: 'hola' });
  console.log('✅ Message creado:', msg);
  console.log('✅ isEmpty:', msg.isEmpty());

  const rule = new FlowRule({ keywords: ['hola', 'buenos dias'], flowId: 'flow_1' });
  console.log('✅ FlowRule match "Hola":', rule.matches('HOLA'));
  console.log('✅ FlowRule match "adios":', rule.matches('adios'));
} catch (e) {
  console.error('❌ Error en test de entidades:', e.message);
}
