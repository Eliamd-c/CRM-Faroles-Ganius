/**
 * FAROLES GENIUS — Event Emitter
 * Lightweight pub/sub for component communication.
 */

const EventBus = (function () {
  const listeners = {};

  function on(event, handler) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(handler);
    // Return unsubscribe function
    return function () {
      off(event, handler);
    };
  }

  function once(event, handler) {
    function wrapper(...args) {
      handler(...args);
      off(event, wrapper);
    }
    return on(event, wrapper);
  }

  function off(event, handler) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(h => h !== handler);
  }

  function emit(event, ...args) {
    if (!listeners[event]) return;
    listeners[event].forEach(h => {
      try { h(...args); } catch (e) { console.error('EventBus error:', e); }
    });
  }

  function clear(event) {
    if (event) delete listeners[event];
    else Object.keys(listeners).forEach(k => delete listeners[k]);
  }

  return { on, once, off, emit, clear };
})();

window.EventBus = EventBus;
