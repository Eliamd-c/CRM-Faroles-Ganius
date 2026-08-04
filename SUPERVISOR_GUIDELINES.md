# Supervisor Agent - Manual de Operación

## ¿Qué Hace el Supervisor?

El supervisor es un **agente que valida cada paso** del plan de implementación. Después de que completes un paso, el supervisor:

1. **Verifica** que el código está correcto
2. **Corre tests** automáticos
3. **Detecta si algo se rompió**
4. **Aprueba o rechaza** el paso
5. **Sugiere el siguiente paso**

---

## Cómo Funciona

### Antes de que empieces un paso:
```
[Tú] "Comenzar paso 1"
↓
[Supervisor] "✅ Paso 1 validado. Puedes comenzar.
  - Crear carpetas: src/domain/, src/use-cases/, etc
  - NO modificar app.js
  - Avísame cuando termines"
```

### Mientras haces el paso:
```
[Tú] Escribes código, creas archivos
↓
[Supervisor espera]
```

### Cuando terminas un paso:
```
[Tú] "Paso 1 completado"
↓
[Supervisor] Valida:
  ✅ ¿Existen carpetas? → git ls-files src/
  ✅ ¿app.js sin cambios? → git diff app.js
  ✅ ¿Index.js creados? → ls src/*/index.js
  
Resultado: ✅ APROBADO
  Siguiente: Paso 2 - Crear Contact.js
```

---

## Validación por Paso

### FASE 1: Setup (Pasos 1-3)

#### Paso 1: Estructura
```bash
# Validaciones
✅ Existen carpetas:
   - src/domain/entities/
   - src/domain/value-objects/
   - src/use-cases/
   - src/adapters/gateways/
   - src/adapters/controllers/
   - src/infrastructure/

✅ Index.js en cada carpeta:
   ls src/*/index.js

✅ app.js sin cambios:
   git diff --name-only | grep -v src/
```

#### Paso 2: Entities
```bash
# Validaciones
✅ Contact.js existe y exports class
   node -e "const Contact = require('./src/domain/entities/Contact'); console.log(typeof Contact)"

✅ Contact tiene métodos requeridos:
   - constructor(data)
   - static new(senderId, name, profile)
   - static fromDatabase(dbRow)
   - isActive(), isPaused(), isInAiAgent(), isAwaitingInput()
   - toDatabase()

✅ Igual para Message.js

# Test manual
node -e "
  const Contact = require('./src/domain/entities/Contact');
  const c = Contact.new('123', 'Test', {});
  console.assert(c.isActive() === true);
  console.assert(c.isPaused() === false);
  console.log('✅ Contact entity works');
"
```

#### Paso 3: Gateways
```bash
# Validaciones
✅ Gateways existen:
   - src/adapters/gateways/MetaGateway.js
   - src/adapters/gateways/OpenAiGateway.js
   - src/adapters/gateways/FlowGateway.js

✅ Cada Gateway wrappea al service:
   const MetaGateway = require('./src/adapters/gateways/MetaGateway');
   const g = new MetaGateway();
   console.assert(typeof g.sendMessage === 'function');

✅ NO cambian lógica (son pass-through):
   grep -n "axios\|supabase" src/adapters/gateways/*.js
   # Esperado: NO encontrar llamadas directas a axios/supabase
   # Solo calls a this.meta, this.openai, etc.
```

---

### FASE 2: Domain Logic (Pasos 4-9)

