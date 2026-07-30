/**
 * FAROLES GENIUS — Validators Component
 * Input validation utilities and inline error display.
 */

const Validators = (function () {

  // ── Rules ──────────────────────────────────────────────
  const rules = {
    required: function (val) {
      if (val === null || val === undefined) return false;
      return String(val).trim().length > 0;
    },
    email: function (val) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val));
    },
    url: function (val) {
      try { new URL(val); return true; } catch (_) { return false; }
    },
    minLength: function (val, min) {
      return String(val).length >= min;
    },
    maxLength: function (val, max) {
      return String(val).length <= max;
    },
    numeric: function (val) {
      return /^\d+$/.test(String(val));
    },
    phone: function (val) {
      return /^[\d\s\+\-\(\)]{7,20}$/.test(String(val));
    }
  };

  // ── Messages ───────────────────────────────────────────
  const messages = {
    required:  'Este campo es requerido',
    email:     'Ingresa un email válido',
    url:       'Ingresa una URL válida (ej: https://ejemplo.com)',
    minLength: function (min) { return `Mínimo ${min} caracteres`; },
    maxLength: function (max) { return `Máximo ${max} caracteres`; },
    numeric:   'Solo se permiten números',
    phone:     'Número de teléfono inválido',
    duplicate: 'Este valor ya existe'
  };

  // ── Validate a single field ────────────────────────────
  /**
   * @param {HTMLElement} input - The input element
   * @param {Array} fieldRules  - Array of rule objects: { rule, param, message }
   * @returns {boolean} valid
   */
  function validateField(input, fieldRules) {
    clearError(input);

    for (const config of fieldRules) {
      const ruleName = config.rule;
      const param    = config.param;
      const val      = input.value;

      let validator = typeof config.fn === 'function' ? config.fn : rules[ruleName];
      if (!validator) continue;

      const valid = param !== undefined ? validator(val, param) : validator(val);

      if (!valid) {
        let msg = config.message;
        if (!msg) {
          const m = messages[ruleName];
          msg = typeof m === 'function' ? m(param) : m;
        }
        showError(input, msg || 'Campo inválido');
        return false;
      }
    }

    showSuccess(input);
    return true;
  }

  // ── Show/clear error ───────────────────────────────────
  function showError(input, message) {
    input.classList.remove('success');
    input.classList.add('error');

    let errEl = input.parentElement.querySelector('.form-error');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.className = 'form-error';
      input.after(errEl);
    }
    errEl.innerHTML = `<span>❌</span> ${escapeHtml(message)}`;
  }

  function showSuccess(input) {
    input.classList.remove('error');
    input.classList.add('success');

    const errEl = input.parentElement.querySelector('.form-error');
    if (errEl) errEl.remove();
  }

  function clearError(input) {
    input.classList.remove('error', 'success');
    const errEl = input.parentElement && input.parentElement.querySelector('.form-error');
    if (errEl) errEl.remove();
  }

  // ── Character counter ──────────────────────────────────
  /**
   * Attach a character counter below a textarea/input
   * @param {HTMLElement} input
   * @param {number} maxLength
   */
  function attachCounter(input, maxLength) {
    let counter = input.parentElement.querySelector('.form-counter');
    if (!counter) {
      counter = document.createElement('div');
      counter.className = 'form-counter';
      input.after(counter);
    }

    function update() {
      const len = input.value.length;
      counter.textContent = `${len} / ${maxLength}`;
      counter.className = 'form-counter';
      if (len > maxLength * 0.9) counter.classList.add('warn');
      if (len > maxLength)       counter.classList.add('danger');
    }

    input.addEventListener('input', update);
    update();

    return counter;
  }

  // ── Validate form ──────────────────────────────────────
  /**
   * Validate all fields in a form/container
   * @param {HTMLElement} form
   * @param {Object} schema - { fieldName: [rules] }
   * @returns {boolean}
   */
  function validateForm(form, schema) {
    let allValid = true;

    Object.entries(schema).forEach(([name, fieldRules]) => {
      const input = form.querySelector(`[name="${name}"], [data-field="${name}"]`);
      if (!input) return;
      const valid = validateField(input, fieldRules);
      if (!valid) allValid = false;
    });

    return allValid;
  }

  // ── Helpers ────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Chip Input (palabra clave tags) ───────────────────
  /**
   * Turn a container into a chip input
   * @param {HTMLElement} wrap  - .chip-input-wrap element
   * @param {Object} [opts]
   */
  function initChipInput(wrap, opts) {
    opts = opts || {};
    const maxChips  = opts.maxChips  || 30;
    const onChange  = opts.onChange  || null;
    const existing  = opts.existing  || [];
    let chips = [...existing];

    // Create text input inside wrap
    const field = document.createElement('input');
    field.type = 'text';
    field.className = 'chip-field';
    field.placeholder = opts.placeholder || 'Escribe y presiona Enter...';
    field.autocomplete = 'off';
    wrap.appendChild(field);

    // Render existing chips
    chips.forEach(c => renderChip(c));

    // Click on wrap → focus input
    wrap.addEventListener('click', function () { field.focus(); });

    field.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addChip(field.value.trim());
        field.value = '';
      } else if (e.key === 'Backspace' && field.value === '' && chips.length > 0) {
        removeChip(chips[chips.length - 1]);
      }
    });

    field.addEventListener('blur', function () {
      if (field.value.trim()) {
        addChip(field.value.trim());
        field.value = '';
      }
    });

    function renderChip(value) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.setAttribute('data-value', value);
      chip.innerHTML = `${escapeHtml(value)}<span class="chip-remove" data-chip="${value}" aria-label="Eliminar ${value}">×</span>`;
      chip.querySelector('.chip-remove').addEventListener('click', function (e) {
        e.stopPropagation();
        removeChip(value);
      });
      wrap.insertBefore(chip, field);
    }

    function addChip(value) {
      if (!value) return;
      if (chips.includes(value)) {
        if (window.Toast) Toast.warning('Esta palabra clave ya existe');
        return;
      }
      if (chips.length >= maxChips) {
        if (window.Toast) Toast.warning(`Máximo ${maxChips} palabras clave`);
        return;
      }
      chips.push(value);
      renderChip(value);
      if (onChange) onChange([...chips]);
    }

    function removeChip(value) {
      chips = chips.filter(c => c !== value);
      const el = wrap.querySelector(`.chip[data-value="${CSS.escape(value)}"]`);
      if (el) el.remove();
      if (onChange) onChange([...chips]);
    }

    return {
      getChips:   function () { return [...chips]; },
      setChips:   function (newChips) {
        chips = [];
        wrap.querySelectorAll('.chip').forEach(c => c.remove());
        newChips.forEach(c => addChip(c));
      },
      clearChips: function () {
        chips = [];
        wrap.querySelectorAll('.chip').forEach(c => c.remove());
        if (onChange) onChange([]);
      }
    };
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return {
    rules,
    messages,
    validateField,
    validateForm,
    showError,
    showSuccess,
    clearError,
    attachCounter,
    initChipInput
  };
})();

window.Validators = Validators;
