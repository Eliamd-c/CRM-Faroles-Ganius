/**
 * ═════════════════════════════════════════════════════════════════════
 * EVENT COMPARATOR
 * ═════════════════════════════════════════════════════════════════════
 *
 * Compares results from new and legacy handlers
 * Identifies discrepancies for monitoring and debugging
 *
 * Comparison strategies:
 * - Exact match: Results are identical
 * - Semantic match: Results are functionally equivalent
 * - Functional match: Both produced expected side effects
 * - Mismatch: Results differ in meaningful way
 *
 * ═════════════════════════════════════════════════════════════════════
 */

class EventComparator {
  constructor() {
    this.comparisonHistory = [];
    this.maxHistorySize = 1000;
  }

  /**
   * Compare results from both handlers
   * Returns: { match: boolean, discrepancies: string[] }
   */
  compare(newResult, legacyResult) {
    const comparison = {
      match: true,
      discrepancies: [],
      newType: this._getResultType(newResult),
      legacyType: this._getResultType(legacyResult)
    };

    // Both null/undefined
    if (newResult === null || newResult === undefined) {
      if (legacyResult === null || legacyResult === undefined) {
        comparison.match = true;
        return comparison;
      } else {
        comparison.match = false;
        comparison.discrepancies.push('New returned null, legacy returned ' + comparison.legacyType);
        return comparison;
      }
    }

    // Both objects/arrays
    if (this._isObject(newResult) && this._isObject(legacyResult)) {
      return this._compareObjects(newResult, legacyResult);
    }

    // Primitive comparison
    if (this._isEqual(newResult, legacyResult)) {
      comparison.match = true;
    } else {
      comparison.match = false;
      comparison.discrepancies.push(
        `Values differ: new=${JSON.stringify(newResult).substring(0, 50)}, ` +
        `legacy=${JSON.stringify(legacyResult).substring(0, 50)}`
      );
    }

    return comparison;
  }

  /**
   * Compare objects for semantic equivalence
   */
  compareObjects(newObj, legacyObj, options = {}) {
    const ignoreFields = options.ignoreFields || ['timestamp', 'createdAt', 'updatedAt'];
    const comparison = {
      match: true,
      discrepancies: [],
      differences: {}
    };

    const allKeys = new Set([
      ...Object.keys(newObj || {}),
      ...Object.keys(legacyObj || {})
    ]);

    for (const key of allKeys) {
      if (ignoreFields.includes(key)) continue;

      const newValue = newObj?.[key];
      const legacyValue = legacyObj?.[key];

      if (!this._isEqual(newValue, legacyValue)) {
        comparison.match = false;
        comparison.differences[key] = {
          new: newValue,
          legacy: legacyValue
        };
        comparison.discrepancies.push(`Field '${key}' differs`);
      }
    }

    return comparison;
  }

  /**
   * Get detailed comparison report
   */
  getComparisonReport() {
    return {
      total_comparisons: this.comparisonHistory.length,
      matches: this.comparisonHistory.filter(c => c.match).length,
      discrepancies: this.comparisonHistory.filter(c => !c.match).length,
      match_rate: this.comparisonHistory.length > 0
        ? (this.comparisonHistory.filter(c => c.match).length / this.comparisonHistory.length * 100).toFixed(2) + '%'
        : 'N/A',
      recent_discrepancies: this.comparisonHistory
        .filter(c => !c.match)
        .slice(-20)
    };
  }

  /**
   * ─────────────────────────────────────────────────────────
   * PRIVATE UTILITIES
   * ─────────────────────────────────────────────────────────
   */

  /**
   * Get type of result
   * @private
   */
  _getResultType(result) {
    if (result === null) return 'null';
    if (result === undefined) return 'undefined';
    if (Array.isArray(result)) return 'array';
    if (typeof result === 'object') return 'object';
    return typeof result;
  }

  /**
   * Check if value is object or array
   * @private
   */
  _isObject(value) {
    return value !== null && (typeof value === 'object');
  }

  /**
   * Deep equality check
   * @private
   */
  _isEqual(a, b) {
    // Primitive comparison
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object') return false;

    // Null check
    if (a === null || b === null) return a === b;

    // Array comparison
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, idx) => this._isEqual(item, b[idx]));
    }

    // Object comparison
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a || {});
      const keysB = Object.keys(b || {});
      if (keysA.length !== keysB.length) return false;
      return keysA.every(key => this._isEqual(a[key], b[key]));
    }

    return false;
  }

  /**
   * Compare two objects
   * @private
   */
  _compareObjects(newObj, legacyObj) {
    const comparison = {
      match: true,
      discrepancies: [],
      newKeys: new Set(Object.keys(newObj || {})),
      legacyKeys: new Set(Object.keys(legacyObj || {})),
      differences: {}
    };

    // Check all keys
    const allKeys = new Set([
      ...Object.keys(newObj || {}),
      ...Object.keys(legacyObj || {})
    ]);

    // Ignore timing/metadata fields
    const ignoreFields = new Set([
      'timestamp', 'createdAt', 'updatedAt', '_id', 'id',
      'executedAt', 'processedAt', 'generatedAt'
    ]);

    for (const key of allKeys) {
      if (ignoreFields.has(key)) continue;

      const newValue = newObj?.[key];
      const legacyValue = legacyObj?.[key];

      if (!(key in (newObj || {}))) {
        comparison.match = false;
        comparison.discrepancies.push(`Key '${key}' missing in new result`);
      } else if (!(key in (legacyObj || {}))) {
        comparison.match = false;
        comparison.discrepancies.push(`Key '${key}' missing in legacy result`);
      } else if (!this._isEqual(newValue, legacyValue)) {
        comparison.match = false;
        comparison.differences[key] = {
          new: this._summarizeValue(newValue),
          legacy: this._summarizeValue(legacyValue)
        };
        comparison.discrepancies.push(`Field '${key}' differs`);
      }
    }

    return comparison;
  }

  /**
   * Summarize a value for display
   * @private
   */
  _summarizeValue(value) {
    if (value === null) return null;
    if (value === undefined) return undefined;
    if (typeof value !== 'object') return value;

    if (Array.isArray(value)) {
      return `Array[${value.length}]`;
    }

    return `Object{${Object.keys(value).join(',')}}`;
  }
}

module.exports = EventComparator;
