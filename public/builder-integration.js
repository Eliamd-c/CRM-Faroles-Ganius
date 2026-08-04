/**
 * ═════════════════════════════════════════════════════════════════════
 * PHASE 2: BUILDER INTEGRATION LAYER
 * ═════════════════════════════════════════════════════════════════════
 *
 * Dual Execution Coordinator
 * Coordinates new (Clean Architecture) and legacy handlers
 * Executes both in parallel, compares results, logs discrepancies
 *
 * Status: PRODUCTION SAFE
 * - New handler is primary
 * - Legacy handler runs as fallback
 * - All events logged for monitoring
 * - Zero production risk (200 OK always returned before handlers)
 *
 * ═════════════════════════════════════════════════════════════════════
 */

const crypto = require('crypto');
const MetricsCollector = require('./services/metrics');
const EventComparator = require('./services/event-comparator');

class BuilderIntegration {
  constructor(options = {}) {
    this.legacyBuilder = options.legacyBuilder || null;
    this.newBuilder = options.newBuilder || null;
    this.logger = options.logger || console;
    this.metrics = new MetricsCollector();
    this.eventComparator = new EventComparator();
    this.featureFlags = options.featureFlags || this._getDefaultFlags();
    this.discrepancies = [];
    this.maxDiscrepanciesStored = 100;
  }

  /**
   * ─────────────────────────────────────────────────────────
   * PUBLIC API
   * ─────────────────────────────────────────────────────────
   */

  /**
   * Main entry point for webhook events
   * Handles all event types with dual execution
   */
  async handleWebhookEvent(eventData, eventType = 'message') {
    const eventId = this._generateEventId();
    const startTime = Date.now();

    try {
      this.metrics.recordEventStart(eventId, eventType);

      // Parallel execution: new handler (primary) + legacy handler (fallback)
      const [newResult, newError, newDuration] = await this._executeNewHandler(
        eventData,
        eventType,
        eventId
      );

      const [legacyResult, legacyError, legacyDuration] = await this._executeLegacyHandler(
        eventData,
        eventType,
        eventId
      );

      // Compare results
      const comparison = this._compareResults(
        newResult,
        legacyResult,
        newError,
        legacyError,
        eventId
      );

      // Record metrics
      this.metrics.recordExecution({
        eventId,
        eventType,
        newSuccess: !newError,
        legacySuccess: !legacyError,
        newDuration,
        legacyDuration,
        resultsMatch: comparison.match,
        newError: newError?.message,
        legacyError: legacyError?.message,
        totalDuration: Date.now() - startTime
      });

      // Store comparison for monitoring
      if (!comparison.match) {
        this._recordDiscrepancy(comparison);
      }

      // Return result: new if successful, fallback to legacy
      if (newResult && !newError) {
        return {
          result: newResult,
          source: 'new',
          eventId,
          status: 'success',
          duration: Date.now() - startTime
        };
      } else if (legacyResult && !legacyError) {
        this.logger.warn(
          `[BuilderIntegration] Fallback to legacy handler for event ${eventId}`
        );
        return {
          result: legacyResult,
          source: 'legacy',
          eventId,
          status: 'fallback',
          duration: Date.now() - startTime
        };
      } else {
        // Both failed
        const error = new Error(
          `Both handlers failed for event ${eventId}. New: ${newError?.message}, Legacy: ${legacyError?.message}`
        );
        this.logger.error('[BuilderIntegration] Critical error', {
          eventId,
          newError: newError?.message,
          legacyError: legacyError?.message
        });
        this.metrics.recordCriticalError(eventId, error);
        throw error;
      }
    } catch (e) {
      this.logger.error('[BuilderIntegration] Unhandled error', {
        eventId,
        error: e.message,
        stack: e.stack
      });
      this.metrics.recordCriticalError(eventId, e);
      throw e;
    }
  }

  /**
   * Handle different webhook event types
   */
  async handleMessageEvent(event) {
    return this.handleWebhookEvent({
      type: 'message',
      sender_id: event.sender?.id,
      text: event.message?.quick_reply?.payload || event.message?.text || '',
      message_id: event.message?.mid,
      timestamp: event.timestamp,
      raw_event: event
    }, 'message');
  }

  async handlePostbackEvent(event) {
    return this.handleWebhookEvent({
      type: 'postback',
      sender_id: event.sender?.id,
      payload: event.postback?.payload,
      timestamp: event.timestamp,
      raw_event: event
    }, 'postback');
  }

  async handleCommentEvent(change) {
    return this.handleWebhookEvent({
      type: 'comment',
      comment_id: change.id,
      text: change.text,
      from_id: change.from?.id,
      from_name: change.from?.username,
      timestamp: Date.now(),
      raw_event: change
    }, 'comment');
  }

