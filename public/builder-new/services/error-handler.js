/**
 * Error Handler Service
 *
 * Comprehensive error handling with:
 * - Error transformation and categorization
 * - User-friendly feedback generation
 * - Backend error logging
 * - Error recovery strategies
 * - Context tracking
 */

/**
 * ErrorHandler - Centralized error management
 */
export class ErrorHandler {
  /**
   * Initialize error handler
   * @param {Object} options - Configuration options
   * @param {Logger} options.logger - Logger instance for backend logging
   * @param {ApiClient} options.apiClient - API client for error reporting
   * @param {Function} options.onUserError - Callback for user-facing errors
   * @param {boolean} options.debugMode - Enable detailed error logging
   */
  constructor(options = {}) {
    this.logger = options.logger || null;
    this.apiClient = options.apiClient || null;
    this.onUserError = options.onUserError || null;
    this.debugMode = options.debugMode || false;
    this.errorContext = new Map(); // Track error context by ID
    this.errorRecoveryStrategies = new Map(); // Recovery handlers by error type
    this.errorCounts = new Map(); // Track error frequency
    this.maxErrorsPerType = 10; // Max entries per error type

    this._initializeRecoveryStrategies();
  }

  /**
   * Handle error with full processing
   * @param {Error} error - Error to handle
   * @param {Object} context - Error context
   * @param {string} context.operation - Operation that failed
   * @param {string} context.component - Component where error occurred
   * @param {Object} context.data - Additional data
   * @returns {Promise<Object>} Processed error info
   */
  async handle(error, context = {}) {
    const errorId = this._generateErrorId();
    const timestamp = new Date().toISOString();

    // Ensure error is Error instance
    const processedError = this._normalizeError(error);

    // Build error info
    const errorInfo = {
      id: errorId,
      timestamp,
      type: this._categorizeError(processedError),
      message: processedError.message,
      status: processedError.status || null,
      code: processedError.code || 'UNKNOWN_ERROR',
      stack: this.debugMode ? processedError.stack : null,
      context: this._sanitizeContext(context),
      userMessage: this._getUserMessage(processedError, context),
      retryable: this._isRetryable(processedError),
      recoveryAction: null,
    };

    // Track error frequency
    this._trackErrorFrequency(errorInfo.type);

    // Log to backend if logger available
    if (this.logger) {
      try {
        this.logger.error(`[${errorInfo.type}] ${errorInfo.message}`, {
          errorId,
          context: errorInfo.context,
          code: errorInfo.code,
        });
      } catch (logErr) {
        console.error('Error logging failed:', logErr.message);
      }
    }

    // Send to backend if API client available
    if (this.apiClient) {
      try {
        await this.apiClient.reportError(errorInfo);
      } catch (reportErr) {
        console.error('Error reporting failed:', reportErr.message);
      }
    }

    // Get recovery action if available
    const recovery = this._getRecoveryStrategy(errorInfo.type);
    if (recovery) {
      errorInfo.recoveryAction = recovery.action;
      try {
        await recovery.handler(errorInfo, context);
      } catch (recoveryErr) {
        console.error('Error recovery failed:', recoveryErr.message);
      }
    }

    // Call user error callback if provided
    if (this.onUserError) {
      try {
        this.onUserError({
          id: errorId,
          title: this._getErrorTitle(errorInfo.type),
          message: errorInfo.userMessage,
          retryable: errorInfo.retryable,
          recoveryAction: errorInfo.recoveryAction,
        });
      } catch (callbackErr) {
        console.error('User error callback failed:', callbackErr.message);
      }
    }

    // Store context for later retrieval
    this.errorContext.set(errorId, errorInfo);

    return errorInfo;
  }

  /**
   * Handle API error with specific logic
   * @param {Error} apiError - API error to handle
   * @param {string} operation - Operation that failed
   * @returns {Promise<Object>} Processed error info
   */
  async handleApiError(apiError, operation) {
    const status = apiError.status || 0;
    const context = {
      operation,
      component: 'ApiClient',
      httpStatus: status,
    };

    // Add retry info if retryable
    if (apiError.isRetryable && apiError.isRetryable()) {
      context.retryable = true;
      context.retryDelay = this._getRetryDelay(status);
    }

    return this.handle(apiError, context);
  }

