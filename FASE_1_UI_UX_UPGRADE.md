# FASE 1: UI/UX UPGRADE - Plan Detallado de Desarrollo

**Duración**: 2 semanas (80 horas)  
**Equipo**: 1 Frontend Developer + 1 QA  
**Objetivo**: Mejorar UI/UX para que sea comparable a ManyChat  
**Resultado**: Interfaz profesional, moderna y pulida

---

## 📋 ÍNDICE

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Componentes a Desarrollar](#componentes-a-desarrollar)
3. [Especificaciones Detalladas](#especificaciones-detalladas)
4. [Arquitectura CSS/JS](#arquitectura-cssjs)
5. [Tareas de Desarrollo](#tareas-de-desarrollo)
6. [Código de Ejemplo](#código-de-ejemplo)
7. [Wireframes y Diseño](#wireframes-y-diseño)
8. [Checklist de Testing](#checklist-de-testing)
9. [Criterios de Aceptación](#criterios-de-aceptación)
10. [Timeline y Hitos](#timeline-y-hitos)

---

## Resumen Ejecutivo

### Cambios Principales

| Componente | Cambio | Impacto | Esfuerzo |
|-----------|--------|--------|----------|
| Header | Rediseño + badges | Alto | Media |
| Sidebar | Modo colapsable + iconos | Medio | Media |
| Modales | Configuración elegante | Alto | Alta |
| Canvas | Mejores nodos + colores | Medio | Media |
| Notificaciones | Toast + validaciones | Medio | Baja |
| Estilos | Sistema de colores consistente | Alto | Media |

### Stack Utilizado (SIN nuevas dependencias)
- **CSS3**: Variables CSS, Flexbox, Grid
- **JavaScript**: Vanilla JS (sin librerías nuevas)
- **HTML**: Semántico mejorado
- **Drawflow**: Ya está, solo mejora de visualización

### Archivos a Crear/Modificar

```
public/
├─ builder.html           (modificado - nueva estructura)
├─ builder.js            (modificado - refactored)
├─ builder.css           (reescrito - nuevo sistema de estilos)
├─ components/
│  ├─ header.js          (nuevo)
│  ├─ sidebar.js         (nuevo)
│  ├─ modals.js          (nuevo)
│  ├─ notifications.js   (nuevo)
│  ├─ canvas.js          (nuevo)
│  └─ validators.js      (nuevo)
├─ styles/
│  ├─ variables.css      (nuevo - color system)
│  ├─ header.css         (nuevo)
│  ├─ sidebar.css        (nuevo)
│  ├─ modals.css         (nuevo)
│  ├─ notifications.css  (nuevo)
│  └─ responsive.css     (nuevo)
└─ assets/
   └─ icons/             (SVG icons, opcional mejorable)
```

---

## Componentes a Desarrollar

### 1. **HEADER** (Nuevo Sistema)

#### 1.1 Estructura del Header

```
┌─────────────────────────────────────────────────────────┐
│ Logo | Monitor | Automatizaciones | Builder (active)    │
│                                                          │
│  Automatizaciones > Sin Título [DRAFT]                  │
│                     ✨ Auto-Organizar | Guardar | Publ. │
└─────────────────────────────────────────────────────────┘
```

#### 1.2 Elementos del Header

**Left Section (Logo + Nav)**
- Logo "Faroles Genius" con "Flow Builder" subtitle
- Navegación: Monitor, Automatizaciones, Builder
- Indicador visual de página activa (underline azul)

**Center Section (Flow Info)**
- Breadcrumb: "Automatizaciones > [Flow Name]"
- Status Badge: "DRAFT" (gray) o "LIVE" (red)
- Flow name editable (click para editar inline)

**Right Section (Actions)**
- Botón "✨ Auto-Organizar" (secondary, gray)
- Botón "Guardar Cambios" (primary, blue)
- Botón "Publicar" (publish, green/red) - solo si es DRAFT
- Menú "..." (more options)

#### 1.3 Especificaciones

**Colores:**
- Background: #ffffff (white)
- Border: #e5e7eb (light gray)
- Text: #111827 (dark)
- Primary button: #3b82f6 (blue)
- Publish button: #16a34a (green)

**Tipografía:**
- Logo: 18px, bold (weight 700)
- Nav items: 14px, regular
- Breadcrumb: 14px, regular
- Status badge: 12px, bold

**Altura**: 64px

**Esfuerzo estimado**: 8 horas

---

### 2. **SIDEBAR** (Sistema Colapsable)

#### 2.1 Estructura

**Estado Expandido (250px):**
```
┌──────────────────────┐
│ ⚡ Palabra Clave      │ ← Draggable item
│ 💬 Enviar Mensaje    │
│ 📥 Pedir Dato        │
│ ⚡ Realizar Acciones │
│                      │
│ CONDICIONES:         │ ← Section header
│ ❓ Condición         │
│ 🎲 Aleatorizador     │
│ ⏱️ Retraso           │
│                      │
│ AVANZADO:            │
│ 📤 Saltar a Flujo    │
│ 🎬 AI Step           │
│                      │
│ « (collapse button)   │
└──────────────────────┘
```

**Estado Colapsado (60px):**
```
┌────┐
│ ⚡ │ ← hover muestra tooltip
│ 💬 │
│ 📥 │
│    │
│ ❓ │
│ 🎲 │
│ ⏱️ │
│    │
│ 📤 │
│ 🎬 │
│    │
│ » │ ← expand button
└────┘
```

#### 2.2 Interactividad

- **Click en `«`/`»`**: Toggle entre expandido/colapsado (guardar en localStorage)
- **Hover en item (colapsado)**: Mostrar tooltip con nombre
- **Drag item**: Cursor cambia, preview del nodo sigue mouse
- **Drop en canvas**: Crear nodo

#### 2.3 Especificaciones

**Ancho expandido**: 250px  
**Ancho colapsado**: 60px  
**Transición**: 0.3s ease-in-out

**Esfuerzo estimado**: 10 horas

---

### 3. **MODALES DE CONFIGURACIÓN** (Nuevo Sistema)

#### 3.1 Modal Base (Reutilizable)

Todos los modales siguen este patrón:

```
┌──────────────────────────────────────────┐
│ Título del Modal                       × │
├──────────────────────────────────────────┤
│                                          │
│  Contenido del modal                    │
│  (formularios, opciones, etc.)          │
│                                          │
│                                          │
├──────────────────────────────────────────┤
│                    [Cancelar] [Guardar] │
└──────────────────────────────────────────┘
```

**Propiedades:**
- Ancho: 500px (max-width: 90vw)
- Overlay: rgba(0,0,0,0.5)
- Animación: Fade in + Scale (300ms)
- Z-index: 1000

#### 3.2 Tipos de Modales

**A) Modal de Trigger (Disparador)**

```
┌─────────────────────────────────────────┐
│ Seleccionar Disparador               × │
├─────────────────────────────────────────┤
│                                         │
│ [Buscar disparador...]                 │
│                                         │
│ DISPARADORES DISPONIBLES:              │
│                                         │
│ ⚡ Palabra Clave                        │
│   El usuario menciona una palabra clave │
│                                         │
│ 💬 Comentario en Post                  │
│   El usuario comenta una publicación   │
│                                         │
│ 📸 Respuesta a Historia                │
│   El usuario responde una historia     │
│                                         │
│ 📨 Evento de Contacto                  │
│   Se ejecuta un evento personalizado   │
│                                         │
├─────────────────────────────────────────┤
│                    [Cancelar] [Siguiente]│
└─────────────────────────────────────────┘
```

**B) Modal de Configuración de Trigger (Palabra Clave)**

```
┌──────────────────────────────────────────┐
│ Configurar: Palabra Clave             × │
├──────────────────────────────────────────┤
│                                          │
│ Tipo de Coincidencia:                  │
│ ⦿ Contiene    ○ Exacta    ○ Comienza   │
│                                          │
│ Palabras Clave:                        │
│ [precio][cuanto vale][costo] [+Agregar]│
│                                          │
│ Nota: case-insensitive                 │
│                                          │
│ Condiciones Adicionales (Opcional):    │
│ [+ Agregar Condición]                  │
│                                          │
├──────────────────────────────────────────┤
│                    [Cancelar] [Guardar] │
└──────────────────────────────────────────┘
```

**C) Modal de Contenido (Texto, Imagen, etc.)**

```
┌──────────────────────────────────────────┐
│ Editar Contenido: Texto               × │
├──────────────────────────────────────────┤
│                                          │
│ [😊][😢][:] [1000]                      │ ← Emoji + counter
│                                          │
│ [Escribe tu mensaje aquí...]            │
│                                          │
│ ☐ Guardar como plantilla               │
│ Nombre: [___________________]           │
│                                          │
│ [+ Agregar Botón]                      │
│                                          │
├─────────────────────────────────────────┤
│                    [Cancelar] [Guardar] │
└─────────────────────────────────────────┘
```

**D) Modal de Botón**

```
┌──────────────────────────────────────────┐
│ Editar Botón                          × │
├──────────────────────────────────────────┤
│                                          │
│ Título del Botón:                      │
│ [New Button #1]                 [50/50] │
│                                          │
│ Acción cuando se presiona:             │
│ ○ Abrir URL                             │
│ ○ Enviar Mensaje                        │
│ ○ Ejecutar Acción                       │
│ ○ Condición (UPGRADE)                   │
│                                          │
│ [Configuración específica por acción]   │
│                                          │
│ Rastrear clics: ☑                       │
│                                          │
├──────────────────────────────────────────┤
│              [Eliminar] [Cancelar] [OK] │
└──────────────────────────────────────────┘
```

**Esfuerzo estimado**: 20 horas

---

### 4. **CANVAS MEJORADO**

#### 4.1 Mejoras a Nodos

**Antes (Actual):**
- Rectángulos simples
- Poco contraste
- Difícil de distinguir tipo

**Después (Nuevo):**
- Cards con sombra
- Colores por tipo (rojo=trigger, azul=mensaje, etc.)
- Icono visible en nodo
- Texto más legible
- Conexiones curvas y con flechas

#### 4.2 Especificaciones de Nodos

**Nodo Trigger (Disparador):**
- Background: #fef2f2 (rojo muy claro)
- Border: #dc2626 (rojo)
- Icono: ⚡
- Texto: "El usuario envía un mensaje" (negrita)

**Nodo Mensaje:**
- Background: #eff6ff (azul claro)
- Border: #3b82f6 (azul)
- Icono: 💬
- Texto: "Enviar message #1"

**Nodo Acción:**
- Background: #fef3c7 (amarillo claro)
- Border: #f59e0b (amarillo)
- Icono: ⚡
- Texto: "Realizar acciones"

**Nodo Condición:**
- Background: #f0fdf4 (verde claro)
- Border: #22c55e (verde)
- Icono: ❓
- Texto: "Condición: [config]"

**Tamaño estándar**: 200px ancho × auto alto

#### 4.3 Conexiones

- **Estilo**: Bezier curves (curvas)
- **Color**: Hereda de nodo origen
- **Ancho**: 2px
- **Flecha**: Pequeña al final de conexión
- **Hover**: Destacar con sombra

**Esfuerzo estimado**: 12 horas

---

### 5. **SISTEMA DE NOTIFICACIONES** (Toast)

#### 5.1 Estructura

```
┌────────────────────────────────┐
│ ✅ Cambios guardados           │
└────────────────────────────────┘

┌────────────────────────────────┐
│ ⚠️ Campo requerido             │
└────────────────────────────────┘

┌────────────────────────────────┐
│ ❌ Error al guardar            │
└────────────────────────────────┘
```

#### 5.2 Tipos de Notificaciones

| Tipo | Ícono | Color | Auto-dismiss |
|------|-------|-------|--------------|
| Success | ✅ | Verde (#16a34a) | 3s |
| Warning | ⚠️ | Amarillo (#f59e0b) | 5s |
| Error | ❌ | Rojo (#dc2626) | 5s |
| Info | ℹ️ | Azul (#3b82f6) | 4s |

#### 5.3 Posición
- Bottom-right
- Margin: 20px
- Z-index: 2000
- Max 3 notificaciones simultáneas

**Esfuerzo estimado**: 5 horas

---

### 6. **SISTEMA DE VALIDACIÓN** (Inline)

#### 6.1 Estados de Input

**Normal:**
```
[Escribe aquí...                    ]
```

**Focus:**
```
[Escribe aquí...                    ] ← border azul
```

**Error:**
```
[Escribe aquí...                    ] ← border rojo
❌ Este campo es requerido
```

**Success:**
```
[Escribe aquí...                    ] ← border verde
✅ Válido
```

#### 6.2 Validaciones Implementar

- **Campos requeridos**: Mostrar error si vacío
- **Email**: Validar formato
- **URL**: Validar formato
- **Longitud**: Mostrar contador
- **Números**: Solo números
- **Palabras clave duplicadas**: Prevenir chips duplicados

**Esfuerzo estimado**: 8 horas

---

## Especificaciones Detalladas

### Sistema de Colores (CSS Variables)

```css
/* Primarios */
--color-primary: #3b82f6;          /* Azul */
--color-primary-dark: #1e40af;
--color-primary-light: #dbeafe;

/* Status */
--color-draft: #6b7280;             /* Gris */
--color-live: #dc2626;              /* Rojo */
--color-success: #16a34a;           /* Verde */
--color-warning: #f59e0b;           /* Amarillo */
--color-error: #dc2626;             /* Rojo */

/* Channel Colors */
--color-instagram: #dc2626;
--color-whatsapp: #16a34a;
--color-messenger: #3b82f6;

/* Neutrals */
--color-bg: #ffffff;
--color-surface: #f9fafb;
--color-border: #e5e7eb;
--color-text: #111827;
--color-text-secondary: #6b7280;

/* Shadows */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
```

### Tipografía

```css
/* Headers */
--font-size-h1: 28px;  /* Logo */
--font-size-h2: 24px;  /* Modal titles */
--font-size-h3: 18px;  /* Section headers */

/* Body */
--font-size-base: 14px;  /* Default */
--font-size-sm: 12px;    /* Labels, hints */
--font-size-xs: 11px;    /* Tiny labels */

/* Weights */
--font-bold: 700;
--font-semibold: 600;
--font-medium: 500;
--font-normal: 400;

/* Line height */
--line-height-tight: 1.25;
--line-height-normal: 1.5;
--line-height-relaxed: 1.75;
```

### Spacing

```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;
--spacing-2xl: 48px;
```

### Breakpoints

```css
/* Mobile first */
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
```

---

## Arquitectura CSS/JS

### Estructura de Archivos

```
public/
├── builder.html              (modificado)
├── builder.js               (refactorizado)
├── builder.css              (reescrito - imports)
│
├── components/               (NUEVO)
│   ├── header.js
│   ├── sidebar.js
│   ├── modals.js
│   ├── notifications.js
│   ├── canvas.js
│   └── validators.js
│
├── styles/                   (NUEVO)
│   ├── variables.css         (colores, tipografía, spacing)
│   ├── reset.css             (normalize)
│   ├── header.css
│   ├── sidebar.css
│   ├── modals.css
│   ├── notifications.css
│   ├── canvas.css
│   ├── responsive.css
│   └── animations.css        (transiciones suaves)
│
└── utils/                    (NUEVO)
    ├── dom.js               (utilidades DOM)
    ├── events.js            (event emitter)
    └── storage.js           (localStorage helpers)
```

### Patrón de Módulos (ES5 compatible)

```javascript
// Ejemplo: components/header.js

const HeaderComponent = (function() {
  // Private
  let config = {
    flowName: '',
    flowStatus: 'draft',
    onSave: null,
    onPublish: null
  };

  function render() {
    // Renderizar header
  }

  function setupListeners() {
    // Event listeners
  }

  function updateStatus(status) {
    config.flowStatus = status;
    render();
  }

  // Public API
  return {
    init: function(options) {
      config = { ...config, ...options };
      render();
      setupListeners();
    },
    setFlowName: function(name) {
      config.flowName = name;
      render();
    },
    setStatus: function(status) {
      updateStatus(status);
    }
  };
})();

// Uso
HeaderComponent.init({
  flowName: 'Mi Flujo',
  flowStatus: 'draft',
  onSave: () => console.log('saved')
});
```

---

## Tareas de Desarrollo

### Sprint 1: Semana 1 (40 horas)

#### Día 1-2: Setup y Foundation (16 horas)

- [ ] **Refactorizar HTML** (builder.html)
  - Crear estructura semántica
  - Dividir en secciones (header, sidebar, main, modals)
  - Agregar data attributes para selectores JS
  - Estimado: 4 horas

- [ ] **Sistema de estilos CSS**
  - Crear `styles/variables.css` con todo el system
  - Crear `styles/reset.css`
  - Crear `styles/responsive.css`
  - Importar todo en `builder.css`
  - Estimado: 4 horas

- [ ] **Modelos JS base**
  - Crear `components/` directory
  - Crear estructura base de módulos
  - Crear `utils/dom.js`, `utils/events.js`, `utils/storage.js`
  - Estimado: 4 horas

- [ ] **Testing setup**
  - Crear estructura para tests
  - Setup mock data
  - Estimado: 4 horas

#### Día 3-5: Header Component (16 horas)

- [ ] **Header.js** (8 horas)
  - [ ] Renderizar logo + nav
  - [ ] Breadcrumb dinámico
  - [ ] Status badge (DRAFT/LIVE)
  - [ ] Botones de acción
  - [ ] Edición inline de nombre
  - [ ] Event listeners

- [ ] **Header.css** (4 horas)
  - [ ] Estilos de header
  - [ ] Responsive layout
  - [ ] Hover states
  - [ ] Active nav indicator

- [ ] **Testing** (4 horas)
  - [ ] Unit tests de componentes
  - [ ] Visual regression tests
  - [ ] Interaction tests

#### Día 6-7: Setup e Integración (8 horas)

- [ ] Integrar Header en builder.html
- [ ] Probar navegación entre páginas
- [ ] Testing end-to-end básico

---

### Sprint 2: Semana 2 (40 horas)

#### Día 1-3: Sidebar Component (24 horas)

- [ ] **Sidebar.js** (12 horas)
  - [ ] Renderizar items draggables
  - [ ] Sistema de secciones
  - [ ] Toggle expandido/colapsado
  - [ ] Tooltips en modo colapsado
  - [ ] Drag handlers (coordinar con canvas)
  - [ ] Guardar estado en localStorage

- [ ] **Sidebar.css** (6 horas)
  - [ ] Layout (expandido/colapsado)
  - [ ] Transiciones suaves
  - [ ] Iconos y hover states
  - [ ] Responsive

- [ ] **Testing** (6 horas)
  - [ ] Drag/drop tests
  - [ ] State persistence
  - [ ] Visual tests

#### Día 4-5: Modales Base (12 horas)

- [ ] **Modals.js** (8 horas)
  - [ ] Sistema base de modales (reutilizable)
  - [ ] Modal de triggers
  - [ ] Modal de configuración (palabra clave)
  - [ ] Validación de inputs dentro de modales

- [ ] **Modals.css** (2 horas)
  - [ ] Estilos de overlay
  - [ ] Animaciones de entrada
  - [ ] Responsividad

- [ ] **Testing** (2 horas)

#### Día 6-7: Notificaciones y Polish (4 horas)

- [ ] **Notifications.js + CSS** (2 horas)
- [ ] **Validations.js** (1 hora)
- [ ] Testing final (1 hora)

---

## Código de Ejemplo

### HTML Structure (builder.html)

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flow Builder</title>
    
    <!-- Estilos -->
    <link rel="stylesheet" href="styles/variables.css">
    <link rel="stylesheet" href="styles/reset.css">
    <link rel="stylesheet" href="styles/header.css">
    <link rel="stylesheet" href="styles/sidebar.css">
    <link rel="stylesheet" href="styles/modals.css">
    <link rel="stylesheet" href="styles/notifications.css">
    <link rel="stylesheet" href="styles/canvas.css">
    <link rel="stylesheet" href="styles/responsive.css">
    <link rel="stylesheet" href="styles/animations.css">
    <link rel="stylesheet" href="builder.css">
    
    <!-- Drawflow -->
    <link rel="stylesheet" href="https://unpkg.com/drawflow@0.0.60/dist/drawflow.min.css">
</head>
<body>
    <!-- Header -->
    <header id="app-header" class="app-header"></header>

    <!-- Main Container -->
    <div class="app-container">
        <!-- Sidebar -->
        <aside id="app-sidebar" class="app-sidebar"></aside>

        <!-- Main Content -->
        <main class="app-main">
            <!-- Canvas -->
            <div id="drawflow" class="drawflow"></div>
        </main>
    </div>

    <!-- Modales Container -->
    <div id="modals-container" class="modals-container"></div>

    <!-- Notificaciones Container -->
    <div id="notifications-container" class="notifications-container"></div>

    <!-- Scripts -->
    <script src="utils/dom.js"></script>
    <script src="utils/events.js"></script>
    <script src="utils/storage.js"></script>
    <script src="components/header.js"></script>
    <script src="components/sidebar.js"></script>
    <script src="components/modals.js"></script>
    <script src="components/notifications.js"></script>
    <script src="components/validators.js"></script>
    <script src="components/canvas.js"></script>
    <script src="https://unpkg.com/drawflow@0.0.60/dist/drawflow.min.js"></script>
    <script src="builder.js"></script>
</body>
</html>
```

### CSS Variables (styles/variables.css)

```css
:root {
  /* Colores Primarios */
  --color-primary: #3b82f6;
  --color-primary-dark: #1e40af;
  --color-primary-light: #dbeafe;

  /* Estados */
  --color-draft: #6b7280;
  --color-live: #dc2626;
  --color-success: #16a34a;
  --color-warning: #f59e0b;
  --color-error: #dc2626;

  /* Canales */
  --color-instagram: #dc2626;
  --color-whatsapp: #16a34a;
  --color-messenger: #3b82f6;

  /* Neutrals */
  --color-bg: #ffffff;
  --color-surface: #f9fafb;
  --color-border: #e5e7eb;
  --color-text: #111827;
  --color-text-secondary: #6b7280;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

  /* Tipografía */
  --font-size-base: 14px;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;

  /* Transiciones */
  --transition-fast: 150ms ease-in-out;
  --transition-normal: 300ms ease-in-out;
  --transition-slow: 500ms ease-in-out;
}
```

### Header Component (components/header.js)

```javascript
const HeaderComponent = (function() {
  let state = {
    flowName: '',
    flowStatus: 'draft',
    canPublish: false,
    onSave: null,
    onPublish: null,
    onArrange: null
  };

  const DOM = {
    header: null,
    flowName: null,
    statusBadge: null,
    saveBtn: null,
    publishBtn: null,
    arrangeBtn: null
  };

  function render() {
    DOM.header.innerHTML = `
      <div class="header-left">
        <div class="logo">Faroles Genius <span>Flow Builder</span></div>
        <nav class="nav-bar">
          <a href="/">Monitor</a>
          <a href="/automations.html">Automatizaciones</a>
          <a href="/builder.html" class="active">Builder</a>
        </nav>
      </div>
      
      <div class="header-center" id="flow-info">
        <div class="breadcrumb">
          Automatizaciones > <span id="flow-name-display">${state.flowName}</span>
        </div>
        <span class="status-badge status-${state.flowStatus}">
          ${state.flowStatus === 'draft' ? 'DRAFT' : 'LIVE'}
        </span>
      </div>
      
      <div class="header-actions">
        <button id="btn-arrange" class="btn btn-secondary">
          ✨ Auto-Organizar
        </button>
        <button id="btn-save" class="btn btn-primary">
          Guardar Cambios
        </button>
        <button id="btn-publish" class="btn btn-publish" ${!state.canPublish ? 'disabled' : ''}>
          Publicar
        </button>
        <button id="btn-menu" class="btn btn-icon">⋮</button>
      </div>
    `;
    
    setupListeners();
  }

  function setupListeners() {
    DOM.saveBtn = document.getElementById('btn-save');
    DOM.publishBtn = document.getElementById('btn-publish');
    DOM.arrangeBtn = document.getElementById('btn-arrange');
    
    DOM.saveBtn.addEventListener('click', () => {
      if (state.onSave) state.onSave();
    });
    
    DOM.publishBtn.addEventListener('click', () => {
      if (state.onPublish) state.onPublish();
    });
    
    DOM.arrangeBtn.addEventListener('click', () => {
      if (state.onArrange) state.onArrange();
    });
  }

  return {
    init: function(container, options = {}) {
      DOM.header = container;
      state = { ...state, ...options };
      render();
    },
    setFlowName: function(name) {
      state.flowName = name;
      const nameDisplay = document.getElementById('flow-name-display');
      if (nameDisplay) nameDisplay.textContent = name;
    },
    setStatus: function(status) {
      state.flowStatus = status;
      state.canPublish = status === 'draft';
      render();
    },
    setState: function(newState) {
      state = { ...state, ...newState };
      render();
    }
  };
})();

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
  HeaderComponent.init(document.getElementById('app-header'), {
    onSave: () => console.log('Save clicked'),
    onPublish: () => console.log('Publish clicked'),
    onArrange: () => console.log('Arrange clicked')
  });
});
```

### Notifications Component (components/notifications.js)

```javascript
const NotificationManager = (function() {
  const container = document.getElementById('notifications-container');
  const activeNotifications = [];

  function createNotification(message, type = 'info', duration = 3000) {
    const id = Date.now();
    const notif = document.createElement('div');
    notif.className = `notification notification-${type}`;
    notif.setAttribute('data-id', id);
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    notif.innerHTML = `
      <span class="notification-icon">${icons[type]}</span>
      <span class="notification-message">${message}</span>
    `;

    container.appendChild(notif);
    activeNotifications.push(id);

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => {
        notif.classList.add('notification-exit');
        setTimeout(() => {
          notif.remove();
          activeNotifications.splice(activeNotifications.indexOf(id), 1);
        }, 300);
      }, duration);
    }

    return id;
  }

  return {
    success: (msg, duration = 3000) => createNotification(msg, 'success', duration),
    error: (msg, duration = 5000) => createNotification(msg, 'error', duration),
    warning: (msg, duration = 5000) => createNotification(msg, 'warning', duration),
    info: (msg, duration = 4000) => createNotification(msg, 'info', duration)
  };
})();

// Uso
NotificationManager.success('Cambios guardados');
NotificationManager.error('Error al guardar');
```

---

## Wireframes y Diseño

### Vista General del Builder

```
┌─────────────────────────────────────────────────────────────┐
│ Logo | Monitor | Auto... | Builder(active)                  │
│ Automatizaciones > Sin Título [DRAFT]                        │
│            ✨ Auto-Organizar | Guardar | Publicar            │
├──────┬──────────────────────────────────────────────────────┤
│      │                                                       │
│ ⚡   │      ┌─────────────────┐                             │
│ 💬   │      │ ⚡ Disparador   │                             │
│ 📥   │      │ Palabra Clave   │                             │
│      │      └────────┬────────┘                             │
│ ❓   │               │                                       │
│ 🎲   │      ┌────────▼────────┐                             │
│ ⏱️   │      │ 💬 Mensaje #1  │                             │
│      │      │ "Hola! ¿Cómo   │                             │
│ 📤   │      │ estás?"        │                             │
│ 🎬   │      └────────┬────────┘                             │
│      │               │                                       │
│      │      ┌────────▼────────┐                             │
│      │      │ ⚡ Acciones    │                             │
│      │      │ Agregar tag    │                             │
│      │      └────────────────┘                             │
│      │                                      + [Zoom +/-]   │
│      │                                                       │
└──────┴──────────────────────────────────────────────────────┘

Modal (overlay):
┌──────────────────────────────────┐
│ Seleccionar Disparador         × │
├──────────────────────────────────┤
│ [Buscar...]                      │
│                                  │
│ ⚡ Palabra Clave                 │
│ 💬 Comentario en Post            │
│ 📸 Respuesta a Historia          │
│                                  │
├──────────────────────────────────┤
│            [Cancelar] [Siguiente]│
└──────────────────────────────────┘
```

---

## Checklist de Testing

### Testing Funcional

**Header:**
- [ ] Logo y navegación visible
- [ ] Status badge muestra DRAFT/LIVE correcto
- [ ] Click en "Guardar" dispara evento
- [ ] Click en "Publicar" solo activo si DRAFT
- [ ] Click en "Auto-Organizar" funciona
- [ ] Nombre del flujo editable inline

**Sidebar:**
- [ ] Items arrastrables
- [ ] Toggle expandido/colapsado funciona
- [ ] Estado se persiste en localStorage
- [ ] Tooltips visibles en modo colapsado
- [ ] Secciones están organizadas correctamente

**Modales:**
- [ ] Aparecen con animación
- [ ] Desaparecen al hacer click en "Cancelar"
- [ ] Validaciones funcionan
- [ ] Inputs aceptan texto correctamente
- [ ] Botones de acción funcionan

**Notificaciones:**
- [ ] Toast aparece y desaparece
- [ ] Colores correctos por tipo
- [ ] Multiple notificaciones no se superponen
- [ ] Auto-dismiss en tiempo correcto

### Testing Visual

- [ ] Responsive en mobile (375px)
- [ ] Responsive en tablet (768px)
- [ ] Responsive en desktop (1280px)
- [ ] Colores corresponden a variables CSS
- [ ] Tipografía es consistente
- [ ] Espaciado es uniforme
- [ ] Sombras son sutiles y consistentes

### Testing de Performance

- [ ] Modal abre en <300ms
- [ ] Transiciones son suaves (60fps)
- [ ] No hay memory leaks al abrir/cerrar modales
- [ ] Scroll en canvas es fluido
- [ ] Drawflow no tiene lag

### Testing en Navegadores

- [ ] Chrome ✅
- [ ] Firefox ✅
- [ ] Safari ✅
- [ ] Edge ✅

---

## Criterios de Aceptación

### Definition of Done (DoD)

✅ **Código**
- [ ] Código escrito siguiendo el estilo del proyecto
- [ ] Sin errores de linting
- [ ] Sin console.log() en producción
- [ ] Modular y reutilizable
- [ ] Variables CSS usadas correctamente

✅ **Testing**
- [ ] Todas las pruebas funcionales pasan
- [ ] Pruebas visuales aprobadas
- [ ] Sin errores en console
- [ ] Responsive en 3 breakpoints

✅ **Documentación**
- [ ] Comentarios en código donde sea necesario
- [ ] README actualizado si hay nuevas features
- [ ] Cambios documentados

✅ **Performance**
- [ ] No hay memory leaks
- [ ] Transiciones fluidas
- [ ] Load time aceptable

### Entregables Esperados

**Por Semana 1:**
- ✅ Header completamente funcional
- ✅ Sidebar con toggle
- ✅ Sistema de estilos CSS base
- ✅ Testing coverage >80%

**Por Semana 2:**
- ✅ Modales de triggers y configuración
- ✅ Sistema de notificaciones
- ✅ Validaciones de inputs
- ✅ Canvas mejorado con colores y estilos
- ✅ Testing coverage >85%
- ✅ UI comparable a ManyChat

---

## Timeline y Hitos

### Semana 1 (40 horas)

| Día | Tarea | Horas | Estado |
|-----|-------|-------|--------|
| L-M | Setup + Foundation | 16 | ⚪ |
| M-J | Header Component | 16 | ⚪ |
| V-L | Integration + Testing | 8 | ⚪ |

### Semana 2 (40 horas)

| Día | Tarea | Horas | Estado |
|-----|-------|-------|--------|
| L-M | Sidebar Component | 12 | ⚪ |
| M-J | Modales Base | 12 | ⚪ |
| V-L | Notifications + Polish | 16 | ⚪ |

### Hitos Finales

- ✅ **Día 7**: Header + Sidebar funcionales
- ✅ **Día 10**: Modales y Notificaciones
- ✅ **Día 14**: UI completa y testeada
- ✅ **Día 14 (EOD)**: Ready para Fase 2

---

## Notas Importantes

### Dependencias Externas
- ❌ NO agregar dependencias nuevas
- ✅ Usar solo: Drawflow (ya existe), HTML5, CSS3, Vanilla JS

### Compatibilidad
- ✅ IE11+ (usar transpilation si es necesario)
- ✅ Mobile responsive
- ✅ Modo dark (opcional para Fase 1)

### Performance Budgets
- Header: <50ms render
- Sidebar toggle: <100ms
- Modal open: <300ms
- Notificación: <100ms

### Accesibilidad (WCAG 2.1 AA)
- ✅ Semantic HTML
- ✅ ARIA labels donde necesario
- ✅ Keyboard navigation (Tab, Enter, Escape)
- ✅ Focus visible
- ✅ Color contrast >4.5:1

---

## Contacto y Preguntas

**Durante el desarrollo:**
- Daily standup: 10am
- Code reviews: Después de cada componente
- Preguntas: Slack #dev channel

**Criterio de aprobación:**
- Pasar checklist de testing
- Cumplir Definition of Done
- Aprobación de PM
- Code review exitoso

---

**Última actualización**: 30 de Julio 2026  
**Versión**: 1.0  
**Estado**: Listo para desarrollo