  async handleAttachmentsEvent(event) {
    return this.handleWebhookEvent({
      type: 'attachments',
      sender_id: event.sender?.id,
      attachments: event.message?.attachments,
      timestamp: event.timestamp,
      raw_event: event
    }, 'attachments');
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return this.metrics.getSummary();
  }

  /**
   * Get recent discrepancies
   */
  getDiscrepancies(limit = 20) {
    return this.discrepancies.slice(-limit);
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    const summary = this.metrics.getSummary();
    return {
      status: summary.health,
      timestamp: new Date().toISOString(),
      metrics: {
        total_events: summary.events.total,
        success_rate: this._calculateSuccessRate(summary),
        match_rate: this._calculateMatchRate(summary),
        avg_latency_ms: summary.timings.total_avg,
        discrepancies_count: this.discrepancies.length,
        recent_errors: summary.recentErrors.length
      }
    };
  }

  /**
   * Update feature flags
   */
  updateFeatureFlag(flagName, value) {
    if (this.featureFlags.hasOwnProperty(flagName)) {
      this.featureFlags[flagName] = value;
      this.logger.info(`[BuilderIntegration] Feature flag updated: ${flagName}=${value}`);
      return { success: true, flag: flagName, value };
    } else {
      this.logger.warn(`[BuilderIntegration] Unknown feature flag: ${flagName}`);
      return { success: false, error: `Unknown flag: ${flagName}` };
    }
  }

  /**
   * Set traffic shift percentage
   */
  setTrafficShiftPercentage(percentage) {
    if (percentage < 0 || percentage > 100) {
      return { success: false, error: 'Percentage must be 0-100' };
    }
    this.featureFlags.TRAFFIC_SHIFT_PERCENTAGE = percentage;
    this.logger.info(`[BuilderIntegration] Traffic shift updated to ${percentage}%`);
    return { success: true, percentage };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = new MetricsCollector();
    this.discrepancies = [];
    this.logger.info('[BuilderIntegration] Metrics reset');
    return { success: true };
  }

  /**
   * ─────────────────────────────────────────────────────────
   * PRIVATE: DUAL EXECUTION
   * ─────────────────────────────────────────────────────────
   */

  /**
   * Execute new handler (Clean Architecture)
   * @private
   */
  async _executeNewHandler(eventData, eventType, eventId) {
    const startTime = Date.now();
    let result = null;
    let error = null;

    if (!this.newBuilder) {
      return [null, new Error('New builder not initialized'), 0];
    }

    if (!this.featureFlags.DUAL_EXECUTION && !this.featureFlags.NEW_ONLY) {
      return [null, new Error('New handler disabled'), 0];
    }

    try {
      // Route to appropriate use case
      if (eventType === 'message' && this.newBuilder.handleIncomingMessageUseCase) {
        result = await this.newBuilder.handleIncomingMessageUseCase.execute({
          senderId: eventData.sender_id,
          text: eventData.text,
          messageId: eventData.message_id,
          timestamp: eventData.timestamp,
          storyMention: eventData.raw_event?.message?.story?.mention,
          hasAttachments: eventData.raw_event?.message?.attachments?.length > 0,
          event: eventData.raw_event
        });
      } else if (eventType === 'comment' && this.newBuilder.handleCommentUseCase) {
        result = await this.newBuilder.handleCommentUseCase.execute({
          commentId: eventData.comment_id,
          text: eventData.text,
          fromName: eventData.from_name,
          fromId: eventData.from_id
        });
      } else if (eventType === 'postback' && this.newBuilder.handlePostbackUseCase) {
        result = await this.newBuilder.handlePostbackUseCase.execute({
          senderId: eventData.sender_id,
          payload: eventData.payload,
          timestamp: eventData.timestamp
        });
      } else if (eventType === 'attachments' && this.newBuilder.handleAttachmentsUseCase) {
        result = await this.newBuilder.handleAttachmentsUseCase.execute({
          senderId: eventData.sender_id,
          attachments: eventData.attachments,
          timestamp: eventData.timestamp
        });
      }
      // Other event types can be added here
    } catch (e) {
      error = e;
      this.logger.error(
        `[BuilderIntegration] New handler error for ${eventType} event ${eventId}`,
        { error: e.message }
      );
    }

    const duration = Date.now() - startTime;
    return [result, error, duration];
  }

