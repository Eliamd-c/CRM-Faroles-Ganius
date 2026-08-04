/**
 * Error Handler Unit Tests
 *
 * Tests for ErrorHandler with comprehensive error scenarios.
 * Can be run with: node services/test-error-handler.js
 */

// ─────────────────────────────────────────────
// Mock Logger
// ─────────────────────────────────────────────

class MockLogger {
  constructor() {
    this.logs = [];
  }

  error(message, context) {
    this.logs.push({ level: 'error', message, context });
  }

  warn(message, context) {
    this.logs.push({ level: 'warn', message, context });
  }

  info(message, context) {
    this.logs.push({ level: 'info', message, context });
  }
}

// ─────────────────────────────────────────────
// Mock ApiClient
// ─────────────────────────────────────────────

class MockApiClient {
  constructor() {
    this.reportedErrors = [];
  }

  async reportError(errorInfo) {
    this.reportedErrors.push(errorInfo);
    return { success: true };
  }
}

// ─────────────────────────────────────────────
// ErrorHandler (copy for testing)
// ─────────────────────────────────────────────

class ErrorHandler {
  constructor(options = {}) {
    this.logger = options.logger || null;
    this.apiClient = options.apiClient || null;
    this.onUserError = options.onUserError || null;
    this.debugMode = options.debugMode || false;
    this.errorContext = new Map();
    this.errorRecoveryStrategies = new Map();
    this.errorCounts = new Map();
    this.maxErrorsPerType = 10;

    this._initializeRecoveryStrategies();
  }

  async handle(error, context = {}) {
    const errorId = this._generateErrorId();
    const timestamp = new Date().toISOString();

    const processedError = this._normalizeError(error);

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

    this._trackErrorFrequency(errorInfo.type);

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

    if (this.apiClient) {
      try {
        await this.apiClient.reportError(errorInfo);
      } catch (reportErr) {
        console.error('Error reporting failed:', reportErr.message);
      }
    }

    const recovery = this._getRecoveryStrategy(errorInfo.type);
    if (recovery) {
      errorInfo.recoveryAction = recovery.action;
      try {
        await recovery.handler(errorInfo, context);
      } catch (recoveryErr) {
        console.error('Error recovery failed:', recoveryErr.message);
      }
    }

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

    this.errorContext.set(errorId, errorInfo);

    return errorInfo;
  }

  async handleApiError(apiError, operation) {
    const status = apiError.status || 0;
    const context = {
      operation,
      component: 'ApiClient',
      httpStatus: status,
    };

    if (apiError.isRetryable && apiError.isRetryable()) {
      context.retryable = true;
      context.retryDelay = this._getRetryDelay(status);
    }

    return this.handle(apiError, context);
  }

  getError(errorId) {
    return this.errorContext.get(errorId) || null;
  }

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

  clearErrors() {
    this.errorContext.clear();
    this.errorCounts.clear();
  }

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

