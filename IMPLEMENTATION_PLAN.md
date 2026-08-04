# Plan de Implementación: Clean Architecture CRM
## Opción B - Segura con Micro-Pasos

**Objetivo:** Migrar a Clean Architecture sin romper la app funcionando
**Método:** 20 micro-pasos (1 hora c/u), testeos después de c/uno
**Riesgo:** MEDIUM-LOW (vs ALTO sin plan)

---

## FASE 1: SETUP (Pasos 1-3)

### ✅ Paso 1: Crear Estructura Base
**Duración:** 30 min | **Riesgo:** BAJO

```
src/
├── domain/
│   ├── entities/
│   │   ├── Contact.js (NEW)
│   │   ├── Message.js (NEW)
│   │   └── Flow.js (NEW)
│   └── value-objects/
│       ├── BotState.js (NEW)
│       └── InputType.js (NEW)
├── use-cases/
│   ├── HandleIncomingMessageUseCase.js (MIGRATE from handlers)
│   ├── HandleCommentUseCase.js
│   ├── HandlePostbackUseCase.js
│   └── index.js (exports all)
├── adapters/
│   ├── gateways/
│   │   ├── MetaGateway.js (NEW - wraps meta.service)
│   │   ├── OpenAiGateway.js (NEW - wraps openai.service)
│   │   ├── FlowGateway.js (NEW - wraps flow.service)
│   │   └── SupabaseGateway.js (NEW - wraps db)
│   └── controllers/
│       └── WebhookController.js (already exists, refactor only)
├── infrastructure/
│   └── bootstrap.js (NEW - DI setup)
├── services/ (KEEP - phase out later)
│   ├── meta.service.js
│   ├── openai.service.js
│   ├── flow.service.js
│   └── ...
└── shared.js (KEEP - gradual removal)
```

**Qué hacer:**
- Crear carpetas vacías
- Crear index.js en cada carpeta
- NO modificar app.js aún

**Test:** `ls -R src/` debe mostrar estructura

---

### ✅ Paso 2: Crear Domain Entities Básicas
**Duración:** 45 min | **Riesgo:** BAJO

**src/domain/entities/Contact.js:**
```javascript
class Contact {
  constructor(data) {
    this.instagramId = data.instagram_id;
    this.name = data.name;
    this.profilePicUrl = data.profile_picture_url;
    this.state = data.bot_state || 'active';
    this.tags = data.tags || [];
    this.fields = data.fields || {};
    this.botPaused = data.bot_paused || false;
    this.awaitingInputType = data.awaiting_input_type;
    this.awaitingInputField = data.awaiting_input_field;
    this.awaitingInputChoices = data.awaiting_input_choices;
    this.currentFlowId = data.current_flow_id;
    this.currentStepIndex = data.current_step_index;
  }

  static fromDatabase(dbRow) {
    return new Contact(dbRow);
  }

  static new(senderId, name, profile) {
    return new Contact({
      instagram_id: senderId,
      name,
      profile_picture_url: profile?.profile_pic || null,
      bot_state: 'active',
      tags: [],
      fields: {},
      bot_paused: false
    });
  }

  isActive() {
    return !this.botPaused && this.state === 'active';
  }

  isPaused() {
    return this.botPaused;
  }

  isInAiAgent() {
    return this.state === 'ai_agent';
  }

  isAwaitingInput() {
    return this.state === 'awaiting_input';
  }

  toDatabase() {
    return {
      instagram_id: this.instagramId,
      name: this.name,
      profile_picture_url: this.profilePicUrl,
      bot_state: this.state,
      tags: this.tags,
      fields: this.fields,
      bot_paused: this.botPaused,
      awaiting_input_type: this.awaitingInputType,
      awaiting_input_field: this.awaitingInputField,
      awaiting_input_choices: this.awaitingInputChoices,
      current_flow_id: this.currentFlowId,
      current_step_index: this.currentStepIndex
    };
  }
}

module.exports = Contact;
```