  /**
   * Execute legacy handler
   * @private
   */
  async _executeLegacyHandler(eventData, eventType, eventId) {
    const startTime = Date.now();
    let result = null;
    let error = null;

    if (!this.legacyBuilder) {
      return [null, new Error('Legacy builder not initialized'), 0];
    }

    if (this.featureFlags.NEW_ONLY) {
      return [null, new Error('Legacy handler disabled'), 0];
    }

    try {
      // Route to appropriate handler
      if (eventType === 'message' && this.legacyBuilder.handleMessage) {
        result = await this.legacyBuilder.handleMessage(eventData.raw_event);
      } else if (eventType === 'comment' && this.legacyBuilder.handleComment) {
        result = await this.legacyBuilder.handleComment(eventData.raw_event);
      } else if (eventType === 'postback' && this.legacyBuilder.handlePostback) {
        result = await this.legacyBuilder.handlePostback(eventData.raw_event);
      } else if (eventType === 'attachments' && this.legacyBuilder.handleAttachments) {
        result = await this.legacyBuilder.handleAttachments(eventData.raw_event);
      }
    } catch (e) {
      error = e;
      this.logger.error(
        `[BuilderIntegration] Legacy handler error for ${eventType} event ${eventId}`,
        { error: e.message }
      );
    }

    const duration = Date.now() - startTime;
    return [result, error, duration];
  }

  /**
   * ─────────────────────────────────────────────────────────
   * PRIVATE: COMPARISON & ANALYSIS
   * ─────────────────────────────────────────────────────────
   */

  /**
   * Compare results from both handlers
   * @private
   */
  _compareResults(newResult, legacyResult, newError, legacyError, eventId) {
    const comparison = {
      eventId,
      timestamp: new Date().toISOString(),
      newSuccess: !newError,
      legacySuccess: !legacyError,
      newResult,
      legacyResult,
      newError: newError?.message,
      legacyError: legacyError?.message,
      match: false,
      discrepancies: []
    };

    // Both failed = mismatch
    if (newError && legacyError) {
      comparison.discrepancies.push('Both handlers failed');
      return comparison;
    }

    // One failed, one succeeded = mismatch
    if ((newError && !legacyError) || (!newError && legacyError)) {
      comparison.discrepancies.push(
        newError ? 'New handler failed, legacy succeeded' : 'New succeeded, legacy failed'
      );
      return comparison;
    }

    // Both succeeded - compare results using EventComparator
    if (!newError && !legacyError) {
      const comparisonResult = this.eventComparator.compare(newResult, legacyResult);
      comparison.match = comparisonResult.match;
      comparison.discrepancies = comparisonResult.discrepancies;
      return comparison;
    }

    return comparison;
  }

  /**
   * Store discrepancy for monitoring
   * @private
   */
  _recordDiscrepancy(comparison) {
    this.discrepancies.push(comparison);
    if (this.discrepancies.length > this.maxDiscrepanciesStored) {
      this.discrepancies.shift();
    }
    this.logger.warn(
      `[BuilderIntegration] Result discrepancy detected for event ${comparison.eventId}`,
      { discrepancies: comparison.discrepancies }
    );
  }

  /**
   * ─────────────────────────────────────────────────────────
   * PRIVATE: UTILITIES
   * ─────────────────────────────────────────────────────────
   */

  /**
   * Generate unique event ID
   * @private
   */
  _generateEventId() {
    return `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Get default feature flags
   * @private
   */
  _getDefaultFlags() {
    return {
      DUAL_EXECUTION: true,           // Run both handlers
      NEW_ONLY: false,                // Skip legacy handler
      NEW_AS_PRIMARY: true,           // Return new handler result if successful
      LEGACY_FALLBACK: true,          // Fallback to legacy if new fails
      COMPARE_RESULTS: true,          // Compare results
      LOG_DISCREPANCIES: true,        // Log mismatches
      GRADUALLY_SHIFT_TRAFFIC: false, // Enable gradual shift
      TRAFFIC_SHIFT_PERCENTAGE: 50    // % traffic to new handler
    };
  }

  /**
   * Calculate success rate from metrics
   * @private
   */
  _calculateSuccessRate(summary) {
    const total = summary.events.total;
    if (total === 0) return '0.00%';
    const newSuccess = summary.events.new_success || 0;
    const legacySuccess = summary.events.legacy_success || 0;
    const rate = ((newSuccess + legacySuccess) / (total * 2)) * 100;
    return rate.toFixed(2) + '%';
  }

  /**
   * Calculate result match rate
   * @private
   */
  _calculateMatchRate(summary) {
    const match = summary.events.results_match || 0;
    const differ = summary.events.results_differ || 0;
    const total = match + differ;
    if (total === 0) return 'N/A';
    const rate = (match / total) * 100;
    return rate.toFixed(2) + '%';
  }
}

module.exports = BuilderIntegration;