  _sanitizeContext(context) {
    const sanitized = { ...context };

    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'apiKey'];
    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        delete sanitized[key];
      }
    }

    const contextStr = JSON.stringify(sanitized);
    if (contextStr.length > 1000) {
      sanitized.note = 'Context truncated due to size';
      return { operation: context.operation, note: 'Context truncated' };
    }

    return sanitized;
  }

  _generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _isRetryable(error) {
    if (error.isRetryable && typeof error.isRetryable === 'function') {
      return error.isRetryable();
    }

    const status = error.status || 0;
    return status >= 500 || status === 408 || status === 429;
  }

  _getUserMessage(error, context) {
    const messages = {
      'VALIDATION_ERROR': 'Please check your input and try again.',
      'NETWORK_ERROR': 'Network connection error. Please check your connection.',
      'TIMEOUT_ERROR': 'Request took too long. Please try again.',
      'SERVER_ERROR': 'Server error occurred. Please try again later.',
      'CLIENT_ERROR': 'Request error. Please check your data.',
      'AUTH_ERROR': 'Authentication failed. Please log in again.',
    };

    const type = this._categorizeError(error);
    return messages[type] || 'An error occurred. Please try again.';
  }

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

  _getRetryDelay(status) {
    if (status === 429) return 5000;
    if (status >= 500) return 2000;
    return 1000;
  }

  _trackErrorFrequency(type) {
    const count = this.errorCounts.get(type) || 0;
    this.errorCounts.set(type, Math.min(count + 1, this.maxErrorsPerType));
  }

  _getErrorFrequency(type) {
    return this.errorCounts.get(type) || 0;
  }

  _initializeRecoveryStrategies() {
    this.registerRecoveryStrategy('SERVER_ERROR', {
      action: 'RETRY',
      handler: async (errorInfo, context) => {
        // Recovery
      },
    });

    this.registerRecoveryStrategy('AUTH_ERROR', {
      action: 'REFRESH_AUTH',
      handler: async (errorInfo, context) => {
        // Recovery
      },
    });

    this.registerRecoveryStrategy('VALIDATION_ERROR', {
      action: 'REVIEW_DATA',
      handler: async (errorInfo, context) => {
        // Recovery
      },
    });
  }

  registerRecoveryStrategy(errorType, strategy) {
    this.errorRecoveryStrategies.set(errorType, strategy);
  }

  _getRecoveryStrategy(type) {
    return this.errorRecoveryStrategies.get(type) || null;
  }
}

// ─────────────────────────────────────────────
// Test Runner
// ─────────────────────────────────────────────

let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`✓ Test ${testCount}: ${name}`);
  } catch (err) {
    failCount++;
    console.error(`✗ Test ${testCount}: ${name}`);
    console.error(`  Error: ${err.message}`);
  }
}

