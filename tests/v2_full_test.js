'use strict';

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const http = require('http');

console.log('═══════════════════════════════════════════════════════════════');
console.log('🧪 INICIANDO BATERÍA DE PRUEBAS LOCALES (v2-messaging)');
console.log('═══════════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

function assert(condition, testName, errorMsg = '') {
  if (condition) {
    console.log(`  ✅ [PASÓ] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FALLÓ] ${testName} - ${errorMsg}`);
    failed++;
  }
}

async function runTests() {
  // ── 1. Validación de Entorno ──────────────────────────────────────────────
  console.log('1️⃣  Probando módulo de configuración y variables de entorno...');
  try {
    const { validateEnv } = require('../src/config/env');
    validateEnv();
    assert(process.env.VERIFY_TOKEN || process.env.WEBHOOK_VERIFY_TOKEN, 'Token de verificación de webhook detectado');
    assert(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, 'URL de Supabase detectada');
    assert(process.env.PAGE_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN, 'Token de Meta detectado');
  } catch (err) {
    assert(false, 'Validación de entorno', err.message);
  }

  // ── 2. Capa de Base de Datos (Supabase) ───────────────────────────────────
  console.log('\n2️⃣  Probando consultas a la Base de Datos en la nube (Supabase)...');
  const db = require('../src/config/supabase');
  let firstConvId = null;
  try {
    const chats = await db.getChats();
    assert(Array.isArray(chats), `getChats() retorna un array (Total: ${chats.length} conversaciones)`);
    if (chats.length > 0) {
      firstConvId = chats[0].conv_id;
      assert(chats[0].conv_id && chats[0].contact_id, 'Los objetos de chat tienen campos clave conv_id y contact_id');
    }
  } catch (err) {
    assert(false, 'Consulta getChats()', err.message);
  }

  if (firstConvId) {
    try {
      const msgs = await db.getMessages(firstConvId, 5);
      assert(Array.isArray(msgs), `getMessages() retorna mensajes para el chat ${firstConvId} (Total obtenidos: ${msgs.length})`);
    } catch (err) {
      assert(false, `Consulta getMessages(${firstConvId})`, err.message);
    }
  }

  // ── 3. Capa de Controladores REST ─────────────────────────────────────────
  console.log('\n3️⃣  Probando Controladores REST simulando peticiones Express...');
  const apiController = require('../src/controllers/apiController');
  await new Promise(resolve => {
    const req = {};
    const res = {
      json: (data) => {
        assert(Array.isArray(data), 'apiController.listChats responde con JSON válido');
        resolve();
      },
      status: (code) => {
        return { json: (err) => { assert(false, 'apiController.listChats', JSON.stringify(err)); resolve(); } };
      }
    };
    apiController.listChats(req, res);
  });

  // ── 4. Capa de Webhook (Meta Verificación) ────────────────────────────────
  console.log('\n4️⃣  Probando Controlador Webhook (Verificación GET y recepción POST)...');
  const webhookController = require('../src/controllers/webhookController');
  
  // Prueba de verificación GET correcta
  const expectedToken = process.env.VERIFY_TOKEN || process.env.WEBHOOK_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN;
  let getPassed = false;
  const reqGet = {
    query: {
      'hub.mode': 'subscribe',
      'hub.verify_token': expectedToken,
      'hub.challenge': 'CHALLENGE_12345'
    }
  };
  const resGet = {
    status: (code) => {
      return {
        send: (text) => {
          if (code === 200 && text === 'CHALLENGE_12345') getPassed = true;
        }
      };
    }
  };
  webhookController.verify(reqGet, resGet);
  assert(getPassed, 'webhookController.verify() aprueba token correcto y devuelve challenge');

  // Prueba de recepción POST inmediata (200 OK)
  let postPassed = false;
  const reqPost = {
    body: {
      object: 'instagram',
      entry: [{
        id: '00000',
        time: Date.now(),
        messaging: [{
          sender: { id: '999999999999' },
          recipient: { id: 'test_page_id' },
          timestamp: Date.now(),
          message: { mid: 'mid_test_99999', text: '[PRUEBA LOCAL] Mensaje de test' }
        }]
      }]
    }
  };
  const resPost = {
    sendStatus: (code) => {
      if (code === 200) postPassed = true;
    }
  };
  webhookController.receive(reqPost, resPost);
  assert(postPassed, 'webhookController.receive() responde 200 OK instantáneamente (evita timeouts)');

  // Esperar a que setImmediate termine y procese el evento en Supabase
  await new Promise(r => setTimeout(r, 1500));
  const testContact = await db.getContact('999999999999');
  assert(testContact !== null, 'El contacto temporal fue creado automáticamente por el motor de chat');
  const testMsgs = await db.getMessages('conv_999999999999', 1);
  assert(testMsgs.length > 0 && testMsgs[0].text.includes('[PRUEBA LOCAL]'), 'El mensaje del webhook fue guardado exitosamente en Supabase');

  // ── 5. Servidor HTTP Real en Puerto de Prueba ─────────────────────────────
  console.log('\n5️⃣  Probando Servidor Express HTTP en puerto temporal...');
  const app = require('../server');
  await new Promise(resolve => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', async () => {
      const port = server.address().port;
      assert(port > 0, `Servidor Express montado en puerto de prueba local ${port}`);

      // Petición HTTP real a /
      try {
        const resHtml = await fetch(`http://127.0.0.1:${port}/`);
        assert(resHtml.status === 200, `HTTP GET / (Frontend CRM HTML) responde 200 OK`);
      } catch (err) {
        assert(false, 'HTTP GET /', err.message);
      }

      // Petición HTTP real a /api/chats
      try {
        const resApi = await fetch(`http://127.0.0.1:${port}/api/chats`);
        const data = await resApi.json();
        assert(resApi.status === 200 && Array.isArray(data), `HTTP GET /api/chats responde 200 OK con ${data.length} conversaciones`);
      } catch (err) {
        assert(false, 'HTTP GET /api/chats', err.message);
      }

      server.close(() => {
        assert(true, 'Servidor de prueba cerrado limpiamente');
        resolve();
      });
    });
  });

  // ── 6. Limpieza de Datos de Prueba en Supabase ────────────────────────────
  console.log('\n6️⃣  Limpiando registros temporales de prueba en la base de datos...');
  try {
    const { createClient } = require('@supabase/supabase-js');
    const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    await s.from('messages').delete().eq('sender_id', '999999999999');
    await s.from('conversations').delete().eq('contact_id', '999999999999');
    await s.from('contacts').delete().eq('id', '999999999999');
    assert(true, 'Limpieza de base de datos exitosa');
  } catch (err) {
    assert(false, 'Limpieza de DB', err.message);
  }

  // ── Resumen Final ─────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`📊 RESULTADO FINAL: ${passed} pasaron | ${failed} fallaron`);
  console.log('═══════════════════════════════════════════════════════════════');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Error fatal durante las pruebas:', err);
  process.exit(1);
});