**src/domain/entities/Message.js:**
```javascript
class Message {
  constructor(data) {
    this.mid = data.mid;
    this.senderId = data.sender_id;
    this.text = data.text || '';
    this.type = data.message_type || 'text';
    this.direction = data.direction; // 'inbound' | 'outbound'
    this.attachmentType = data.attachment_type;
    this.attachmentUrl = data.attachment_url;
    this.timestamp = data.timestamp || Date.now();
  }

  static new(senderId, text, type = 'text') {
    return new Message({
      sender_id: senderId,
      text,
      message_type: type,
      direction: 'outbound',
      timestamp: Date.now()
    });
  }

  static fromDatabase(dbRow) {
    return new Message(dbRow);
  }

  isInbound() {
    return this.direction === 'inbound';
  }

  isOutbound() {
    return this.direction === 'outbound';
  }

  hasAttachment() {
    return !!this.attachmentUrl;
  }

  toDatabase() {
    return {
      mid: this.mid,
      instagram_id: this.senderId,
      direction: this.direction,
      message_type: this.type,
      content: this.text,
      attachment_type: this.attachmentType,
      attachment_url: this.attachmentUrl,
      timestamp: this.timestamp
    };
  }
}

module.exports = Message;
```

**Test:** 
```bash
node -e "const Contact = require('./src/domain/entities/Contact'); const c = Contact.new('123', 'Test', {}); console.log(c.isActive())"
# Expected: true
```

---

### ✅ Paso 3: Crear Gateways (Wrappers)
**Duración:** 1 hora | **Riesgo:** BAJO

**Principio:** Gateways = interfaces que llaman a los servicios actuales, sin cambiar lógica

**src/adapters/gateways/MetaGateway.js:**
```javascript
const meta = require('../../services/meta.service');

class MetaGateway {
  async getUserProfile(senderId) {
    return meta.getUserProfile(senderId);
  }

  async sendMessage(recipientId, text, quickReplies = null) {
    return meta.sendMessage(recipientId, text, quickReplies);
  }

  async sendTemplate(recipientId, text, buttons) {
    return meta.sendTemplate(recipientId, text, buttons);
  }

  async logMessage(instagramId, direction, type, content, mid, extra = {}) {
    return meta.logMessageToDB(instagramId, direction, type, content, mid, extra);
  }

  // ... otros métodos
}

module.exports = MetaGateway;
```

**Test:**
```bash
node -e "const MetaGateway = require('./src/adapters/gateways/MetaGateway'); const g = new MetaGateway(); console.log(typeof g.sendMessage)"
# Expected: 'function'
```

---

## FASE 2: DOMAIN LOGIC (Pasos 4-9)

### ✅ Paso 4: Migrar HandleMessage Logic a UseCase
**Duración:** 1.5 horas | **Riesgo:** MEDIO

**src/use-cases/HandleIncomingMessageUseCase.js:**

Copia toda la lógica de `handlers.handleMessage()` pero:
- Recibe gateways por constructor (DI)
- Retorna resultado en lugar de mutar estado
- NO tiene acceso a `state` global