#### Paso 4: HandleIncomingMessageUseCase
```bash
# Validaciones
✅ Archivo existe:
   src/use-cases/HandleIncomingMessageUseCase.js

✅ Constructor recibe gateways (DI):
   grep "constructor(.*Gateway" src/use-cases/HandleIncomingMessageUseCase.js

✅ NO accede a state global:
   grep "require.*shared" src/use-cases/HandleIncomingMessageUseCase.js
   # Esperado: NO encontrar

✅ Tiene método execute():
   grep "execute(inputData)" src/use-cases/HandleIncomingMessageUseCase.js

✅ Maneja todos los casos:
   grep -E "storyMention|botPaused|isInAiAgent|isAwaitingInput|matchingFlow" \
     src/use-cases/HandleIncomingMessageUseCase.js

# Test manual
node -e "
  const UseCase = require('./src/use-cases/HandleIncomingMessageUseCase');
  // Mock gateways
  const mockGateways = {
    metaGateway: { getUserProfile: async () => ({}) },
    openaiGateway: {},
    flowGateway: {},
    supabaseGateway: { getContactByInstagramId: async () => null }
  };
  const uc = new UseCase(mockGateways);
  console.assert(typeof uc.execute === 'function');
  console.log('✅ UseCase structure OK');
"
```

#### Paso 5: Bug #1 Fix (Guard Condition)
```bash
# Validaciones
✅ NO existe guard condition que bloquea ai_agent:
   grep -n "canReceiveAutomatedMessages" src/use-cases/HandleIncomingMessageUseCase.js
   # Esperado: NO encontrar

✅ Checka ai_agent directamente:
   grep -n "isInAiAgent()" src/use-cases/HandleIncomingMessageUseCase.js
   # Esperado: encontrar

✅ Test: contact en estado ai_agent ejecuta AI
   node test/unit/handle-message-usecase.test.js
   # Debe pasar: "should handle ai_agent state correctly"
```

#### Paso 6: Bug #2 Fix (Regex Matching)
```bash
# Validaciones
✅ NO usa || en matchType:
   grep -n "matchType === .*||" src/use-cases/HandleIncomingMessageUseCase.js
   # Esperado: NO encontrar

✅ Cada matchType es independiente:
   grep -A 5 "if (matchType === 'contains')" src/use-cases/HandleIncomingMessageUseCase.js
   grep -A 5 "if (matchType === 'regex')" src/use-cases/HandleIncomingMessageUseCase.js
   grep -A 5 "if (matchType === 'exact')" src/use-cases/HandleIncomingMessageUseCase.js

✅ Test: solo 1 flow matchea
   node test/unit/flow-matching.test.js
   # Debe pasar: "should match only one flow"
```

#### Paso 7: Bug #3 Fix (_handleAwaitingInput)
```bash
# Validaciones
✅ Método NO está vacío:
   grep -A 10 "_handleAwaitingInput" src/use-cases/HandleIncomingMessageUseCase.js
   # Esperado: Más de 2 líneas

✅ Implementa validación:
   grep "_validateInput" src/use-cases/HandleIncomingMessageUseCase.js

✅ Implementa retries:
   grep "retries" src/use-cases/HandleIncomingMessageUseCase.js

✅ Test: valida input 3 veces
   node test/unit/awaiting-input.test.js
   # Debe pasar: "should retry 3 times then fail"
```

#### Paso 8: Otros UseCases
```bash
# Validaciones
✅ Archivos existen:
   ls src/use-cases/Handle*UseCase.js
   # Esperado: Comment, Postback, Mention, Attachments

✅ Cada uno tiene constructor + execute():
   for f in src/use-cases/Handle*UseCase.js; do
     grep -q "constructor(" "$f" && grep -q "execute(" "$f" || echo "❌ $f incomplete"
   done
```

#### Paso 9: SupabaseGateway
```bash
# Validaciones
✅ Archivo existe y no es vacío:
   wc -l src/adapters/gateways/SupabaseGateway.js
   # Esperado: > 50 líneas

✅ Métodos principales existen:
   grep "getContactByInstagramId\|createContact\|updateContact" \
     src/adapters/gateways/SupabaseGateway.js

✅ Usa Contact entity:
   grep "Contact.fromDatabase" src/adapters/gateways/SupabaseGateway.js

✅ Test con mock Supabase:
   node test/unit/supabase-gateway.test.js
   # Debe pasar todos tests
```

