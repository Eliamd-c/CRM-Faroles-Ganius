/**
 * Logger Utility
 *
 * Centralized logging with console output and error reporting.
 * Gracefully handles logging failures.
 */

/**
 * Logger - Handles all application logging
 */
export class Logger {
  /**
   * Initialize logger
   * @param {Object} options - Configuration options
   * @param {boolean} options.debugMode - Enable debug logging
   * @param {Function} options.onError - Callback for error logging
   */
  constructor(options = {}) {
    this.debugMode = options.debugMode || false;
    this.onError = options.onError || null;
    this.logQueue = [];
    this.maxQueueSize = 100;
  }

  /**
   * Log at specified level
   * @param {string} level - Log level (debug, info, warn, error)
   * @param {string} message - Log message
   * @param {Object} context - Additional context data
   * @returns {Object} Log entry
   */
  log(level, message, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };

    try {
      // Output to console based on level
      switch (level.toLowerCase()) {
        case 'debug':
          if (this.debugMode) {
            console.debug(`[${logEntry.timestamp}] DEBUG:`, message, context);
          }
          break;
        case 'info':
          console.info(`[${logEntry.timestamp}] INFO:`, message, context);
          break;
        case 'warn':
          console.warn(`[${logEntry.timestamp}] WARN:`, message, context);
          break;
        case 'error':
          console.error(`[${logEntry.timestamp}] ERROR:`, message, context);
          // Send error to callback if provided
          if (this.onError && typeof this.onError === 'function') {
            try {
              this.onError(logEntry);
            } catch (callbackErr) {
              console.error('Logger callback error:', callbackErr.message);
            }
          }
          break;
        default:
          console.log(`[${logEntry.timestamp}] ${level}:`, message, context);
      }

      // Queue log entry for potential batch sending
      this._queueLogEntry(logEntry);
    } catch (err) {
      // Fail silently - never throw from logger
      console.error('Logger error (ignored):', err.message);
    }

    return logEntry;
  }

  /**
   * Log error level message
   * @param {string} message - Error message
   * @param {Object} context - Additional context
   * @returns {Object} Log entry
   */
  error(message, context = {}) {
    return this.log('error', message, context);
  }

  /**
   * Log warn level message
   * @param {string} message - Warning message
   * @param {Object} context - Additional context
   * @returns {Object} Log entry
   */
  warn(message, context = {}) {
    return this.log('warn', message, context);
  }

  /**
   * Log info level message
   * @param {string} message - Info message
   * @param {Object} context - Additional context
   * @returns {Object} Log entry
   */
  info(message, context = {}) {
    return this.log('info', message, context);
  }

  /**
   * Log debug level message
   * @param {string} message - Debug message
   * @param {Object} context - Additional context
   * @returns {Object} Log entry
   */
  debug(message, context = {}) {
    return this.log('debug', message, context);
  }

  /**
   * Send error to backend logging service
   * @param {string} message - Error message
   * @param {Object} context - Error context
   * @param {Function} fetchFn - Fetch function for sending logs
   */
  async sendErrorLog(message, context, fetchFn) {
    if (!fetchFn || typeof fetchFn !== 'function') {
      return false;
    }

    try {
      const response = await fetchFn('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          message,
          context,
        }),
      });

      return response.ok;
    } catch (err) {
      // Fail silently - logging should never crash the app
      console.error('Failed to send error log (ignored):', err.message);
      return false;
    }
  }

  /**
   * Queue log entry for potential batch sending
   * @private
   * @param {Object} logEntry - Log entry to queue
   */
  _queueLogEntry(logEntry) {
    this.logQueue.push(logEntry);

    // Keep queue size manageable
    if (this.logQueue.length > this.maxQueueSize) {
      this.logQueue.shift();
    }
  }

  /**
   * Get queued log entries
   * @returns {Array} Queued logs
   */
  getQueuedLogs() {
    return [...this.logQueue];
  }

  /**
   * Clear log queue
   */
  clearQueue() {
    this.logQueue = [];
  }
}