```javascript
const Contact = require('../domain/entities/Contact');
const Message = require('../domain/entities/Message');

class HandleIncomingMessageUseCase {
  constructor({ metaGateway, openaiGateway, flowGateway, supabaseGateway }) {
    this.meta = metaGateway;
    this.openai = openaiGateway;
    this.flow = flowGateway;
    this.db = supabaseGateway;
  }

  async execute(inputData) {
    const { senderId, text, storyMention, hasAttachments, event } = inputData;

    if (!senderId) throw new Error('Missing senderId');

    // 1. Get/Create contact
    let contact = await this.db.getContactByInstagramId(senderId);
    if (!contact) {
      const profile = await this.meta.getUserProfile(senderId);
      contact = Contact.new(senderId, profile?.name || senderId, profile);
      await this.db.createContact(contact);
      // Trigger welcome flow...
      return { status: 'welcomed', contact };
    }

    // 2. Check bot paused
    if (contact.isPaused()) {
      return { status: 'paused', contact };
    }

    // 3. Handle story mention
    if (storyMention) {
      // ... lógica story mention
      return { status: 'story_handled', contact };
    }

    // 4. Handle AI Agent state
    if (contact.isInAiAgent()) {
      const shouldExit = this._checkExitPattern(text);
      if (shouldExit) {
        contact.state = 'active';
        await this.db.updateContact(contact);
        return { status: 'exited_ai', contact };
      }
      await this.openai.runAiAgent(senderId, contact);
      return { status: 'ai_handled', contact };
    }

    // 5. Handle Awaiting Input state (FIX BUG: no guard condition!)
    if (contact.isAwaitingInput()) {
      const isValid = this._validateInput(text, contact.awaitingInputType);
      if (isValid) {
        contact.state = 'active';
        if (contact.awaitingInputField) {
          contact.fields[contact.awaitingInputField] = text;
        }
        await this.db.updateContact(contact);
        return { status: 'input_captured', contact };
      } else {
        // Retry logic
        return { status: 'input_invalid', contact };
      }
    }

    // 6. Match keywords to flows
    const matchedFlow = this._findMatchingFlow(text);
    if (matchedFlow) {
      await this.flow.processFlow(matchedFlow, senderId, contact);
      return { status: 'flow_executed', contact };
    }

    // 7. Default
    return { status: 'no_match', contact };
  }

  _checkExitPattern(text) {
    const patterns = [/^(salir|exit|quit|menu|menú)$/, /^(volver al menú|menu principal)$/];
    return patterns.some(p => p.test(text.trim().toLowerCase()));
  }

  _validateInput(text, inputType) {
    // Reuse logic from handlers.js
    if (inputType === 'email') return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(text);
    if (inputType === 'phone') return /^\+?[\d\s-]{7,15}$/.test(text);
    if (inputType === 'number') return /^-?\d+(\.\d+)?$/.test(text);
    // ... etc
    return text.length > 0;
  }

  _findMatchingFlow(text) {
    // Reuse flow matching logic from handlers.js
    // Return flow or null
  }
}

module.exports = HandleIncomingMessageUseCase;
```

**Test:** Crear test_handle_message.js que no toque BD real

---

### ✅ Paso 5: Fijar Bug #1 (Guard Condition)
**Duración:** 30 min | **Riesgo:** BAJO

**En HandleIncomingMessageUseCase.js:**
Cambiar:
```javascript
// ❌ VIEJO (BUG)
if (!contact.canReceiveAutomatedMessages()) {
  return; // Retorna ANTES de chequear ai_agent y awaiting_input
}
```

Por:
```javascript
// ✅ NUEVO (CORRECTO)
if (contact.isInAiAgent()) {
  // Maneja ai_agent state
  return;
}

if (contact.isAwaitingInput()) {
  // Maneja awaiting_input state
  return;
}
```

**Test:** Test case que pasa contact en estado 'ai_agent' debe ejecutar lógica de AI

---

### ✅ Paso 6: Fijar Bug #2 (Regex Match)
**Duración:** 30 min | **Riesgo:** BAJO

**En HandleIncomingMessageUseCase._findMatchingFlow():**

```javascript
// ❌ VIEJO (BUG)
if (matchType === 'contains' || f.matchType === 'regex') {
  // Error: debería ser && para ESTE flow
}

// ✅ NUEVO
if (matchType === 'contains') {
  const match = f.keywords.find(kw => 
    lowerText.includes(kw.toLowerCase())
  );
  if (match) return f;
}

if (matchType === 'regex') {
  const match = f.keywords.find(kw => {
    try {
      const regex = new RegExp(kw, 'i');
      return regex.test(text);
    } catch (e) {
      return false;
    }
  });
  if (match) return f;
}

if (matchType === 'exact') {
  const match = f.keywords.find(kw => 
    lowerText === kw.toLowerCase()
  );
  if (match) return f;
}

return null;
```

**Test:** Test con múltiples flows, verificar que solo 1 matchea

---

### ✅ Paso 7: Fijar Bug #3 (Empty Method)
**Duración:** 30 min | **Riesgo:** BAJO

**En HandleIncomingMessageUseCase.js:**

```javascript
// ❌ VIEJO (vacío)
_handleAwaitingInput(text, contact) {
  // EMPTY
}

// ✅ NUEVO
_handleAwaitingInput(text, contact) {
  const isValid = this._validateInput(text, contact.awaitingInputType);
  
  if (isValid) {
    return { success: true, value: text };
  }
  
  const retries = (contact.retries || 0) + 1;
  if (retries >= 3) {
    return { success: false, reason: 'max_retries' };
  }
  
  return { success: false, reason: 'invalid_format', retries };
}
```

