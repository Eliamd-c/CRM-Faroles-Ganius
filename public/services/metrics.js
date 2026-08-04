/**
 * ═════════════════════════════════════════════════════════════════════
 * METRICS COLLECTOR
 * ═════════════════════════════════════════════════════════════════════
 *
 * Tracks performance and health of both new and legacy handlers
 * Provides real-time visibility into integration status
 *
 * Metrics tracked:
 * - Total events processed
 * - New handler: success/error counts
 * - Legacy handler: success/error counts
 * - Result matches/discrepancies
 * - Execution timings
 * - Health status
 *
 * ═════════════════════════════════════════════════════════════════════
 */

class MetricsCollector {
  constructor() {
    this.events = {
      total: 0,
      by_type: {
        message: 0,
        comment: 0,
        postback: 0,
        attachments: 0,
        other: 0
      },
      new_success: 0,
      new_error: 0,
      legacy_success: 0,
      legacy_error: 0,
      results_match: 0,
      results_differ: 0,
      critical_errors: 0
    };

    this.timings = {
      new_handler: [],      // Array of execution times
      legacy_handler: [],   // Array of execution times
      total: [],            // Array of total execution times
      by_type: {
        message: [],
        comment: [],
        postback: [],
        attachments: [],
        other: []
      }
    };

    this.errors = [];       // Array of error objects for recent errors
    this.maxErrorsStored = 100;

    this.startTime = Date.now();
    this.lastResetTime = Date.now();
  }

  /**
   * Record event start
   */
  recordEventStart(eventId, eventType) {
    this.events.total += 1;
    this.events.by_type[eventType] = (this.events.by_type[eventType] || 0) + 1;
  }

  /**
   * Record execution results
   */
  recordExecution(data) {
    const {
      eventId,
      eventType,
      newSuccess,
      legacySuccess,
      newDuration,
      legacyDuration,
      resultsMatch,
      newError,
      legacyError,
      totalDuration
    } = data;

    // Update success/error counts
    if (newSuccess) {
      this.events.new_success += 1;
    } else {
      this.events.new_error += 1;
    }

    if (legacySuccess) {
      this.events.legacy_success += 1;
    } else {
      this.events.legacy_error += 1;
    }

    // Track match/differ
    if (resultsMatch) {
      this.events.results_match += 1;
    } else {
      this.events.results_differ += 1;
    }

    // Record timings
    if (newDuration > 0) {
      this.timings.new_handler.push(newDuration);
      // Keep only last 1000 timings to avoid memory bloat
      if (this.timings.new_handler.length > 1000) {
        this.timings.new_handler = this.timings.new_handler.slice(-1000);
      }
    }

    if (legacyDuration > 0) {
      this.timings.legacy_handler.push(legacyDuration);
      if (this.timings.legacy_handler.length > 1000) {
        this.timings.legacy_handler = this.timings.legacy_handler.slice(-1000);
      }
    }

    if (totalDuration > 0) {
      this.timings.total.push(totalDuration);
      if (this.timings.total.length > 1000) {
        this.timings.total = this.timings.total.slice(-1000);
      }
    }

    // Track by event type
    if (eventType && this.timings.by_type[eventType]) {
      this.timings.by_type[eventType].push(totalDuration);
      if (this.timings.by_type[eventType].length > 500) {
        this.timings.by_type[eventType] = this.timings.by_type[eventType].slice(-500);
      }
    }

    // Record errors for monitoring
    if (newError) {
      this._recordError(eventId, 'new_handler', newError);
    }
    if (legacyError) {
      this._recordError(eventId, 'legacy_handler', legacyError);
    }
  }

  /**
   * Record critical error
   */
  recordCriticalError(eventId, error) {
    this.events.critical_errors += 1;
    this._recordError(eventId, 'critical', error.message);
  }

  /**
   * Get metrics summary
   */
  getSummary() {
    const uptime = Date.now() - this.startTime;
    const timeSinceReset = Date.now() - this.lastResetTime;

    return {
      uptime_ms: uptime,
      time_since_reset_ms: timeSinceReset,
      events: { ...this.events },
      timings: {
        new_handler_avg: this._average(this.timings.new_handler),
        new_handler_min: Math.min(...(this.timings.new_handler || [Infinity])),
        new_handler_max: Math.max(...(this.timings.new_handler || [-Infinity])),
        legacy_handler_avg: this._average(this.timings.legacy_handler),
        legacy_handler_min: Math.min(...(this.timings.legacy_handler || [Infinity])),
        legacy_handler_max: Math.max(...(this.timings.legacy_handler || [-Infinity])),
        total_avg: this._average(this.timings.total),
        by_type: this._getAveragesByType()
      },
      health: this._calculateHealth(),
      success_rate: this._calculateSuccessRate(),
      match_rate: this._calculateMatchRate(),
      recentErrors: this.errors.slice(-10)
    };
  }

  /**
   * Get detailed health status
   */
  getHealthStatus() {
    const summary = this.getSummary();
    const health = summary.health;

    return {
      status: health,
      timestamp: new Date().toISOString(),
      summary: summary,
      recommendations: this._getRecommendations(health, summary)
    };
  }

