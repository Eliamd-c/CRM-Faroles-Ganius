/**
 * FAROLES GENIUS — Notifications Component
 * Toast notification system with auto-dismiss and progress bar.
 */

const NotificationManager = (function () {
  let container = null;
  const MAX_NOTIFICATIONS = 4;
  const active = [];

  const TYPES = {
    success: { icon: '✅', label: 'Éxito',    duration: 3000 },
    error:   { icon: '❌', label: 'Error',    duration: 5000 },
    warning: { icon: '⚠️', label: 'Aviso',   duration: 5000 },
    info:    { icon: 'ℹ️', label: 'Info',    duration: 4000 }
  };

  function getContainer() {
    if (!container) {
      container = document.getElementById('notifications-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'notifications-container';
        container.className = 'notifications-container';
        document.body.appendChild(container);
      }
    }
    return container;
  }

  function dismiss(id) {
    const el = document.querySelector(`.notification[data-notif-id="${id}"]`);
    if (!el) return;

    el.classList.add('exiting');
    setTimeout(() => {
      el.remove();
      const idx = active.indexOf(id);
      if (idx !== -1) active.splice(idx, 1);
    }, 280);
  }

  function show(message, type, options) {
    type = type || 'info';
    const cfg = TYPES[type] || TYPES.info;
    const duration = (options && options.duration !== undefined) ? options.duration : cfg.duration;
    const detail = options && options.detail;

    const c = getContainer();

    // Limit simultaneous notifications
    if (active.length >= MAX_NOTIFICATIONS) {
      dismiss(active[0]);
    }

    const id = 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    active.push(id);

    const el = document.createElement('div');
    el.className = `notification notification-${type}`;
    el.setAttribute('data-notif-id', id);
    el.style.setProperty('--notif-duration', (duration / 1000) + 's');

    el.innerHTML = `
      <span class="notification-icon" aria-hidden="true">${cfg.icon}</span>
      <div class="notification-content">
        <span class="notification-message">${DOMUtils ? DOMUtils.escapeHtml(message) : message}</span>
        ${detail ? `<span class="notification-detail">${DOMUtils ? DOMUtils.escapeHtml(detail) : detail}</span>` : ''}
      </div>
      <button class="notification-close" aria-label="Cerrar" data-dismiss="${id}">×</button>
    `;

    // Close on button click
    el.querySelector('.notification-close').addEventListener('click', function () {
      dismiss(id);
    });

    c.appendChild(el);

    // Auto dismiss
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }

    return id;
  }

  return {
    success: function (msg, opts) { return show(msg, 'success', opts); },
    error:   function (msg, opts) { return show(msg, 'error',   opts); },
    warning: function (msg, opts) { return show(msg, 'warning', opts); },
    info:    function (msg, opts) { return show(msg, 'info',    opts); },
    dismiss
  };
})();

window.NotificationManager = NotificationManager;
// Shorthand alias
window.Toast = NotificationManager;
