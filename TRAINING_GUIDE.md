# Training Guide: Clean Architecture

## 📅 Programa de Entrenamiento

**Duración Total:** 3-4 horas (3 sesiones)
**Audiencia:** Todo el equipo de desarrollo
**Prerequisito:** Conocimiento básico de Node.js

---

## 🎯 Objetivos

Al final del entrenamiento, el equipo podrá:
- ✓ Entender la arquitectura limpia del CRM
- ✓ Crear nuevas features siguiendo el patrón
- ✓ Testear código correctamente
- ✓ Resolver bugs en cualquier capa

---

## 📚 SESIÓN 1: Arquitectura (60-90 minutos)

### Parte 1: Conceptos (30 min)

**1.1 - ¿Qué es Clean Architecture?**

Clean Architecture es una forma de organizar código en capas independientes:

```
┌──────────────────────────────────────────────┐
│  HTTP Layer (Express)                        │  ← Cómo entra/sale data
├──────────────────────────────────────────────┤
│  Infrastructure (Bootstrap/DI)               │  ← Cómo se conectan las cosas
├──────────────────────────────────────────────┤
│  Adapter Layer (Gateways)                    │  ← Abstracción de servicios
├──────────────────────────────────────────────┤
│  Application Layer (Use Cases)               │  ← Qué hace el negocio
├──────────────────────────────────────────────┤
│  Domain Layer (Entities)                     │  ← Reglas del negocio
└──────────────────────────────────────────────┘
```

**Ventajas:**
- Cada capa es independiente
- Fácil de testear
- Fácil de cambiar (ej: cambiar DB)
- Código más limpio y organizado

**Desventajas:**
- Más archivos
- Más inyección de dependencias
- Curva de aprendizaje

---

### Parte 2: Nuestras Capas (60 min)

**2.1 - Domain Layer** (src/domain/)

```javascript
// Contact.js - Entidad de negocio pura
class Contact {
  constructor(data) {
    this.instagramId = data.instagram_id;
    this.state = data.bot_state || 'active';
    this.tags = data.tags || [];
  }

  isActive() {
    return this.state === 'active';
  }

  switchToAiAgent() {
    this.state = 'ai_agent';
  }
}
```

**Qué es:** Entidades que representan objetos del negocio
**Responsabilidad:** Lógica del dominio (reglas de negocio)
**No debe:** Conocer de bases de datos, APIs, frameworks

**Archivos:**
- `src/domain/entities/Contact.js` - Usuario/cliente
- `src/domain/entities/Message.js` - Mensaje en conversación

---

**2.2 - Adapter Layer** (src/adapters/)

```javascript
// MetaGateway.js - Abstrae la API de Meta
class MetaGateway {
  async getUserProfile(senderId) {
    return meta.getUserProfile(senderId);
  }

  async sendMessage(id, text) {
    return meta.sendMessage(id, text);
  }
}
```

**Qué es:** Interfaces que abstraen servicios externos
**Responsabilidad:** Comunicarse con APIs, bases de datos
**Patrón:** Cada gateway = 1 servicio externo

**Gateways:**
- `MetaGateway` - Instagram/Meta API
- `OpenAiGateway` - AI agent
- `FlowGateway` - Flow engine
- `SupabaseGateway` - Base de datos

---

**2.3 - Application Layer** (src/use-cases/)

```javascript
// HandleIncomingMessageUseCase.js - Orquesta el negocio
class HandleIncomingMessageUseCase {
  constructor({ metaGateway, openaiGateway, supabaseGateway }) {
    this.meta = metaGateway;
    this.openai = openaiGateway;
    this.db = supabaseGateway;
  }

  async execute(inputData) {
    // 1. Validar input
    // 2. Obtener contacto de BD
    // 3. Decidir qué hacer (flujo, IA, etc)
    // 4. Ejecutar acción
    // 5. Retornar resultado
  }
}
```

**Qué es:** Casos de uso = lógica de negocio
**Responsabilidad:** Orquestar gateways + entities
**Patrón:** 1 Use Case = 1 flujo de usuario

