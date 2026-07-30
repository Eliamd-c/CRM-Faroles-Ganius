# PLAN DE MEJORA DEL CRM - Inspirado en ManyChat Builder

**Fecha**: 30 de Julio 2026  
**Proyecto**: Faroles Genius CRM 2.0  
**Objetivo**: Mejorar el builder visual y experiencia de usuario basándose en patrones de ManyChat

---

## 1. ANÁLISIS ACTUAL vs ManyChat

### ✅ Lo que YA TIENEN (Fortalezas)

| Feature | Estado | Notas |
|---------|--------|-------|
| Builder visual con nodos | ✅ Implementado | Usando Drawflow |
| Sistema de triggers | ✅ Implementado | Palabra clave |
| Tipos de contenido múltiples | ✅ Implementado | Texto, imagen, botones, galería, etc. |
| Acciones en nodos | ✅ Implementado | Tags, campos, automatización |
| Conexiones visuales | ✅ Implementado | Flujo entre nodos |
| Guardado de flujos | ✅ Implementado | JSON + Supabase |
| Dashboard en tiempo real | ✅ Implementado | SSE para logs |
| Upload de archivos | ✅ Implementado | Multer, 25MB limit |

### ⚠️ Lo que FALTA o NECESITA MEJORA (Gaps)

| Feature | ManyChat | Nuestro CRM | Prioridad | Complejidad |
|---------|----------|------------|-----------|------------|
| **UI/UX del Header** | Polished + badges | Básico | ALTA | Media |
| **Sidebar Colapsable** | Sí, con iconos | No | MEDIA | Baja |
| **Modales de Configuración** | Elegantes + validaciones | Inline panels | ALTA | Media |
| **Visualización de Triggers** | Modal completo + búsqueda | Inline simple | ALTA | Media |
| **Sistema de Botones** | Editor modal robusto | Basic | MEDIA | Media |
| **Vista Previa en Tiempo Real** | Canvas + preview side-by-side | Solo canvas | MEDIA | Baja |
| **Validaciones y Errores** | Completas + toasts | Básicas | MEDIA | Baja |
| **Auto-Organizar Nodos** | Algoritmo inteligente | Simple | BAJA | Alta |
| **Badges de Status** | DRAFT/LIVE claros | Básicos | MEDIA | Baja |
| **Contador de Caracteres** | En cada input | No | BAJA | Baja |
| **Chip/Tag Input** | Para palabras clave | No | MEDIA | Baja |
| **Animaciones** | Smooth transitions | Ninguna | BAJA | Media |
| **Responsividad** | Full | Parcial | MEDIA | Media |
| **Iconografía** | Sistema consistente | Emoji | BAJA | Media |
| **Soporte Multi-canal** | Instagram, WhatsApp, Messenger | Solo genérico | ALTA | Alta |

---

## 2. PLAN DE MEJORA - 3 FASES

### FASE 1: UI/UX Upgrade (Semanas 1-2)

**Objetivo**: Mejorar la interfaz visual para que se parezca a ManyChat sin cambiar la lógica backend.

#### 1.1 Header y Navegación
- [ ] Mejorar header con breadcrumb claro
- [ ] Agregar badges de status (DRAFT/LIVE) con colores
- [ ] Agregar botones de "Vista previa" y "Publicar" destacados
- [ ] Implementar dropdown de opciones (menú...)
- [ ] Mostrar nombre del flujo editable en header

#### 1.2 Sidebar Improvements
- [ ] Implementar modo colapsable (expandido ↔ solo iconos)
- [ ] Agregar iconografía clara por tipo de nodo
- [ ] Reorganizar elementos en grupos (Trigger, Contenido, Lógica, Acciones)
- [ ] Agregar descripción al pasar mouse sobre items

#### 1.3 Paneles de Edición
- [ ] Convertir configuración inline a modales elegantes
- [ ] Mejorar formularios con validaciones visuales
- [ ] Agregar placeholders descriptivos en inputs
- [ ] Implementar chip input para palabras clave
- [ ] Agregar contadores de caracteres

