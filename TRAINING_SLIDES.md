# Training Slides: Clean Architecture

## SLIDE 1: Bienvenida

```
╔════════════════════════════════════════════════════╗
║                                                    ║
║   CLEAN ARCHITECTURE TRAINING                     ║
║   CRM 2.0 Implementation                          ║
║                                                    ║
║   Duración: 3-4 horas                            ║
║   Objetivo: Que todos entiendan y usen la        ║
║             nueva arquitectura                    ║
║                                                    ║
╚════════════════════════════════════════════════════╝
```

**Objetivo del día:**
- Entender por qué implementamos esto
- Saber cómo funciona cada capa
- Poder crear nuevas features correctamente

---

## SLIDE 2: El Problema Anterior

```
ANTES:
┌─────────────────────────────────────┐
│  app.js                             │  ← 3,800+ líneas
│  ├─ handlers                        │     (TODO mezclado)
│  ├─ routing                         │
│  ├─ lógica de negocio               │
│  └─ data access                     │
└─────────────────────────────────────┘

Problemas:
❌ Difícil de testear
❌ Difícil de cambiar (toca todo)
❌ Difícil de entender (mucho código)
❌ Difícil de mantener (circular dependencies)
```

---

## SLIDE 3: La Solución

```
AHORA:
┌─────────────────────────────────────┐
│  HTTP (Express)                     │  ← Entry point
├─────────────────────────────────────┤
│  Infrastructure (Bootstrap/DI)      │  ← Conecta las piezas
├─────────────────────────────────────┤
│  Adapters (Gateways)                │  ← Servicios externos
├─────────────────────────────────────┤
│  Application (Use Cases)            │  ← Orquestación
├─────────────────────────────────────┤
│  Domain (Entities)                  │  ← Reglas de negocio
└─────────────────────────────────────┘

Ventajas:
✅ Cada capa es independiente
✅ Fácil de testear
✅ Fácil de cambiar
✅ Fácil de entender
```

---

## SLIDE 4: Los Números

```
ANTES:
  📊 Lines of code: 3,800+
  🧩 Modules: 1 (monolith)
  🧪 Tests: ~5
  🐛 Bugs: 3 críticos

AHORA:
  📊 Lines of code: ~2,000 nuevas + servicios
  🧩 Modules: 9 (domain, adapters, use-cases, infrastructure)
  🧪 Tests: 20 (14 unit + 6 integration)
  🐛 Bugs: 3 críticos FIJOS ✅
```

---

## SLIDE 5: Las 5 Capas (Resumen)

```
CAPA 5: DOMAIN (Entities)
  └─ Contact.js, Message.js
  └─ Reglas del negocio puras
  └─ Sin dependencias externas

CAPA 4: APPLICATION (Use Cases)
  └─ HandleIncomingMessageUseCase.js (y 4 más)
  └─ Orquesta gateways + entities
  └─ Implementa flujos de usuario

CAPA 3: ADAPTERS (Gateways)
  └─ MetaGateway, OpenAiGateway, FlowGateway, SupabaseGateway
  └─ Abstrae servicios externos
  └─ Intercambiable (cambiar DB fácil)

CAPA 2: INFRASTRUCTURE (Bootstrap/DI)
  └─ bootstrap.js
  └─ Conecta todas las piezas
  └─ Inyección de dependencias

CAPA 1: HTTP (Express)
  └─ app.js
  └─ Recibe requests, delega a use-cases
```

---

## SLIDE 6: Flujo de un Request

```
User envía DM
    ↓
Meta webhook → POST /webhook
    ↓
app.js extrae datos
    ↓
app.js llama: di.handleIncomingMessage.execute({...})
    ↓
UseCase recibe input
    ├─ Obtiene Contact (SupabaseGateway)
    ├─ Chequea estado
    ├─ Ejecuta acción (IA, flujo, etc)
    ├─ Actualiza Contact (SupabaseGateway)
    └─ Retorna resultado
    ↓
app.js envía respuesta 200 OK
    ↓
Meta recibe confirmación
```

---

## SLIDE 7: Domain Layer (Entity)