**Use Cases:**
- `HandleIncomingMessageUseCase` - Procesar DM
- `HandleCommentUseCase` - Procesar comentarios
- `HandlePostbackUseCase` - Procesar botones
- `HandleMentionUseCase` - Procesar menciones
- `HandleAttachmentsUseCase` - Procesar archivos

---

**2.4 - Infrastructure Layer** (src/infrastructure/)

```javascript
// bootstrap.js - Inyector de dependencias
function bootstrap(dependencies) {
  const metaGateway = new MetaGateway();
  const openaiGateway = new OpenAiGateway();
  const handleIncomingMessage = new HandleIncomingMessageUseCase({
    metaGateway,
    openaiGateway,
    // ...
  });

  return {
    useCases: { handleIncomingMessage, /* ... */ },
    gateways: { metaGateway, openaiGateway, /* ... */ }
  };
}
```

**Qué es:** Conecta todas las piezas
**Responsabilidad:** Crear instancias, inyectar dependencias
**Patrón:** DI Container = IoC pattern

---

## 🔧 SESIÓN 2: Ejemplos Prácticos (60 minutos)

### Parte 1: Cómo Funciona un Request (30 min)

**Flujo de un mensaje:**

```
1. Meta webhook recibe DM
   ↓
2. app.js lo recibe en /webhook POST
   ↓
3. app.js extrae datos (senderId, text, etc)
   ↓
4. app.js llama: di.handleIncomingMessage.execute({...})
   ↓
5. UseCase recibe input
   ├→ Obtiene Contact de BD (SupabaseGateway)
   ├→ Chequea state del Contact
   ├→ Si es 'ai_agent': llama OpenAiGateway
   ├→ Si es 'awaiting_input': valida input
   ├→ Si es 'active': busca flow o ejecuta IA
   ↓
6. UseCase actualiza Contact en BD
   ↓
7. UseCase retorna {status: 'success', ...}
   ↓
8. app.js recibe respuesta (no la usa, es async)
   ↓
9. Meta recibe 200 OK (ya)
```

---

### Parte 2: Código Real - Walkthrough (30 min)

**Abrirse estos archivos en el editor:**

1. `src/use-cases/HandleIncomingMessageUseCase.js` (247 líneas)
   - Mostrar constructor (qué recibe)
   - Mostrar método execute()
   - Explicar flujo de decisión (estado de contact)
   - Mostrar cómo retorna resultado

2. `src/adapters/gateways/SupabaseGateway.js` (207 líneas)
   - Mostrar constructor
   - Mostrar getContactByInstagramId()
   - Mostrar updateContact()
   - Explicar error handling

3. `src/infrastructure/bootstrap.js` (114 líneas)
   - Mostrar cómo se instancian gateways
   - Mostrar cómo se instancian use-cases
   - Explicar inyección de dependencias

4. `app.js` línea 173 (wrapper dual)
   - Mostrar cómo se llama UseCase desde webhook
   - Explicar por qué ambas versiones corren

---

## 🛠️ SESIÓN 3: Hands-On Lab (90 minutos)

### Tarea: Crear un Nuevo UseCase

**Escenario:** Crear un handler para un nuevo tipo de evento: `handleLocationUseCase`

**Requisitos:**
- Crear archivo en `src/use-cases/HandleLocationUseCase.js`
- Recibir location data (lat, lon, city)
- Guardar en Contact.fields
- Retornar {status, contact}

**Pasos:**

**Paso 1: Entender la estructura** (10 min)
```bash
# Abrir un UseCase existente como referencia
cat src/use-cases/HandlePostbackUseCase.js
```