  /**
   * Get statistics by event type
   */
  getStatsByType(eventType) {
    const typeCount = this.events.by_type[eventType] || 0;
    const typeTimings = this.timings.by_type[eventType] || [];

    return {
      event_type: eventType,
      count: typeCount,
      avg_duration_ms: this._average(typeTimings),
      min_duration_ms: typeTimings.length > 0 ? Math.min(...typeTimings) : 0,
      max_duration_ms: typeTimings.length > 0 ? Math.max(...typeTimings) : 0
    };
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.events = {
      total: 0,
      by_type: { message: 0, comment: 0, postback: 0, attachments: 0, other: 0 },
      new_success: 0,
      new_error: 0,
      legacy_success: 0,
      legacy_error: 0,
      results_match: 0,
      results_differ: 0,
      critical_errors: 0
    };
    this.timings = {
      new_handler: [],
      legacy_handler: [],
      total: [],
      by_type: { message: [], comment: [], postback: [], attachments: [], other: [] }
    };
    this.errors = [];
    this.lastResetTime = Date.now();
  }

  /**
   * ─────────────────────────────────────────────────────────
   * PRIVATE UTILITIES
   * ─────────────────────────────────────────────────────────
   */

  /**
   * Record error in errors array
   * @private
   */
  _recordError(eventId, handler, errorMessage) {
    const errorRecord = {
      timestamp: new Date().toISOString(),
      eventId,
      handler,
      message: errorMessage,
      iso_timestamp: new Date().toISOString()
    };

    this.errors.push(errorRecord);
    if (this.errors.length > this.maxErrorsStored) {
      this.errors.shift();
    }
  }

  /**
   * Calculate average of array
   * @private
   */
  _average(arr) {
    if (!arr || arr.length === 0) return 0;
    const sum = arr.reduce((a, b) => a + b, 0);
    return Math.round(sum / arr.length * 100) / 100;
  }

  /**
   * Calculate health status
   * @private
   */
  _calculateHealth() {
    const total = this.events.total;
    if (total === 0) return 'UNKNOWN';

    const newTotal = this.events.new_success + this.events.new_error;
    const legacyTotal = this.events.legacy_success + this.events.legacy_error;

    const newSuccessRate = newTotal > 0 ? this.events.new_success / newTotal : 0;
    const legacySuccessRate = legacyTotal > 0 ? this.events.legacy_success / legacyTotal : 0;
    const avgSuccessRate = (newSuccessRate + legacySuccessRate) / 2;

    const matchCount = this.events.results_match;
    const differCount = this.events.results_differ;
    const matchRate = matchCount + differCount > 0
      ? matchCount / (matchCount + differCount)
      : 1;

    const criticalErrorRate = this.events.critical_errors / Math.max(total, 1);

    // Health determination
    if (avgSuccessRate >= 0.99 && matchRate >= 0.95 && criticalErrorRate < 0.001) {
      return 'HEALTHY';
    } else if (avgSuccessRate >= 0.95 && matchRate >= 0.85 && criticalErrorRate < 0.01) {
      return 'DEGRADED';
    } else {
      return 'UNHEALTHY';
    }
  }

  /**
   * Calculate overall success rate
   * @private
   */
  _calculateSuccessRate() {
    const total = this.events.total * 2; // Both handlers
    if (total === 0) return 0;
    const successes = this.events.new_success + this.events.legacy_success;
    return Math.round((successes / total) * 10000) / 100; // percentage
  }

  /**
   * Calculate match rate
   * @private
   */
  _calculateMatchRate() {
    const match = this.events.results_match;
    const differ = this.events.results_differ;
    const total = match + differ;
    if (total === 0) return 100;
    return Math.round((match / total) * 10000) / 100; // percentage
  }

  /**
   * Get averages by event type
   * @private
   */
  _getAveragesByType() {
    const result = {};
    for (const [type, timings] of Object.entries(this.timings.by_type)) {
      result[type] = this._average(timings);
    }
    return result;
  }

  /**
   * Get recommendations based on health status
   * @private
   */
  _getRecommendations(health, summary) {
    const recommendations = [];

    if (health === 'UNHEALTHY') {
      recommendations.push('⚠️ System unhealthy: Check recent errors and investigate root cause');
      recommendations.push('Consider reverting to legacy-only mode temporarily');
      recommendations.push('Review error logs for patterns');
    }

    if (health === 'DEGRADED') {
      recommendations.push('⚠️ System degraded: Monitor closely and consider reducing traffic');
      recommendations.push('Check if performance is acceptable for current workload');
    }

    if (summary.match_rate < 90) {
      recommendations.push('⚠️ Low result match rate: Investigate discrepancies');
    }

    if (summary.timings.new_handler_avg > summary.timings.legacy_handler_avg * 1.5) {
      recommendations.push('ℹ️ New handler is significantly slower: Investigate performance');
    }

    if (summary.events.critical_errors > 0) {
      recommendations.push('⚠️ Critical errors detected: Review immediately');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ System is healthy and operating normally');
    }

    return recommendations;
  }
}

module.exports = MetricsCollector;