#### 1.4 Canvas Improvements
- [ ] Mejorar visualidad de nodos (cards vs rectángulos)
- [ ] Agregar colores por tipo de nodo (rojo=trigger, azul=mensaje, etc.)
- [ ] Mejorar conexiones visuales (líneas curvas, flechas)
- [ ] Agregar tooltips en hover
- [ ] Implementar zoom/pan más intuitivo

#### 1.5 Notificaciones y Feedback
- [ ] Implementar toast notifications (success, error, info)
- [ ] Agregar indicadores visuales de validación
- [ ] Mejorar mensajes de error
- [ ] Agregar spinner de carga

**Esfuerzo**: 40-50 horas de desarrollo  
**Stack**: CSS3 + JavaScript (sin dependencias nuevas)  
**Resultado**: UI comparable a ManyChat pero con tu lógica actual

---

### FASE 2: Sistema de Triggers Robusto (Semanas 3-4)

**Objetivo**: Implementar un sistema de triggers similar a ManyChat con opciones avanzadas.

#### 2.1 Tipos de Triggers Expandidos

Agregar soporte para:
- [ ] **Comentarios de publicaciones** (si integran Instagram API)
- [ ] **Respuestas a historias** (Instagram)
- [ ] **Mensajes DM** (Instagram) - ya tienen pero mejorar UI
- [ ] **Eventos de contacto** (email, cumpleaños, etiqueta añadida)
- [ ] **URLs de referencia** (tracking links)
- [ ] **Tiempo específico** (scheduling)
- [ ] **Entrada de usuario** (después de cierta acción)

#### 2.2 Configuración de Triggers

- [ ] Modal de selección de trigger tipo ManyChat
- [ ] Búsqueda de triggers por palabra clave
- [ ] Descripción de cada trigger
- [ ] Opciones de configuración específicas por tipo
- [ ] Validaciones de parámetros

#### 2.3 Lógica de Matching

- [ ] Keyword matching (contains, exact, starts_with, ends_with)
- [ ] Regex support (opcional, UPGRADE)
- [ ] AI intent detection (opcional, UPGRADE)
- [ ] Multiple conditions (AND/OR logic)
- [ ] Case-insensitive matching

**Esfuerzo**: 30-40 horas  
**Stack**: Backend (Node.js) + Frontend (JavaScript)  
**Resultado**: Sistema de triggers flexible y extensible

---

### FASE 3: Integración Real de Canales (Semanas 5-8)

**Objetivo**: Soportar múltiples canales como ManyChat (Instagram, WhatsApp, Messenger).

#### 3.1 Arquitectura Multi-canal

- [ ] Refactorizar modelo de datos para soportar canales
- [ ] Crear abstracción de "Channel" (interface)
- [ ] Implementar canales específicos (Instagram, WhatsApp, Messenger)

#### 3.2 Instagram Integration (si no está completamente implementado)

- [ ] Webhook handler para DMs, comentarios, story replies
- [ ] Send messages back via Instagram API
- [ ] Rate limiting y manejo de errores
- [ ] Logging y debugging

#### 3.3 WhatsApp Integration

- [ ] Configuración de API de WhatsApp Business
- [ ] Recibir y enviar mensajes
- [ ] Media support (imágenes, videos, documentos)
- [ ] Webhook handler

#### 3.4 Facebook Messenger Integration

- [ ] Setup de Messenger API
- [ ] Message sending
- [ ] Webhook handling
- [ ] Rich media support

**Esfuerzo**: 60-80 horas  
**Stack**: Node.js, Webhook handlers, API integrations  
**Resultado**: CRM multi-canal como ManyChat

---

## 3. MEJORAS SECUNDARIAS (Quick Wins)

### Low Effort, High Impact