---

### FASE 3: Integration (Pasos 10-15)

#### Paso 10: Bootstrap/DI
```bash
# Validaciones
✅ Archivo existe:
   src/infrastructure/bootstrap.js

✅ Instancia gateways:
   grep "new.*Gateway" src/infrastructure/bootstrap.js

✅ Instancia use-cases:
   grep "new.*UseCase" src/infrastructure/bootstrap.js

✅ Retorna objeto con use-cases:
   grep "return {" src/infrastructure/bootstrap.js

# Test
node -e "
  const bootstrap = require('./src/infrastructure/bootstrap');
  const useCases = bootstrap();
  console.assert(typeof useCases.handleIncomingMessage === 'object');
  console.assert(typeof useCases.handleIncomingMessage.execute === 'function');
  console.log('✅ Bootstrap works');
"
```

#### Paso 11: Wrapper Dual
```bash
# Validaciones
✅ app.js importa bootstrap:
   grep "bootstrap" app.js

✅ app.js crea useCases:
   grep "const.*useCases.*bootstrap" app.js

✅ Webhook handler llama AMBAS versiones:
   grep -A 5 "handleMessageBoth" app.js
   # Esperado: ver calls a handlers.handleMessage() Y useCases.handleIncomingMessage()

✅ NO modificó lógica de handlers:
   git diff src/handlers/webhook.handlers.js
   # Esperado: Poco/ningún cambio (solo agregar call desde app.js)

# Test: app inicia sin errors
npm start
# Esperar conexión a Meta webhook
# Enviar DM de prueba
# Verificar en logs que ambas versiones corren
```

#### Paso 12: Integration Tests
```bash
# Validaciones
✅ Tests existen:
   ls test/integration/

✅ Tests cubren bugs:
   grep -r "ai_agent\|awaiting_input\|regex" test/integration/

✅ Todos los tests pasan:
   npm run test:integration
   # Esperado: 100% pass rate

✅ Tests usan BD de TEST (no PROD):
   grep "TEST_DB\|test.*supabase" test/integration/*.js
```

#### Paso 13-15: Refactorear Handlers
```bash
# Validaciones
✅ handlers.handleMessage() llama UseCase:
   grep "handleIncomingMessage.execute" src/handlers/webhook.handlers.js

✅ NO hay lógica duplicada:
   wc -l src/handlers/webhook.handlers.js
   # Esperado: MENOS líneas que antes (removió lógica)

✅ Todos los tipos de evento siguen funcionando:
   grep "handlePostback\|handleComment\|handleMention" src/handlers/webhook.handlers.js
   # Esperado: existen pero son simples (delegados a UseCase)

# Test: app.js sigue funcionando
npm start
# Enviar varios tipos de eventos
# Verificar en logs que se procesan correctamente
```

---

### FASE 4: Cleanup (Pasos 16-20)

#### Paso 16: Unit Tests
```bash
# Validaciones
✅ Tests para cada UseCase:
   ls test/unit/use-cases/

✅ Tests para cada Entity:
   ls test/unit/domain/

✅ Tests para cada Gateway:
   ls test/unit/adapters/gateways/

✅ Todos pasan:
   npm run test:unit
   # Esperado: 100% pass rate

✅ Coverage > 80%:
   npm run test:coverage
```

#### Paso 17: Documentation
```bash
# Validaciones
✅ Docs existen:
   ls docs/CLEAN_ARCHITECTURE.md

✅ Contiene:
   grep "UseCase\|Gateway\|Entity\|testing" docs/CLEAN_ARCHITECTURE.md
```

#### Paso 18: Remover Viejo
```bash
# Validaciones
✅ Removido viejo ReceiveMessageUseCase (roto):
   ls src/use-cases/ReceiveMessageUseCase.js
   # Esperado: NO EXISTE

✅ Removido viejo WebhookController:
   ls src/adapters/controllers/WebhookController.js
   # Esperado: NO EXISTE (o solo si lo migramos)

✅ Removido src/main.js:
   ls src/main.js
   # Esperado: NO EXISTE

# Test
npm start
# App sigue funcionando
```

