/**
 * API Client Unit Tests
 *
 * Tests ApiClient with mocked fetch.
 * Can be run with: node adapters/test-api.js
 */

// ─────────────────────────────────────────────
// Error Classes (copy for testing)
// ─────────────────────────────────────────────

class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', context = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.context = context;
  }
}

class ApiError extends Error {
  constructor(message, status = 500, code = 'API_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  isRetryable() {
    return this.status >= 500 || this.status === 408 || this.status === 429;
  }
}

// ─────────────────────────────────────────────
// API Client (copy for testing)
// ─────────────────────────────────────────────

class ApiResponse {
  constructor(status, data, headers = {}) {
    this.ok = status >= 200 && status < 300;
    this.status = status;
    this.data = data;
    this.headers = headers;
  }
}

class ApiClient {
  constructor(authToken, options = {}) {
    if (!authToken || typeof authToken !== 'string') {
      throw new Error('ApiClient: authToken must be a non-empty string');
    }

    this.authToken = authToken;
    this.timeout = options.timeout || 5000;
    this.maxRetries = options.maxRetries || 3;
    this.fetchFn = options.fetchFn || null;
    this.onError = options.onError || null;

    if (!this.fetchFn) {
      throw new Error('ApiClient: fetch function not available');
    }
  }

  async saveFlow(flowData) {
    if (!flowData || typeof flowData !== 'object') {
      throw new Error('ApiClient.saveFlow: flowData must be an object');
    }

    try {
      const response = await this._fetch('POST', '/api/flows', flowData);
      return response.data;
    } catch (err) {
      throw this._handleError(err, 'saveFlow');
    }
  }

  async loadFlow(flowId) {
    if (!flowId || typeof flowId !== 'string') {
      throw new Error('ApiClient.loadFlow: flowId must be a non-empty string');
    }

    try {
      const response = await this._fetch('GET', `/api/flows/${flowId}`);
      return response.data;
    } catch (err) {
      throw this._handleError(err, 'loadFlow');
    }
  }

  async publishFlow(flowId) {
    if (!flowId || typeof flowId !== 'string') {
      throw new Error('ApiClient.publishFlow: flowId must be a non-empty string');
    }

    try {
      const response = await this._fetch('POST', `/api/flows/${flowId}/publish`);
      return response.data;
    } catch (err) {
      throw this._handleError(err, 'publishFlow');
    }
  }

  async deleteFlow(flowId) {
    if (!flowId || typeof flowId !== 'string') {
      throw new Error('ApiClient.deleteFlow: flowId must be a non-empty string');
    }

    try {
      const response = await this._fetch('DELETE', `/api/flows/${flowId}`);
      return response.ok;
    } catch (err) {
      throw this._handleError(err, 'deleteFlow');
    }
  }

  async listFlows() {
    try {
      const response = await this._fetch('GET', '/api/flows');
      return response.data || [];
    } catch (err) {
      throw this._handleError(err, 'listFlows');
    }
  }

  async generateFlowFromAI(prompt) {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('ApiClient.generateFlowFromAI: prompt must be a non-empty string');
    }