| Mejora | Esfuerzo | Impacto | Cómo |
|--------|----------|--------|------|
| Más tipos de contenido | 2-4h | Alto | Agregar Tarjeta (Image+Title+Buttons), Video, Audio |
| Mejor visualización de botones | 2h | Medio | Mostrar botones como chips, no solo texto |
| Drag-and-drop mejorado | 3h | Medio | Feedback visual al arrastrar, preview position |
| Contador de caracteres | 1h | Bajo | Input indicators en modales |
| Validación de flujos | 2h | Alto | Detectar ciclos, nodos sin conexión, etc. |
| Exportar/Importar flujos | 3h | Medio | JSON + UI para descargar/cargar |
| Versioning de flujos | 4h | Medio | Historial de cambios, rollback |
| Búsqueda de nodos | 2h | Medio | Filtro en canvas, goto node |
| Undo/Redo | 4h | Bajo | Stack de cambios |
| Dark mode | 2h | Bajo | CSS variables + toggle |

---

## 4. ROADMAP RECOMENDADO

### Timeline: 8-12 semanas

```
Semana 1-2:   FASE 1 - UI/UX Upgrade
              ├─ Header + Sidebar + Modales
              ├─ Notificaciones + Validaciones
              └─ Testing y refinamiento

Semana 3-4:   FASE 2 - Triggers Robusto
              ├─ Modal de triggers
              ├─ Múltiples tipos de triggers
              ├─ Lógica de matching
              └─ Testing

Semana 5-8:   FASE 3 - Integración Multi-canal
              ├─ Arquitectura (2 semanas)
              ├─ Instagram (1.5 semanas)
              ├─ WhatsApp (1.5 semanas)
              ├─ Messenger (1 semana)
              └─ Testing

Quick Wins:   En paralelo a cada fase
              ├─ Más tipos de contenido
              ├─ Mejores botones
              ├─ Validación de flujos
              └─ Exportar/Importar
```

---

## 5. ARQUITECTURA TÉCNICA

### Backend (Node.js)

**Cambios necesarios:**

```javascript
// Modelo de datos mejorado
{
  automation: {
    id: "auto_1",
    name: "Nombre",
    channel: "instagram|whatsapp|messenger", // ← New
    status: "draft|live",
    trigger: {
      type: "message|comment|story|event|...",
      matchType: "contains|exact|regex",
      keywords: [],
      conditions: [], // ← New: múltiples condiciones
      timeTrigger: null // ← New: scheduling
    },
    steps: [
      {
        id: "step_1",
        type: "message|condition|action|delay|input",
        channel: "instagram|whatsapp|...",
        content: {},
        nextStep: "step_2|null"
      }
    ]
  }
}
```

**APIs a crear/mejorar:**

```
POST   /api/automations          - Crear automatización
GET    /api/automations          - Listar
GET    /api/automations/:id      - Obtener una
PUT    /api/automations/:id      - Actualizar
DELETE /api/automations/:id      - Eliminar
POST   /api/automations/:id/publish - Publicar
POST   /api/automations/:id/validate - Validar flujo

POST   /api/channels/instagram/send      - Enviar via IG
POST   /api/channels/whatsapp/send       - Enviar via WA
POST   /api/channels/messenger/send      - Enviar via Messenger

POST   /webhook/instagram        - Webhook de IG
POST   /webhook/whatsapp         - Webhook de WA
POST   /webhook/messenger        - Webhook de FB
```

### Frontend (JavaScript + CSS)

**Nuevos módulos:**

```
public/
├─ builder-ui/
│  ├─ header.js          (UI del header mejorado)
│  ├─ sidebar.js         (Sidebar colapsable + iconos)
│  ├─ modals.js          (Modales de configuración)
│  ├─ notifications.js   (Toast notifications)
│  └─ canvas.js          (Canvas mejorado)
│
├─ triggers/
│  ├─ trigger-modal.js   (Modal de selección)
│  ├─ trigger-config.js  (Configuración por tipo)
│  └─ trigger-templates.js (Templates de triggers)
│
├─ channels/
│  ├─ channel-selector.js (Seleccionar canal)
│  ├─ instagram.js       (Opciones IG)
│  ├─ whatsapp.js        (Opciones WA)
│  └─ messenger.js       (Opciones FB)
│
└─ builder.css           (Estilos mejorados - siguiendo ManyChat)
```