**Paso 2: Crear el archivo** (15 min)
```javascript
// src/use-cases/HandleLocationUseCase.js
class HandleLocationUseCase {
  constructor({ supabaseGateway, broadcastLog }) {
    this.db = supabaseGateway;
    this.broadcastLog = broadcastLog;
  }

  async execute({ senderId, latitude, longitude, city }) {
    if (!senderId) throw new Error('Missing senderId');

    // 1. Obtener contacto
    const contact = await this.db.getContactByInstagramId(senderId);
    if (!contact) return { status: 'contact_not_found' };

    // 2. Guardar location
    contact.setField('location_lat', latitude);
    contact.setField('location_lon', longitude);
    contact.setField('location_city', city);

    // 3. Actualizar en BD
    await this.db.updateContact(contact);

    // 4. Log
    this.broadcastLog('LOCATION', `Location guardada para ${senderId}: ${city}`);

    // 5. Retornar
    return {
      status: 'location_saved',
      contact
    };
  }
}

module.exports = HandleLocationUseCase;
```

**Paso 3: Registrar en index.js** (5 min)
```javascript
// src/use-cases/index.js
const HandleLocationUseCase = require('./HandleLocationUseCase');
module.exports = {
  // ... existing
  HandleLocationUseCase
};
```

**Paso 4: Agregar a bootstrap.js** (10 min)
```javascript
// src/infrastructure/bootstrap.js
const handleLocationUseCase = new HandleLocationUseCase({
  supabaseGateway,
  broadcastLog
});

return {
  useCases: {
    // ... existing
    handleLocationUseCase
  }
};
```

**Paso 5: Testear** (30 min)
```javascript
// test_location.js (crear nuevo)
const bootstrap = require('./src/infrastructure/bootstrap');
const Contact = require('./src/domain/entities/Contact');

const di = bootstrap({
  state: { INSTAGRAM_ACCOUNT_ID: '999' },
  broadcastLog: (type, msg) => console.log(`[${type}] ${msg}`)
});

async function test() {
  // 1. Mock contact
  const mockContact = Contact.new('123', 'Test User', {});
  console.log('Initial state:', mockContact.fields);

  // 2. Usar UseCase (con mock gateway)
  // Aquí necesitarías mock de supabaseGateway
  
  console.log('✅ Test completado');
}

test().catch(console.error);
```

**Paso 6: Feedback** (20 min)
- Mostrar lo que creó
- Qué funcionó, qué no
- Cómo mejorar el código

---

## 📚 Recursos para el Equipo

**Documentación:**
- `docs/CLEAN_ARCHITECTURE.md` - Guía completa de arquitectura
- `IMPLEMENTATION_PLAN.md` - Cómo se implementó
- Este documento (TRAINING_GUIDE.md)

**Código de referencia:**
- `src/use-cases/HandleIncomingMessageUseCase.js` - Main use-case
- `src/adapters/gateways/SupabaseGateway.js` - DB gateway
- `src/infrastructure/bootstrap.js` - DI setup

**Tests para aprender:**
- `test_unit.js` - Cómo testear entities
- `test_integration.js` - Cómo testear DI

---

## ✅ Checklist Post-Training

- [ ] Equipo entiende las 5 capas
- [ ] Equipo puede leer un UseCase
- [ ] Equipo puede leer un Gateway
- [ ] Equipo puede crear un nuevo UseCase
- [ ] Equipo sabe cómo correr tests
- [ ] Equipo sabe cómo agregar una feature

---

## 🎯 Próximos Pasos del Equipo

**Después del training:**
1. Cada dev crea 1 pequeño UseCase
2. Code review mutuo
3. Integrar en main
4. Crear features nuevas usando arquitectura

---

## 📞 Preguntas Frecuentes

**P: ¿Por qué tanta complejidad?**
R: Facilita testing, mantenimiento y cambios. Vale la pena.

**P: ¿Cuándo usar qué?**
R: Entity = reglas de negocio, Gateway = servicios externos, UseCase = orquestar.

**P: ¿Y si la arquitectura cambia?**
R: Lo bueno es que puedes cambiar implementación sin tocar lógica.

**P: ¿Cómo agrego un nuevo Gateway?**
R: Crear archivo, implementar métodos, agregar a bootstrap(), inyectar en use-cases.

---

## 💡 Filosofía

> "Clean Architecture no es sobre escribir más código.
> Es sobre escribir código que es fácil de entender, testear y cambiar."

Cada capa tiene UNA responsabilidad. Eso es todo.