    try {
      const response = await this._fetch('POST', '/api/ai/generate-flow', { prompt });
      return response.data;
    } catch (err) {
      throw this._handleError(err, 'generateFlowFromAI');
    }
  }

  async validateFlow(flowData) {
    if (!flowData || typeof flowData !== 'object') {
      throw new Error('ApiClient.validateFlow: flowData must be an object');
    }

    try {
      const response = await this._fetch('POST', '/api/flows/validate', flowData);
      return response.data || { valid: true, errors: [] };
    } catch (err) {
      throw this._handleError(err, 'validateFlow');
    }
  }

  async _fetch(method, endpoint, body = null) {
    if (!method || typeof method !== 'string') {
      throw new Error('_fetch: method must be a non-empty string');
    }
    if (!endpoint || typeof endpoint !== 'string') {
      throw new Error('_fetch: endpoint must be a non-empty string');
    }

    let lastError = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this._fetchWithTimeout(method, endpoint, body);

        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
          error.status = response.status;
          error.retryable = response.status >= 500 || response.status === 408 || response.status === 429;

          if (!error.retryable || attempt === this.maxRetries - 1) {
            throw error;
          }

          const delay = Math.pow(2, attempt) * 100; // 100ms for testing
          await this._sleep(delay);
          lastError = error;
          continue;
        }

        let data;
        try {
          data = await response.json();
        } catch (e) {
          data = null;
        }

        return new ApiResponse(response.status, data, response.headers);
      } catch (err) {
        lastError = err;

        const isNetworkError = err.message.includes('Network error') || err.message.includes('timeout');
        const shouldRetry = (err.retryable || isNetworkError) && attempt < this.maxRetries - 1;

        if (shouldRetry) {
          const delay = Math.pow(2, attempt) * 100;
          await this._sleep(delay);
          continue;
        }

        throw err;
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  async _fetchWithTimeout(method, endpoint, body = null) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        signal: controller.signal,
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await this.fetchFn(endpoint, options);
      return response;
    } catch (err) {
      if (err.name === 'AbortError') {
        const timeoutError = new Error(`Request timeout`);
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _handleError(err, method) {
    const context = { method, timestamp: new Date().toISOString() };

    if (this.onError && typeof this.onError === 'function') {
      try {
        this.onError(err, context);
      } catch (callbackErr) {
        // Ignore callback errors
      }
    }

    return err;
  }
}

// ─────────────────────────────────────────────
// Mock Fetch Implementation
// ─────────────────────────────────────────────

class MockResponse {
  constructor(status, data, statusText = 'OK') {
    this.ok = status >= 200 && status < 300;
    this.status = status;
    this.statusText = statusText;
    this.data = data;
    this.headers = new Map();
  }

  json() {
    if (this.data instanceof Error) {
      return Promise.reject(this.data);
    }
    return Promise.resolve(this.data);
  }
}

function createMockFetch(responses = {}) {
  let callCount = 0;

  return async (url, options = {}) => {
    callCount++;
    const key = `${options.method || 'GET'} ${url}`;

    if (responses[key]) {
      const response = responses[key];
      if (typeof response === 'function') {
        return response(callCount, options);
      }
      if (response instanceof Error) {
        throw response;
      }
      return response;
    }

    // Default success response
    return new MockResponse(200, { success: true });
  };
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

function assertThrows(fn, msg) {
  try {
    fn();
    throw new Error(msg || 'Should have thrown');
  } catch (err) {
    if (msg && !err.message.includes(msg)) {
      throw new Error(`Expected "${msg}", got: ${err.message}`);
    }
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
  console.log('\n=== API Client Tests ===\n');

  // Test 1: Constructor validates token
  test('ApiClient constructor requires authToken', () => {
    assertThrows(
      () => new ApiClient(null, {}),
      'authToken must be'
    );
  });

  // Test 2: Constructor requires fetch
  test('ApiClient constructor requires fetchFn', () => {
    assertThrows(
      () => new ApiClient('token123', {}),
      'fetch function'
    );
  });

  // Test 3: saveFlow sends POST request
  await asyncTest('saveFlow sends POST request with flow data', async () => {
    const mockFetch = createMockFetch({
      'POST /api/flows': new MockResponse(200, { id: 'flow1', name: 'Test' })
    });

    const client = new ApiClient('token123', { fetchFn: mockFetch });
    const result = await client.saveFlow({ name: 'Test' });

    assertEquals(result.id, 'flow1', 'Should return flow ID');
    assertEquals(result.name, 'Test', 'Should return flow name');
  });

  // Test 4: loadFlow sends GET request
  await asyncTest('loadFlow retrieves flow by ID', async () => {
    const mockFetch = createMockFetch({
      'GET /api/flows/flow123': new MockResponse(200, { id: 'flow123', name: 'Test Flow' })
    });

    const client = new ApiClient('token123', { fetchFn: mockFetch });
    const result = await client.loadFlow('flow123');

    assertEquals(result.id, 'flow123', 'Should return flow ID');
  });

  // Test 5: listFlows returns array
  await asyncTest('listFlows returns array of flows', async () => {
    const mockFetch = createMockFetch({
      'GET /api/flows': new MockResponse(200, [
        { id: '1', name: 'Flow 1' },
        { id: '2', name: 'Flow 2' }
      ])
    });

    const client = new ApiClient('token123', { fetchFn: mockFetch });
    const flows = await client.listFlows();

    assertEquals(Array.isArray(flows), true, 'Should return array');
    assertEquals(flows.length, 2, 'Should have 2 flows');
  });

  // Test 6: publishFlow sends POST
  await asyncTest('publishFlow publishes flow by ID', async () => {
    const mockFetch = createMockFetch({
      'POST /api/flows/flow123/publish': new MockResponse(200, { status: 'published' })
    });

    const client = new ApiClient('token123', { fetchFn: mockFetch });
    const result = await client.publishFlow('flow123');

    assertEquals(result.status, 'published', 'Should return published status');
  });

  // Test 7: deleteFlow validates ID
  await asyncTest('deleteFlow requires flowId', async () => {
    const mockFetch = createMockFetch({});
    const client = new ApiClient('token123', { fetchFn: mockFetch });

    try {
      await client.deleteFlow(null);
      throw new Error('Should have thrown');
    } catch (err) {
      assertEquals(err.message.includes('flowId must be'), true, 'Should have error message');
    }
  });

  // Test 8: validateFlow checks flow structure
  await asyncTest('validateFlow returns validation result', async () => {
    const mockFetch = createMockFetch({
      'POST /api/flows/validate': new MockResponse(200, { valid: true, errors: [] })
    });

    const client = new ApiClient('token123', { fetchFn: mockFetch });
    const result = await client.validateFlow({ nodes: [] });

    assertEquals(result.valid, true, 'Should be valid');
    assertEquals(Array.isArray(result.errors), true, 'Should have errors array');
  });

  // Test 9: generateFlowFromAI sends prompt
  await asyncTest('generateFlowFromAI generates flow from prompt', async () => {
    const mockFetch = createMockFetch({
      'POST /api/ai/generate-flow': new MockResponse(200, { id: 'ai-flow', nodes: [] })
    });

    const client = new ApiClient('token123', { fetchFn: mockFetch });
    const result = await client.generateFlowFromAI('Create a contact flow');

    assertNotNull(result.id, 'Should return flow ID');
  });

  // Test 10: Retry logic on 500 error
  await asyncTest('Retry logic retries on server error (500)', async () => {
    let attempts = 0;
    const mockFetch = async (url, options) => {
      attempts++;
      if (attempts < 3) {
        return new MockResponse(500, { error: 'Server error' }, 'Internal Server Error');
      }
      return new MockResponse(200, { id: 'flow1' });
    };

    const client = new ApiClient('token123', { fetchFn: mockFetch, timeout: 100 });
    const result = await client.saveFlow({ name: 'Test' });

    assertEquals(attempts, 3, 'Should retry 3 times');
    assertEquals(result.id, 'flow1', 'Should succeed on retry');
  });

  // Test 11: No retry on 404 error
  await asyncTest('No retry on client error (404)', async () => {
    let attempts = 0;
    const mockFetch = async (url, options) => {
      attempts++;
      return new MockResponse(404, { error: 'Not found' }, 'Not Found');
    };

    const client = new ApiClient('token123', { fetchFn: mockFetch, timeout: 100 });

    try {
      await client.loadFlow('nonexistent');
      throw new Error('Should have thrown');
    } catch (err) {
      assertEquals(attempts, 1, 'Should not retry on 404');
    }
  });

  // Test 12: Error callback is called
  await asyncTest('Error callback is invoked on error', async () => {
    let errorCalled = false;
    let errorContext = null;

    const mockFetch = createMockFetch({
      'GET /api/flows/test': new MockResponse(500, { error: 'Server error' }, 'Server Error')
    });

    const client = new ApiClient('token123', {
      fetchFn: mockFetch,
      onError: (err, ctx) => {
        errorCalled = true;
        errorContext = ctx;
      }
    });

    try {
      await client.loadFlow('test');
    } catch (err) {
      // Expected error
    }

    assertEquals(errorCalled, true, 'Error callback should be called');
    assertEquals(errorContext.method, 'loadFlow', 'Context should have method');
  });

  // Test 13: Authorization header is sent
  await asyncTest('Authorization header includes token', async () => {
    let sentHeaders = null;

    const mockFetch = async (url, options) => {
      sentHeaders = options.headers;
      return new MockResponse(200, { id: '1' });
    };

    const client = new ApiClient('mytoken123', { fetchFn: mockFetch });
    await client.listFlows();

    assertEquals(sentHeaders['Authorization'], 'Bearer mytoken123', 'Should send auth header');
  });

  // Test 14: Request timeout handling
  await asyncTest('Request timeout is handled', async () => {
    const mockFetch = async (url, options) => {
      // Simulate timeout by abort signal
      await new Promise((_, reject) => {
        const abortHandler = () => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        };
        options.signal.addEventListener('abort', abortHandler);
      });
    };

    const client = new ApiClient('token123', { fetchFn: mockFetch, timeout: 100 });

    try {
      await client.listFlows();
    } catch (err) {
      assertEquals(err.name, 'TimeoutError', 'Should throw timeout error');
    }
  });

  // Print summary
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