  /**
   * Handle validation error with details
   * @param {ValidationError} validationError - Validation error
   * @param {string} operation - Operation context
   * @returns {Promise<Object>} Processed error info
   */
  async handleValidationError(validationError, operation) {
    const context = {
      operation,
      component: 'Validation',
      errors: validationError.errors || [],
      errorCount: (validationError.errors || []).length,
    };

    return this.handle(validationError, context);
  }

  /**
   * Get error by ID
   * @param {string} errorId - Error ID
   * @returns {Object|null} Error info or null
   */
  getError(errorId) {
    return this.errorContext.get(errorId) || null;
  }

  /**
   * Get error statistics
   * @returns {Object} Stats { totalErrors, byType, frequency }
   */
  getErrorStats() {
    const stats = {
      totalErrors: this.errorContext.size,
      byType: {},
      frequency: {},
    };

    for (const [type, count] of this.errorCounts.entries()) {
      stats.byType[type] = count;
      stats.frequency[type] = this._getErrorFrequency(type);
    }

    return stats;
  }

  /**
   * Clear error context
   */
  clearErrors() {
    this.errorContext.clear();
    this.errorCounts.clear();
  }

  /**
   * Normalize error to Error instance
   * @private
   * @param {*} error - Error to normalize
   * @returns {Error} Normalized error
   */
  _normalizeError(error) {
    if (error instanceof Error) {
      return error;
    }

    if (typeof error === 'string') {
      return new Error(error);
    }

    if (typeof error === 'object' && error !== null) {
      const message = error.message || error.msg || 'Unknown error';
      const err = new Error(message);
      Object.assign(err, error);
      return err;
    }

    return new Error('Unknown error');
  }

  /**
   * Categorize error type
   * @private
   * @param {Error} error - Error to categorize
   * @returns {string} Error category
   */
  _categorizeError(error) {
    if (error.name === 'ValidationError') {
      return 'VALIDATION_ERROR';
    }
    if (error.name === 'ApiError') {
      const status = error.status || 0;
      if (status >= 500) return 'SERVER_ERROR';
      if (status >= 400) return 'CLIENT_ERROR';
      if (status === 0) return 'NETWORK_ERROR';
      return 'HTTP_ERROR';
    }
    if (error.name === 'TimeoutError') {
      return 'TIMEOUT_ERROR';
    }
    if (error.name === 'AppError') {
      return error.code || 'APP_ERROR';
    }
    if (error.message.includes('Network') || error.message.includes('Failed to fetch')) {
      return 'NETWORK_ERROR';
    }
    return 'UNKNOWN_ERROR';
  }

