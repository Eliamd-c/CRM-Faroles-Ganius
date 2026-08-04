/**
 * Error Classes
 *
 * Custom error types for different failure scenarios.
 * Enables better error handling and categorization.
 */

/**
 * Base application error
 */
export class AppError extends Error {
  /**
   * Create an AppError
   * @param {string} message - Error message
   * @param {string} code - Error code (e.g., 'UNKNOWN_ERROR')
   * @param {Object} context - Additional context data
   */
  constructor(message, code = 'UNKNOWN_ERROR', context = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Convert error to plain object
   * @returns {Object}
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * API-specific error with HTTP status
 */
export class ApiError extends Error {
  /**
   * Create an ApiError
   * @param {string} message - Error message
   * @param {number} status - HTTP status code
   * @param {string} code - Error code (e.g., 'NETWORK_ERROR')
   */
  constructor(message, status = 500, code = 'API_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.timestamp = new Date().toISOString();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * Check if error is retryable
   * @returns {boolean}
   */
  isRetryable() {
    // Retry on timeout and server errors, not on client errors
    return this.status >= 500 || this.status === 408 || this.status === 429;
  }

  /**
   * Convert error to plain object
   * @returns {Object}
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      isRetryable: this.isRetryable(),
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Validation error with detailed error list
 */
export class ValidationError extends Error {
  /**
   * Create a ValidationError
   * @param {string} message - Error message
   * @param {Array} errors - Array of detailed validation errors
   */
  constructor(message, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.errors = Array.isArray(errors) ? errors : [];
    this.timestamp = new Date().toISOString();
    this.code = 'VALIDATION_ERROR';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }

  /**
   * Get all error messages as array
   * @returns {string[]}
   */
  getErrorMessages() {
    return this.errors.map(e => e.message || String(e));
  }

  /**
   * Convert error to plain object
   * @returns {Object}
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      errors: this.errors,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}