function assertEquals(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'Assertion'}: expected ${expected}, got ${actual}`);
  }
}

function assertNotNull(val, msg) {
  if (val === null || val === undefined) {
    throw new Error(msg || 'Value should not be null');
  }
}

function assertTrue(val, msg) {
  if (val !== true) {
    throw new Error(msg || 'Value should be true');
  }
}

async function asyncTest(name, fn) {
  testCount++;
  try {
    await fn();
    passCount++;
    console.log(`✓ Test ${testCount}: ${name}`);
  } catch (err) {
    failCount++;
    console.error(`✗ Test ${testCount}: ${name}`);
    console.error(`  Error: ${err.message}`);
  }
}

// ─────────────────────────────────────────────
// Test Cases
// ─────────────────────────────────────────────

async function runTests() {
  console.log('\n=== Error Handler Tests ===\n');

  // Test 1: Initialize error handler
  test('ErrorHandler initializes with options', () => {
    const logger = new MockLogger();
    const handler = new ErrorHandler({ logger });

    assertNotNull(handler, 'Handler should be created');
    assertEquals(handler.logger, logger, 'Logger should be set');
  });

  // Test 2: Handle error and log it
  await asyncTest('handle() processes error and logs it', async () => {
    const logger = new MockLogger();
    const handler = new ErrorHandler({ logger });

    const error = new Error('Test error');
    const errorInfo = await handler.handle(error, { operation: 'test' });

    assertEquals(logger.logs.length, 1, 'Should log error');
    assertEquals(logger.logs[0].level, 'error', 'Should be error level');
  });

  // Test 3: Error categorization
  await asyncTest('Error categorization works correctly', async () => {
    const handler = new ErrorHandler();

    const stringError = new Error('Network error');
    stringError.message = 'Failed to fetch';
    const errorInfo = await handler.handle(stringError);

    assertEquals(errorInfo.type, 'NETWORK_ERROR', 'Should categorize as network error');
  });

  // Test 4: Normalize different error types
  test('_normalizeError handles strings and objects', () => {
    const handler = new ErrorHandler();

    const strErr = handler._normalizeError('Test string');
    assertEquals(strErr instanceof Error, true, 'String should become Error');

    const objErr = handler._normalizeError({ message: 'Test' });
    assertEquals(objErr instanceof Error, true, 'Object should become Error');
  });

  // Test 5: Sanitize context removes sensitive data
  test('_sanitizeContext removes sensitive keys', () => {
    const handler = new ErrorHandler();

    const context = {
      operation: 'save',
      token: 'secret123',
      apiKey: 'key456',
      other: 'value',
    };

    const sanitized = handler._sanitizeContext(context);

    assertEquals('token' in sanitized, false, 'Token should be removed');
    assertEquals('apiKey' in sanitized, false, 'ApiKey should be removed');
    assertEquals(sanitized.operation, 'save', 'Other data should remain');
  });

  // Test 6: Error tracking with frequency
  await asyncTest('Error frequency tracking works', async () => {
    const handler = new ErrorHandler();

    await handler.handle(new Error('Error 1'));
    await handler.handle(new Error('Error 2'));
    await handler.handle(new Error('Error 3'));

    const stats = handler.getErrorStats();
    assertEquals(stats.totalErrors, 3, 'Should track 3 errors');
  });

  // Test 7: User error callback
  await asyncTest('onUserError callback is invoked', async () => {
    let callbackCalled = false;
    let callbackData = null;

    const handler = new ErrorHandler({
      onUserError: (data) => {
        callbackCalled = true;
        callbackData = data;
      },
    });

    await handler.handle(new Error('Test'));

    assertEquals(callbackCalled, true, 'Callback should be called');
    assertNotNull(callbackData.message, 'Should have user message');
  });

  // Test 8: API client error reporting
  await asyncTest('ApiClient.reportError is called', async () => {
    const apiClient = new MockApiClient();
    const handler = new ErrorHandler({ apiClient });

    await handler.handle(new Error('Test error'), { operation: 'save' });

    assertEquals(apiClient.reportedErrors.length, 1, 'Should report error');
    assertEquals(apiClient.reportedErrors[0].message, 'Test error', 'Should have error message');
  });

  // Test 9: Recovery strategy for server errors
  await asyncTest('Recovery strategy is assigned for server error', async () => {
    const handler = new ErrorHandler();

    const error = new Error('Server error');
    error.name = 'ApiError';
    error.status = 500;

    const errorInfo = await handler.handle(error);

    assertEquals(errorInfo.recoveryAction, 'RETRY', 'Should have RETRY recovery action');
  });

  // Test 10: Retryable error detection
  test('_isRetryable identifies retryable errors', () => {
    const handler = new ErrorHandler();

    const serverError = new Error('Server error');
    serverError.status = 500;
    assertEquals(handler._isRetryable(serverError), true, '500 should be retryable');

    const notFoundError = new Error('Not found');
    notFoundError.status = 404;
    assertEquals(handler._isRetryable(notFoundError), false, '404 should not be retryable');
  });

  // Test 11: Error context retrieval
  await asyncTest('getError retrieves error by ID', async () => {
    const handler = new ErrorHandler();

    const errorInfo = await handler.handle(new Error('Test'));
    const retrieved = handler.getError(errorInfo.id);

    assertNotNull(retrieved, 'Should retrieve error');
    assertEquals(retrieved.message, 'Test', 'Should have same message');
  });

  // Test 12: Clear errors
  await asyncTest('clearErrors resets error tracking', async () => {
    const handler = new ErrorHandler();

    await handler.handle(new Error('Error 1'));
    await handler.handle(new Error('Error 2'));

    handler.clearErrors();

    const stats = handler.getErrorStats();
    assertEquals(stats.totalErrors, 0, 'Should have no errors after clear');
  });

  console.log(`\n=== Test Summary ===`);
  console.log(`Total: ${testCount}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Success Rate: ${((passCount / testCount) * 100).toFixed(1)}%\n`);

  process.exit(failCount > 0 ? 1 : 0);
}

// Run tests
runTests().catch(err => {
  console.error('Test runner error:', err.message);
  process.exit(1);
});