```javascript
// Contact es una entidad de negocio PURA
const contact = Contact.new('123', 'Alice', {...});

// Métodos de negocio:
contact.isActive()           // ¿Puede recibir mensajes?
contact.switchToAiAgent()    // Cambiar estado
contact.isAwaitingInput()    // ¿Esperando input?

// Datos:
contact.tags                 // ['vip', 'premium']
contact.fields               // {city: 'Bogotá'}
contact.state               // 'active' | 'ai_agent' | 'awaiting_input'

// NO accede a BD, NO llama APIs
// Solo lógica de negocio pura
```

---

## SLIDE 8: Adapter Layer (Gateway)

```javascript
// Gateway abstrae un servicio externo
const gateway = new SupabaseGateway(supabaseClient);

// Gateway tiene métodos que usan el servicio:
await gateway.getContactByInstagramId('123')
await gateway.updateContact(contact)
await gateway.addContactTag('123', 'vip')

// Ventaja: Si cambias DB, solo cambias Gateway
// Los use-cases NO saben que existe Supabase
```

---

## SLIDE 9: Application Layer (Use Case)

```javascript
// Use Case orquesta: entities + gateways
class HandleIncomingMessageUseCase {
  constructor({ supabaseGateway, openaiGateway }) {
    this.db = supabaseGateway;    // Inyectado
    this.ai = openaiGateway;      // Inyectado
  }

  async execute(inputData) {
    // 1. Usar entities
    let contact = await this.db.getContact(inputData.senderId);
    
    // 2. Aplicar lógica
    if (contact.isInAiAgent()) {
      await this.ai.runAiAgent(contact);
    }
    
    // 3. Persistir cambios
    await this.db.updateContact(contact);
    
    // 4. Retornar resultado
    return { status: 'success' };
  }
}
```

---

## SLIDE 10: Infrastructure (DI Container)

```javascript
// Bootstrap conecta todo
const di = bootstrap({
  state,
  flowsConfig,
  supabaseClient,
  broadcastLog
});

// di contiene todas las instancias listas para usar:
di.useCases.handleIncomingMessage
di.useCases.handleComment
di.useCases.handlePostback
di.gateways.supabaseGateway
di.gateways.openaiGateway
// ...

// En app.js es fácil:
await di.handleIncomingMessage.execute({...})
```

---

## SLIDE 11: HTTP Layer (Express)

```javascript
// app.js es simple ahora:
const di = bootstrap({...});

app.post('/webhook', async (req, res) => {
  const body = req.body;
  
  for (const event of body.entry[0].messaging) {
    if (event.message?.text) {
      // Delegar a use-case (3 líneas):
      await di.handleIncomingMessage.execute({
        senderId: event.sender.id,
        text: event.message.text
      });
    }
  }
  
  res.sendStatus(200);
});

// Ventaja: app.js es solo enrutamiento + delegación
// NO tiene lógica de negocio
```

---

## SLIDE 12: Cómo Agregar una Feature

```
Escenario: Agregar soporte para "geolocalización"

Paso 1: Crear entity si es necesario
  └─ Location value-object (lat, lon)

Paso 2: Crear/actualizar gateway
  └─ SupabaseGateway.saveLocation(contact, location)

Paso 3: Crear use-case
  └─ HandleLocationUseCase.js
  └─ Recibe location, valida, guarda

Paso 4: Registrar en bootstrap
  └─ new HandleLocationUseCase({supabaseGateway})

Paso 5: Usar en app.js
  └─ await di.handleLocation.execute({...})

Paso 6: Testear
  └─ test_location.js
```

---

## SLIDE 13: Testing

```
ANTES:
❌ Difícil testear porque todo está mezclado

AHORA:
✅ Testear cada capa por separado

Entity Tests:
  const contact = Contact.new('123', 'Alice', {...});
  assert(contact.isActive() === true);

Gateway Tests (mock BD):
  const gateway = new SupabaseGateway(null);
  const result = await gateway.get('123');
  assert(result === null); // No BD, es mock

Use Case Tests:
  const useCase = new HandleLocation({
    supabaseGateway: mockGateway
  });
  const result = await useCase.execute({...});
  assert(result.status === 'success');
```

---

## SLIDE 14: Bugs Que Fijamos

```
❌ BUG #1: Guard condition bloqueaba ai_agent state
  └─ FIJO: Removimos guard, estados ahora alcanzables

❌ BUG #2: Regex matching no funcionaba
  └─ FIJO: Cada matchType es independiente

❌ BUG #3: _handleAwaitingInput estaba vacío
  └─ FIJO: Implementado completamente con validación

RESULTADO: 3/3 bugs fijos ✅
```