**Test:** Test que valide input 3 veces, luego falle

---

### ✅ Paso 8: Crear Otros UseCases Comunes
**Duración:** 1 hora | **Riesgo:** BAJO

- `HandleCommentUseCase.js` (mismo patrón que HandleMessage)
- `HandlePostbackUseCase.js`
- `HandleMentionUseCase.js`
- `HandleAttachmentsUseCase.js`

Cada uno: copia lógica actual → refactoriza → recibe gateways

**Test:** Crear test para cada uno

---

### ✅ Paso 9: Crear SupabaseGateway Completo
**Duración:** 1.5 horas | **Riesgo:** MEDIO

```javascript
const Contact = require('../../domain/entities/Contact');

class SupabaseGateway {
  constructor(supabaseClient) {
    this.db = supabaseClient;
  }

  async getContactByInstagramId(instagramId) {
    const { data } = await this.db
      .from('customers')
      .select('*')
      .eq('instagram_id', instagramId)
      .single();
    
    return data ? Contact.fromDatabase(data) : null;
  }

  async createContact(contact) {
    const { data, error } = await this.db
      .from('customers')
      .insert([contact.toDatabase()])
      .select()
      .single();
    
    if (error) throw error;
    return Contact.fromDatabase(data);
  }

  async updateContact(contact) {
    const { data, error } = await this.db
      .from('customers')
      .update(contact.toDatabase())
      .eq('instagram_id', contact.instagramId)
      .select()
      .single();
    
    if (error) throw error;
    return Contact.fromDatabase(data);
  }

  // ... otros métodos
}

module.exports = SupabaseGateway;
```

**Test:** Usar mock de supabase, verificar queries correctas

---

## FASE 3: INTEGRATION (Pasos 10-15)

### ✅ Paso 10: Crear Bootstrap/DI Setup
**Duración:** 45 min | **Riesgo:** BAJO

**src/infrastructure/bootstrap.js:**
```javascript
const MetaGateway = require('../adapters/gateways/MetaGateway');
const OpenAiGateway = require('../adapters/gateways/OpenAiGateway');
const FlowGateway = require('../adapters/gateways/FlowGateway');
const SupabaseGateway = require('../adapters/gateways/SupabaseGateway');

const HandleIncomingMessageUseCase = require('../use-cases/HandleIncomingMessageUseCase');
// ... import otros use-cases

const supabase = require('../../db');

function bootstrap() {
  // Crear gateways
  const metaGateway = new MetaGateway();
  const openaiGateway = new OpenAiGateway();
  const flowGateway = new FlowGateway();
  const supabaseGateway = new SupabaseGateway(supabase);

  // Crear use-cases
  const handleIncomingMessage = new HandleIncomingMessageUseCase({
    metaGateway,
    openaiGateway,
    flowGateway,
    supabaseGateway
  });

  // ... otros use-cases

  return {
    handleIncomingMessage,
    // ... otros use-cases
  };
}

module.exports = bootstrap;
```

**Test:** `node -e "const bootstrap = require('./src/infrastructure/bootstrap'); const useCases = bootstrap(); console.log(typeof useCases.handleIncomingMessage.execute)"`

---

### ✅ Paso 11: Crear Wrapper en app.js (Paralelo)
**Duración:** 1 hora | **Riesgo:** BAJO

En `app.js`, agregamos:
```javascript
// Importar clean architecture
const bootstrap = require('./src/infrastructure/bootstrap');
const cleanUseCases = bootstrap();

// Crear wrapper que llama AMBAS versiones por ahora
async function handleMessageBoth(event) {
  try {
    // Versión nueva (clean architecture)
    const result = await cleanUseCases.handleIncomingMessage.execute({
      senderId: event.sender?.id,
      text: event.message?.text,
      storyMention: event.message?.story?.mention,
      hasAttachments: !!event.message?.attachments
    });
    console.log('[CLEAN] Result:', result.status);
  } catch (err) {
    console.error('[CLEAN] Error:', err.message);
    // Fall back a versión antigua
  }

  // Versión antigua (actual) - la mantenemos mientras testea
  await handlers.handleMessage(event);
}
```

