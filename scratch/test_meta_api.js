const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });
const meta = require('../src/services/meta.service');
const { state } = require('../src/shared');

async function testSend() {
  state.ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;
  console.log('Usando token:', state.ACCESS_TOKEN.substring(0, 15) + '...');
  
  try {
    await meta.sendMessage('23924681817177804', 'Hola, este es un mensaje de prueba local.');
    console.log('Mensaje enviado con éxito');
  } catch (err) {
    console.error('Fallo al enviar:', err);
  }
}

testSend();
