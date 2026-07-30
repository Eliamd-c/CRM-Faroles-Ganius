/**
 * FAROLES GENIUS — Modals Component
 * Reusable modal system: trigger picker, keyword config, content editor, button editor.
 */

const ModalManager = (function () {
  let activeModal = null;
  let untrапFocus = null;

  // ── Core: Open / Close ──────────────────────────────────
  function open(config) {
    // config: { title, subtitle, icon, iconBg, body (html string or fn), footer, onClose, size }
    if (activeModal) close();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', config.title || 'Modal');

    const size = config.size || 'md';
    const widths = { sm: '400px', md: '520px', lg: '640px' };

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.width = widths[size] || widths.md;

    const iconHtml = config.icon
      ? `<div class="modal-icon" style="background: ${config.iconBg || '#eff6ff'};">${config.icon}</div>`
      : '';

    const subtitleHtml = config.subtitle
      ? `<p class="modal-subtitle">${escapeHtml(config.subtitle)}</p>`
      : '';

    const footerHtml = config.footer !== false
      ? `<div class="modal-footer${config.deleteBtn ? ' has-delete' : ''}" id="modal-footer">
           ${config.deleteBtn ? `<button class="btn btn-secondary" id="modal-delete-btn" style="color: var(--color-error); border-color: var(--color-error);">${config.deleteBtn}</button>` : ''}
           <div style="display:flex; gap: 8px;">
             <button class="btn btn-secondary" id="modal-cancel-btn">Cancelar</button>
             <button class="btn btn-primary" id="modal-confirm-btn">${config.confirmLabel || 'Guardar'}</button>
           </div>
         </div>`
      : '';

    modal.innerHTML = `
      <div class="modal-header">
        <div class="modal-header-left">
          ${iconHtml}
          <div>
            <h2 class="modal-title">${escapeHtml(config.title || '')}</h2>
            ${subtitleHtml}
          </div>
        </div>
        <button class="modal-close" id="modal-close-btn" aria-label="Cerrar">×</button>
      </div>
      <div class="modal-body" id="modal-body">
        ${typeof config.body === 'function' ? config.body() : (config.body || '')}
      </div>
      ${footerHtml}
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    activeModal = { overlay, modal, config };

    // Focus trap
    if (window.DOMUtils) {
      untrapFocus = DOMUtils.trapFocus(modal);
    }

    // Event listeners
    document.getElementById('modal-close-btn').addEventListener('click', function () {
      close();
      if (config.onClose) config.onClose('close');
    });

    const cancelBtn = document.getElementById('modal-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        close();
        if (config.onClose) config.onClose('cancel');
      });
    }

    const confirmBtn = document.getElementById('modal-confirm-btn');
    if (confirmBtn && config.onConfirm) {
      confirmBtn.addEventListener('click', function () {
        config.onConfirm(modal);
      });
    }

    const deleteBtn = document.getElementById('modal-delete-btn');
    if (deleteBtn && config.onDelete) {
      deleteBtn.addEventListener('click', function () {
        if (config.onDelete) config.onDelete();
      });
    }

    // Close on overlay click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        close();
        if (config.onClose) config.onClose('overlay');
      }
    });

    // Close on Escape
    document.addEventListener('keydown', handleEscape);

    // After-open callback
    if (config.onOpen) {
      requestAnimationFrame(function () { config.onOpen(modal); });
    }

    return { overlay, modal };
  }

  function close() {
    if (!activeModal) return;
    const { overlay } = activeModal;

    overlay.classList.add('closing');
    setTimeout(function () {
      if (overlay.parentElement) overlay.remove();
    }, 250);

    if (untrapFocus) { untrapFocus(); untrapFocus = null; }
    document.removeEventListener('keydown', handleEscape);
    activeModal = null;
  }

  function handleEscape(e) {
    if (e.key === 'Escape') {
      if (activeModal && activeModal.config.onClose) {
        activeModal.config.onClose('escape');
      }
      close();
    }
  }

  function setConfirmLoading(loading) {
    const btn = document.getElementById('modal-confirm-btn');
    if (!btn) return;
    btn.disabled = loading;
    btn.innerHTML = loading ? '⏳ Guardando...' : (activeModal && activeModal.config.confirmLabel) || 'Guardar';
  }

  // ── Trigger Picker Modal ────────────────────────────────
  function openTriggerPicker(nodeId) {
    const triggers = [
      {
        type: 'message',
        icon: '💬',
        iconBg: '#eff6ff',
        iconColor: '#2563eb',
        title: 'Mensaje directo',
        desc: 'El usuario envía un mensaje con una palabra clave'
      },
      {
        type: 'comment',
        icon: '💬',
        iconBg: '#f0fdf4',
        iconColor: '#16a34a',
        title: 'Comentario en publicación',
        desc: 'El usuario comenta con una palabra clave en tu post o reel'
      },
      {
        type: 'story_reply',
        icon: '📸',
        iconBg: '#fdf2f8',
        iconColor: '#9333ea',
        title: 'Respuesta a historia',
        desc: 'El usuario responde a una de tus historias de Instagram',
        soon: true
      },
      {
        type: 'mention',
        icon: '@',
        iconBg: '#faf5ff',
        iconColor: '#7c3aed',
        title: 'Mención en historia',
        desc: 'El usuario menciona tu cuenta en una historia',
        soon: true
      }
    ];

    const body = `
      <p style="margin-bottom: 16px; font-size: 13px; color: var(--color-text-secondary);">
        Elige qué evento dispara esta automatización
      </p>
      ${triggers.map(function (t) {
        return `
          <div class="trigger-card ${t.soon ? 'disabled' : ''}"
               data-trigger-type="${t.type}"
               ${t.soon ? 'aria-disabled="true"' : 'role="button" tabindex="0"'}
               style="${t.soon ? 'opacity:0.55;cursor:not-allowed;' : ''}">
            <div class="trigger-card-icon" style="background:${t.iconBg}; color:${t.iconColor};">
              ${t.icon}
            </div>
            <div class="trigger-card-info">
              <strong>
                ${escapeHtml(t.title)}
                ${t.soon ? '<span class="badge badge-soon" style="margin-left:6px;">Próximamente</span>' : ''}
              </strong>
              <span>${escapeHtml(t.desc)}</span>
            </div>
            <div class="trigger-card-arrow">›</div>
          </div>
        `;
      }).join('')}
    `;

    open({
      title: 'Inicia automatización cuando...',
      subtitle: null,
      icon: '⚡',
      iconBg: '#fef2f2',
      body: body,
      footer: false,
      onOpen: function (modal) {
        modal.querySelectorAll('.trigger-card:not(.disabled)').forEach(function (card) {
          card.addEventListener('click', function () {
            const type = card.getAttribute('data-trigger-type');
            close();
            // Emit to the builder to configure the trigger
            if (window.selectTriggerType) selectTriggerType(nodeId, type);
            if (window.EventBus) EventBus.emit('trigger:selected', { nodeId, type });
          });

          card.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') card.click();
          });
        });
      }
    });
  }

  // ── Keyword Config Modal ────────────────────────────────
  function openKeywordConfig(nodeId, currentData, onSave) {
    currentData = currentData || {};
    const matchType  = currentData.matchType  || 'contains';
    const keywords   = currentData.keywords   || [];

    const body = `
      <div class="form-group">
        <label class="form-label">Tipo de Coincidencia</label>
        <div class="radio-group">
          <label class="radio-card ${matchType === 'contains' ? 'selected' : ''}" data-match="contains">
            <input type="radio" name="matchType" value="contains" ${matchType === 'contains' ? 'checked' : ''}>
            Contiene
          </label>
          <label class="radio-card ${matchType === 'exact' ? 'selected' : ''}" data-match="exact">
            <input type="radio" name="matchType" value="exact" ${matchType === 'exact' ? 'checked' : ''}>
            Exacta
          </label>
          <label class="radio-card ${matchType === 'starts_with' ? 'selected' : ''}" data-match="starts_with">
            <input type="radio" name="matchType" value="starts_with" ${matchType === 'starts_with' ? 'checked' : ''}>
            Empieza con
          </label>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Palabras Clave <span class="required">*</span></label>
        <div class="chip-input-wrap" id="keyword-chip-wrap"></div>
        <p class="form-hint">Escribe y presiona Enter para agregar. No distingue mayúsculas/minúsculas.</p>
      </div>

      <div class="form-group">
        <label class="form-check" style="gap: 8px; font-size: 13px;">
          <input type="checkbox" id="kw-case-sensitive" ${currentData.caseSensitive ? 'checked' : ''}>
          Distinguir mayúsculas/minúsculas
        </label>
      </div>
    `;

    let chipController = null;

    open({
      title: 'Configurar: Palabra Clave',
      icon: '⚡',
      iconBg: '#fef2f2',
      body: body,
      confirmLabel: 'Guardar',
      onOpen: function (modal) {
        // Init chip input
        const wrap = document.getElementById('keyword-chip-wrap');
        if (wrap && window.Validators) {
          chipController = Validators.initChipInput(wrap, {
            existing: keywords,
            placeholder: 'precio, cuánto vale...'
          });
        }

        // Radio card selection
        modal.querySelectorAll('.radio-card').forEach(function (card) {
          card.addEventListener('click', function () {
            modal.querySelectorAll('.radio-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            const radio = card.querySelector('input[type=radio]');
            if (radio) radio.checked = true;
          });
        });
      },
      onConfirm: function (modal) {
        const chips = chipController ? chipController.getChips() : [];
        if (chips.length === 0) {
          if (window.Toast) Toast.error('Debes agregar al menos una palabra clave');
          return;
        }

        const selectedMatch = modal.querySelector('input[name="matchType"]:checked');
        const caseSensitive = modal.querySelector('#kw-case-sensitive');

        const result = {
          matchType:     selectedMatch ? selectedMatch.value : 'contains',
          keywords:      chips,
          caseSensitive: caseSensitive ? caseSensitive.checked : false
        };

        close();
        if (onSave) onSave(result);
        if (window.EventBus) EventBus.emit('trigger:keywordSaved', { nodeId, data: result });
      }
    });
  }

  // ── Button Editor Modal ─────────────────────────────────
  function openButtonEditor(buttonData, onSave, onDelete) {
    buttonData = buttonData || {};
    const actions = [
      { value: 'flow',   label: 'Enviar Mensaje / Continuar flujo' },
      { value: 'url',    label: 'Abrir URL' },
      { value: 'call',   label: 'Llamar teléfono' },
      { value: 'action', label: 'Ejecutar Acción' }
    ];

    const selectedAction = buttonData.action || 'flow';

    const body = `
      <div class="form-group">
        <label class="form-label">Título del Botón <span class="required">*</span></label>
        <input
          id="btn-title"
          class="form-input"
          type="text"
          value="${escapeHtml(buttonData.title || '')}"
          placeholder="Ej: Ver más información"
          maxlength="50"
          name="btnTitle"
        />
      </div>

      <div class="form-group">
        <label class="form-label">Acción al presionar</label>
        <div class="action-options" id="action-options">
          ${actions.map(function (a) {
            return `
              <label class="action-option ${a.value === selectedAction ? 'selected' : ''}"
                     data-action="${a.value}">
                <input type="radio" name="btnAction" value="${a.value}" ${a.value === selectedAction ? 'checked' : ''}>
                <span class="radio-dot"></span>
                ${escapeHtml(a.label)}
              </label>
            `;
          }).join('')}
        </div>
      </div>

      <div id="action-config" style="margin-top: 4px;">
        ${renderActionConfig(selectedAction, buttonData)}
      </div>

      <div class="form-group" style="margin-top: 12px;">
        <label class="form-check">
          <input type="checkbox" id="btn-track" ${buttonData.track !== false ? 'checked' : ''}>
          Rastrear clics en este botón
        </label>
      </div>
    `;

    open({
      title: 'Editar Botón',
      icon: '🔘',
      iconBg: '#eff6ff',
      body: body,
      confirmLabel: 'Guardar',
      deleteBtn: onDelete ? '🗑 Eliminar' : null,
      onDelete: onDelete,
      onOpen: function (modal) {
        // Attach counter
        const titleInput = document.getElementById('btn-title');
        if (titleInput && window.Validators) {
          Validators.attachCounter(titleInput, 50);
        }

        // Action option selection
        modal.querySelectorAll('.action-option').forEach(function (opt) {
          opt.addEventListener('click', function () {
            modal.querySelectorAll('.action-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            const radio = opt.querySelector('input[type=radio]');
            if (radio) radio.checked = true;

            // Update action config
            const cfg = document.getElementById('action-config');
            if (cfg) cfg.innerHTML = renderActionConfig(opt.getAttribute('data-action'), buttonData);
          });
        });
      },
      onConfirm: function (modal) {
        const titleInput = document.getElementById('btn-title');
        if (!titleInput || !titleInput.value.trim()) {
          if (window.Validators) Validators.showError(titleInput, 'El título es requerido');
          return;
        }

        const selectedAction = modal.querySelector('input[name="btnAction"]:checked');
        const trackInput = modal.querySelector('#btn-track');
        const urlInput = modal.querySelector('#btn-url');

        const result = {
          title:  titleInput.value.trim(),
          action: selectedAction ? selectedAction.value : 'flow',
          url:    urlInput ? urlInput.value.trim() : null,
          track:  trackInput ? trackInput.checked : true
        };

        close();
        if (onSave) onSave(result);
      }
    });
  }

  function renderActionConfig(action, data) {
    data = data || {};
    if (action === 'url') {
      return `
        <div class="form-group">
          <label class="form-label">URL <span class="required">*</span></label>
          <input id="btn-url" class="form-input" type="url" value="${escapeHtml(data.url || '')}" placeholder="https://ejemplo.com">
        </div>
      `;
    }
    if (action === 'call') {
      return `
        <div class="form-group">
          <label class="form-label">Número de teléfono</label>
          <input id="btn-url" class="form-input" type="tel" value="${escapeHtml(data.url || '')}" placeholder="+52 55 1234 5678">
        </div>
      `;
    }
    return '';
  }

  // ── Content (Text) Editor Modal ─────────────────────────
  function openTextEditor(currentText, onSave) {
    const MAX = 1000;
    const body = `
      <div class="form-group">
        <label class="form-label">Mensaje</label>
        <div class="textarea-wrap">
          <div class="emoji-bar">
            <div style="display:flex; gap:4px;">
              <button class="emoji-btn" title="Emoji" type="button">😊</button>
              <button class="emoji-btn" title="Variable" type="button">{{}}</button>
            </div>
            <span style="font-size:11px; color: var(--color-text-muted);">Markdown soportado</span>
          </div>
          <textarea
            id="text-content"
            class="form-input form-textarea"
            placeholder="Escribe tu mensaje aquí..."
            maxlength="${MAX}"
            name="textContent"
            rows="5"
          >${escapeHtml(currentText || '')}</textarea>
        </div>
      </div>

      <div class="form-group">
        <label class="form-check">
          <input type="checkbox" id="save-template">
          Guardar como plantilla
        </label>
      </div>
    `;

    open({
      title: 'Editar Texto',
      icon: '💬',
      iconBg: '#eff6ff',
      body: body,
      confirmLabel: 'Guardar',
      onOpen: function (modal) {
        const ta = document.getElementById('text-content');
        if (ta && window.Validators) Validators.attachCounter(ta, MAX);
      },
      onConfirm: function (modal) {
        const ta = document.getElementById('text-content');
        if (!ta) return;
        close();
        if (onSave) onSave(ta.value);
      }
    });
  }

  // ── Confirm Dialog ──────────────────────────────────────
  function confirm(message, opts, onConfirm) {
    opts = opts || {};
    open({
      title: opts.title || 'Confirmar',
      icon: opts.icon || '⚠️',
      iconBg: opts.iconBg || '#fffbeb',
      body: `<p style="font-size:14px; color: var(--color-text-secondary); line-height:1.6;">${escapeHtml(message)}</p>`,
      confirmLabel: opts.confirmLabel || 'Confirmar',
      onOpen: function (modal) {
        const btn = document.getElementById('modal-confirm-btn');
        if (btn && opts.danger) {
          btn.style.background = 'var(--color-error)';
          btn.style.borderColor = 'var(--color-error)';
        }
      },
      onConfirm: function () {
        close();
        if (onConfirm) onConfirm();
      },
      onClose: opts.onCancel ? function () { opts.onCancel(); } : null
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
    open,
    close,
    setConfirmLoading,
    openTriggerPicker,
    openKeywordConfig,
    openButtonEditor,
    openTextEditor,
    confirm
  };
})();

window.ModalManager = ModalManager;