**Test:** App sigue funcionando, ambas versiones corren

---

### ✅ Paso 12: Correr Tests Contra BD Real
**Duración:** 1 hora | **Riesgo:** MEDIO

Crear `test/integration/` que:
1. Usa BD de TEST (no prod)
2. Envía eventos simulados
3. Verifica que ambas versiones dan mismo resultado

```javascript
// test/integration/message-handling.test.js
const bootstrap = require('../../src/infrastructure/bootstrap');

describe('HandleIncomingMessage', () => {
  let useCases;

  before(() => {
    useCases = bootstrap();
  });

  it('should handle normal message', async () => {
    const result = await useCases.handleIncomingMessage.execute({
      senderId: 'test-123',
      text: 'Hola'
    });
    
    assert.strictEqual(result.status, 'no_match'); // O lo que corresponda
  });

  it('should handle ai_agent state correctly', async () => {
    // Crear contact en estado ai_agent
    // Enviar mensaje
    // Verificar que se ejecuta lógica AI
  });

  it('should handle awaiting_input state correctly', async () => {
    // Crear contact esperando email
    // Enviar email válido
    // Verificar que se guarda en fields
  });
});
```

---

### ✅ Paso 13-15: Validar + Refactorear Handlers
**Duración:** 2 horas | **Riesgo:** MEDIO**

Ahora que UseCase funciona:
1. Remover lógica de handlers.js que ya está en UseCase
2. Handlers solo llaman a UseCase
3. Mantener compatibilidad con webhook actual

```javascript
// src/handlers/webhook.handlers.js REFACTORED
const useCases = require('../use-cases');

async function handleMessage(event) {
  const result = await useCases.handleIncomingMessage.execute({
    senderId: event.sender?.id,
    text: event.message?.text,
    storyMention: event.message?.story?.mention,
    hasAttachments: !!event.message?.attachments
  });
  
  // Procesar result (broadcasts, etc)
  console.log('Message handled:', result.status);
}
```

**Test:** App sigue funcionando exactamente igual

---

## FASE 4: CLEANUP (Pasos 16-20)

### ✅ Paso 16: Deprecar Lógica Vieja en handlers.js
**Duración:** 1 hora | **Riesgo:** BAJO

Remover código duplicado que ya está en UseCase

### ✅ Paso 17: Crear Tests Completos
**Duración:** 2 horas | **Riesgo:** BAJO

Tests unitarios para cada UseCase, Entity, Gateway

### ✅ Paso 18: Documentación
**Duración:** 1 hora | **Riesgo:** BAJO

Documentar:
- Cómo agregar nuevo UseCase
- Cómo testear
- Diagrama de flow

### ✅ Paso 19: Remover src/use-cases/ReceiveMessageUseCase.js (viejo roto)
**Duración:** 15 min | **Riesgo:** BAJO

Remover la versión vieja rota

### ✅ Paso 20: Verificación Final
**Duración:** 1 hora | **Riesgo:** BAJO

- Verificar que app.js es solo orquestador
- Todos los tests pasan
- Webhooks funcionan

---

## VALIDACIÓN POR PASO

| Paso | Validación | Test |
|------|-----------|------|
| 1 | Estructura existe | `ls src/` |
| 2 | Entities funcionan | Unit test |
| 3 | Gateways wrappean servicios | Unit test |
| 4 | UseCase sin bugs | Unit + integration |
| 5 | Bug #1 fijo | Test ai_agent state |
| 6 | Bug #2 fijo | Test regex matching |
| 7 | Bug #3 fijo | Test awaiting_input |
| 8+ | Cada paso corre independiente | Test suite |

---

## RISK MITIGATION

**Si algo sale mal:**
1. Paso N rompe: `git revert HEAD~N`
2. Regresa a paso N-1 (funcionando)
3. Analizamos qué falló
4. Intenta paso N con cambios

**Nunca pierdes work**: cada paso es un commit separado

---

## ESTIMADO TOTAL

- Setup: 2 horas
- Domain + UseCases: 8 horas
- Integration: 4 horas
- Cleanup: 4 horas

**Total: ~18 horas (~3 días de trabajo)**

**Resultado: Clean Architecture 100% funcional, con bugs críticos fijos**
