/**
 * FAROLES GENIUS — Header Component
 * Renders and manages the app header with nav, flow info, and action buttons.
 */

const HeaderComponent = (function () {
  let state = {
    flowName: 'Sin Título',
    flowStatus: 'draft',
    canPublish: true,
    onSave: null,
    onPublish: null,
    onArrange: null,
    onFlowNameChange: null
  };

  let container = null;
  let editingName = false;

  // ── Render ──────────────────────────────────────────────
  function render() {
    if (!container) return;

    const isDraft = state.flowStatus === 'draft';

    container.innerHTML = `
      <!-- Left: Logo + Nav -->
      <div class="header-left">
        <a href="/" class="header-logo" title="Ir al inicio">
          <span class="header-logo-name">Faroles Genius</span>
          <span class="header-logo-sub">Flow Builder</span>
        </a>
        <nav class="header-nav" aria-label="Navegación principal">
          <a href="/" class="header-nav-link" id="nav-monitor">
            <span class="nav-icon">📊</span> Monitor
          </a>
          <a href="/automations.html" class="header-nav-link" id="nav-automations">
            <span class="nav-icon">🤖</span> Automatizaciones
          </a>
          <a href="/builder.html" class="header-nav-link active" id="nav-builder">
            <span class="nav-icon">⚡</span> Builder
          </a>
        </nav>
      </div>

      <!-- Center: Flow info -->
      <div class="header-center" id="flow-header-center" style="display: none;">
        <div class="header-breadcrumb">
          <span>Automatizaciones</span>
          <span class="header-breadcrumb-sep">›</span>
          <div class="flow-name-wrap">
            <span
              id="flow-name-display"
              class="flow-name-display"
              title="Clic para editar"
              role="button"
              tabindex="0"
              aria-label="Nombre del flujo"
            >${escapeHtml(state.flowName)}</span>
            <input
              id="flow-name-input"
              class="flow-name-input"
              type="text"
              value="${escapeHtml(state.flowName)}"
              maxlength="80"
              style="display:none;"
              aria-label="Editar nombre del flujo"
            />
          </div>
        </div>
        <span id="flow-status-badge" class="status-badge ${isDraft ? 'draft' : 'live'}">
          ${isDraft ? 'BORRADOR' : 'EN VIVO'}
        </span>
      </div>

      <!-- Right: Actions -->
      <div class="header-actions">
        <button id="btn-arrange" class="btn btn-secondary" title="Organizar nodos automáticamente">
          ✨ Organizar
        </button>
        <div class="header-sep"></div>
        <button id="btn-save" class="btn btn-primary" title="Guardar cambios (Ctrl+S)">
          💾 Guardar
        </button>
        <button
          id="btn-publish"
          class="btn btn-publish ${!isDraft ? 'live-state' : ''}"
          title="${isDraft ? 'Publicar flujo' : 'Desactivar flujo'}"
          style="display: none;"
        >
          ${isDraft ? '🚀 Publicar' : '⏹ Desactivar'}
        </button>
        <button id="btn-menu" class="btn btn-icon" title="Más opciones" aria-label="Más opciones">⋮</button>
      </div>
    `;

    setupListeners();
  }

  // ── Listeners ───────────────────────────────────────────
  function setupListeners() {
    // Save button
    const saveBtn = document.getElementById('btn-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        if (state.onSave) state.onSave();
      });
    }

    // Publish button
    const publishBtn = document.getElementById('btn-publish');
    if (publishBtn) {
      publishBtn.addEventListener('click', function () {
        if (state.onPublish) state.onPublish(state.flowStatus);
      });
    }

    // Arrange button
    const arrangeBtn = document.getElementById('btn-arrange');
    if (arrangeBtn) {
      arrangeBtn.addEventListener('click', function () {
        if (state.onArrange) state.onArrange();
      });
    }

    // Inline name editing
    setupNameEdit();

    // Keyboard shortcut Ctrl+S
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (state.onSave) state.onSave();
      }
    });
  }

  function setupNameEdit() {
    const display = document.getElementById('flow-name-display');
    const input   = document.getElementById('flow-name-input');

    if (!display || !input) return;

    function startEdit() {
      if (editingName) return;
      editingName = true;
      display.style.display = 'none';
      input.style.display = 'block';
      input.value = state.flowName;
      input.select();
      input.focus();
    }

    function endEdit(save) {
      if (!editingName) return;
      editingName = false;
      if (save) {
        const newName = input.value.trim() || 'Sin Título';
        state.flowName = newName;
        display.textContent = newName;
        if (state.onFlowNameChange) state.onFlowNameChange(newName);
      }
      input.style.display = 'none';
      display.style.display = '';
    }

    display.addEventListener('click', startEdit);
    display.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') startEdit();
    });

    input.addEventListener('blur', function () { endEdit(true); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') endEdit(true);
      if (e.key === 'Escape') endEdit(false);
    });
  }

  // ── Helpers ─────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Public API ───────────────────────────────────────────
  return {
    init: function (containerEl, options) {
      container = typeof containerEl === 'string'
        ? document.getElementById(containerEl)
        : containerEl;

      if (!container) {
        console.warn('HeaderComponent: container not found');
        return;
      }

      state = Object.assign(state, options || {});
      render();
    },

    showFlowInfo: function (flowName, status) {
      state.flowName = flowName || 'Sin Título';
      state.flowStatus = status || 'draft';
      state.canPublish = true;

      const center = document.getElementById('flow-header-center');
      if (center) center.style.display = 'flex';

      const publishBtn = document.getElementById('btn-publish');
      if (publishBtn) publishBtn.style.display = '';

      // Update display without full re-render
      const nameDisplay = document.getElementById('flow-name-display');
      if (nameDisplay) nameDisplay.textContent = state.flowName;

      const badge = document.getElementById('flow-status-badge');
      if (badge) {
        badge.className = `status-badge ${state.flowStatus === 'live' ? 'live' : 'draft'}`;
        badge.textContent = state.flowStatus === 'live' ? 'EN VIVO' : 'BORRADOR';
      }

      if (publishBtn) {
        const isLive = state.flowStatus === 'live';
        publishBtn.className = `btn btn-publish ${isLive ? 'live-state' : ''}`;
        publishBtn.innerHTML = isLive ? '⏹ Desactivar' : '🚀 Publicar';
      }
    },

    setFlowName: function (name) {
      state.flowName = name;
      const nameDisplay = document.getElementById('flow-name-display');
      if (nameDisplay) nameDisplay.textContent = name;
      const input = document.getElementById('flow-name-input');
      if (input) input.value = name;
    },

    setStatus: function (status) {
      state.flowStatus = status;
      this.showFlowInfo(state.flowName, status);
    },

    setSaving: function (isSaving) {
      const btn = document.getElementById('btn-save');
      if (!btn) return;
      if (isSaving) {
        btn.innerHTML = '⏳ Guardando...';
        btn.disabled = true;
      } else {
        btn.innerHTML = '💾 Guardar';
        btn.disabled = false;
      }
    }
  };
})();

window.HeaderComponent = HeaderComponent;
