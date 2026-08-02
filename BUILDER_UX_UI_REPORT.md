# Flow Builder UX/UI Design Report
**Faroles Genius CRM 2.0**

> Informe especializado de evaluación de diseño de experiencia de usuario (UX) e interfaz (UI) para el Flow Builder visual. Documento dirigido a evaluadores expertos en diseño de software y usabilidad.

---

## 📋 Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Análisis de Arquitectura Visual](#análisis-de-arquitectura-visual)
3. [Estructura de Navegación](#estructura-de-navegación)
4. [Componentes UI](#componentes-ui)
5. [Sistema de Diseño](#sistema-de-diseño)
6. [Flujos de Usuario](#flujos-de-usuario)
7. [Patrones de Interacción](#patrones-de-interacción)
8. [Accesibilidad](#accesibilidad)
9. [Rendimiento y Optimización](#rendimiento-y-optimización)
10. [Hallazgos y Recomendaciones](#hallazgos-y-recomendaciones)

---

## 1. Resumen Ejecutivo

### 1.1 Definición del Producto
El **Flow Builder** es un editor visual basado en nodos y conexiones (graph-based interface) que permite a usuarios no técnicos construir automatizaciones de conversaciones en Instagram sin escribir código. Utiliza la librería **Drawflow** como motor de renderización gráfica.

### 1.2 Propósito Funcional
- Crear flujos (workflows) de automatización para Instagram Direct Messages y Comentarios
- Gestionar 16+ tipos de nodos (Trigger, Message, Input, Condition, Actions, AI Agent, etc.)
- Permitir configuración visual de cada nodo a través de un panel inspector lateral
- Guardar, publicar y gestionar flujos persistentes

### 1.3 Audiencia Objetivo
- **Usuarios no técnicos**: Community managers, marketers, support teams
- **Usuarios semitécnicos**: Especialistas en automatización
- **Administradores**: Gestión de flujos y configuración global

### 1.4 Contexto Técnico
- **Framework**: Vanilla JavaScript (no React/Vue)
- **Librería gráfica**: Drawflow 0.0.60
- **Styling**: CSS personalizado + sistema de variables CSS
- **Arquitectura**: Modular con separación de concerns (utils, components, builders)
- **Persistencia**: API REST con Supabase backend

---

## 2. Análisis de Arquitectura Visual

### 2.1 Layout Principal (3 Columnas)

```
┌─────────────────────────────────────────────────┐
│                   HEADER (Sticky)                │
│  Logo | Nav | Flow Name | Status | Actions     │
└─────────────────────────────────────────────────┘
┌──────────┬───────────────────────┬──────────────┐
│ SIDEBAR  │    CANVAS (Drawflow)  │ CONFIG PANEL │
│ Nodos    │  - Arrastrable        │ Inspector    │
│ (16 tipos)│  - Zoom controls      │ (Hidden)     │
│          │  - Right-click menu    │              │
└──────────┴───────────────────────┴──────────────┘
```

**Análisis de proporción:**
- Sidebar: ~15-20% del ancho (colapsable)
- Canvas: ~60-70% (área principal de trabajo)
- Config Panel: ~15-25% (aparece al seleccionar nodo)

**Beneficios:**
- ✅ Maximiza espacio para canvas (donde ocurre el trabajo principal)
- ✅ Sidebar compacto pero accesible (16 nodos categorizados)
- ✅ Panel inspector contextual (aparece bajo demanda)

**Críticas potenciales:**
- ⚠️ Con sidebar expandido + panel abierto, el canvas se reduce significativamente
- ⚠️ En pantallas pequeñas (<1200px), la UI se comprime y pierde usabilidad

### 2.2 Flujo Visual de Información

```
Disparador (Trigger)
        ↓
Contenido (Message/Carousel/etc)
        ↓
Lógica (Condition/Randomizer)
        ↓
Acciones (Add Tag/Pause Bot/etc)
        ↓
Siguiente paso o fin
```

**Ventajas:**
- ✅ Flujo lineal y lógico (de arriba a abajo)
- ✅ Fácil de seguir incluso para usuarios novatos
- ✅ Coincide con mentalidad de "if-then" para automatizaciones

### 2.3 Capas Visuales (Z-index)

| Layer | Z-index | Elemento | Comportamiento |
|-------|---------|----------|----------------|
| Aplicación | 0-10 | Canvas, Sidebar | Base |
| Interactivos | 50-100 | Toolbar de zoom, Context menu | Encima de canvas |
| Modales | 9000-9999 | Trigger picker, Dialogs | Encima de todo |
| Notifications | 10000+ | Toast messages | Encima de modales |

**Criterio de capas:** Bien estructurado, sigue estándares de z-index progresivos.

---

## 3. Estructura de Navegación

### 3.1 Navegación Global (Header)

**Elementos:**
```html
[Logo] [Monitor | Automations | Builder] [... Acciones ...]
```

**Características:**
- ✅ Links claros a secciones principales
- ✅ Indicador visual (badge "active") en la sección actual
- ✅ Logo clickeable vuelve al inicio
- ✅ Permanente (sticky top)

**Datos ARIA:**
- `aria-label` en nav: "Navegación principal"
- Links semánticamente correctos

### 3.2 Navegación Contextual (Builder Específica)

| Elemento | Función | Acceso |
|----------|---------|--------|
| **Trigger Picker Modal** | Elegir tipo de disparador | Click en nodo trigger |
| **Context Menu** | Agregar nodos rápidamente | Doble-click en canvas |
| **Config Panel** | Editar nodo seleccionado | Click en nodo |
| **Zoom Toolbar** | Controlar zoom del canvas | Buttons en canvas |

**Fortalezas:**
- ✅ Múltiples puntos de entrada (drag, double-click, context menu)
- ✅ No requiere menús anidados profundos
- ✅ Descubrimiento intuitivo de funciones

**Debilidades:**
- ⚠️ El context menu no es evidente (solo aparece con doble-click)
- ⚠️ No hay tooltip o hint que mencione el doble-click como opción
- ⚠️ Keyboard shortcuts no documentados

### 3.3 Breadcrumbs / Localización Actual

**Estado actual:** ❌ No implementado

**Problema:** Al profundizar en subflows (Goto/Condition→Subflow), no hay indicador de "dónde estoy" en la jerarquía.

**Recomendación:** Agregar breadcrumb o indicador de navegación:
```
Flow: Compra Grupal > Step 3: Confirmación
```

---

## 4. Componentes UI

### 4.1 Header y Branding

**Componentes:**
```
┌─ Logo ──────────────────────┐
│ Faroles Genius              │
│ Flow Builder (subtítulo)    │
└─────────────────────────────┘
```

**Tipografía:**
- Logo: Inter 700 (bold), tamaño ~20px
- Subtítulo: Inter 500, tamaño ~12px, color muted

**Fortalezas:**
- ✅ Logo claramente diferenciado
- ✅ Subtítulo contextualiza la sección
- ✅ Responsive (Stack vertical en mobile)

### 4.2 Botones de Acción

**Tipos:**

| Tipo | Uso | Colores | Ejemplo |
|------|-----|---------|---------|
| **Primary** | Acción principal | Gradiente morado (#8a2be2→#9d4edd) | "Guardar" |
| **Secondary** | Acciones secundarias | Fondo transparente | "Organizar", "Generar IA" |
| **Publish** | Publicar flujo | Rojo/Verde | "Publicar" |
| **Danger** | Eliminar | Rojo (#fa5252) | "Eliminar" |

**Especificaciones:**
- Padding: 12px 24px (actions) | 6px 14px (nav)
- Border-radius: 8px
- Font: Inter 600 (bold)
- Transiciones: 150ms ease-out

**Interacciones:**
- ✅ Hover: cambio de opacidad/sombra
- ✅ Active: reduce escala ligeramente
- ✅ Disabled: opacidad 50%
- ✅ Focus: ring de 2px (accesibilidad)

**Hallazgo importante:**
```javascript
// Buttons with gradient backgrounds
background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
```
Los botones de IA usan gradientes que mejoran la jerarquía visual sin añadir complejidad.

### 4.3 Tarjetas de Nodos (Node Cards)

**Estructura:**
```
┌─ Header ─────────────────────────┐
│ ⚡ Trigger                       │
├──────────────────────────────────┤
│ Content (variable por tipo)      │
│ - Bloques de texto               │
│ - Teclado virtual (buttons)      │
│ - Preview de configuración       │
├──────────────────────────────────┤
│ [●] Output ports (conexiones)    │
└──────────────────────────────────┘
```

**Tipos de Nodos Visuales:**

1. **Nodo de Mensaje (mc-content)**
   - Fondo: Azul claro (#dbeafe)
   - Header: Gradiente azul
   - Contenido: Preview de texto + teclado de botones

2. **Nodo de Acción (mc-action)**
   - Fondo: Amarillo claro (#fef3c7)
   - Header: Gradiente naranja
   - Contenido: Icono + descripción acción

3. **Nodo de Lógica (mc-logic)**
   - Fondo: Púrpura claro (#ede9fe)
   - Header: Gradiente púrpura
   - Contenido: Config de condiciones/paths

4. **Nodo IA (mc-ai)**
   - Fondo: Gradiente morado→rosa
   - Header: "🧠 Agente IA"
   - Contenido: Prompt preview

5. **Nodo Disparador (mc-trigger)**
   - Especial: Border dashed azul
   - Indica punto de entrada del flujo
   - Única entrada posible en el flujo

**Código relevante:**
```css
.mc-node {
  border-radius: 8px;
  padding: 0;
  min-width: 200px;
  max-width: 300px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transition: all 200ms ease;
}

.mc-node:hover {
  box-shadow: 0 12px 24px rgba(0,0,0,0.15);
  transform: translateY(-2px);
}

.mc-node.selected {
  box-shadow: 0 0 0 2px #8a2be2, 0 12px 24px rgba(138,43,226,0.3);
}
```

**Fortalezas:**
- ✅ Color-coding por tipo hace fácil identificar nodos
- ✅ Shadow y hover feedback indican interactividad
- ✅ Tamaño consistente (~200-300px ancho)
- ✅ Contenido adaptable dentro del nodo

**Problemas identificados:**
- ⚠️ En canvas congestionado, los nodos pueden superponerse (sin z-index dinámico)
- ⚠️ Nombres de clase poco descriptivos (mc-content, mc-logic)
- ⚠️ No hay visual feedback diferente para nodos sin configurar vs configurados

### 4.4 Panel Inspector (Config Panel)

**Estructura:**
```
┌──────────────────────────────────┐
│ [Icon] Título del nodo         × │
├──────────────────────────────────┤
│ Contenido dinámico por tipo:     │
│                                  │
│ □ Input 1: "Tipo de mensaje"    │
│ □ Input 2: "Contenido"          │
│                                  │
│ [Buttons para agregar items]     │
└──────────────────────────────────┘
```

**Comportamiento:**
- ✅ Aparece al seleccionar nodo
- ✅ Se posiciona a la derecha del canvas
- ✅ Scroll interno si contenido es muy largo
- ✅ Cierra al hacer click fuera o botón ×

**Contenido Variable por Tipo:**

| Nodo | Config Mostrada |
|------|-----------------|
| **Message** | Bloques (texto/imagen), Botones |
| **Input** | Tipo (email/phone/text), Campo, Prompt |
| **Action** | Catálogo de acciones, Parámetros |
| **Condition** | Campo, Operador, Valor |
| **Trigger** | Selector de tipo (message/comment/story) |
| **AI Agent** | Textarea para system prompt |

**Fortalezas:**
- ✅ Contexto apropiado por tipo de nodo
- ✅ No congestiona el canvas principal
- ✅ Fácil de cerrar/abrir

**Debilidades:**
- ⚠️ Scroll interno oculta contenido inferior (no es evidente)
- ⚠️ No hay indicador visual de cambios sin guardar
- ⚠️ Los errores de validación aparecen solo al guardar

### 4.5 Sidebar de Nodos

**Organización (4 secciones):**
```
DISPARADORES
  ⚡ Palabra Clave
  ─────────────
CONTENIDO
  💬 Enviar Mensaje
  📥 Pedir Dato
  🖼️ Carrusel
  📸 Galería
  🎵 Audio
  🎥 Video
  📄 Archivo / PDF
  ─────────────
LÓGICA
  ⚡ Realizar Acciones
  🔀 Condición Lógica
  🎲 Aleatorio (A/B)
  ⏱  Espera (Delay)
  ─────────────
AVANZADO
  ↗️  Goto / Saltar
  🧠 Agente IA [ESPECIAL: gradiente morado]
```

**Funcionalidad:**
- ✅ Drag & drop de items al canvas
- ✅ Tooltip en hover muestra nombre completo
- ✅ Emojis+Iconos mejoran escaneo visual
- ✅ Toggle de colapso (button "«") guarda estado en localStorage

**Especificaciones:**
- Ancho: 160px (expandido), colapsa a 60px
- Items: 56px alto
- Fuente: Inter 500, 13px
- Separadores visuales entre secciones

**Crítica:**
- ⚠️ Nodos de IA (🧠) tienen gradiente visual diferente, sugieren "premium"
- ⚠️ No hay búsqueda de nodos (16 items es manejable pero crecer)
- ⚠️ Ordenamiento no es alfabético ni por frecuencia de uso

---

## 5. Sistema de Diseño

### 5.1 Paleta de Colores

```css
:root {
  /* Primarios */
  --accent: #8a2be2;           /* Púrpura principal */
  --accent-hover: #9d4edd;     /* Púrpura más claro */
  
  /* Backgrounds */
  --bg-color: #0f1115;         /* Casi negro (dark mode) */
  --card-bg: rgba(255, 255, 255, 0.03);
  --border-color: rgba(255, 255, 255, 0.1);
  
  /* Text */
  --text-main: #f8f9fa;        /* Blanco puro */
  --text-muted: #adb5bd;       /* Gris */
  
  /* Semánticos */
  --success: #20c997;          /* Verde */
  --warning: #ffc107;          /* Amarillo */
  --danger: #fa5252;           /* Rojo */
}
```

**Análisis:**
- ✅ Tema oscuro (dark mode by default) - menos fatiga visual
- ✅ Alto contraste (blanco sobre negro) - accesible (WCAG AA)
- ✅ Colores semánticos claros (success/warning/danger)
- ✅ Sistema consistente usado en toda la app

**Crítica:**
- ⚠️ No hay light mode (algunos usuarios lo prefieren)
- ⚠️ Púrpura (#8a2be2) es saturado, puede cansar a largo plazo
- ⚠️ Falta color "info" para mensajes informativos

### 5.2 Tipografía

**Font Stack:**
```css
font-family: 'Inter', sans-serif;
```

**Jerarquía:**
- **Títulos (h1)**: Inter 700, 28px, línea 1.2
- **Subtítulos (h2)**: Inter 600, 20px
- **Labels/Headers (h3)**: Inter 600, 16px
- **Body**: Inter 400/500, 14-16px
- **Small**: Inter 400, 12-13px
- **Micro**: Inter 500, 11px

**Especificaciones:**
- Line-height: 1.5 (body), 1.3 (headers)
- Letter-spacing: 0.05em (headers)
- Font-weight: 400 (regular), 500 (medium), 600 (semi-bold), 700 (bold)

**Fortalezas:**
- ✅ Inter es excelente para interfaces (muy legible)
- ✅ Jerarquía clara y consistente
- ✅ Buen contraste en dark mode

### 5.3 Espaciado (8px System)

```css
Margin/Padding: 4px, 8px, 12px, 16px, 24px, 32px, 48px...
```

**Aplicación:**
- Buttons: 12px (vertical) x 24px (horizontal)
- Card padding: 16px / 24px
- Sidebar items: 8px padding, 12px margin
- Section divider: 24px (vertical)

**Beneficio:** Sistema consistente facilita escalabilidad y mantenibilidad.

### 5.4 Bordes y Radio

```css
border-radius: 4px (pequeño)  | botones secundarios, inputs
             | 6px (medio)    | cards, modales chicos
             | 8px (grande)   | nodos principales, header
             | 12px (xl)      | tabs, panels
             | 99px (píldora) | badges redondos
```

**Consistencia:** Todas las esquinas redondeadas siguen este sistema.

---

## 6. Flujos de Usuario

### 6.1 Flujo: Crear un Nuevo Flujo

```
1. Inicia: Usuario clickea "+ New Flow" en automations.html
   ↓
2. Abre builder.html con ?new=1
   ↓
3. Modal: "Inicia automatización cuando..." (Trigger Picker)
   - Opción 1: Mensaje directo (palabra clave)
   - Opción 2: Comentario (palabra clave)
   - Opción 3: Mención en historia [Próximamente]
   ↓
4. Trigger node aparece en canvas
   ↓
5. Usuario empieza a drag&drop nodos del sidebar
   ↓
6. Click en nodo → Config Panel aparece en derecha
   ↓
7. Configura nodo (texto, botones, acciones, etc)
   ↓
8. Click "Guardar" → API POST /api/flows → vuelve a automations.html
```

**Puntos críticos:**
- ✅ Flujo claro: trigger → design → save
- ⚠️ Modal de trigger al inicio puede confundir (¿es obligatorio?)
- ⚠️ No hay validación antes de guardar (puede causar errores silenciosos)

### 6.2 Flujo: Editar un Flujo Existente

```
1. Desde automations.html, click en flujo existente
   ↓
2. builder.html?flowId=flow_123
   ↓
3. Carga el flujo desde /api/flows/flow_123
   ↓
4. Renderiza todos los nodos y conexiones
   ↓
5. Usuario edita: drag nodes, reconfigurar, agregar/eliminar
   ↓
6. Click "Guardar" → PATCH /api/flows/flow_123 → notificación
```

**UX Issues identificados:**
- ⚠️ No hay confirmación "¿Quieres guardar cambios?" al abandonar sin guardar
- ⚠️ No hay historial de versiones (si cometes error, no hay rollback)
- ⚠️ Múltiples usuarios editando el mismo flujo → posibles conflictos

### 6.3 Flujo: Configurar un Nodo de Mensaje

```
1. Drag "💬 Enviar Mensaje" al canvas
   ↓
2. Click en nodo → Config Panel abre
   ↓
3. Sección "Contenido":
   - Ver bloque de texto (default: "¡Hola!...")
   - Click "Editar" → inline editor
   - Escribir/Modificar texto
   ↓
4. Sección "Botones":
   - Ver lista de botones (vacía inicialmente)
   - Click "+ Agregar Botón"
   - Input title + payload
   - Botones aparecen en nodo visualmente
   ↓
5. Puertos de salida se repositionan (output_2, output_3...)
   ↓
6. Click "Guardar"
```

**Fortalezas del flujo:**
- ✅ Preview inmediato en el nodo
- ✅ Agregar/remover items es iterativo

**Problemas:**
- ⚠️ Preview en nodo vs config panel pueden desincronizarse
- ⚠️ No hay "drag to reorder" para botones
- ⚠️ Sin caracteres de limite visible (¿cuánto texto cabe?)

---

## 7. Patrones de Interacción

### 7.1 Drag & Drop

**Tipos:**
1. **Drag de Sidebar → Canvas** (crear nodo)
   - Cursor: crosshair durante drag
   - Feedback: placeholder de tamaño del nodo
   - Al soltar: nodo aparece en posición del mouse

2. **Drag de nodo en canvas** (reorganizar)
   - Moveble dentro del canvas
   - Conexiones se mantienen al mover
   - Smooth (sin lag, reroute activo)

3. **Drag entre puertos** (conectar)
   - Click en output port + drag a input port
   - Cursor línea azul mientras se arrastra
   - Snap automático al soltar cerca de un puerto

**Feedback visual:**
- ✅ Cursor cambia (pointer → grab → dragging)
- ✅ Sombra se intensifica durante drag
- ✅ Previsualización de línea de conexión

**Problemas:**
- ⚠️ Área "soltable" en canvas no tiene visual (¿dónde puedo soltar?)
- ⚠️ No hay confirmación al soltar fuera del área (falla silenciosa)

### 7.2 Context Menu (Doble-click)

**Activación:** Doble-click en canvas vacío

**Contenido:**
```
⚡ Palabra Clave
💬 Enviar Mensaje
📥 Pedir Dato
...
─────────
🖼️ Carrusel
```

**Comportamiento:**
- Posición: aparece en cursor
- Cierra al: click fuera, selección, Escape
- Inserta nodo en posición del cursor

**Issues:**
- ⚠️ NO hay documentación que mencione "doble-click"
- ⚠️ Conflicto potencial: doble-click también selecciona texto
- ⚠️ En touchscreen (tablet), doble-click es torpe

### 7.3 Inspector Contextual (Click en Nodo)

**Comportamiento:**
- Click en nodo → config panel desliza desde derecha
- El nodo se resalta (border + shadow changes)
- Click en otro nodo → panel se actualiza
- Click fuera o botón × → panel se cierra

**Animaciones:**
```css
transition: right 300ms cubic-bezier(0.4, 0, 0.2, 1);
transform: translateX(100%) → translateX(0);
```

**UX Positivo:**
- ✅ No obstruye canvas durante lectura
- ✅ Fácil de ignorar si no necesitas editar
- ✅ Animación smooth da sensación de "reveal"

---

## 8. Accesibilidad

### 8.1 WCAG Compliance

| Criteria | Status | Notas |
|----------|--------|-------|
| **Contrast (AA)** | ✅ | Blanco (#f8f9fa) sobre negro (#0f1115) = 18:1 |
| **Focus Visible** | ⚠️ Parcial | Botones sí, canvas no |
| **Keyboard Nav** | ⚠️ Limitado | Tab funciona, Arrow keys no implementadas |
| **ARIA Labels** | ⚠️ Parcial | Headers tienen aria-label, pero faltan en nodos |
| **Alt Text** | ❌ N/A | Solo para UI, no canvas (es SVG rendered) |
| **Color Dependency** | ✅ | Emojis + texto, no solo color |

### 8.2 Keyboard Navigation

**Implementado:**
- ✅ Tab → navega entre botones principales
- ✅ Enter → activa botones
- ✅ Escape → cierra modales/panels

**Faltante:**
- ❌ Arrow Keys → mover nodos en canvas
- ❌ Delete → eliminar nodo seleccionado
- ❌ Ctrl+S → guardar (solo mouse)
- ❌ Ctrl+Z → undo (no hay historial)

### 8.3 ARIA Attributes

**Presentes:**
```html
<nav aria-label="Navegación principal">
<div aria-live="polite" aria-atomic="false"> (notifications)
<div role="menu"> (context menu)
<button role="menuitem">
<div role="button" tabindex="0"> (trigger picker)
```

**Faltante:**
- Config panel: `aria-hidden="false"` sería útil
- Nodos en canvas: `role="button"` y `aria-selected`
- Sidebar: `role="navigation"` y `aria-label`

### 8.4 Color & Vision

**Fortalezas:**
- ✅ No depende SOLO de color (emojis + texto)
- ✅ Alto contraste 18:1

**Debilidades:**
- ⚠️ Deuteranopia (daltonismo rojo-verde): Algunos colores en nodos pueden confundirse
  - Solución: Agregar patrones/texturas además de color

---

## 9. Rendimiento y Optimización

### 9.1 Bundle Size

**Librerías:**
- Drawflow: ~50kb minified
- Dagre: ~25kb minified
- Vanilla JS: ~100kb custom code (builder.js + components + utils)
- **Total UI JS: ~175kb**

**Impacto:** Aceptable para SPA interna, pero podría optimizarse.

### 9.2 Canvas Rendering

**Tecnología:** Drawflow usa SVG + DOM nodos HTML

**Performance issues identificados:**
- ⚠️ Con >50 nodos, lag perceptible en pan/zoom
- ⚠️ Cada nodo es DOM element (no canvas virtual)
- ⚠️ Reflow/repaint cuando agregar nodos sin batch

### 9.3 State Management

**Cómo se gestiona el estado:**
```javascript
const nodeBlocksState = {};   // { nodeId: [{id, type, content}] }
const nodeActionsState = {};  // { nodeId: {type, params} }
const nodeInputState = {};    // { nodeId: {type, field, prompt} }
// ... muchos otros
```

**Problemas:**
- ⚠️ 10+ objetos de estado global (difícil de sincronizar)
- ⚠️ No hay transacciones (update puede fallar a mitad)
- ⚠️ Caché interna vs server state → posibles inconsistencias

**Recomendación:** Migrar a Pinia/Zustand para state management centralizado.

---

## 10. Hallazgos y Recomendaciones

### 10.1 Fortalezas Principales

1. **Clarity & Simplicity**
   - No hay menús anidados profundos
   - Cada elemento tiene un propósito claro
   - Visual hierarchy evidente

2. **Color-Coded System**
   - Tipo de nodo = tipo de acción visual
   - Fácil de escanear y recordar
   - Accesible (no depende SOLO de color)

3. **Responsive Design**
   - Sidebar colapsa en móvil
   - Canvas reflow dinámico
   - Layout flexible

4. **Extensibilidad**
   - 16 tipos de nodos
   - Fácil agregar nuevos tipos
   - State management permite variaciones

### 10.2 Problemas Críticos

| Severidad | Problema | Impacto | Solución |
|-----------|----------|---------|----------|
| **Alta** | No hay undo/redo | Usuarios pierden cambios | Agregar stack de historial |
| **Alta** | Sin validación antes de guardar | Flujos inválidos se guardan | Pre-save validation |
| **Media** | Canvas performance >50 nodos | UI lag | Virtualización o canvas nativo |
| **Media** | No hay indicador "unsaved changes" | Confusión sobre qué guardó | Asterisco en nombre + warning |
| **Media** | Doble-click context menu oculto | Discovery pobre | Tooltip o hint visual |

### 10.3 Recomendaciones de Mejora

#### UX/UI

1. **Historial de Cambios**
   - Implementar undo/redo (Ctrl+Z / Ctrl+Shift+Z)
   - Guardar snapshots cada N cambios
   - Timeline visual de versiones

2. **Validación**
   - Nodos marcados con "⚠️" si falta config
   - Pre-save validation con errores claros
   - Impedir guardar flujos inválidos

3. **Discovery**
   - Tooltip: "💡 Doble-click para agregar nodos"
   - Video tutorial (onboarding first-time)
   - Keyboard shortcut hints

4. **Búsqueda en Sidebar**
   - Input search para filtrar los 16 nodos
   - Muestra "1/16 nodos"
   - Searchable por nombre + tipo

5. **Confirmación de Abandono**
   - Al navegar fuera: "¿Guardar cambios?"
   - Si hay cambios sin guardar, mostrar banner
   - Similar a Google Docs

#### Técnica

6. **State Management**
   - Migrar a Pinia o Zustand
   - Reducir 10+ objetos a 1 store
   - Sincronización automática client↔server

7. **Performance**
   - Virtualizar nodos en canvas (solo renderizar viewport)
   - Batch DOM updates
   - Web Workers para cálculos pesados

8. **Accesibilidad**
   - Arrow keys para mover nodos
   - ARIA complete en canvas
   - Test con screen reader (NVDA/JAWS)

9. **Mobile Support**
   - Touch events para pan/zoom (pinch)
   - Bigger touch targets (min 48x48px)
   - Vertical layout para pantallas chicas

### 10.4 Priorización de Mejoras

**Fase 1 (Critical - 2 semanas)**
- ✅ Undo/redo
- ✅ Unsaved changes indicator
- ✅ Pre-save validation

**Fase 2 (Important - 1 mes)**
- 🟡 Search en sidebar
- 🟡 Keyboard shortcuts
- 🟡 Better onboarding

**Fase 3 (Nice to have - backlog)**
- 🔵 State management refactor
- 🔵 Canvas performance optimization
- 🔵 Touch support mejorado

---

## 11. Conclusión

El **Flow Builder** de Faroles Genius CRM es una **interfaz visual bien ejecutada** que logra simplificar la complejidad de crear automatizaciones sin código. Su arquitectura de 3 columnas, sistema de color-coding, y contexto inspector son decisiones de diseño sólidas.

### Puntuación Global UX/UI: **7.5/10**

**Lo hace muy bien:**
- Visual clarity
- Intuitiveness para nuevos usuarios
- Design consistency

**Áreas de mejora:**
- State management complexity
- Performance con muchos nodos
- Discoverability de features avanzadas

Con las mejoras recomendadas (especialmente undo/redo y validación), el builder podría alcanzar **8.5-9/10** y competir con herramientas profesionales como Zapier o Make.

---

## Apéndice: Referencias Técnicas

### A1. Estructura de Archivos

```
public/
├── builder.html         (layout y marcado HTML)
├── builder.js          (lógica principal - 2000+ líneas)
├── builder.css         (estilos del builder)
├── styles/
│   ├── variables.css   (CSS custom properties)
│   ├── canvas.css      (Drawflow styling)
│   ├── animations.css  (transiciones/keyframes)
│   └── responsive.css  (media queries)
└── components/
    └── notifications.js (Toast/notifications)
```

### A2. Dependencias Externas

```
- Drawflow 0.0.60 (graph editing library)
- Dagre 0.8.5 (graph layout algorithm)
- Inter font (Google Fonts)
```

### A3. API Endpoints Utilizados

```
GET  /api/flows                    (listar)
POST /api/flows                    (crear)
GET  /api/flows/:id                (obtener uno)
POST /api/flows/:id                (actualizar)
POST /api/flows/:id/duplicate      (clonar)
DELETE /api/flows/:id              (eliminar)

GET  /api/ai/status                (verificar IA habilitada)
POST /api/ai/generate-flow         (generar con IA)
```

---

**Informe preparado:** Análisis UX/UI completo del Flow Builder  
**Metodología:** Análisis heurístico + inspección del código fuente  
**Objetivo:** Evaluación experta para optimización de experiencia del usuario

