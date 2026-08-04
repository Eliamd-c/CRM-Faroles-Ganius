/**
 * ═════════════════════════════════════════════════════════════════════
 * FEATURE FLAGS SERVICE
 * ═════════════════════════════════════════════════════════════════════
 *
 * Runtime configuration for integration layer behavior
 * Allows dynamic feature toggling without redeployment
 *
 * Flags:
 * - DUAL_EXECUTION: Run both handlers
 * - NEW_AS_PRIMARY: Return new handler result if successful
 * - LEGACY_FALLBACK: Fallback to legacy if new fails
 * - COMPARE_RESULTS: Compare results for discrepancies
 * - LOG_DISCREPANCIES: Log result mismatches
 * - TRAFFIC_SHIFT: Enable gradual traffic shifting
 *
 * ═════════════════════════════════════════════════════════════════════
 */

class FeatureFlags {
  constructor(config = {}) {
    this.flags = {
      DUAL_EXECUTION: config.dualExecution ?? true,
      NEW_AS_PRIMARY: config.newAsPrimary ?? true,
      LEGACY_FALLBACK: config.legacyFallback ?? true,
      COMPARE_RESULTS: config.compareResults ?? true,
      LOG_DISCREPANCIES: config.logDiscrepancies ?? true,
      TRAFFIC_SHIFT: config.trafficShift ?? false
    };

    this.trafficShiftPercentage = config.trafficShiftPercentage ?? 50;
    this.changeHistory = [];
    this.maxHistorySize = 1000;
  }

  /**
   * Check if a feature flag is enabled
   */
  isEnabled(flagName) {
    return this.flags[flagName] ?? false;
  }

  /**
   * Determine if new handler should be used (with traffic shift support)
   */
  shouldUseNewHandler() {
    // If traffic shift disabled, use NEW_AS_PRIMARY flag
    if (!this.flags.TRAFFIC_SHIFT) {
      return this.flags.NEW_AS_PRIMARY;
    }

    // Traffic shift enabled: percentage-based routing
    const random = Math.random() * 100;
    return random < this.trafficShiftPercentage;
  }

  /**
   * Update a feature flag
   */
  updateFlag(flagName, value) {
    if (!this.flags.hasOwnProperty(flagName)) {
      return {
        success: false,
        error: `Unknown flag: ${flagName}`,
        flag: flagName
      };
    }

    const oldValue = this.flags[flagName];
    this.flags[flagName] = value;

    // Record change in history
    this._recordChange(flagName, oldValue, value, 'flag_update');

    return {
      success: true,
      flag: flagName,
      old_value: oldValue,
      new_value: value,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Set traffic shift percentage
   */
  setTrafficShift(percentage) {
    if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
      return {
        success: false,
        error: 'Percentage must be a number between 0 and 100',
        requested: percentage
      };
    }

    const oldValue = this.trafficShiftPercentage;
    this.trafficShiftPercentage = percentage;

    // Record change
    this._recordChange('TRAFFIC_SHIFT_PERCENTAGE', oldValue, percentage, 'traffic_shift');

    return {
      success: true,
      percentage: percentage,
      old_percentage: oldValue,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Enable traffic shift mode
   */
  enableTrafficShift() {
    const oldValue = this.flags.TRAFFIC_SHIFT;
    this.flags.TRAFFIC_SHIFT = true;
    this._recordChange('TRAFFIC_SHIFT', oldValue, true, 'mode_change');

    return {
      success: true,
      mode: 'traffic_shift_enabled',
      percentage: this.trafficShiftPercentage,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Disable traffic shift mode (return to deterministic routing)
   */
  disableTrafficShift() {
    const oldValue = this.flags.TRAFFIC_SHIFT;
    this.flags.TRAFFIC_SHIFT = false;
    this._recordChange('TRAFFIC_SHIFT', oldValue, false, 'mode_change');

    return {
      success: true,
      mode: 'traffic_shift_disabled',
      using: this.flags.NEW_AS_PRIMARY ? 'new_primary' : 'legacy_primary',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get all flags
   */
  getAll() {
    return {
      ...this.flags,
      TRAFFIC_SHIFT_PERCENTAGE: this.trafficShiftPercentage
    };
  }

  /**
   * Get flag summary for monitoring
   */
  getSummary() {
    return {
      flags: this.getAll(),
      mode: this.flags.TRAFFIC_SHIFT ? 'traffic_shift' : 'deterministic',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get change history
   */
  getChangeHistory(limit = 20) {
    return this.changeHistory.slice(-limit);
  }

  /**
   * Reset all flags to defaults
   */
  reset() {
    this.flags = {
      DUAL_EXECUTION: true,
      NEW_AS_PRIMARY: true,
      LEGACY_FALLBACK: true,
      COMPARE_RESULTS: true,
      LOG_DISCREPANCIES: true,
      TRAFFIC_SHIFT: false
    };
    this.trafficShiftPercentage = 50;
    this._recordChange('ALL_FLAGS', null, this.flags, 'reset');

    return {
      success: true,
      message: 'All flags reset to defaults',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * ─────────────────────────────────────────────────────────
   * PRIVATE UTILITIES
   * ─────────────────────────────────────────────────────────
   */

  /**
   * Record flag change in history
   * @private
   */
  _recordChange(flagName, oldValue, newValue, changeType) {
    const change = {
      timestamp: new Date().toISOString(),
      flag: flagName,
      old_value: oldValue,
      new_value: newValue,
      change_type: changeType,
      iso_timestamp: new Date().toISOString()
    };

    this.changeHistory.push(change);

    // Keep history size bounded
    if (this.changeHistory.length > this.maxHistorySize) {
      this.changeHistory = this.changeHistory.slice(-this.maxHistorySize);
    }
  }
}

module.exports = FeatureFlags;