  /**
   * Sanitize context for safe storage
   * @private
   * @param {Object} context - Context to sanitize
   * @returns {Object} Sanitized context
   */
  _sanitizeContext(context) {
    const sanitized = { ...context };

    // Remove sensitive data
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'apiKey'];
    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        delete sanitized[key];
      }
    }

    // Limit data size
    const contextStr = JSON.stringify(sanitized);
    if (contextStr.length > 1000) {
      sanitized.note = 'Context truncated due to size';
      return { operation: context.operation, note: 'Context truncated' };
    }

    return sanitized;
  }

  /**
   * Generate unique error ID
   * @private
   * @returns {string} Error ID
   */
  _generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if error is retryable
   * @private
   * @param {Error} error - Error to check
   * @returns {boolean}
   */
  _isRetryable(error) {
    if (error.isRetryable && typeof error.isRetryable === 'function') {
      return error.isRetryable();
    }

    const status = error.status || 0;
    return status >= 500 || status === 408 || status === 429;
  }

  /**
   * Get user-friendly error message
   * @private
   * @param {Error} error - Error
   * @param {Object} context - Error context
   * @returns {string} User message
   */
  _getUserMessage(error, context) {
    // Import messages map for localization
    const messages = {
      'VALIDATION_ERROR': 'Please check your input and try again.',
      'NETWORK_ERROR': 'Network connection error. Please check your connection and retry.',
      'TIMEOUT_ERROR': 'Request took too long. Please try again.',
      'SERVER_ERROR': 'Server error occurred. Please try again later.',
      'CLIENT_ERROR': 'Request error. Please check your data and try again.',
      'AUTH_ERROR': 'Authentication failed. Please log in again.',
    };

    const type = this._categorizeError(error);
    return messages[type] || 'An error occurred. Please try again.';
  }

  /**
   * Get error title for display
   * @private
   * @param {string} type - Error type
   * @returns {string} Display title
   */
  _getErrorTitle(type) {
    const titles = {
      'VALIDATION_ERROR': 'Validation Error',
      'NETWORK_ERROR': 'Connection Error',
      'TIMEOUT_ERROR': 'Request Timeout',
      'SERVER_ERROR': 'Server Error',
      'CLIENT_ERROR': 'Request Error',
      'AUTH_ERROR': 'Authentication Error',
    };

    return titles[type] || 'Error';
  }

  /**
   * Get retry delay for status code
   * @private
   * @param {number} status - HTTP status code
   * @returns {number} Delay in ms
   */
  _getRetryDelay(status) {
    if (status === 429) return 5000; // Rate limit - longer delay
    if (status >= 500) return 2000; // Server error - moderate delay
    return 1000; // Default - short delay
  }

  /**
   * Track error frequency
   * @private
   * @param {string} type - Error type
   */
  _trackErrorFrequency(type) {
    const count = this.errorCounts.get(type) || 0;
    this.errorCounts.set(type, Math.min(count + 1, this.maxErrorsPerType));
  }

  /**
   * Get error frequency
   * @private
   * @param {string} type - Error type
   * @returns {number} Frequency count
   */
  _getErrorFrequency(type) {
    return this.errorCounts.get(type) || 0;
  }

  /**
   * Initialize recovery strategies
   * @private
   */
  _initializeRecoveryStrategies() {
    // Retry strategy for retryable errors
    this.registerRecoveryStrategy('SERVER_ERROR', {
      action: 'RETRY',
      handler: async (errorInfo, context) => {
        // Recovery callback would be implemented by caller
        console.log(`Recovery for ${errorInfo.type}: Retry recommended`);
      },
    });

    // Refresh auth for auth errors
    this.registerRecoveryStrategy('AUTH_ERROR', {
      action: 'REFRESH_AUTH',
      handler: async (errorInfo, context) => {
        console.log(`Recovery for ${errorInfo.type}: Authentication refresh needed`);
      },
    });

    // Validation error recovery
    this.registerRecoveryStrategy('VALIDATION_ERROR', {
      action: 'REVIEW_DATA',
      handler: async (errorInfo, context) => {
        console.log(`Recovery for ${errorInfo.type}: Data review needed`);
      },
    });
  }

  /**
   * Register recovery strategy
   * @param {string} errorType - Error type
   * @param {Object} strategy - Strategy { action, handler }
   */
  registerRecoveryStrategy(errorType, strategy) {
    this.errorRecoveryStrategies.set(errorType, strategy);
  }

  /**
   * Get recovery strategy
   * @private
   * @param {string} type - Error type
   * @returns {Object|null} Strategy or null
   */
  _getRecoveryStrategy(type) {
    return this.errorRecoveryStrategies.get(type) || null;
  }
}

/**
 * Global error handler instance
 */
let globalErrorHandler = null;

/**
 * Initialize global error handler
 * @param {Object} options - Configuration options
 * @returns {ErrorHandler} Error handler instance
 */
export function initializeErrorHandler(options = {}) {
  globalErrorHandler = new ErrorHandler(options);
  return globalErrorHandler;
}

/**
 * Get global error handler
 * @returns {ErrorHandler|null} Global error handler or null if not initialized
 */
export function getErrorHandler() {
  return globalErrorHandler;
}
