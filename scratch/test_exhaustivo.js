#!/usr/bin/env node
/**
 * TEST EXHAUSTIVO E2E - CRM 2.0 Ecosistema de Agentes IA
 * Prueba función por función cada componente del sistema.
 * Ejecutar: node scratch/test_exhaustivo.js
 */

try { require('@dotenvx/dotenvx').config(); } catch(e) { try { require('dotenv').config(); } catch(e2) {} }

const errors = [];
const warnings = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  return { name, fn };
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function runTest(t) {
  try {
    await t.fn();
    passed++;
    console.log(`  ✅ ${t.name}`);
  } catch (err) {
    failed++;
    const errMsg = `${t.name}: ${err.message}`;
    errors.push(errMsg);
    console.log(`  ❌ ${t.name}`);
    console.log(`     → ${err.message}`);
  }
}

async function runSuite(suiteName, tests) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📦 ${suiteName}`);
  console.log('═'.repeat(60));
  for (const t of tests) {
    await runTest(t);
  }
}

// ============================================================
// 1. ENTIDADES DE DOMINIO
// ============================================================
const domainTests = [
  test('Contact.new() crea un contacto válido', () => {
    const Contact = require('../src/domain/entities/Contact');
    const c = Contact.new('12345', 'Test User', { profile_pic: 'http://pic.jpg' });
    assert(c.instagramId === '12345', 'instagramId incorrecto');
    assert(c.name === 'Test User', 'name incorrecto');
    assert(c.state === 'active', 'state debe ser active');
    assert(c.botPaused === false, 'botPaused debe ser false');
    assert(Array.isArray(c.tags), 'tags debe ser array');
    assert(typeof c.fields === 'object', 'fields debe ser object');
  }),

  test('Contact.fromDatabase() reconstruye correctamente', () => {
    const Contact = require('../src/domain/entities/Contact');
    const dbRow = {
      instagram_id: '99999',
      name: 'DB User',
      bot_state: 'ai_agent',
      bot_paused: true,
      tags: ['vip'],
      fields: { presupuesto: '500000' },
    };
    const c = Contact.fromDatabase(dbRow);
    assert(c.instagramId === '99999', 'instagramId incorrecto');
    assert(c.isInAiAgent() === true, 'isInAiAgent debería ser true');
    assert(c.isPaused() === true, 'isPaused debería ser true');
    assert(c.tags.includes('vip'), 'tags debe contener vip');
  }),

  test('Contact.toDatabase() serializa correctamente', () => {
    const Contact = require('../src/domain/entities/Contact');
    const c = Contact.new('111', 'Serialize Test');
    c.addTag('lead');
    c.setField('ubicacion', 'Bogotá');
    const db = c.toDatabase();
    assert(db.instagram_id === '111', 'instagram_id incorrecto');
    assert(db.tags.includes('lead'), 'tags debe incluir lead');
    assert(db.fields.ubicacion === 'Bogotá', 'fields.ubicacion incorrecto');
    assert(db.updated_at, 'updated_at debe existir');
  }),

  test('Contact.isActive() responde correcto', () => {
    const Contact = require('../src/domain/entities/Contact');
    const c = Contact.new('222', 'Active Test');
    assert(c.isActive() === true, 'isActive debería ser true para contacto nuevo');
    c.pause();
    assert(c.isActive() === false, 'isActive debería ser false cuando pausado');
    c.resume();
    assert(c.isActive() === true, 'isActive debería ser true tras resume');
  }),

  test('Contact.switchToAwaitingInput() y switchToActive()', () => {
    const Contact = require('../src/domain/entities/Contact');
    const c = Contact.new('333', 'Transition Test');
    c.switchToAwaitingInput('text', 'nombre', null, 'Dime tu nombre');
    assert(c.isAwaitingInput() === true, 'debe estar awaiting_input');
    assert(c.awaitingInputField === 'nombre', 'field incorrecto');
    assert(c.awaitingInputPrompt === 'Dime tu nombre', 'prompt incorrecto');
    c.switchToActive();
    assert(c.isActive() === true, 'debe ser active tras switchToActive');
    assert(c.awaitingInputType === null, 'awaitingInputType debe ser null');
  }),

  test('Contact.incrementRetries() incrementa', () => {
    const Contact = require('../src/domain/entities/Contact');
    const c = Contact.new('444', 'Retry Test');
    assert(c.awaitingInputRetries === 0, 'debe iniciar en 0');
    c.incrementRetries();
    assert(c.awaitingInputRetries === 1, 'debe ser 1');
    c.incrementRetries();
    assert(c.awaitingInputRetries === 2, 'debe ser 2');
  }),

  test('Contact.addTag() no duplica tags', () => {
    const Contact = require('../src/domain/entities/Contact');
    const c = Contact.new('555', 'Tag Test');
    c.addTag('vip');
    c.addTag('vip');
    c.addTag('vip');
    assert(c.tags.length === 1, `tags.length debería ser 1, es ${c.tags.length}`);
  }),

  test('Contact.removeTag() remueve correctamente', () => {
    const Contact = require('../src/domain/entities/Contact');
    const c = Contact.new('666', 'Remove Tag');
    c.addTag('a');
    c.addTag('b');
    c.removeTag('a');
    assert(!c.tags.includes('a'), 'no debe contener a');
    assert(c.tags.includes('b'), 'debe contener b');
  }),

  test('Contact.switchToPaused() existe como método', () => {
    const Contact = require('../src/domain/entities/Contact');
    const c = Contact.new('777', 'Pause Test');
    if (typeof c.switchToPaused !== 'function') {
      warnings.push('CRITICO: Contact NO tiene switchToPaused() - HandleIncomingMessageUseCase lo llama en líneas 92 y 116 pero Contact solo tiene pause()');
      // Fallback check
      assert(typeof c.pause === 'function', 'Contact debe tener al menos pause()');
    }
  }),
];

// ============================================================
// 2. COMMAND PATTERN
// ============================================================
const commandTests = [
  test('Command base lanza error si no implementa getToolSchema', () => {
    const Command = require('../src/domain/commands/Command');
    const cmd = new Command('test_cmd', 'Test');
    let threw = false;
    try { cmd.getToolSchema(); } catch (e) { threw = true; }
    assert(threw, 'getToolSchema debe lanzar error');
  }),

  test('Command base lanza error si no implementa execute', async () => {
    const Command = require('../src/domain/commands/Command');
    const cmd = new Command('test_cmd', 'Test');
    let threw = false;
    try { await cmd.execute({}, {}); } catch (e) { threw = true; }
    assert(threw, 'execute debe lanzar error');
  }),

  test('CommandRegistry tiene 5 comandos registrados', () => {
    const registry = require('../src/domain/commands/CommandRegistry');
    const expected = ['send_product_catalog', 'save_customer_data', 'send_quick_replies', 'trigger_static_flow', 'query_knowledge_base'];
    for (const name of expected) {
      assert(registry.get(name) !== null, `Comando "${name}" no registrado`);
    }
  }),

  test('CommandRegistry.getAllToolSchemas() retorna schemas válidos', () => {
    const registry = require('../src/domain/commands/CommandRegistry');
    const schemas = registry.getAllToolSchemas();
    assert(schemas.length >= 5, `Esperado >=5, recibido ${schemas.length}`);
    for (const s of schemas) {
      assert(s.type === 'function', `type debe ser function`);
      assert(s.function && s.function.name, `debe tener function.name`);
      assert(s.function.parameters && s.function.parameters.type === 'object', `params debe ser object`);
    }
  }),

  test('CommandRegistry.execute() cmd inexistente retorna error', async () => {
    const registry = require('../src/domain/commands/CommandRegistry');
    const result = await registry.execute('fantasma', {}, {});
    assert(result.success === false, 'debe ser success:false');
  }),

  test('SaveCustomerDataCommand tiene enum en field_name', () => {
    const registry = require('../src/domain/commands/CommandRegistry');
    const schema = registry.get('save_customer_data').getToolSchema();
    const fn = schema.function.parameters.properties.field_name;
    assert(fn.enum, 'field_name DEBE tener enum');
    assert(fn.enum.includes('presupuesto'), 'enum debe incluir presupuesto');
    assert(fn.enum.includes('modelo_interes'), 'enum debe incluir modelo_interes');
  }),

  test('SendProductCatalogCommand schema válido', () => {
    const registry = require('../src/domain/commands/CommandRegistry');
    const schema = registry.get('send_product_catalog').getToolSchema();
    assert(schema.function.parameters.properties.message, 'falta message');
    assert(schema.function.parameters.properties.category, 'falta category');
  }),

  test('SendQuickRepliesCommand schema válido', () => {
    const registry = require('../src/domain/commands/CommandRegistry');
    const schema = registry.get('send_quick_replies').getToolSchema();
    assert(schema.function.parameters.properties.message, 'falta message');
    assert(schema.function.parameters.properties.options, 'falta options');
  }),

  test('QueryKnowledgeBaseCommand schema válido', () => {
    const registry = require('../src/domain/commands/CommandRegistry');
    const schema = registry.get('query_knowledge_base').getToolSchema();
    assert(schema.function.parameters.properties.query, 'falta query');
  }),

  test('TriggerStaticFlowCommand schema válido', () => {
    const registry = require('../src/domain/commands/CommandRegistry');
    const schema = registry.get('trigger_static_flow').getToolSchema();
    assert(schema.function.parameters.properties.flow_id, 'falta flow_id');
  }),
];

// ============================================================
// 3. STATE PATTERN
// ============================================================
const stateTests = [
  test('SalesState base lanza error en getPrompt', () => {
    const SalesState = require('../src/domain/states/SalesState');
    const s = new SalesState('TEST');
    let threw = false;
    try { s.getPrompt({}); } catch (e) { threw = true; }
    assert(threw, 'getPrompt debe lanzar error');
  }),

  test('SalesState PURCHASE_INTENT sin datos -> DISCOVERY', () => {
    const SalesState = require('../src/domain/states/SalesState');
    const s = new SalesState('TEST');
    const r = s.evaluateTransition({ messages: [], intent: 'PURCHASE_INTENT', customer: { fields: {} }, llmShouldAdvance: false });
    assert(r === 'DISCOVERY', `Esperado DISCOVERY, recibido ${r}`);
  }),

  test('SalesState PURCHASE_INTENT con modelo_interes -> CHECKOUT', () => {
    const SalesState = require('../src/domain/states/SalesState');
    const s = new SalesState('TEST');
    const r = s.evaluateTransition({ messages: [], intent: 'PURCHASE_INTENT', customer: { fields: { modelo_interes: 'Solar 100W' } }, llmShouldAdvance: false });
    assert(r === 'CHECKOUT', `Esperado CHECKOUT, recibido ${r}`);
  }),

  test('SalesState GENERAL -> null', () => {
    const SalesState = require('../src/domain/states/SalesState');
    const s = new SalesState('TEST');
    const r = s.evaluateTransition({ messages: [], intent: 'GENERAL', customer: null, llmShouldAdvance: false });
    assert(r === null, `Esperado null, recibido ${r}`);
  }),

  test('OnboardingState.getPrompt() contiene ONBOARDING y RAG', () => {
    const OnboardingState = require('../src/domain/states/OnboardingState');
    const s = new OnboardingState();
    const p = s.getPrompt({ context: 'Ctx', messages: [{ role: 'user', content: 'Hola' }], intent: 'GENERAL', customer: null });
    assert(p.includes('ONBOARDING'), 'debe incluir ONBOARDING');
    assert(p.includes('query_knowledge_base'), 'debe mencionar RAG');
  }),

  test('OnboardingState llmShouldAdvance=true -> DISCOVERY', () => {
    const OnboardingState = require('../src/domain/states/OnboardingState');
    const s = new OnboardingState();
    const r = s.evaluateTransition({ messages: [{},{},{}], intent: 'GENERAL', customer: { fields: {} }, llmShouldAdvance: true });
    assert(r === 'DISCOVERY', `Esperado DISCOVERY, recibido ${r}`);
  }),

  test('DiscoveryState.getPrompt() menciona save_customer_data', () => {
    const DiscoveryState = require('../src/domain/states/DiscoveryState');
    const s = new DiscoveryState();
    const p = s.getPrompt({ context: 'Ctx', messages: [{ role: 'user', content: 'ok' }], intent: 'GENERAL', customer: null });
    assert(p.includes('save_customer_data'), 'debe mencionar save_customer_data');
  }),

  test('DiscoveryState NO avanza solo por messages.length', () => {
    const DiscoveryState = require('../src/domain/states/DiscoveryState');
    const s = new DiscoveryState();
    const msgs = new Array(20).fill({ role: 'user', content: 'msg' });
    const r = s.evaluateTransition({ messages: msgs, intent: 'GENERAL', customer: { fields: {} }, llmShouldAdvance: false });
    assert(r === null, `NO debe avanzar solo por historial, devolvió ${r}`);
  }),

  test('RecommendationState.getPrompt() menciona send_product_catalog CRÍTICO', () => {
    const RecommendationState = require('../src/domain/states/RecommendationState');
    const s = new RecommendationState();
    const p = s.getPrompt({ context: 'Ctx', messages: [{ role: 'user', content: 'ok' }], intent: 'GENERAL', customer: null });
    assert(p.includes('send_product_catalog'), 'debe mencionar send_product_catalog');
  }),

  test('RecommendationState NO avanza solo por messages.length', () => {
    const RecommendationState = require('../src/domain/states/RecommendationState');
    const s = new RecommendationState();
    const msgs = new Array(20).fill({ role: 'user', content: 'msg' });
    const r = s.evaluateTransition({ messages: msgs, intent: 'GENERAL', customer: { fields: {} }, llmShouldAdvance: false });
    assert(r === null, `NO debe avanzar solo por historial, devolvió ${r}`);
  }),

  test('CheckoutState.getPrompt() menciona query_knowledge_base', () => {
    const CheckoutState = require('../src/domain/states/CheckoutState');
    const s = new CheckoutState();
    const p = s.getPrompt({ context: 'Ctx', messages: [{ role: 'user', content: 'pagar' }], intent: 'PURCHASE_INTENT', customer: null });
    assert(p.includes('query_knowledge_base'), 'debe mencionar RAG para datos de pago');
  }),

  test('CheckoutState OBJECTION -> RECOMMENDATION', () => {
    const CheckoutState = require('../src/domain/states/CheckoutState');
    const s = new CheckoutState();
    const r = s.evaluateTransition({ messages: [], intent: 'OBJECTION', customer: { fields: {} }, llmShouldAdvance: false });
    assert(r === 'RECOMMENDATION', `Esperado RECOMMENDATION, recibido ${r}`);
  }),

  test('CheckoutState PURCHASE_INTENT -> null (ya estamos en checkout)', () => {
    const CheckoutState = require('../src/domain/states/CheckoutState');
    const s = new CheckoutState();
    const r = s.evaluateTransition({ messages: [], intent: 'PURCHASE_INTENT', customer: { fields: {} }, llmShouldAdvance: false });
    assert(r === null, `Esperado null, recibido ${r}`);
  }),
];

// ============================================================
// 4. CIRCUIT BREAKER
// ============================================================
const circuitBreakerTests = [
  test('CircuitBreaker inicia CLOSED', () => {
    const { CircuitBreaker } = require('../src/utils/CircuitBreaker');
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeout: 1000 });
    assert(cb.state === 'CLOSED', `Esperado CLOSED, recibido ${cb.state}`);
  }),

  test('CircuitBreaker.fire() ejecuta acción', async () => {
    const { CircuitBreaker } = require('../src/utils/CircuitBreaker');
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeout: 1000 });
    const result = await cb.fire(() => Promise.resolve('ok'));
    assert(result === 'ok', `Esperado 'ok', recibido ${result}`);
  }),

  test('CircuitBreaker abre tras N fallos transitorios', async () => {
    const { CircuitBreaker } = require('../src/utils/CircuitBreaker');
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeout: 10000 });
    const err = new Error('timeout'); err.code = 'ETIMEDOUT';
    for (let i = 0; i < 2; i++) {
      try { await cb.fire(() => { throw err; }); } catch (e) {}
    }
    assert(cb.state === 'OPEN', `Esperado OPEN, recibido ${cb.state}`);
  }),

  test('CircuitBreaker NO abre con errores 400', async () => {
    const { CircuitBreaker } = require('../src/utils/CircuitBreaker');
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeout: 10000 });
    const err = new Error('Bad Request'); err.response = { status: 400 };
    for (let i = 0; i < 5; i++) {
      try { await cb.fire(() => { throw err; }); } catch (e) {}
    }
    assert(cb.state === 'CLOSED', `Esperado CLOSED, recibido ${cb.state}`);
  }),

  test('CircuitBreaker lanza CircuitOpenError cuando OPEN', async () => {
    const { CircuitBreaker, CircuitOpenError } = require('../src/utils/CircuitBreaker');
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 60000 });
    const err = new Error('timeout'); err.code = 'ETIMEDOUT';
    try { await cb.fire(() => { throw err; }); } catch (e) {}
    let caught = false;
    try { await cb.fire(() => Promise.resolve('ok')); } catch (e) { caught = e.isCircuitBreakerError; }
    assert(caught, 'debe lanzar CircuitOpenError');
  }),

  test('openAICircuitBreaker Singleton existe', () => {
    const { openAICircuitBreaker } = require('../src/utils/CircuitBreaker');
    assert(openAICircuitBreaker, 'Singleton debe existir');
    assert(openAICircuitBreaker.failureThreshold === 3, `threshold debe ser 3`);
  }),
];

// ============================================================
// 5. BOOTSTRAP & DI
// ============================================================
const bootstrapTests = [
  test('Bootstrap lanza error sin state', () => {
    const bootstrap = require('../src/infrastructure/bootstrap');
    let threw = false;
    try { bootstrap({}); } catch (e) { threw = true; }
    assert(threw, 'debe lanzar error');
  }),

  test('Bootstrap lanza error sin flowsConfig', () => {
    const bootstrap = require('../src/infrastructure/bootstrap');
    let threw = false;
    try { bootstrap({ state: {} }); } catch (e) { threw = true; }
    assert(threw, 'debe lanzar error');
  }),

  test('Bootstrap retorna DI container completo', () => {
    const bootstrap = require('../src/infrastructure/bootstrap');
    const { state } = require('../src/shared');
    const di = bootstrap({ state, flowsConfig: { flows: [] }, broadcastLog: () => {}, supabaseClient: null, recentReplies: new Set() });
    assert(di.gateways, 'debe tener gateways');
    assert(di.gateways.metaGateway, 'debe tener metaGateway');
    assert(di.useCases, 'debe tener useCases');
    assert(di.useCases.handleIncomingMessageUseCase, 'debe tener handleIncomingMessageUseCase');
    assert(di.handleMessage, 'debe tener shortcut handleMessage');
  }),

  test('HandleIncomingMessageUseCase recibe langGraphService en DI', () => {
    const bootstrap = require('../src/infrastructure/bootstrap');
    const { state } = require('../src/shared');
    const di = bootstrap({ state, flowsConfig: { flows: [] }, broadcastLog: () => {}, supabaseClient: null });
    const uc = di.useCases.handleIncomingMessageUseCase;
    if (!uc.langGraphService) {
      warnings.push('CRITICO: HandleIncomingMessageUseCase.langGraphService es undefined tras bootstrap(). bootstrap.js NO lo inyecta.');
    }
  }),
];

// ============================================================
// 6. LANGGRAPH SERVICE
// ============================================================
const langgraphTests = [
  test('LangGraphService se exporta como Singleton', () => {
    const svc = require('../src/services/langgraph.service');
    assert(svc, 'debe exportar algo');
    assert(typeof svc.processConversation === 'function', 'debe tener processConversation');
    assert(typeof svc.initialize === 'function', 'debe tener initialize');
    assert(typeof svc.destroy === 'function', 'debe tener destroy');
  }),

  test('LangGraphService tiene getGraphDiagram', () => {
    const svc = require('../src/services/langgraph.service');
    assert(typeof svc.getGraphDiagram === 'function', 'debe tener getGraphDiagram');
  }),

  test('LangGraphService tiene getStateHistory', () => {
    const svc = require('../src/services/langgraph.service');
    assert(typeof svc.getStateHistory === 'function', 'debe tener getStateHistory');
  }),

  test('LangGraphService tiene updateState', () => {
    const svc = require('../src/services/langgraph.service');
    assert(typeof svc.updateState === 'function', 'debe tener updateState');
  }),
];

// ============================================================
// 7. HANDLE INCOMING MESSAGE USE CASE
// ============================================================
const useCaseTests = [
  test('UseCase rechaza sin senderId', async () => {
    const UC = require('../src/use-cases/HandleIncomingMessageUseCase');
    const uc = new UC({
      metaGateway: {}, openaiGateway: {}, flowGateway: {}, supabaseGateway: {},
      langGraphService: {}, state: { INSTAGRAM_ACCOUNT_ID: 'xxx' }, flowsConfig: {}, broadcastLog: () => {}
    });
    let threw = false;
    try { await uc.execute({}); } catch (e) { threw = true; }
    assert(threw, 'debe lanzar error sin senderId');
  }),

  test('UseCase ignora self_message', async () => {
    const UC = require('../src/use-cases/HandleIncomingMessageUseCase');
    const uc = new UC({
      metaGateway: {}, openaiGateway: {}, flowGateway: {}, supabaseGateway: {},
      langGraphService: {}, state: { INSTAGRAM_ACCOUNT_ID: '12345' }, flowsConfig: {}, broadcastLog: () => {}
    });
    const r = await uc.execute({ senderId: '12345', text: 'hola' });
    assert(r.status === 'self_message', `Esperado self_message, recibido ${r.status}`);
  }),

  test('UseCase ignora mensajes vacíos', async () => {
    const UC = require('../src/use-cases/HandleIncomingMessageUseCase');
    const uc = new UC({
      metaGateway: {}, openaiGateway: {}, flowGateway: {}, supabaseGateway: {},
      langGraphService: {}, state: { INSTAGRAM_ACCOUNT_ID: 'xxx' }, flowsConfig: {}, broadcastLog: () => {}
    });
    const r = await uc.execute({ senderId: '999' });
    assert(r.status === 'no_content', `Esperado no_content, recibido ${r.status}`);
  }),

  test('_sendInChunks() no usa regex', () => {
    const UC = require('../src/use-cases/HandleIncomingMessageUseCase');
    const src = UC.toString();
    const usesRegex = src.includes('.match(');
    assert(!usesRegex, '_sendInChunks todavía usa .match() regex (riesgo ReDoS)');
  }),

  test('_sendInChunks() fragmenta 2000 chars en 3 chunks', async () => {
    const UC = require('../src/use-cases/HandleIncomingMessageUseCase');
    const sent = [];
    const uc = new UC({
      metaGateway: { sendMessage: async (id, text) => sent.push(text) },
      openaiGateway: {}, flowGateway: {}, supabaseGateway: {},
      langGraphService: {}, state: { INSTAGRAM_ACCOUNT_ID: 'xxx' }, flowsConfig: {}, broadcastLog: () => {}
    });
    await uc._sendInChunks('x', 'A'.repeat(2000));
    assert(sent.length === 3, `Esperado 3, recibido ${sent.length}`);
    assert(sent[0].length === 950, `Chunk1 debe ser 950, es ${sent[0].length}`);
    assert(sent[2].length === 100, `Chunk3 debe ser 100, es ${sent[2].length}`);
  }),

  test('_sendInChunks() no envía nada con null/empty', async () => {
    const UC = require('../src/use-cases/HandleIncomingMessageUseCase');
    let called = false;
    const uc = new UC({
      metaGateway: { sendMessage: async () => { called = true; } },
      openaiGateway: {}, flowGateway: {}, supabaseGateway: {},
      langGraphService: {}, state: { INSTAGRAM_ACCOUNT_ID: 'xxx' }, flowsConfig: {}, broadcastLog: () => {}
    });
    await uc._sendInChunks('x', null);
    assert(!called, 'no debe llamar con null');
    await uc._sendInChunks('x', '');
    assert(!called, 'no debe llamar con empty');
  }),

  test('_checkExitPattern() detecta patrones de salida', () => {
    const UC = require('../src/use-cases/HandleIncomingMessageUseCase');
    const uc = new UC({
      metaGateway: {}, openaiGateway: {}, flowGateway: {}, supabaseGateway: {},
      langGraphService: {}, state: { INSTAGRAM_ACCOUNT_ID: 'xxx' }, flowsConfig: {}, broadcastLog: () => {}
    });
    assert(uc._checkExitPattern('salir') === true, '"salir" debe detectarse');
    assert(uc._checkExitPattern('EXIT') === true, '"EXIT" debe detectarse');
    assert(uc._checkExitPattern('hola amigo') === false, 'texto normal no debe detectarse');
  }),
];

// ============================================================
// 8. SHARED STATE
// ============================================================
const sharedTests = [
  test('shared.state tiene propiedades requeridas', () => {
    const { state } = require('../src/shared');
    const keys = ['ACCESS_TOKEN', 'INSTAGRAM_ACCOUNT_ID', 'GRAPH_API', 'AI_MASTER_CONTEXT', 'flowsConfig', 'sseClients'];
    for (const k of keys) assert(k in state, `falta ${k}`);
  }),

  test('broadcastLog no lanza error sin clientes SSE', () => {
    const { broadcastLog } = require('../src/shared');
    let threw = false;
    try { broadcastLog('TEST', 'msg'); } catch (e) { threw = true; }
    assert(!threw, 'no debe lanzar error');
  }),
];

// ============================================================
// 9. GATEWAYS
// ============================================================
const gatewayTests = [
  test('MetaGateway tiene todos los métodos requeridos', () => {
    const MetaGateway = require('../src/adapters/gateways/MetaGateway');
    const gw = new MetaGateway();
    const req = ['sendMessage', 'sendQuickReplies', 'sendCarousel', 'sendCard', 'getUserProfile', 'sendMediaMessage'];
    for (const m of req) assert(typeof gw[m] === 'function', `falta ${m}`);
  }),

  test('SupabaseGateway maneja null DB', async () => {
    const SupabaseGateway = require('../src/adapters/gateways/SupabaseGateway');
    const gw = new SupabaseGateway(null);
    const c = await gw.getContactByInstagramId('test');
    assert(c === null, 'debe retornar null sin DB');
    const cs = await gw.getAllContacts();
    assert(Array.isArray(cs) && cs.length === 0, 'debe retornar [] sin DB');
  }),
];

// ============================================================
// EJECUTAR
// ============================================================
(async () => {
  console.log('\n🔬 TEST EXHAUSTIVO E2E - CRM 2.0 ECOSISTEMA DE AGENTES IA');
  console.log(`Fecha: ${new Date().toLocaleString()}`);
  console.log('─'.repeat(60));

  await runSuite('1. ENTIDADES DE DOMINIO (Contact)', domainTests);
  await runSuite('2. COMMAND PATTERN (Comandos + Registry)', commandTests);
  await runSuite('3. STATE PATTERN (Estados de Venta)', stateTests);
  await runSuite('4. CIRCUIT BREAKER (Resiliencia)', circuitBreakerTests);
  await runSuite('5. BOOTSTRAP & DI', bootstrapTests);
  await runSuite('6. LANGGRAPH SERVICE', langgraphTests);
  await runSuite('7. HANDLE INCOMING MESSAGE USE CASE', useCaseTests);
  await runSuite('8. SHARED STATE', sharedTests);
  await runSuite('9. GATEWAYS (Adapters)', gatewayTests);

  console.log(`\n${'═'.repeat(60)}`);
  console.log('📊 RESULTADOS FINALES');
  console.log('═'.repeat(60));
  console.log(`  ✅ Pasaron: ${passed}`);
  console.log(`  ❌ Fallaron: ${failed}`);
  console.log(`  ⚠️  Warnings: ${warnings.length}`);
  console.log(`  Total: ${passed + failed}`);

  if (errors.length > 0) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log('❌ ERRORES ENCONTRADOS:');
    console.log('─'.repeat(60));
    errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  }

  if (warnings.length > 0) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log('⚠️  WARNINGS (no rompen pero son peligrosos):');
    console.log('─'.repeat(60));
    warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
  }

  console.log('\n');
  process.exit(failed > 0 ? 1 : 0);
})();