---

## 6. PRIORIZACIÓN

### Fase 1 (OBLIGATORIO - MVP de UI)
- Header + Status badges
- Sidebar colapsable
- Modales de configuración
- Mejores notificaciones

### Fase 2 (IMPORTANTE - Triggers Robusto)
- Sistema de triggers expandido
- Modal de triggers tipo ManyChat
- Múltiples tipos de triggers

### Fase 3 (DESEABLE - Multi-canal Completo)
- Arquitectura multi-canal
- Integración real de canales
- APIs de envío

### Quick Wins (CONTINUO)
- Más tipos de contenido
- Mejores botones visuales
- Exportar/Importar
- Validación de flujos

---

## 7. MÉTRICAS DE ÉXITO

| Métrica | Actual | Meta | Fase |
|---------|--------|------|------|
| UI parity con ManyChat | 40% | 90% | Fase 1 |
| Tipos de triggers | 1 | 7+ | Fase 2 |
| Canales soportados | 1 (genérico) | 3 (IG, WA, Messenger) | Fase 3 |
| User satisfaction | N/A | 4.5/5 | Todas |
| Bug rate | High | <1% | Todas |
| Performance (load time) | 2s | <1s | Todas |

---

## 8. CONSIDERACIONES IMPORTANTES

### ⚠️ Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| Breaking changes en datos | Alto | Versioning, migrations, rollback |
| API rate limits | Medio | Queue sistema, throttling |
| Webhook failures | Medio | Retry logic, dead letter queue |
| Complejidad arquitextura | Medio | Tests, documentación clara |
| Tiempo de desarrollo | Alto | Priorización estricta, MVP primero |

### 💡 Recomendaciones

1. **Empezar por Fase 1**: La UI/UX es lo más visible y tiene impacto inmediato
2. **Mantener compatibilidad**: No quebrar flujos existentes
3. **Tests desde el inicio**: UI tests, integration tests, API tests
4. **Documentación**: Mantener docs actualizadas
5. **Feedback del usuario**: Testear con usuarios reales entre fases
6. **Refactoring gradual**: No todo de una vez, pequeños pasos

---

## 9. RECURSOS Y BUDGET

### Personas Necesarias
- 1 Frontend Developer (UI/UX) - Fase 1
- 1 Backend Developer (APIs) - Fase 2-3
- 1 QA (Testing) - Todas las fases
- 1 PM/Product Owner (dirección) - Todas las fases

### Herramientas Potenciales
- **UI Components**: shadcn/ui, Radix UI (opcional, para Fase 1)
- **Testing**: Jest, React Testing Library, Playwright
- **Monitoring**: Sentry, Logtail
- **CI/CD**: GitHub Actions (ya probablemente tienen)

### Estimación Total
- **Tiempo**: 8-12 semanas (1-2 devs)
- **Costo**: Depende de tu estructura, ~$50k-$100k
- **ROI**: Alto (mejorador de UX = retención de usuarios)

---

## 10. SIGUIENTES PASOS

1. ✅ **Esta semana**: Aprueban el plan
2. ✅ **Semana que viene**: Diseñar mockups de Fase 1 (figma/mockup)
3. ✅ **Semana 2**: Iniciar desarrollo Fase 1
4. ✅ **Semana 3**: Alfa testing con usuarios
5. ✅ **Semana 4**: Beta release Fase 1
6. ✅ **Semana 5**: Feedback y pequeños fixes
7. ✅ **Semana 6**: Iniciar Fase 2 (en paralelo con fixes de Fase 1)
8. ✅ Continuar con roadmap

---

## CONCLUSIÓN

Tu CRM ya tiene un 70% de lo que tiene ManyChat. Con este plan, puedes alcanzar 95% de feature parity + UI comparable en 8-12 semanas. El beneficio es enorme: mejor UX = usuarios más felices = mejor retención.

**Recomendación**: Empezar inmediatamente con Fase 1 (UI/UX) porque es el impacto más visible para usuarios.

¿Aprobamos este plan?
