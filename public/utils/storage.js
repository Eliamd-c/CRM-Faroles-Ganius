/**
 * FAROLES GENIUS — Storage Utilities
 * localStorage helpers with JSON support and fallback.
 */

const StorageUtils = (function () {
  const PREFIX = 'fg_builder_';

  function key(k) {
    return PREFIX + k;
  }

  function set(k, value) {
    try {
      localStorage.setItem(key(k), JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('StorageUtils.set error:', e);
      return false;
    }
  }

  function get(k, defaultValue) {
    try {
      const raw = localStorage.getItem(key(k));
      if (raw === null) return defaultValue !== undefined ? defaultValue : null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('StorageUtils.get error:', e);
      return defaultValue !== undefined ? defaultValue : null;
    }
  }

  function remove(k) {
    try {
      localStorage.removeItem(key(k));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clear() {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(PREFIX))
        .forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.warn('StorageUtils.clear error:', e);
    }
  }

  function has(k) {
    return localStorage.getItem(key(k)) !== null;
  }

  return { set, get, remove, clear, has };
})();

window.StorageUtils = StorageUtils;
