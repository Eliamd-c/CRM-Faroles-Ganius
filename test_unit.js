// Unit Tests for Clean Architecture Components

const assert = require('assert');
const Contact = require('./src/domain/entities/Contact');
const Message = require('./src/domain/entities/Message');
const MetaGateway = require('./src/adapters/gateways/MetaGateway');
const SupabaseGateway = require('./src/adapters/gateways/SupabaseGateway');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`);
    testsFailed++;
  }
}

console.log('═══════════════════════════════════════════════════════');
console.log('UNIT TESTS: Clean Architecture Components');
console.log('═══════════════════════════════════════════════════════');

// ─── DOMAIN: Contact Entity ───
console.log('\n📋 DOMAIN: Contact Entity');
test('Create contact with factory', () => {
  const contact = Contact.new('123', 'Alice', { profile_pic: 'http://pic.jpg' });
  assert.strictEqual(contact.instagramId, '123');
  assert.strictEqual(contact.name, 'Alice');
  assert.strictEqual(contact.state, 'active');
});

test('Contact state transitions', () => {
  const contact = Contact.new('123', 'Bob', {});
  assert.strictEqual(contact.isActive(), true);
  
  contact.switchToAiAgent();
  assert.strictEqual(contact.isInAiAgent(), true);
  
  contact.switchToAwaitingInput('email', 'email_field', null, 'Enter email:');
  assert.strictEqual(contact.isAwaitingInput(), true);
  
  contact.switchToActive();
  assert.strictEqual(contact.isActive(), true);
});

test('Contact pause/resume', () => {
  const contact = Contact.new('123', 'Charlie', {});
  assert.strictEqual(contact.isPaused(), false);
  
  contact.pause();
  assert.strictEqual(contact.isPaused(), true);
  assert.strictEqual(contact.isActive(), false);
  
  contact.resume();
  assert.strictEqual(contact.isPaused(), false);
  assert.strictEqual(contact.isActive(), true);
});

test('Contact tags management', () => {
  const contact = Contact.new('123', 'Dave', {});
  assert.strictEqual(contact.tags.length, 0);
  
  contact.addTag('vip');
  assert(contact.tags.includes('vip'));
  
  contact.addTag('vip'); // Duplicate
  assert.strictEqual(contact.tags.length, 1);
  
  contact.removeTag('vip');
  assert(!contact.tags.includes('vip'));
});

test('Contact fields management', () => {
  const contact = Contact.new('123', 'Eve', {});
  contact.setField('city', 'Bogotá');
  assert.strictEqual(contact.getField('city'), 'Bogotá');
});

test('Contact toDatabase serialization', () => {
  const contact = Contact.new('123', 'Frank', { profile_pic: 'http://pic.jpg' });
  contact.addTag('premium');
  contact.setField('phone', '555-1234');
  
  const db = contact.toDatabase();
  assert.strictEqual(db.instagram_id, '123');
  assert.strictEqual(db.name, 'Frank');
  assert(db.tags.includes('premium'));
  assert.strictEqual(db.fields.phone, '555-1234');
});

// ─── DOMAIN: Message Entity ───
console.log('\n📋 DOMAIN: Message Entity');
test('Create message with factory', () => {
  const msg = Message.new('123', 'Hello', 'text');
  assert.strictEqual(msg.instagramId, '123');
  assert.strictEqual(msg.text, 'Hello');
  assert.strictEqual(msg.type, 'text');
  assert.strictEqual(msg.isOutbound(), true);
});

test('Message attachment', () => {
  const msg = Message.new('123', '', 'image');
  assert.strictEqual(msg.hasAttachment(), false);
  
  msg.attachMedia('image', 'http://img.jpg');
  assert.strictEqual(msg.hasAttachment(), true);
  assert.strictEqual(msg.attachmentType, 'image');
  assert.strictEqual(msg.attachmentUrl, 'http://img.jpg');
});

test('Message metadata', () => {
  const msg = Message.new('123', 'Test', 'text');
  msg.addMetadata('quick_reply', 'yes');
  assert.strictEqual(msg.getMetadata('quick_reply'), 'yes');
});

// ─── ADAPTERS: MetaGateway ───
console.log('\n📋 ADAPTERS: MetaGateway');
test('MetaGateway instantiation', () => {
  const gateway = new MetaGateway();
  assert(gateway);
  assert.strictEqual(typeof gateway.sendMessage, 'function');
  assert.strictEqual(typeof gateway.getUserProfile, 'function');
});

test('MetaGateway methods exist', () => {
  const gateway = new MetaGateway();
  const methods = [
    'getUserProfile', 'sendMessage', 'sendTemplate', 'logMessage',
    'sendCard', 'sendCarousel', 'sendAudio', 'sendVideo'
  ];
  for (const method of methods) {
    assert.strictEqual(typeof gateway[method], 'function');
  }
});

// ─── ADAPTERS: SupabaseGateway ───
console.log('\n📋 ADAPTERS: SupabaseGateway');
test('SupabaseGateway with null db', () => {
  const gateway = new SupabaseGateway(null);
  assert(gateway);
  assert.strictEqual(typeof gateway.getContactByInstagramId, 'function');
});

test('SupabaseGateway fallback (no db)', async () => {
  const gateway = new SupabaseGateway(null);
  const result = await gateway.getContactByInstagramId('123');
  assert.strictEqual(result, null);
});

test('SupabaseGateway methods count', () => {
  const gateway = new SupabaseGateway(null);
  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(gateway))
    .filter(m => m !== 'constructor');
  assert(methods.length >= 15, `Should have 15+ methods, has ${methods.length}`);
});

// ─── Summary ───
console.log('\n═══════════════════════════════════════════════════════');
console.log(`✅ TESTS PASSED: ${testsPassed}`);
console.log(`❌ TESTS FAILED: ${testsFailed}`);
console.log('═══════════════════════════════════════════════════════');

if (testsFailed === 0) {
  console.log('\n🎉 ALL UNIT TESTS PASSED!');
  process.exit(0);
} else {
  console.log('\n⚠️ SOME TESTS FAILED');
  process.exit(1);
}
