# FASE 2: TRIGGERS ROBUSTO - Plan Detallado de Desarrollo

**Duración**: 2 semanas (80 horas)  
**Equipo**: 1 Backend Developer + 1 Frontend Developer + 1 QA  
**Objetivo**: Sistema avanzado de triggers como ManyChat  
**Resultado**: Triggers multi-tipo, multi-canal, con matching inteligente

---

## 📋 ÍNDICE

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Tipos de Triggers](#tipos-de-triggers)
3. [Especificaciones Detalladas](#especificaciones-detalladas)
4. [Arquitectura Backend](#arquitectura-backend)
5. [Arquitectura Frontend](#arquitectura-frontend)
6. [Tareas de Desarrollo](#tareas-de-desarrollo)
7. [Código de Ejemplo](#código-de-ejemplo)
8. [UI Mockups](#ui-mockups)
9. [API Endpoints](#api-endpoints)
10. [Testing Plan](#testing-plan)

---

## Resumen Ejecutivo

### Cambios Principales

Este fase **NO** cambia la UI de Fase 1, pero **expande la funcionalidad** de triggers:

| Aspecto | Actual | Después | Impacto |
|---------|--------|---------|---------|
| Tipos de triggers | 1 | 7+ | Alto |
| Matching logic | Básico | Avanzado | Alto |
| Condiciones | No | Sí | Medio |
| Canales | Genérico | Instagram/WA/Messenger | Alto |
| API | Simple | Robusta | Medio |

### Nuevos Tipos de Triggers

```
1. Palabra Clave (existente, mejorado)
   - Keyword matching
   - Regex support (UPGRADE)
   - AI intent (UPGRADE)

2. Comentario en Publicación (NUEVO)
   - Post comments
   - Story comments
   - Reel comments

3. Respuesta a Historia (NUEVO)
   - Story reply text
   - Story reply with emoji

4. Mensaje DM (mejorado)
   - Direct message text
   - DM con archivo adjunto

5. Evento de Contacto (NUEVO)
   - Birthday
   - Tag added
   - Custom event

6. URL de Referencia (NUEVO)
   - Click en tracking link
   - UTM parameters

7. Acción Específica (NUEVO)
   - User action
   - Custom webhook

8. Tiempo Específico (UPGRADE)
   - Scheduled trigger
   - Recurring
```

### Stack No Cambia

**Backend:**
- Node.js + Express (existente)
- Supabase (existente)
- Nuevas rutas: `/api/triggers/*`

**Frontend:**
- JavaScript vanilla (existente)
- Componente nuevo: `triggers/trigger-system.js`
- Modal reutilizable de Fase 1

---

## Tipos de Triggers

### 1. Disparador: Palabra Clave (Mejorado)

#### Descripción
El usuario escribe/menciona una palabra o frase específica en un mensaje.

#### Configuración Disponible

```
┌─────────────────────────────────────┐
│ Tipo: Palabra Clave                 │
├─────────────────────────────────────┤
│                                     │
│ Tipo de Coincidencia:              │
│ ⦿ Contiene                          │
│ ○ Exacta                            │
│ ○ Comienza con                      │
│ ○ Termina con                       │
│ ○ Regex (UPGRADE)                   │
│                                     │
│ Palabras Clave:                    │
│ [precio][cuanto vale][costo]        │
│ [+ Agregar más]                     │
│                                     │
│ Opciones:                           │
│ ☑ Case-insensitive (default)        │
│ ☐ Ignorar acentos                   │
│ ☐ Solo palabras completas           │
│                                     │
│ Condiciones Adicionales:            │
│ [+ Agregar Condición]               │
│                                     │
└─────────────────────────────────────┘
```

#### Lógica de Matching

```javascript
// Contiene: "precio" en "cual es el precio?"
"cual es el precio?".includes("precio") // true

// Exacta: "precio" = "precio" completo
message === "precio" // true

// Comienza con: "hola" comienza con "hol"
message.startsWith("hol") // true

// Termina con: "costo" termina con "sto"
message.endsWith("sto") // true

// Regex: /^precio\s*[0-9]+$/
/^precio\s*[0-9]+$/.test("precio 100") // true
```

#### Casos de Uso
- "¿Cuál es el precio?" → Dispara flujo de precios
- "INFO" → Dispara flujo de información
- "PROMO" → Dispara oferta especial

---

### 2. Disparador: Comentario en Publicación (NUEVO)

#### Descripción
El usuario comenta en una publicación o reel de Instagram.

#### Requisitos
- Integración Instagram Graph API
- Webhook listening en `POST /webhook/instagram`
- Permisos: `instagram_manage_messages`, `instagram_basic`

#### Configuración

```
┌─────────────────────────────────────┐
│ Tipo: Comentario en Publicación     │
├─────────────────────────────────────┤
│                                     │
│ Tipo de Publicación:               │
│ ☑ Posts                             │
│ ☑ Reels                             │
│ ☐ Stories                           │
│                                     │
│ Filtro de Comentario:              │
│ ○ Cualquier comentario             │
│ ○ Contiene palabras clave:         │
│   [interesado][comprar][precio]    │
│                                     │
│ Responder automaticamente:         │
│ ☑ Sí, enviar DM                    │
│ ☐ No, solo notificar               │
│                                     │
└─────────────────────────────────────┘
```

#### Estructura de Evento (Webhook)

```json
{
  "event": "comment_received",
  "channel": "instagram",
  "data": {
    "comment_id": "17999...",
    "comment_text": "¿Cuánto cuesta?",
    "commenter": {
      "id": "123456",
      "username": "user_handle",
      "name": "User Name"
    },
    "post": {
      "id": "post_123",
      "type": "IMAGE" // IMAGE, VIDEO (reel), CAROUSEL
    },
    "timestamp": "2026-07-30T10:30:00Z"
  }
}
```

#### Casos de Uso
- Comenta en foto de producto → Enviar ficha técnica
- Comenta en video → Enviar enlace
- Comenta emoji ❤️ → Agregar a lista de interesados

---

### 3. Disparador: Respuesta a Historia (NUEVO)

#### Descripción
El usuario responde a una historia de Instagram.

#### Configuración

```
┌─────────────────────────────────────┐
│ Tipo: Respuesta a Historia          │
├─────────────────────────────────────┤
│                                     │
│ Filtro de Respuesta:               │
│ ○ Cualquier respuesta              │
│ ○ Contiene palabras clave:         │
│   [sí][interesado][quiero]        │
│ ○ Es emoji específico:             │
│   [❤️][👍][🔥]                      │
│                                     │
│ Respuesta Automática:              │
│ Enviar DM con:                     │
│ [Catálogo PDF]                     │
│                                     │
└─────────────────────────────────────┘
```

#### Estructura de Evento

```json
{
  "event": "story_reply_received",
  "channel": "instagram",
  "data": {
    "story_id": "story_456",
    "reply_text": "Sí, me interesa",
    "reply_type": "text" // text, emoji, media
    "responder": {
      "id": "789",
      "username": "user_handle"
    },
    "timestamp": "2026-07-30T10:35:00Z"
  }
}
```

#### Casos de Uso
- Responde ❤️ a "¿Te interesa?" → Agregar a lista
- Responde "Sí" a CTA → Enviar catálogo
- Responde cualquier cosa → Registrar interés

---

### 4. Disparador: Mensaje DM (Mejorado)

#### Descripción
El usuario envía un mensaje directo (DM) a la cuenta de Instagram.

#### Mejoras vs Actual

```
Actual:
- Solo texto
- Matching de palabras clave

Nuevo:
- Texto + archivo
- Matching avanzado (regex, AI intent)
- Detección de tipo de archivo
- Media analysis (opcional, UPGRADE)
```

#### Configuración

```
┌─────────────────────────────────────┐
│ Tipo: Mensaje DM (mejorado)         │
├─────────────────────────────────────┤
│                                     │
│ Tipo de Mensaje:                   │
│ ☑ Texto                             │
│ ☑ Con archivo                       │
│ ○ Archivo específico:               │
│   [Imagen][Video][PDF]             │
│                                     │
│ Matching de Texto:                 │
│ (opciones de palabra clave como 1)  │
│                                     │
│ Detección de Archivo:              │
│ ○ Cualquier archivo                │
│ ○ Solo imágenes                    │
│ ○ Solo videos                      │
│ ○ Solo PDFs                        │
│                                     │
└─────────────────────────────────────┘
```

#### Casos de Uso
- Usuario envía DM + foto del producto → Crear ticket de soporte
- Usuario envía "hola" → Enviar catálogo
- Usuario envía video → Procesar y responder

---

### 5. Disparador: Evento de Contacto (NUEVO)

#### Descripción
Se dispara cuando sucede un evento específico en el perfil del contacto.

#### Tipos de Eventos Disponibles

| Evento | Descripción | Parámetros |
|--------|-------------|-----------|
| Birthday | Cumpleaños del contacto | date |
| Tag Added | Se agrega una etiqueta | tag_name |
| Tag Removed | Se quita una etiqueta | tag_name |
| Field Updated | Se actualiza un campo personalizado | field_name, new_value |
| Score Reached | Contacto alcanza cierta puntuación | score |
| Days Since Action | N días desde última acción | days, action_type |

#### Configuración

```
┌─────────────────────────────────────┐
│ Tipo: Evento de Contacto            │
├─────────────────────────────────────┤
│                                     │
│ Evento:                            │
│ ○ Cumpleaños                       │
│ ○ Etiqueta Agregada                │
│ ○ Campo Personalizado Updated      │
│ ○ Puntuación Alcanzada             │
│ ○ Inactividad (N días)             │
│                                     │
│ Parámetros Específicos:            │
│ (según evento seleccionado)         │
│                                     │
│ Ejecutar si:                       │
│ ○ Siempre                          │
│ ○ Solo si cumple condición         │
│   [+ Agregar Condición]            │
│                                     │
└─────────────────────────────────────┘
```

#### Casos de Uso
- Cumpleaños → Enviar descuento especial
- Tag "VIP" agregada → Enviar ofertas premium
- 30 días sin actividad → Reactivar con campaña
- Score > 100 → Ofrecer asesoría personal

---

### 6. Disparador: URL de Referencia (NUEVO)

#### Descripción
El usuario hace clic en un enlace de referencia rastreado.

#### Configuración

```
┌─────────────────────────────────────┐
│ Tipo: URL de Referencia             │
├─────────────────────────────────────┤
│                                     │
│ Enlace Rastreado:                  │
│ [https://faroles.com/?ref=ig001]   │
│                                     │
│ Parámetros UTM:                    │
│ ☑ utm_source: instagram            │
│ ☑ utm_medium: (auto-detectar)      │
│ ☑ utm_campaign: (auto-detectar)    │
│ ☑ utm_content: (auto-detectar)     │
│                                     │
│ Acciones:                          │
│ ☑ Registrar click                  │
│ ☑ Enviar DM de bienvenida          │
│ ☑ Agregar tag: "web_visitor"       │
│                                     │
└─────────────────────────────────────┘
```

#### Estructura de Evento (Backend)

```json
{
  "event": "tracking_link_clicked",
  "channel": "instagram",
  "data": {
    "contact_id": "ig_789",
    "username": "user_handle",
    "link": "https://faroles.com/?ref=ig001",
    "utm_params": {
      "source": "instagram",
      "medium": "story",
      "campaign": "summer_promo",
      "content": "post_123"
    },
    "click_time": "2026-07-30T10:40:00Z",
    "landing_page": "/products/faroles-rusticos"
  }
}
```

#### Casos de Uso
- Click en link de story → Registrar y enviar promo
- Click de enlace específico → Activar flujo de compra
- UTM = newsletter → Agregar a lista premium

---

### 7. Disparador: Acción del Sistema (NUEVO)

#### Descripción
Se dispara cuando ocurre una acción manual o automática en el CRM.

#### Tipos de Acciones

| Acción | Descripción |
|--------|-------------|
| manual_trigger | Disparo manual de usuario |
| api_call | Llamada a API externa |
| webhook | Webhook personalizado |
| schedule | Programado a hora específica |
| condition_met | Condición en flujo anterior |

#### Configuración

```
┌─────────────────────────────────────┐
│ Tipo: Acción del Sistema            │
├─────────────────────────────────────┤
│                                     │
│ Acción Disparadora:                │
│ ○ Manual (click de usuario)         │
│ ○ API (webhook personalizado)       │
│ ○ Programado (hora específica)      │
│ ○ Desde otro flujo                  │
│                                     │
│ Si es "Programado":                │
│ Hora: [14:30]                       │
│ Días: ☑L ☑M ☑M ☑J ☑V ☐S ☐D      │
│ Timezone: [America/Bogota]          │
│                                     │
│ Si es "API":                       │
│ Webhook URL: [________________]    │
│ Validar token: [____________]       │
│                                     │
└─────────────────────────────────────┘
```

#### Casos de Uso
- Disparo manual → Enviar encuesta
- API externa → Sincronizar datos
- Programado 9am → Enviar saludo diario
- Desde otro flujo → Encadenar automatizaciones

---

## Especificaciones Detalladas

### Modelo de Datos - Trigger

```javascript
{
  // Identificación
  id: "trigger_1",
  flowId: "flow_abc123",
  
  // Tipo y canal
  type: "keyword|comment|story_reply|dm|contact_event|url_ref|system_action",
  channel: "instagram|whatsapp|messenger|all",
  
  // Configuración general
  enabled: true,
  priority: 1, // 1=high, 2=medium, 3=low
  
  // Configuración específica por tipo
  config: {
    // Para keyword
    matchType: "contains|exact|startsWith|endsWith|regex",
    keywords: ["palabra1", "palabra2"],
    caseInsensitive: true,
    ignoreAccents: false,
    wholeWords: false,
    
    // Para comment
    postTypes: ["IMAGE", "VIDEO", "CAROUSEL"],
    respondAutomatically: true,
    
    // Para story_reply
    replyFilter: "any|keywords|emoji",
    targetEmojis: ["❤️", "👍"],
    
    // Para contact_event
    eventType: "birthday|tag_added|field_updated|score_reached|inactivity",
    eventParams: { days: 30, score: 100 },
    
    // Para url_ref
    trackingUrl: "https://...",
    utmParams: { source: "instagram", medium: "story" },
    
    // Para system_action
    actionType: "manual|api|webhook|schedule",
    scheduleTime: "14:30",
    scheduleDays: ["MON", "TUE"],
    timezone: "America/Bogota",
    
    // Compartido
    conditions: [
      {
        id: "cond_1",
        field: "contact_tags",
        operator: "includes",
        value: "vip"
      }
    ]
  },
  
  // Resultado
  nextStep: "step_1", // ID del primer paso del flujo
  
  // Metadata
  createdAt: "2026-07-30T10:00:00Z",
  updatedAt: "2026-07-30T10:00:00Z",
  stats: {
    timesTriggered: 42,
    lastTriggered: "2026-07-30T10:35:00Z"
  }
}
```

### Modelo de Datos - Condición

```javascript
{
  id: "cond_1",
  type: "text|number|boolean|date|list",
  
  field: "message_text|contact_tags|contact_score|contact_email|...",
  operator: "equals|contains|startsWith|endsWith|gt|lt|gte|lte|includes|excludes|matches",
  value: "algo" | 100 | true | "2026-07-30",
  
  logic: "AND|OR" // relación con siguiente condición
}
```

---

## Arquitectura Backend

### Nuevas Rutas API

```javascript
// CREATE
POST /api/triggers
  Body: { flowId, type, channel, config, nextStep }
  Response: { id, ... }

// READ
GET /api/triggers
  Query: { flowId, type, channel, enabled }
  Response: [ { id, type, config, ... } ]

GET /api/triggers/:id
  Response: { id, type, config, ... }

// UPDATE
PUT /api/triggers/:id
  Body: { config, enabled, priority }
  Response: { id, ... }

// DELETE
DELETE /api/triggers/:id
  Response: { success: true }

// TEST
POST /api/triggers/:id/test
  Body: { testData }
  Response: { matches: boolean, debug: {...} }

// STATS
GET /api/triggers/:id/stats
  Response: { timesTriggered, lastTriggered, ... }
```

### Nuevo Módulo: Trigger Engine

```
triggers/
├── engine.js              (procesador principal)
├── matchers/
│  ├── keyword-matcher.js   (palabra clave)
│  ├── comment-matcher.js   (comentarios)
│  ├── event-matcher.js     (eventos de contacto)
│  ├── url-matcher.js       (URLs de referencia)
│  └── system-matcher.js    (acciones del sistema)
├── conditions.js          (evaluador de condiciones)
├── validators.js          (validar configuración)
└── tests/
   └── trigger-engine.test.js
```

### Pseudo-código del Engine

```javascript
// triggers/engine.js
class TriggerEngine {
  async processTrigger(event) {
    // 1. Encontrar triggers aplicables
    const triggers = await this.findTriggers(event.channel, event.type);
    
    // 2. Para cada trigger, evaluar si dispara
    for (const trigger of triggers) {
      if (!trigger.enabled) continue;
      
      // 3. Evaluar matcher específico
      const matcher = this.getMatcher(trigger.type);
      if (!matcher.matches(event, trigger.config)) continue;
      
      // 4. Evaluar condiciones adicionales
      const conditions = trigger.config.conditions || [];
      if (!this.evaluateConditions(event, conditions)) continue;
      
      // 5. DISPARAR: ejecutar próximo paso del flujo
      await this.executeNextStep(trigger.flowId, trigger.nextStep, event);
      
      // 6. Registrar estadísticas
      await this.recordTriggerStat(trigger.id, event);
    }
  }
  
  evaluateConditions(event, conditions) {
    // AND/OR logic
    // Comparar campos del evento con valores especificados
  }
  
  getMatcher(triggerType) {
    const matchers = {
      keyword: KeywordMatcher,
      comment: CommentMatcher,
      story_reply: StoryReplyMatcher,
      dm: DMMatcher,
      contact_event: ContactEventMatcher,
      url_ref: URLReferenceMatcher,
      system_action: SystemActionMatcher
    };
    return new matchers[triggerType]();
  }
}

// Example: KeywordMatcher
class KeywordMatcher {
  matches(event, config) {
    const { keywords, matchType, caseInsensitive, ignoreAccents } = config;
    const text = caseInsensitive ? event.message.toLowerCase() : event.message;
    
    for (const keyword of keywords) {
      const searchTerm = caseInsensitive ? keyword.toLowerCase() : keyword;
      
      switch (matchType) {
        case 'contains':
          if (text.includes(searchTerm)) return true;
          break;
        case 'exact':
          if (text === searchTerm) return true;
          break;
        case 'startsWith':
          if (text.startsWith(searchTerm)) return true;
          break;
        case 'regex':
          if (new RegExp(searchTerm).test(text)) return true;
          break;
      }
    }
    
    return false;
  }
}
```

### Webhook Handlers

```javascript
// Recibir eventos de Instagram
POST /webhook/instagram
  - comment received → CommentMatcher
  - story reply → StoryReplyMatcher
  - message received → DMMatcher
  - link clicked → URLReferenceMatcher

// Eventos del Sistema
POST /webhook/events
  - contact.birthday
  - contact.tag_added
  - contact.field_updated
  - flow.triggered_manually
```

---

## Arquitectura Frontend

### Nuevo Componente: TriggerSystem

```
components/triggers/
├── trigger-system.js      (controlador principal)
├── trigger-modal.js       (modal de selección)
├── trigger-config.js      (formulario de configuración)
├── trigger-templates.js   (templates por tipo)
├── condition-builder.js   (constructor de condiciones)
└── trigger-preview.js     (preview de configuración)
```

### Componente Principal

```javascript
const TriggerSystem = (function() {
  let triggers = [];
  let currentTrigger = null;
  
  function openTriggerModal(flowId) {
    // 1. Mostrar modal de selección de tipo
    // 2. User selecciona tipo (keyword, comment, etc.)
    // 3. Mostrar formulario específico del tipo
    // 4. User configura parámetros
    // 5. Guardar via API
  }
  
  function renderTriggerList(flowId) {
    // Listar triggers del flujo actual
    // Mostrar iconos, tipos, configuración resumida
    // Permitir edit/delete
  }
  
  function editTrigger(triggerId) {
    // Cargar datos del trigger
    // Mostrar formulario prerellenado
    // Permitir cambios
    // Guardar via API
  }
  
  return {
    init: function(container, flowId) {
      // ...
    },
    openTriggerModal,
    renderTriggerList,
    editTrigger
  };
})();
```

---

## Tareas de Desarrollo

### Semana 1 (40 horas)

#### Día 1-2: Backend Foundation (16 horas)

- [ ] **Modelo de datos mejorado** (4 horas)
  - [ ] Actualizar schema.sql con nuevas columnas
  - [ ] Crear migraciones en Supabase
  - [ ] Estructura JSON para config

- [ ] **Trigger Engine base** (8 horas)
  - [ ] Crear `triggers/engine.js`
  - [ ] Implementar `evaluateConditions()`
  - [ ] Implementar `findTriggers()`
  - [ ] Setup de matchers

- [ ] **Testing base** (4 horas)
  - [ ] Setup Jest para triggers
  - [ ] Tests básicos de engine

#### Día 3-5: Matchers Implementation (24 horas)

- [ ] **KeywordMatcher** (4 horas)
  - [ ] Implementar todos los tipos de matching
  - [ ] Tests unitarios
  - [ ] Casos edge (acentos, mayúsculas, etc.)

- [ ] **CommentMatcher** (4 horas)
  - [ ] Parsear eventos de Instagram
  - [ ] Filtrar por tipo de post
  - [ ] Tests

- [ ] **StoryReplyMatcher** (3 horas)
  - [ ] Detectar respuestas de story
  - [ ] Filtrar emoji vs texto
  - [ ] Tests

- [ ] **DMMatcher** (3 horas)
  - [ ] Mejorar matching actual
  - [ ] Soportar archivos
  - [ ] Tests

- [ ] **ContactEventMatcher** (3 horas)
  - [ ] Nuevos tipos de eventos
  - [ ] Parámetros dinámicos
  - [ ] Tests

- [ ] **URLReferenceMatcher** (3 horas)
  - [ ] Rastrear clicks
  - [ ] Extraer UTM parameters
  - [ ] Tests

- [ ] **SystemActionMatcher** (1 hora)
  - [ ] Manual triggers
  - [ ] API webhooks
  - [ ] Tests

#### Día 6-7: API Endpoints (16 horas)

- [ ] **CRUD endpoints** (8 horas)
  - [ ] POST /api/triggers (crear)
  - [ ] GET /api/triggers (listar)
  - [ ] GET /api/triggers/:id (obtener)
  - [ ] PUT /api/triggers/:id (actualizar)
  - [ ] DELETE /api/triggers/:id (eliminar)

- [ ] **Endpoints especiales** (4 horas)
  - [ ] POST /api/triggers/:id/test (test)
  - [ ] GET /api/triggers/:id/stats (estadísticas)

- [ ] **Validación y error handling** (4 horas)
  - [ ] Validar configuración por tipo
  - [ ] Error responses consistentes
  - [ ] Logging

---

### Semana 2 (40 horas)

#### Día 1-3: Frontend Components (24 horas)

- [ ] **Trigger Modal** (8 horas)
  - [ ] Mostrar lista de tipos de triggers
  - [ ] Búsqueda y filtro
  - [ ] Descripción de cada tipo
  - [ ] Selección y navegación

- [ ] **Trigger Config Forma** (10 horas)
  - [ ] Formulario base (reutilizable)
  - [ ] Configuración por tipo (keyword, comment, etc.)
  - [ ] Validaciones en frontend
  - [ ] Preview de configuración

- [ ] **Condition Builder** (6 horas)
  - [ ] Interfaz para agregar condiciones
  - [ ] AND/OR logic
  - [ ] Remover condiciones

#### Día 4-5: Integration & Testing (16 horas)

- [ ] **Integrar con builder existente** (6 horas)
  - [ ] Conectar TriggerSystem con builder.js
  - [ ] Actualizar flujo de edición de triggers
  - [ ] Guardar y cargar triggers

- [ ] **End-to-end testing** (6 horas)
  - [ ] Crear trigger de cada tipo
  - [ ] Verificar que se disparan correctamente
  - [ ] Verificar estadísticas

- [ ] **Polish y fixes** (4 horas)
  - [ ] UX improvements
  - [ ] Error messages claros
  - [ ] Responsividad

#### Día 6-7: Documentation & Final Testing (4 horas)

- [ ] **Documentar API** (2 horas)
- [ ] **Testing final** (2 horas)

---

## Código de Ejemplo

### Backend: Trigger Engine

```javascript
// triggers/engine.js
class TriggerEngine {
  constructor(supabase, logger) {
    this.db = supabase;
    this.logger = logger;
    this.matchers = {
      keyword: new KeywordMatcher(),
      comment: new CommentMatcher(),
      story_reply: new StoryReplyMatcher(),
      dm: new DMMatcher(),
      contact_event: new ContactEventMatcher(),
      url_ref: new URLReferenceMatcher(),
      system_action: new SystemActionMatcher()
    };
  }

  async processTrigger(event) {
    try {
      // 1. Find applicable triggers
      const triggers = await this.findApplicableTriggers(event);
      
      this.logger.info(`Found ${triggers.length} potential triggers for event`, {
        eventType: event.type,
        channel: event.channel
      });

      // 2. Evaluate each trigger
      for (const trigger of triggers) {
        if (!trigger.enabled) continue;

        const matches = await this.evaluateTrigger(event, trigger);
        if (matches) {
          this.logger.info(`Trigger matched`, { triggerId: trigger.id });
          
          // 3. Execute next step
          await this.executeNextStep(trigger.flowId, trigger.nextStep, event);
          
          // 4. Record stats
          await this.recordTriggerStat(trigger.id);
        }
      }
    } catch (error) {
      this.logger.error('Error processing trigger', { error });
      throw error;
    }
  }

  async evaluateTrigger(event, trigger) {
    // 1. Check matcher
    const matcher = this.matchers[trigger.type];
    if (!matcher) {
      throw new Error(`Unknown trigger type: ${trigger.type}`);
    }

    if (!matcher.matches(event, trigger.config)) {
      return false;
    }

    // 2. Check conditions
    const conditions = trigger.config.conditions || [];
    return this.evaluateConditions(event, conditions);
  }

  evaluateConditions(event, conditions) {
    if (conditions.length === 0) return true;

    let result = true;
    let logic = 'AND'; // default

    for (const condition of conditions) {
      const conditionMet = this.evaluateCondition(event, condition);
      
      if (logic === 'AND') {
        result = result && conditionMet;
      } else {
        result = result || conditionMet;
      }
      
      logic = condition.logic || 'AND';
    }

    return result;
  }

  evaluateCondition(event, condition) {
    const { field, operator, value } = condition;
    const eventValue = event[field];

    switch (operator) {
      case 'equals':
        return eventValue === value;
      case 'contains':
        return typeof eventValue === 'string' && eventValue.includes(value);
      case 'gt':
        return eventValue > value;
      case 'lt':
        return eventValue < value;
      case 'includes':
        return Array.isArray(eventValue) && eventValue.includes(value);
      case 'matches':
        return new RegExp(value).test(eventValue);
      default:
        return false;
    }
  }

  async findApplicableTriggers(event) {
    // Find triggers by channel and type
    const { data, error } = await this.db
      .from('triggers')
      .select('*')
      .eq('channel', event.channel)
      .eq('type', event.type)
      .eq('enabled', true)
      .order('priority', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async executeNextStep(flowId, stepId, event) {
    // Delegate to flow engine
    // This was already implemented in previous phases
  }

  async recordTriggerStat(triggerId) {
    const { error } = await this.db
      .from('triggers')
      .update({
        stats: this.db.raw(`jsonb_set(stats, '{timesTriggered}', to_jsonb(stats->'timesTriggered'::int + 1)), 
                           jsonb_set(stats, '{lastTriggered}', to_jsonb(now()))`)
      })
      .eq('id', triggerId);

    if (error) throw error;
  }
}

module.exports = TriggerEngine;
```

### Backend: Keyword Matcher

```javascript
// triggers/matchers/keyword-matcher.js
class KeywordMatcher {
  matches(event, config) {
    if (!event.message_text) return false;

    const {
      keywords = [],
      matchType = 'contains',
      caseInsensitive = true,
      ignoreAccents = false,
      wholeWords = false
    } = config;

    if (keywords.length === 0) return false;

    let text = event.message_text;
    if (caseInsensitive) text = text.toLowerCase();
    if (ignoreAccents) text = this.removeAccents(text);

    for (const keyword of keywords) {
      let searchTerm = keyword;
      if (caseInsensitive) searchTerm = searchTerm.toLowerCase();
      if (ignoreAccents) searchTerm = this.removeAccents(searchTerm);

      if (this.matchesType(text, searchTerm, matchType, wholeWords)) {
        return true;
      }
    }

    return false;
  }

  matchesType(text, searchTerm, matchType, wholeWords) {
    switch (matchType) {
      case 'contains':
        if (wholeWords) {
          const regex = new RegExp(`\\b${this.escapeRegex(searchTerm)}\\b`, 'g');
          return regex.test(text);
        }
        return text.includes(searchTerm);

      case 'exact':
        return text === searchTerm;

      case 'startsWith':
        return text.startsWith(searchTerm);

      case 'endsWith':
        return text.endsWith(searchTerm);

      case 'regex':
        try {
          const regex = new RegExp(searchTerm);
          return regex.test(text);
        } catch {
          return false;
        }

      default:
        return false;
    }
  }

  removeAccents(str) {
    return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = KeywordMatcher;
```

### Backend: API Routes

```javascript
// routes/triggers.js
const express = require('express');
const router = express.Router();
const TriggerEngine = require('../triggers/engine');

// CREATE
router.post('/', async (req, res) => {
  try {
    const { flowId, type, channel, config, nextStep } = req.body;

    // Validar
    if (!flowId || !type || !channel || !nextStep) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insertar
    const { data, error } = await supabase
      .from('triggers')
      .insert({
        flow_id: flowId,
        type,
        channel,
        config,
        next_step: nextStep,
        enabled: true,
        stats: { timesTriggered: 0 }
      })
      .select();

    if (error) throw error;

    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// READ
router.get('/', async (req, res) => {
  try {
    const { flowId, type, channel, enabled } = req.query;

    let query = supabase.from('triggers').select('*');

    if (flowId) query = query.eq('flow_id', flowId);
    if (type) query = query.eq('type', type);
    if (channel) query = query.eq('channel', channel);
    if (enabled !== undefined) query = query.eq('enabled', enabled === 'true');

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { config, enabled, priority } = req.body;

    const { data, error } = await supabase
      .from('triggers')
      .update({ config, enabled, priority })
      .eq('id', id)
      .select();

    if (error) throw error;

    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('triggers')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// TEST
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const { testData } = req.body;

    // Get trigger
    const { data: triggers, error: triggerError } = await supabase
      .from('triggers')
      .select('*')
      .eq('id', id);

    if (triggerError) throw triggerError;
    if (!triggers.length) return res.status(404).json({ error: 'Trigger not found' });

    const trigger = triggers[0];
    const engine = new TriggerEngine(supabase);

    // Evaluate
    const matcher = engine.matchers[trigger.type];
    const matches = matcher.matches(testData, trigger.config);

    res.json({ matches, debug: { triggerType: trigger.type, testData } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// STATS
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('triggers')
      .select('stats')
      .eq('id', id);

    if (error) throw error;

    res.json(data[0]?.stats || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### Frontend: Trigger Modal

```javascript
// components/triggers/trigger-modal.js
const TriggerModal = (function() {
  const TRIGGER_TYPES = [
    {
      id: 'keyword',
      name: 'Palabra Clave',
      icon: '🔤',
      description: 'El usuario menciona una palabra o frase'
    },
    {
      id: 'comment',
      name: 'Comentario en Publicación',
      icon: '💬',
      description: 'El usuario comenta una foto o reel'
    },
    {
      id: 'story_reply',
      name: 'Respuesta a Historia',
      icon: '📸',
      description: 'El usuario responde a una historia'
    },
    {
      id: 'dm',
      name: 'Mensaje DM',
      icon: '📨',
      description: 'El usuario envía un mensaje directo'
    },
    {
      id: 'contact_event',
      name: 'Evento de Contacto',
      icon: '📅',
      description: 'Cumpleaños, etiqueta, campo actualizado'
    },
    {
      id: 'url_ref',
      name: 'URL de Referencia',
      icon: '🔗',
      description: 'El usuario hace clic en un enlace rastreado'
    },
    {
      id: 'system_action',
      name: 'Acción del Sistema',
      icon: '⚙️',
      description: 'Manual, API, o programado'
    }
  ];

  function render(container, flowId) {
    container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h2>Seleccionar Disparador</h2>
            <button class="modal-close">×</button>
          </div>
          
          <div class="modal-body">
            <input 
              type="search" 
              class="search-input" 
              placeholder="Buscar disparador..." 
              id="trigger-search"
            />
            
            <div class="trigger-list" id="trigger-list">
              ${TRIGGER_TYPES.map(t => `
                <div class="trigger-item" data-type="${t.id}">
                  <span class="trigger-icon">${t.icon}</span>
                  <div class="trigger-info">
                    <div class="trigger-name">${t.name}</div>
                    <div class="trigger-description">${t.description}</div>
                  </div>
                  <span class="trigger-arrow">→</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    setupListeners(container, flowId);
  }

  function setupListeners(container, flowId) {
    const searchInput = container.querySelector('#trigger-search');
    const triggerItems = container.querySelectorAll('.trigger-item');
    const closeBtn = container.querySelector('.modal-close');

    // Search
    searchInput?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      triggerItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query) ? 'flex' : 'none';
      });
    });

    // Select trigger type
    triggerItems.forEach(item => {
      item.addEventListener('click', () => {
        const type = item.dataset.type;
        showConfigForm(type, flowId);
      });
    });

    // Close
    closeBtn?.addEventListener('click', () => {
      container.innerHTML = '';
    });
  }

  function showConfigForm(triggerType, flowId) {
    // Delegate to TriggerConfig component
    TriggerConfig.render(document.body, triggerType, flowId);
  }

  return {
    render
  };
})();
```

### Frontend: Trigger Config

```javascript
// components/triggers/trigger-config.js
const TriggerConfig = (function() {
  async function render(container, triggerType, flowId) {
    const html = getFormHtml(triggerType);
    
    container.innerHTML = html;
    setupValidation(triggerType);
    setupSaveListener(triggerType, flowId);
  }

  function getFormHtml(type) {
    const templates = {
      keyword: `
        <div class="trigger-config-form">
          <h3>Configurar: Palabra Clave</h3>
          
          <div class="form-group">
            <label>Tipo de Coincidencia:</label>
            <div class="radio-group">
              <label><input type="radio" name="matchType" value="contains" checked /> Contiene</label>
              <label><input type="radio" name="matchType" value="exact" /> Exacta</label>
              <label><input type="radio" name="matchType" value="startsWith" /> Comienza con</label>
              <label><input type="radio" name="matchType" value="endsWith" /> Termina con</label>
              <label><input type="radio" name="matchType" value="regex" /> Regex</label>
            </div>
          </div>
          
          <div class="form-group">
            <label>Palabras Clave:</label>
            <div class="chip-input" id="keyword-input">
              <input type="text" placeholder="Escribe y presiona Enter..." />
              <div class="chips"></div>
            </div>
          </div>
          
          <div class="form-group">
            <label>
              <input type="checkbox" name="caseInsensitive" checked />
              No distinguir mayúsculas/minúsculas
            </label>
          </div>
          
          <div class="form-group">
            <label>
              <input type="checkbox" name="ignoreAccents" />
              Ignorar acentos
            </label>
          </div>
          
          <button class="btn btn-primary" id="save-trigger">Guardar Disparador</button>
        </div>
      `,
      
      comment: `
        <div class="trigger-config-form">
          <h3>Configurar: Comentario en Publicación</h3>
          
          <div class="form-group">
            <label>Tipo de Publicación:</label>
            <div class="checkbox-group">
              <label><input type="checkbox" name="postTypes" value="IMAGE" checked /> Posts</label>
              <label><input type="checkbox" name="postTypes" value="VIDEO" checked /> Reels</label>
              <label><input type="checkbox" name="postTypes" value="CAROUSEL" /> Carruseles</label>
            </div>
          </div>
          
          <div class="form-group">
            <label>Filtro de Comentario:</label>
            <div class="radio-group">
              <label><input type="radio" name="filterType" value="any" checked /> Cualquier comentario</label>
              <label><input type="radio" name="filterType" value="keywords" /> Contiene palabras clave</label>
            </div>
          </div>
          
          <div class="form-group" id="keywords-group" style="display:none;">
            <label>Palabras Clave:</label>
            <div class="chip-input" id="keyword-input">
              <input type="text" placeholder="Escribe y presiona Enter..." />
              <div class="chips"></div>
            </div>
          </div>
          
          <div class="form-group">
            <label>
              <input type="checkbox" name="respondAutomatically" checked />
              Responder automáticamente con DM
            </label>
          </div>
          
          <button class="btn btn-primary" id="save-trigger">Guardar Disparador</button>
        </div>
      `
      
      // ... más templates para otros tipos
    };
    
    return templates[type] || '<p>Tipo no soportado</p>';
  }

  function setupValidation(type) {
    // Validar según tipo
  }

  function setupSaveListener(type, flowId) {
    const saveBtn = document.querySelector('#save-trigger');
    saveBtn?.addEventListener('click', async () => {
      const config = collectFormData(type);
      
      // Guardar via API
      const response = await fetch('/api/triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flowId,
          type,
          channel: 'instagram', // o seleccionable
          config,
          nextStep: 'step_1' // o dinámico
        })
      });
      
      if (response.ok) {
        console.log('Trigger saved');
        document.body.innerHTML = ''; // Cerrar modal
      }
    });
  }

  function collectFormData(type) {
    const formData = new FormData(document.querySelector('.trigger-config-form'));
    // Convertir a objeto según tipo
    return Object.fromEntries(formData);
  }

  return {
    render
  };
})();
```

---

## UI Mockups

### Modal de Selección de Triggers

```
┌─────────────────────────────────────────┐
│ Seleccionar Disparador                × │
├─────────────────────────────────────────┤
│                                         │
│ [Buscar disparador...]                  │
│                                         │
│ 🔤 Palabra Clave                     → │
│    El usuario menciona una palabra     │
│                                         │
│ 💬 Comentario en Publicación          → │
│    El usuario comenta una foto o reel  │
│                                         │
│ 📸 Respuesta a Historia               → │
│    El usuario responde a una historia  │
│                                         │
│ 📨 Mensaje DM                         → │
│    El usuario envía un mensaje directo │
│                                         │
│ 📅 Evento de Contacto                 → │
│    Cumpleaños, etiqueta, campo...      │
│                                         │
│ 🔗 URL de Referencia                  → │
│    El usuario hace clic en un enlace   │
│                                         │
│ ⚙️ Acción del Sistema                  → │
│    Manual, API, o programado           │
│                                         │
└─────────────────────────────────────────┘
```

### Formulario de Configuración (Palabra Clave)

```
┌────────────────────────────────────────┐
│ Configurar: Palabra Clave            × │
├────────────────────────────────────────┤
│                                        │
│ Tipo de Coincidencia:                 │
│ ⦿ Contiene      ○ Exacta              │
│ ○ Comienza con  ○ Termina con        │
│ ○ Regex                               │
│                                        │
│ Palabras Clave:                       │
│ [precio][cuanto vale][costo]  [+]    │
│                                        │
│ Opciones:                             │
│ ☑ No distinguir mayúsculas/minúsculas │
│ ☐ Ignorar acentos                    │
│ ☐ Solo palabras completas             │
│                                        │
│ Condiciones Adicionales:              │
│ [+ Agregar Condición]                 │
│                                        │
│             [Cancelar] [Guardar]      │
└────────────────────────────────────────┘
```

---

## API Endpoints

### Triggers

```
CREATE
POST /api/triggers
  {
    "flowId": "flow_123",
    "type": "keyword|comment|story_reply|dm|contact_event|url_ref|system_action",
    "channel": "instagram|whatsapp|messenger|all",
    "config": { ... type-specific ... },
    "nextStep": "step_1"
  }
  → { "id": "trigger_1", ... }

READ ALL
GET /api/triggers?flowId=flow_123&type=keyword&enabled=true
  → [ { "id": "trigger_1", ... }, ... ]

READ ONE
GET /api/triggers/trigger_1
  → { "id": "trigger_1", ... }

UPDATE
PUT /api/triggers/trigger_1
  {
    "config": { ... },
    "enabled": true,
    "priority": 1
  }
  → { "id": "trigger_1", ... }

DELETE
DELETE /api/triggers/trigger_1
  → { "success": true }

TEST
POST /api/triggers/trigger_1/test
  {
    "testData": {
      "message_text": "Cuál es el precio?",
      "channel": "instagram"
    }
  }
  → { "matches": true, "debug": { ... } }

STATS
GET /api/triggers/trigger_1/stats
  → { "timesTriggered": 42, "lastTriggered": "2026-07-30T10:35:00Z" }
```

---

## Testing Plan

### Unit Tests

**Backend:**
- [ ] KeywordMatcher: todos los tipos de matching
- [ ] CommentMatcher: filtrar por tipo de post
- [ ] StoryReplyMatcher: detectar emoji vs texto
- [ ] Condition evaluator: AND/OR logic
- [ ] Trigger Engine: disparo y propagación

**Frontend:**
- [ ] Modal de selección: búsqueda funciona
- [ ] Formulario: validación de campos
- [ ] Chip input: agregar/remover palabras clave
- [ ] API call: guardar trigger exitosamente

### Integration Tests

- [ ] Crear trigger → Appear en lista
- [ ] Enviar evento → Trigger se dispara
- [ ] Trigger dispara → Ejecuta próximo paso
- [ ] Estadísticas se registran correctamente

### E2E Tests

- [ ] Usuario abre builder
- [ ] Usuario crea trigger de palabra clave
- [ ] Usuario configura condiciones
- [ ] Usuario guarda
- [ ] Enviar mensaje con palabra clave
- [ ] Flujo se ejecuta automáticamente

### Manual Testing Checklist

- [ ] Todas las UI de trigger visible correctamente
- [ ] Modales abren/cierran suavemente
- [ ] Validaciones funcionan
- [ ] Errores se muestran claramente
- [ ] Funciona en mobile
- [ ] Responsive en todos los breakpoints

---

## Criterios de Aceptación

✅ **Código**
- [ ] 7 tipos de triggers implementados
- [ ] API endpoints funcionando
- [ ] Backend matchers correctos
- [ ] Frontend modales y formularios
- [ ] Validación en ambos lados

✅ **Testing**
- [ ] Coverage >80%
- [ ] Todos los tests verdes
- [ ] E2E tests funcionando
- [ ] Sin errores de consola

✅ **Performance**
- [ ] Buscar triggers en <100ms
- [ ] Evaluar condiciones en <10ms
- [ ] Modal abre en <300ms

✅ **UX**
- [ ] Interfaz clara y intuitiva
- [ ] Mensajes de error descriptivos
- [ ] Loading states visuales
- [ ] Responsive en mobile

---

## Timeline y Hitos

### Semana 1 (40 horas)

| Día | Tarea | Horas | Estado |
|-----|-------|-------|--------|
| L-M | Backend foundation | 16 | ⚪ |
| M-J | Matchers implementation | 24 | ⚪ |

### Semana 2 (40 horas)

| Día | Tarea | Horas | Estado |
|-----|-------|-------|--------|
| L-M | Frontend components | 24 | ⚪ |
| M-J | Integration & testing | 12 | ⚪ |
| V-L | Polish & documentation | 4 | ⚪ |

### Hitos Finales

- ✅ **Día 7**: Todos los matchers implementados
- ✅ **Día 10**: Frontend modales funcionales
- ✅ **Día 14**: Sistema completo y testeado
- ✅ **Día 14 (EOD)**: Ready para Fase 3

---

## Notas Importantes

### Dependencias Externas
- ✅ Usar APIs existentes (Supabase, Instagram Graph API)
- ✅ No agregar dependencias nuevas (reutilizar Fase 1)

### Compatibilidad
- ✅ IE11+ (si aplica)
- ✅ Mobile responsive
- ✅ Todos los navegadores principales

### Seguridad
- ✅ Validar todas las entradas
- ✅ Sanitizar regex para prevenir ReDoS
- ✅ Rate-limit en webhooks

### Performance Budgets
- Buscar triggers: <100ms
- Evaluar condiciones: <10ms
- Modal opening: <300ms

---

**Última actualización**: 30 de Julio 2026  
**Versión**: 1.0  
**Estado**: Listo para desarrollo
