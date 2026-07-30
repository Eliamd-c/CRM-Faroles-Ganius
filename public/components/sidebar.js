/**
 * FAROLES GENIUS — Sidebar Component
 * Collapsible sidebar with drag items, sections, and tooltips.
 */

const SidebarComponent = (function () {
  const STORAGE_KEY = 'sidebar_collapsed';

  let container = null;
  let collapsed = false;

  // ── Node definitions ─────────────────────────────────────
  const SECTIONS = [
    {
      label: 'Disparadores',
      items: [
        { type: 'trigger', icon: '⚡', label: 'Palabra Clave' }
      ]
    },
    {
      label: 'Contenido',
      items: [
        { type: 'message',   icon: '💬', label: 'Enviar Mensaje' },
        { type: 'input',     icon: '📥', label: 'Pedir Dato' },
        { type: 'carousel',  icon: '🖼️', label: 'Carrusel' },
        { type: 'gallery',   icon: '📸', label: 'Galería' },
        { type: 'audio',     icon: '🎵', label: 'Audio' },
        { type: 'video',     icon: '🎥', label: 'Video' },
        { type: 'file',      icon: '📄', label: 'Archivo / PDF' }
      ]
    },
    {
      label: 'Lógica',
      items: [
        { type: 'action',     icon: '⚡', label: 'Realizar Acciones' },
        { type: 'condition',  icon: '🔀', label: 'Condición Lógica' },
        { type: 'randomizer', icon: '🎲', label: 'Aleatorio (A/B)' },
        { type: 'delay',      icon: '⏱',  label: 'Espera (Delay)' }
      ]
    },
    {
      label: 'Avanzado',
      items: [
        { type: 'goto', icon: '↗️', label: 'Goto / Saltar' }
      ]
    }
  ];

  // ── Render ───────────────────────────────────────────────
  function render() {
    if (!container) return;

    let html = '<div class="sidebar-scroll">';

    SECTIONS.forEach(function (section) {
      html += `<div class="sidebar-section-header" aria-hidden="${collapsed}">${section.label}</div>`;

      section.items.forEach(function (item) {
        html += `
          <div
            class="drag-item"
            draggable="true"
            data-node="${item.type}"
            title="${item.label}"
            role="button"
            tabindex="0"
            aria-label="Arrastrar: ${item.label}"
          >
            <span class="drag-icon" aria-hidden="true">${item.icon}</span>
            <span class="drag-label">${item.label}</span>
            <span class="drag-tooltip" aria-hidden="true">${item.icon} ${item.label}</span>
          </div>
        `;
      });

      html += '<div class="sidebar-divider"></div>';
    });

    html += '</div>';

    // Toggle button
    html += `
      <div class="sidebar-toggle">
        <button class="sidebar-toggle-btn" id="sidebar-toggle-btn" title="${collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}" aria-label="${collapsed ? 'Expandir' : 'Colapsar'} sidebar">
          <span class="toggle-icon">«</span>
        </button>
      </div>
    `;

    container.innerHTML = html;
    applyCollapsed();
    setupListeners();
  }

  function applyCollapsed() {
    if (collapsed) {
      container.classList.add('collapsed');
    } else {
      container.classList.remove('collapsed');
    }
  }

  // ── Listeners ────────────────────────────────────────────
  function setupListeners() {
    // Toggle button
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        collapsed = !collapsed;
        StorageUtils.set(STORAGE_KEY, collapsed);
        applyCollapsed();
        // Update title
        toggleBtn.title = collapsed ? 'Expandir sidebar' : 'Colapsar sidebar';
        toggleBtn.setAttribute('aria-label', (collapsed ? 'Expandir' : 'Colapsar') + ' sidebar');
        // Update section headers visibility
        container.querySelectorAll('.sidebar-section-header').forEach(function (h) {
          h.setAttribute('aria-hidden', String(collapsed));
        });
        // Emit event
        if (window.EventBus) EventBus.emit('sidebar:toggle', { collapsed });
      });
    }

    // Drag items
    container.querySelectorAll('.drag-item').forEach(function (item) {
      item.addEventListener('dragstart', function (e) {
        const nodeType = item.getAttribute('data-node');
        e.dataTransfer.setData('text/plain', nodeType);
        e.dataTransfer.effectAllowed = 'copy';
        item.classList.add('dragging');
      });

      item.addEventListener('dragend', function () {
        item.classList.remove('dragging');
      });

      // Keyboard: Enter/Space to add node at center
      item.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const nodeType = item.getAttribute('data-node');
          if (window.EventBus) EventBus.emit('sidebar:addNode', { type: nodeType });
        }
      });
    });
  }

  // ── Public API ───────────────────────────────────────────
  return {
    init: function (containerEl) {
      container = typeof containerEl === 'string'
        ? document.getElementById(containerEl)
        : containerEl;

      if (!container) {
        // fallback: look for .sidebar
        container = document.querySelector('.sidebar') || document.querySelector('.app-sidebar');
      }

      if (!container) {
        console.warn('SidebarComponent: container not found');
        return;
      }

      // Add class for new styles
      container.classList.add('app-sidebar');

      // Restore collapsed state
      collapsed = StorageUtils ? StorageUtils.get(STORAGE_KEY, false) : false;

      render();
    },

    getSections: function () { return SECTIONS; },
    isCollapsed: function () { return collapsed; },

    expand: function () {
      collapsed = false;
      if (StorageUtils) StorageUtils.set(STORAGE_KEY, false);
      applyCollapsed();
    },

    collapse: function () {
      collapsed = true;
      if (StorageUtils) StorageUtils.set(STORAGE_KEY, true);
      applyCollapsed();
    }
  };
})();

window.SidebarComponent = SidebarComponent;