---

## SLIDE 15: Migración Strategy

```
FASE 1 (ACTUAL): Dual Execution
  - Old handlers: Still running
  - New use-cases: Running alongside
  - Zero downtime, completely reversible

FASE 2 (PRÓXIMA): Gradual Deprecation
  - Use-cases become primary
  - Handlers become fallback
  - Monitor for stability

FASE 3 (FUTURO): Full Cleanup
  - Remove old handlers
  - Keep only clean architecture
  - Single source of truth
```

---

## SLIDE 16: Best Practices

```
✅ DO:
  ✓ Cada capa hace UNA cosa
  ✓ Inyectar dependencias (no hardcoded imports)
  ✓ Retornar resultado estructurado
  ✓ Testear cada capa
  ✓ Usar entidades para lógica de negocio

❌ DON'T:
  ✗ Gateway llamando otro Gateway
  ✗ Use-case directamente a DB (usa gateway)
  ✗ Lógica de negocio en HTTP handler
  ✗ Circular dependencies
  ✗ Entidades con métodos que usan BD
```

---

## SLIDE 17: Preguntas de Ejemplo

**P: ¿Qué pasa si necesito agregar logging?**
R: Inyecta `broadcastLog` en el use-case, llámalo cuando sea necesario.

**P: ¿Qué pasa si cambio de Supabase a PostgreSQL?**
R: Solo reescribes SupabaseGateway, use-cases no cambian.

**P: ¿Debo crear un use-case para TODO?**
R: No, solo para flujos de usuario complejos. Para helpers simples está bien.

**P: ¿Por qué tantos archivos?**
R: Mejor tener 10 archivos simples que 1 archivo complejo de 3,800 líneas.

---

## SLIDE 18: Recursos

```
📚 Documentación:
  - docs/CLEAN_ARCHITECTURE.md  (guía completa)
  - TRAINING_GUIDE.md           (este documento)
  - IMPLEMENTATION_PLAN.md      (cómo se hizo)

💻 Código de referencia:
  - src/use-cases/HandleIncomingMessageUseCase.js
  - src/adapters/gateways/SupabaseGateway.js
  - src/infrastructure/bootstrap.js

🧪 Tests:
  - test_unit.js       (14 pruebas)
  - test_integration.js (6 pruebas)
```

---

## SLIDE 19: Ahora Es Tu Turno

```
Lab: Crear HandleLocationUseCase

1. Abre HandlePostbackUseCase.js como referencia
2. Crea HandleLocationUseCase.js
3. Registra en bootstrap.js
4. Crea test_location.js
5. Corre los tests

⏱️ Tiempo: 90 minutos
```

---

## SLIDE 20: Cierre

```
✅ LOGROS:
  • 20/20 tests pasando
  • 3/3 bugs críticos fijos
  • Arquitectura clara
  • Código mantenible
  • Documentación completa

🎯 PRÓXIMOS PASOS:
  • Monitorear staging (24-48 horas)
  • Merge a main
  • Cada dev practica creando 1 use-case
  • Usar arquitectura en nuevas features

💪 FILOSOFÍA:
  "Clean Architecture no es sobre escribir más código.
   Es sobre escribir código que es fácil de entender,
   testear y cambiar."
```

---

## Notas del Facilitador

**Tiempo sugerido:**
- Slide 1: 5 min (intro)
- Slides 2-4: 10 min (problema/solución)
- Slides 5-10: 30 min (explicar capas)
- Slide 11: 10 min (HTTP layer)
- Slide 12: 10 min (agregar feature)
- Slide 13: 5 min (testing)
- Slides 14-17: 15 min (Q&A)
- Slide 18: 5 min (recursos)
- Slide 19: 90 min (lab práctico)
- Slide 20: 10 min (cierre)

**Demostración en vivo:**
- Abrir `HandleIncomingMessageUseCase.js` en editor
- Mostrar Constructor → execute() method
- Rastrear flujo: qué llama gateway, qué retorna
- Abrir tests, correr `node test_unit.js`
- Crear nuevos test en vivo

**Lab Setup:**
- Que cada dev clone el repo
- Que siga los pasos (Slide 19)
- Code review mutuo de lo que creó
- Mostrar resultados de tests
