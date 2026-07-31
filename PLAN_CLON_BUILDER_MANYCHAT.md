# PLAN: CLONAR BUILDER VISUAL DE MANYCHAT

**Duración**: 3-4 semanas (120-160 horas)  
**Equipo**: 1 Frontend Developer + 1 UI/UX Designer + 1 QA  
**Objetivo**: Builder visual idéntico a ManyChat en look & feel + interacciones  
**Alcance**: SOLO UI/UX del builder - NO triggers complejos, NO multi-canal

---

## 📋 ÍNDICE

1. [Resumen](#resumen)
2. [Análisis Visual de ManyChat](#análisis-visual-de-manychat)
3. [Componentes a Construir](#componentes-a-construir)
4. [Especificaciones Detalladas](#especificaciones-detalladas)
5. [Tareas de Desarrollo](#tareas-de-desarrollo)
6. [Código de Ejemplo](#código-de-ejemplo)
7. [Testing Plan](#testing-plan)

---

## Resumen

### ¿Qué vamos a clonar?

**LA INTERFAZ VISUAL** del builder de ManyChat:
- ✅ Header elegante con nombre, status, botones
- ✅ Sidebar con paleta de nodos (drag-drop)
- ✅ Canvas central con nodos visuales
- ✅ Conexiones visuales (líneas curvas)
- ✅ Modales de configuración por tipo de nodo
- ✅ Animaciones suaves (transiciones, hover, drag)
- ✅ Toast notifications (éxito, error, info)
- ✅ Input validations visuales
- ✅ Preview mode
- ✅ Estado DRAFT/LIVE con badge

### ¿Qué NO vamos a clonar?

- ❌ Sistema de triggers complejos (mantenemos el actual)
- ❌ Multi-canal (seguimos genérico)
- ❌ Integraciones con APIs externas
- ❌ Lógica de IA o ML
- ❌ Historiales/versioning avanzados

### Cambios Visuales Principales

| Elemento | Actual | ManyChat-Like | Impacto |
|----------|--------|---------------|---------|
| Header | Básico | Polished + badges | Alto |
| Sidebar | No existe | Paleta deslizable + iconos | Alto |
| Nodos | Rectángulos simples | Cards con colores | Alto |
| Conexiones | Líneas rectas | Líneas curvas suaves | Medio |
| Modales | Inline panels | Floating elegantes | Alto |
| Botones | Básicos | Polished + feedback | Medio |
| Animaciones | Ninguna | Smooth transitions | Bajo |
| Canvas | Plano | Profundidad visual | Medio |

---

## Análisis Visual de ManyChat

### 1. Header (60-64px height)

```
┌─────────────────────────────────────────────────────────────┐
│ ← │ Nombre de Flujo* │ DRAFT 🔴 │ Vista Previa │ Publicar  │
└─────────────────────────────────────────────────────────────┘

Elementos:
- Botón atrás (← flecha)
- Nombre editable (click para renombrar)
- Badge de estado: DRAFT (rojo) o LIVE (verde)
- Botón "Vista Previa" (outline)
- Botón "Publicar" (filled, destacado)
- Menú (⋮) con opciones adicionales
```

**Especificaciones:**
- Height: 64px
- Background: Blanco/Light gray
- Border-bottom: Subtle shadow
- Padding: 12px 20px
- Font: Inter, 14-16px

### 2. Sidebar (250px expandido / 60px colapsado)

```
EXPANDIDO (250px)           COLAPSADO (60px)
┌──────────────────────┐   ┌──┐
│ ⊕ Agregar Nodo ▼     │   │≡ │
├──────────────────────┤   ├──┤
│ 🔴 TRIGGERS          │   │🔴│
│ ├─ Palabra Clave     │   │  │
│ ├─ DM                │   │  │
│ ├─ Comentario        │   │  │
│                      │   │  │
│ 💬 CONTENIDO         │   │💬│
│ ├─ Mensaje Texto     │   │  │
│ ├─ Imagen            │   │  │
│ ├─ Botones           │   │  │
│ ├─ Galería           │   │  │
│                      │   │  │
│ ⚙️ ACCIONES          │   │⚙ │
│ ├─ Asignar Etiqueta  │   │  │
│ ├─ Actualizar Campo  │   │  │
│ ├─ Delay             │   │  │
│                      │   │  │
│ 🔀 LÓGICA            │   │🔀│
│ ├─ Condición Si/No   │   │  │
│ ├─ Esperar Respuesta │   │  │
│                      │   │  │
└──────────────────────┘   └──┘
```

**Especificaciones:**
- Width expandido: 250px
- Width colapsado: 60px
- Transición: 300ms
- Fondo: Blanco/Light
- Grupos colapsables
- Drag-drop desde items hacia canvas

### 3. Canvas Central

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│        ┌──────────────┐                                    │
│        │🔴 Palabra    │                                    │
│        │ Clave: hola  │                                    │
│        └──────┬───────┘                                    │
│               │ (línea curva)                              │
│               ↓                                            │
│        ┌──────────────┐                                    │
│        │💬 Mensaje    │                                    │
│        │ "Hola! ¿Cóm… │                                    │
│        └──────┬───────┘                                    │
│               │                                            │
│               ↓                                            │
│        ┌──────────────┐                                    │
│        │🔀 Condición  │                                    │
│        │ ¿Tiene tag?  │                                    │
│        └──────┬───────┘                                    │
│             ↙   ↘                                          │
│        SÍ /       \ NO                                    │
│          ↓         ↓                                       │
│     [Nodo]     [Nodo]                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Interacciones:
- Scroll/Zoom con rueda + Ctrl
- Drag nodos para mover
- Click en nodo → panel lateral
- Click-drag conexión → crear nueva
- Delete con tecla o botón
- Multiselect con Ctrl+Click
```

**Especificaciones:**
- Background: Subtle grid pattern
- Nodos: Cards con shadows
- Conexiones: Cubic Bezier curves
- Zoom range: 50% - 200%
- Smooth panning

### 4. Nodos Visuales

```
TRIGGER NODE (Rojo)         CONTENT NODE (Azul)        ACTION NODE (Verde)
┌────────────────────┐      ┌────────────────────┐      ┌────────────────────┐
│ 🔴 Palabra Clave   │      │ 💬 Mensaje Texto   │      │ ⚙️ Asignar Tag     │
│                    │      │                    │      │                    │
│ Contiene: "hola"   │      │ "¡Hola! ¿En qué…   │      │ Tag: "interesado"  │
│                    │      │ puedo ayudarte?"   │      │                    │
│ ├─ Clic edit       │      │ ├─ Clic edit       │      │ ├─ Clic edit       │
│ ├─ Ícono delete    │      │ ├─ Ícono delete    │      │ ├─ Ícono delete    │
│ └─ Puerto salida→  │      │ └─ Puerto salida→  │      │ └─ Puerto salida→  │
└────────────────────┘      └────────────────────┘      └────────────────────┘

LOGIC NODE (Naranja)
┌────────────────────┐
│ 🔀 Condición       │
│                    │
│ Si: tag = "VIP"    │
│                    │
│ ├─ Clic edit       │
│ ├─ Ícono delete    │
│ ├─ Puerto SÍ →     │
│ └─ Puerto NO →     │
└────────────────────┘

Colores:
- Triggers: #E63946 (rojo)
- Content: #457B9D (azul)
- Actions: #2A9D8F (verde/teal)
- Logic: #F77F00 (naranja)
```

**Especificaciones:**
- Width: 160px (fijo)
- Height: variable (100-180px)
- Border-radius: 8px
- Shadow: 0 2px 8px rgba(0,0,0,0.1)
- Padding: 12px
- Font-size: 12-13px
- Hover: Slight lift + brighter shadow
- Selected: Border 2px + glow

### 5. Modales de Configuración

```
┌────────────────────────────────────────────────┐
│ Editar: Mensaje Texto                       × │
├────────────────────────────────────────────────┤
│                                                │
│ Contenido:                                     │
│ ┌──────────────────────────────────────────┐  │
│ │ Escribe aquí tu mensaje...               │  │
│ │                                          │  │
│ │ ¡Hola! ¿En qué puedo ayudarte?          │  │
│ │                                          │  │
│ └──────────────────────────────────────────┘  │
│ 45 / 500 caracteres                           │
│                                                │
│ ☐ Usar variables {{ contact.name }}           │
│                                                │
│ Botones: [+ Agregar Botón]                    │
│ ├─ Botón 1: "Sí" → [destino]                 │
│ ├─ Botón 2: "No" → [destino]                 │
│                                                │
│                      [Cancelar] [Guardar]      │
└────────────────────────────────────────────────┘

Posición: Centro pantalla
Background: Semi-transparent overlay
Animation: Fade in + slight scale (300ms)
```

**Especificaciones:**
- Max-width: 500px
- Backdrop: rgba(0,0,0,0.5)
- Animation: Fade + transform 300ms
- Close: ESC key, X button, click outside
- Z-index: 1000+

### 6. Validaciones Visuales

```
Campo vacío:
┌──────────────────────────────────────────┐
│ Contenido del mensaje:                   │ ⚠️ Requerido
│ ┌────────────────────────────────────────┐│
│ │                                        ││ <- Border rojo
│ └────────────────────────────────────────┘│
└──────────────────────────────────────────┘

Campo válido:
┌──────────────────────────────────────────┐
│ Contenido del mensaje:                   │ ✓ Válido
│ ┌────────────────────────────────────────┐│
│ │ ¡Hola! ¿En qué puedo ayudarte?        ││ <- Border verde
│ └────────────────────────────────────────┘│
└──────────────────────────────────────────┘

Error:
┌──────────────────────────────────────────┐
│ Contenido del mensaje:                   │ ✗ Máx 500 caracteres
│ ┌────────────────────────────────────────┐│
│ │ Lorem ipsum...                         ││ <- Border rojo
│ └────────────────────────────────────────┘│
└──────────────────────────────────────────┘
```

### 7. Toast Notifications

```
Éxito (verde):
┌─────────────────────────────────┐
│ ✓ Flujo guardado correctamente  │
└─────────────────────────────────┘

Error (rojo):
┌─────────────────────────────────┐
│ ✗ Error al guardar flujo        │
└─────────────────────────────────┘

Info (azul):
┌─────────────────────────────────┐
│ ℹ Cambios no guardados          │
└─────────────────────────────────┘

Posición: Top-right
Auto-close: 3000ms (o manual con X)
```

---

## Componentes a Construir

### 1. Header Component

```
elements/
├── header.js
├── header.css
└── subcomponents/
    ├── flow-name-editor.js
    ├── status-badge.js
    └── action-buttons.js
```

### 2. Sidebar Component

```
elements/
├── sidebar.js
├── sidebar.css
└── subcomponents/
    ├── node-palette.js
    ├── node-category.js
    └── node-item.js
```

### 3. Canvas Component

```
elements/
├── canvas.js
├── canvas.css
├── canvas-grid.js
├── node-renderer.js
├── connection-renderer.js
└── canvas-interactions.js
```

### 4. Modal Component (Reutilizable)

```
elements/
├── modal.js
├── modal.css
└── modals/
    ├── edit-message-modal.js
    ├── edit-buttons-modal.js
    ├── edit-image-modal.js
    ├── edit-condition-modal.js
    └── (más por cada tipo de nodo)
```

### 5. Notifications Component

```
elements/
├── notification-manager.js
├── notification.css
└── notification-item.js
```

### 6. Utilities

```
utils/
├── theme-colors.js          (paleta de colores)
├── animation-helpers.js     (transiciones)
├── validation-helpers.js    (validación de inputs)
├── canvas-helpers.js        (matemáticas del canvas)
└── storage-helpers.js       (localStorage para estado)
```

---

## Especificaciones Detalladas

### Color Palette

```css
/* Neutrals */
--color-white: #FFFFFF;
--color-light-gray: #F5F7FA;
--color-gray: #B8BCC5;
--color-dark-gray: #3D414B;
--color-black: #000000;

/* Primary */
--color-primary: #2563EB;    /* Azul */

/* Status */
--color-success: #10B981;    /* Verde */
--color-error: #EF4444;      /* Rojo */
--color-warning: #F59E0B;    /* Naranja */
--color-info: #3B82F6;       /* Azul claro */

/* Node Colors */
--color-trigger: #E63946;    /* Rojo */
--color-content: #457B9D;    /* Azul */
--color-action: #2A9D8F;     /* Teal */
--color-logic: #F77F00;      /* Naranja */
```

### Typography

```css
--font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Scales */
--font-size-xs: 12px;
--font-size-sm: 13px;
--font-size-base: 14px;
--font-size-lg: 16px;
--font-size-xl: 18px;
--font-size-2xl: 20px;

/* Weights */
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;

/* Line Heights */
--line-height-tight: 1.2;
--line-height-normal: 1.5;
--line-height-relaxed: 1.75;
```

### Spacing System

```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-base: 12px;
--spacing-md: 16px;
--spacing-lg: 20px;
--spacing-xl: 24px;
--spacing-2xl: 32px;
--spacing-3xl: 40px;
```

### Animations

```css
/* Transiciones */
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-normal: 300ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow: 500ms cubic-bezier(0.4, 0, 0.2, 1);

/* Ejemplos */
button:hover {
  transition: all var(--transition-fast);
  background-color: var(--color-primary);
}

modal {
  animation: modalFadeIn var(--transition-normal);
}

@keyframes modalFadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

### Shadow System

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-base: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
```

---

## Tareas de Desarrollo

### Semana 1 (40 horas): UI Base

#### Día 1-2: Setup & Header (16 horas)

- [ ] **CSS Framework** (6 horas)
  - [ ] Variables de tema (colores, spacing, fonts)
  - [ ] Reset y estilos base
  - [ ] Sistema de grid/flexbox
  - [ ] Archivo: `public/styles/theme.css`

- [ ] **Header Component** (10 horas)
  - [ ] HTML estructura semántica
  - [ ] Estilos del header
  - [ ] Botón atrás funcional
  - [ ] Nombre editable (click para renombrar)
  - [ ] Badge de estado (DRAFT/LIVE)
  - [ ] Botones Vista Previa y Publicar
  - [ ] Menú desplegable (⋮)
  - [ ] Archivo: `public/js/components/header.js`

#### Día 3-5: Sidebar & Paleta (24 horas)

- [ ] **Sidebar Base** (8 horas)
  - [ ] HTML estructura
  - [ ] Estilos responsivos
  - [ ] Animación collapse/expand (300ms)
  - [ ] Archivo: `public/js/components/sidebar.js`

- [ ] **Node Palette** (10 horas)
  - [ ] Categorías (Triggers, Content, Actions, Logic)
  - [ ] Items dentro de categorías
  - [ ] Drag-drop desde sidebar
  - [ ] Hover effects y descripción
  - [ ] Archivo: `public/js/components/node-palette.js`

- [ ] **Icons & Typography** (6 horas)
  - [ ] Sistema de iconos (emoji o SVG)
  - [ ] Tipografía consistente
  - [ ] Responsive en mobile

---

### Semana 2 (40 horas): Canvas & Nodos

#### Día 1-3: Canvas & Rendering (24 horas)

- [ ] **Canvas Base** (8 horas)
  - [ ] Canvas HTML5 o SVG
  - [ ] Grid background
  - [ ] Pan/zoom funcional
  - [ ] Archivo: `public/js/components/canvas.js`

- [ ] **Node Rendering** (10 horas)
  - [ ] Renderizar nodos en canvas
  - [ ] Estilos por tipo de nodo (colores)
  - [ ] Puertos de entrada/salida
  - [ ] Hover effects (lift + shadow)
  - [ ] Selected state (border + glow)
  - [ ] Archivo: `public/js/components/node-renderer.js`

- [ ] **Connection Rendering** (6 horas)
  - [ ] Dibujar líneas curvas (Bezier)
  - [ ] Animación de conexiones
  - [ ] Validación de conectores
  - [ ] Archivo: `public/js/components/connection-renderer.js`

#### Día 4-5: Interacciones Canvas (16 horas)

- [ ] **Drag & Drop Nodos** (8 horas)
  - [ ] Mover nodos por canvas
  - [ ] Snap a grid (opcional)
  - [ ] Visual feedback mientras draggea
  - [ ] Archivo: `public/js/components/canvas-interactions.js`

- [ ] **Crear Conexiones** (4 horas)
  - [ ] Click puerto → drag → click destino
  - [ ] Preview de línea mientras draggea
  - [ ] Validaciones

- [ ] **Delete Nodos** (4 horas)
  - [ ] Tecla Delete
  - [ ] Botón delete en nodo
  - [ ] Confirmación

---

### Semana 3 (40 horas): Modales & Validaciones

#### Día 1-2: Sistema de Modales (16 horas)

- [ ] **Modal Base** (6 horas)
  - [ ] Componente reutilizable
  - [ ] Overlay semi-transparent
  - [ ] Animación fade + scale
  - [ ] Close con ESC y X
  - [ ] Archivo: `public/js/components/modal.js`

- [ ] **Modales por Tipo** (10 horas)
  - [ ] Edit Message Modal
  - [ ] Edit Buttons Modal
  - [ ] Edit Image Modal
  - [ ] Edit Condition Modal
  - [ ] (más según tipos de nodos actuales)

#### Día 3-4: Validaciones & Feedback (16 horas)

- [ ] **Form Validation** (8 horas)
  - [ ] Validar inputs en tiempo real
  - [ ] Mostrar errores inline
  - [ ] Contador de caracteres
  - [ ] Required fields highlighting
  - [ ] Archivo: `public/js/utils/validation-helpers.js`

- [ ] **Notifications/Toasts** (8 horas)
  - [ ] Notification manager
  - [ ] Toasts (success, error, info)
  - [ ] Auto-close
  - [ ] Stacking múltiples
  - [ ] Archivo: `public/js/components/notification-manager.js`

#### Día 5: Polish & Animations (8 horas)

- [ ] **Smooth Transitions**
  - [ ] Button hover states
  - [ ] Modal animations
  - [ ] Canvas interactions
  - [ ] Sidebar collapse

- [ ] **Responsive Design**
  - [ ] Mobile (375px)
  - [ ] Tablet (768px)
  - [ ] Desktop (1280px+)

---

### Semana 4 (40 horas): Integration & Testing

#### Día 1-3: Integration (24 horas)

- [ ] **Conectar Header** (4 horas)
  - [ ] Guardar nombre de flujo
  - [ ] Cambiar estado DRAFT/LIVE
  - [ ] Botón Publicar funcional

- [ ] **Conectar Sidebar** (4 horas)
  - [ ] Drag-drop crea nodos en canvas
  - [ ] Mantener lista sincronizada

- [ ] **Conectar Canvas** (8 horas)
  - [ ] Guardar posición de nodos
  - [ ] Guardar conexiones
  - [ ] Cargar flujo existente

- [ ] **Conectar Modales** (8 horas)
  - [ ] Guardar cambios de configuración
  - [ ] Actualizar nodo visualmente
  - [ ] Descartar cambios

#### Día 4-5: Testing & Polish (16 horas)

- [ ] **Manual Testing** (8 horas)
  - [ ] Todos los tipos de nodos
  - [ ] Todas las interacciones
  - [ ] Mobile responsiveness
  - [ ] Cross-browser

- [ ] **Performance** (4 horas)
  - [ ] Renderizado suave
  - [ ] Animaciones 60fps
  - [ ] No lag en drag-drop

- [ ] **Final Polish** (4 horas)
  - [ ] Detalles visuales
  - [ ] UX refinements
  - [ ] Documentación

---

## Código de Ejemplo

### Header Component

```javascript
// public/js/components/header.js
const Header = (function() {
  let flowName = 'Mi Flujo';
  let status = 'DRAFT';

  function render(container) {
    container.innerHTML = `
      <header class="builder-header">
        <div class="header-left">
          <button class="btn-back" aria-label="Volver">←</button>
          <span class="flow-name" contenteditable="true">${flowName}</span>
        </div>

        <div class="header-center">
          <span class="status-badge status-${status.toLowerCase()}">
            <span class="status-dot"></span>
            ${status}
          </span>
        </div>

        <div class="header-right">
          <button class="btn btn-outline">👁️ Vista Previa</button>
          <button class="btn btn-primary">Publicar</button>
          <button class="btn-menu">⋮</button>
        </div>
      </header>
    `;

    setupEventListeners(container);
  }

  function setupEventListeners(container) {
    const nameSpan = container.querySelector('.flow-name');
    const publishBtn = container.querySelector('.btn-primary');
    const previewBtn = container.querySelector('[aria-label="Vista Previa"]');
    const backBtn = container.querySelector('.btn-back');

    nameSpan.addEventListener('blur', (e) => {
      flowName = e.target.textContent;
      saveFlow();
    });

    publishBtn.addEventListener('click', () => {
      status = 'LIVE';
      render(container);
      NotificationManager.show('Flujo publicado', 'success');
      saveFlow();
    });

    previewBtn.addEventListener('click', () => {
      showPreview();
    });

    backBtn.addEventListener('click', () => {
      window.history.back();
    });
  }

  return { render };
})();
```

### Sidebar Component

```javascript
// public/js/components/sidebar.js
const Sidebar = (function() {
  const CATEGORIES = [
    {
      id: 'triggers',
      name: 'TRIGGERS',
      icon: '🔴',
      items: [
        { id: 'keyword', name: 'Palabra Clave', icon: '🔤' },
        { id: 'dm', name: 'Mensaje DM', icon: '📨' }
      ]
    },
    {
      id: 'content',
      name: 'CONTENIDO',
      icon: '💬',
      items: [
        { id: 'message', name: 'Mensaje Texto', icon: '💬' },
        { id: 'image', name: 'Imagen', icon: '🖼️' },
        { id: 'buttons', name: 'Botones', icon: '🔘' }
      ]
    },
    {
      id: 'actions',
      name: 'ACCIONES',
      icon: '⚙️',
      items: [
        { id: 'tag', name: 'Asignar Etiqueta', icon: '🏷️' },
        { id: 'field', name: 'Actualizar Campo', icon: '✏️' }
      ]
    },
    {
      id: 'logic',
      name: 'LÓGICA',
      icon: '🔀',
      items: [
        { id: 'condition', name: 'Condición Si/No', icon: '❓' }
      ]
    }
  ];

  let expanded = true;

  function render(container) {
    container.innerHTML = `
      <aside class="sidebar ${expanded ? 'expanded' : 'collapsed'}">
        <button class="btn-toggle-sidebar" title="Colapsar/Expandir">
          ${expanded ? '✕' : '☰'}
        </button>

        ${expanded ? `
          <div class="sidebar-content">
            ${CATEGORIES.map(category => `
              <div class="category">
                <h3 class="category-title">${category.icon} ${category.name}</h3>
                <div class="items">
                  ${category.items.map(item => `
                    <div class="node-item" draggable="true" data-type="${item.id}">
                      <span class="item-icon">${item.icon}</span>
                      <span class="item-name">${item.name}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="sidebar-collapsed">
            ${CATEGORIES.map(cat => `
              <button class="category-icon" title="${cat.name}" data-category="${cat.id}">
                ${cat.icon}
              </button>
            `).join('')}
          </div>
        `}
      </aside>
    `;

    setupDragDrop(container);
    setupToggle(container);
  }

  function setupDragDrop(container) {
    const items = container.querySelectorAll('.node-item');
    items.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('nodeType', item.dataset.type);
      });
    });
  }

  function setupToggle(container) {
    const btn = container.querySelector('.btn-toggle-sidebar');
    btn?.addEventListener('click', () => {
      expanded = !expanded;
      render(container);
    });
  }

  return { render };
})();
```

### Modal Component

```javascript
// public/js/components/modal.js
const Modal = (function() {
  function create(title, content, onSave, onCancel) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2>${title}</h2>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline btn-cancel">Cancelar</button>
          <button class="btn btn-primary btn-save">Guardar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('.modal-close').addEventListener('click', () => {
      close(modal, onCancel);
    });

    modal.querySelector('.btn-cancel').addEventListener('click', () => {
      close(modal, onCancel);
    });

    modal.querySelector('.btn-save').addEventListener('click', () => {
      const formData = new FormData(modal.querySelector('form'));
      onSave(Object.fromEntries(formData));
      close(modal);
    });

    // ESC key
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        close(modal, onCancel);
      }
    };
    document.addEventListener('keydown', handleEsc);

    return modal;
  }

  function close(modal, callback) {
    modal.classList.add('closing');
    setTimeout(() => {
      modal.remove();
      callback?.();
    }, 300);
  }

  return { create };
})();
```

### CSS: Theme & Animations

```css
/* public/styles/theme.css */

:root {
  /* Colors */
  --color-white: #FFFFFF;
  --color-light-gray: #F5F7FA;
  --color-gray: #B8BCC5;
  --color-dark-gray: #3D414B;
  
  /* Triggers/Content/Actions */
  --color-trigger: #E63946;
  --color-content: #457B9D;
  --color-action: #2A9D8F;
  --color-logic: #F77F00;
  
  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-base: 12px;
  --spacing-md: 16px;
  
  /* Transitions */
  --transition-fast: 150ms ease-out;
  --transition-normal: 300ms ease-out;
}

/* Header */
.builder-header {
  height: 64px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  background: var(--color-white);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.flow-name {
  font-size: 16px;
  font-weight: 600;
  cursor: text;
  padding: 4px 8px;
  border-radius: 4px;
}

.flow-name:hover {
  background: var(--color-light-gray);
}

/* Status Badge */
.status-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.status-draft {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
}

.status-live {
  background: rgba(16, 185, 129, 0.1);
  color: var(--color-success);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Sidebar */
.sidebar {
  width: 250px;
  background: var(--color-white);
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  transition: width var(--transition-normal);
  overflow: hidden;
}

.sidebar.collapsed {
  width: 60px;
}

.category-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-gray);
  margin: 16px 12px 8px;
  letter-spacing: 0.5px;
}

.node-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: move;
  border-radius: 4px;
  font-size: 13px;
  transition: all var(--transition-fast);
}

.node-item:hover {
  background: var(--color-light-gray);
  transform: translateX(2px);
}

/* Canvas */
.canvas-container {
  flex: 1;
  position: relative;
  background: url('data:image/svg+xml...') repeat;
  overflow: hidden;
}

/* Nodes */
.node {
  position: absolute;
  min-width: 160px;
  padding: 12px;
  border-radius: 8px;
  background: var(--color-white);
  border: 2px solid transparent;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: move;
  transition: all var(--transition-fast);
  user-select: none;
}

.node:hover {
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.node.selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.node.trigger {
  border-left: 4px solid var(--color-trigger);
}

.node.content {
  border-left: 4px solid var(--color-content);
}

.node.action {
  border-left: 4px solid var(--color-action);
}

.node.logic {
  border-left: 4px solid var(--color-logic);
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn var(--transition-normal);
}

.modal {
  background: var(--color-white);
  border-radius: 8px;
  box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  animation: modalSlideIn var(--transition-normal);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Buttons */
.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all var(--transition-fast);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: #1d4ed8;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.btn-outline {
  border: 1px solid var(--color-gray);
  background: transparent;
  color: var(--color-dark-gray);
}

.btn-outline:hover {
  background: var(--color-light-gray);
}
```

---

## Testing Plan

### Functional Testing

- [ ] Header
  - [ ] Nombre editable
  - [ ] Status badge se actualiza
  - [ ] Botón Publicar funciona
  - [ ] Botón Vista Previa abre preview

- [ ] Sidebar
  - [ ] Collapse/expand funciona
  - [ ] Drag-drop items crean nodos
  - [ ] Todas las categorías visibles

- [ ] Canvas
  - [ ] Drag nodos mueve posición
  - [ ] Zoom funciona
  - [ ] Pan funciona
  - [ ] Conexiones se crean correctamente

- [ ] Modales
  - [ ] Abren con animación suave
  - [ ] Validación funciona
  - [ ] Guardar actualiza nodo
  - [ ] Cancelar descarta cambios
  - [ ] ESC key cierra

- [ ] Notifications
  - [ ] Toasts aparecen
  - [ ] Auto-close funciona
  - [ ] Múltiples se stackean

### Visual Testing

- [ ] Responsive en mobile (375px)
- [ ] Responsive en tablet (768px)
- [ ] Responsive en desktop (1280px+)
- [ ] Colores consistentes
- [ ] Animaciones smooth
- [ ] Tipografía clara

### Performance Testing

- [ ] 60fps en animaciones
- [ ] No lag en drag-drop
- [ ] Canvas renderiza rápido
- [ ] Memory usage reasonable

---

## Checklist Final

✅ **UI/UX Completa**
- [ ] Header elegante
- [ ] Sidebar funcional
- [ ] Canvas intuitivo
- [ ] Nodos visuales
- [ ] Modales pulidos
- [ ] Animaciones suaves

✅ **Interacciones**
- [ ] Drag-drop nodos
- [ ] Crear conexiones
- [ ] Editar configuración
- [ ] Delete nodos
- [ ] Guardar automaticamente

✅ **Visual Parity**
- [ ] Looks like ManyChat
- [ ] Feels like ManyChat
- [ ] Responsive
- [ ] Cross-browser compatible

---

**Último Update**: 30 de Julio 2026  
**Versión**: 1.0  
**Estado**: Listo para desarrollo
