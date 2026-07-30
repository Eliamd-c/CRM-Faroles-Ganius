/**
 * FAROLES GENIUS — DOM Utilities
 * Helpers for common DOM operations.
 */

/* global DOMUtils */

const DOMUtils = (function () {
  /**
   * Query selector (single element)
   * @param {string} selector
   * @param {Element} [context=document]
   */
  function $(selector, context) {
    return (context || document).querySelector(selector);
  }

  /**
   * Query selector all
   * @param {string} selector
   * @param {Element} [context=document]
   */
  function $$(selector, context) {
    return Array.from((context || document).querySelectorAll(selector));
  }

  /**
   * Create element with optional attributes / innerHTML
   * @param {string} tag
   * @param {Object} [attrs]
   * @param {string} [html]
   */
  function create(tag, attrs, html) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'class') el.className = v;
        else el.setAttribute(k, v);
      });
    }
    if (html !== undefined) el.innerHTML = html;
    return el;
  }

  /**
   * Add / remove class(es)
   */
  function addClass(el, ...classes) {
    if (el) el.classList.add(...classes);
  }

  function removeClass(el, ...classes) {
    if (el) el.classList.remove(...classes);
  }

  function toggleClass(el, cls, force) {
    if (el) el.classList.toggle(cls, force);
  }

  function hasClass(el, cls) {
    return el ? el.classList.contains(cls) : false;
  }

  /**
   * Show / hide elements
   */
  function show(el, display) {
    if (el) el.style.display = display || 'flex';
  }

  function hide(el) {
    if (el) el.style.display = 'none';
  }

  function setVisible(el, visible, display) {
    if (visible) show(el, display);
    else hide(el);
  }

  /**
   * Delegate event listener
   * @param {Element} parent
   * @param {string} event
   * @param {string} selector
   * @param {Function} handler
   */
  function delegate(parent, event, selector, handler) {
    parent.addEventListener(event, function (e) {
      const target = e.target.closest(selector);
      if (target && parent.contains(target)) {
        handler.call(target, e, target);
      }
    });
  }

  /**
   * Remove all children from element
   */
  function empty(el) {
    if (el) el.innerHTML = '';
  }

  /**
   * Safely set text content
   */
  function setText(el, text) {
    if (el) el.textContent = text;
  }

  /**
   * Animate height to 0 then remove
   */
  function animateRemove(el, duration) {
    if (!el) return;
    el.style.overflow = 'hidden';
    el.style.transition = `height ${duration || 200}ms ease, opacity ${duration || 200}ms ease`;
    el.style.height = el.scrollHeight + 'px';
    requestAnimationFrame(() => {
      el.style.height = '0';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), duration || 200);
    });
  }

  /**
   * Escape HTML special chars
   */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Trap focus inside an element (for modals)
   */
  function trapFocus(el) {
    const focusable = el.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    function handleTab(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    el.addEventListener('keydown', handleTab);
    if (first) first.focus();

    return function () {
      el.removeEventListener('keydown', handleTab);
    };
  }

  return {
    $,
    $$,
    create,
    addClass,
    removeClass,
    toggleClass,
    hasClass,
    show,
    hide,
    setVisible,
    delegate,
    empty,
    setText,
    animateRemove,
    escapeHtml,
    trapFocus
  };
})();

window.DOMUtils = DOMUtils;