#### Paso 19: Final Verification
```bash
# Validaciones
✅ app.js es solo orquestador (~50-100 líneas):
   wc -l app.js

✅ No hay console.errors:
   npm start 2>&1 | grep -i error
   # Esperado: solo errores de meta (no nuestros)

✅ Webhooks funcionan:
   # Enviar DM real a bot
   # Verificar que se procesa en logs

✅ BD intacta:
   # Verificar customers table tiene mismos datos
   # Verificar messages table tiene mismos datos

✅ Tests pasan:
   npm run test
   # Esperado: 100% pass rate

# Smoke test final
npm run test:e2e
```

---

## Cómo Invocar al Supervisor

Después de cada paso, di:

```
"Paso N completado. Valida."
```

El supervisor ejecutará:
1. Validaciones automáticas (comandos bash)
2. Tests automáticos
3. Verificaciones de estructura
4. Aprobación/rechazo

Ejemplo:
```
[Tú] "Paso 1 completado. Valida."

[Supervisor]
"Validando Paso 1: Crear estructura base...

✅ Carpetas existen (7/7)
✅ index.js creados (7/7)
✅ app.js sin cambios

RESULTADO: ✅ APROBADO

Siguientes acciones:
  1. Paso 2: Crear Contact.js y Message.js
  2. Duración estimada: 45 min
  3. Tu primer archivo: src/domain/entities/Contact.js

Comienza cuando quieras y avísame cuando termines."
```

---

## Qué Pasa si Algo Falla

Si la validación falla:

```
[Supervisor]
"❌ VALIDATION FAILED

Paso 2: Crear Entities
Archivo esperado: src/domain/entities/Contact.js
Resultado: NO ENCONTRADO

Debug:
  $ ls src/domain/entities/
  # Mostrar qué hay

Acciones:
  1. ¿Olvidaste crear el archivo?
  2. ¿Está en otra carpeta?
  3. ¿Tiene otro nombre?

Avísame cuando esté listo."
```

---

## Status del Plan

Puedo verificar progreso total en cualquier momento:

```
[Tú] "¿Progreso?"

[Supervisor]
"PROGRESO: 3/20 pasos completados (15%)

✅ Paso 1: Estructura (DONE)
✅ Paso 2: Entities (DONE)
✅ Paso 3: Gateways (DONE)
⏳ Paso 4: HandleIncomingMessageUseCase (IN PROGRESS)
⭕ Paso 5-20: Pendiente

Tiempo estimado restante: 15 horas
Riesgo actual: LOW (3 pasos triviales done)"
```

---

## Resumo: El Flujo Completo

```
1. Tú: "Comenzar plan"
   ↓ Supervisor: Explica paso 1

2. Tú: Implementas paso 1
   ↓ (sin interrupción)

3. Tú: "Paso 1 completado"
   ↓ Supervisor: Valida automáticamente

4. Si ✅ APROBADO:
   ↓ Supervisor: Explica paso 2, repite desde #2

5. Si ❌ RECHAZADO:
   ↓ Supervisor: Explica qué falta, espera fixes

6. Repite hasta paso 20

7. Resultado: Clean Architecture 100% funcional ✅
```

---

## Notas Finales

- **Micro-pasos:** Cada paso es < 1 hora. Puedes hacer 1 al día si quieres.
- **Testing:** Cada paso tiene tests automáticos. NO hay sorpresas al final.
- **Reversible:** Si paso N falla, revertimos y analizamos sin perder trabajo anterior.
- **Pragmatismo:** Usamos ambas versiones en paralelo (vieja + nueva) hasta que nueva esté lista. Luego deprecamos vieja.

**¿Comenzamos con Paso 1?**
