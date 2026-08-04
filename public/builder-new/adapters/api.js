/**
 * API Client
 *
 * Handles all HTTP communication with backend.
 * Implements error handling, retries, timeouts, and exponential backoff.
 */

/**
 * API response wrapper
 */
class ApiResponse {
  constructor(status, data, headers = {}) {
    this.ok = status >= 200 && status < 300;
    this.status = status;
    this.data = data;
    this.headers = headers;
  }
}

/**
 * API Client - Centralized HTTP communication
 */
export class ApiClient {
  /**
   * Initialize API client
   * @param {string} authToken - Authentication token
   * @param {Object} options - Configuration options
   * @param {number} options.timeout - Request timeout in ms (default 5000)
   * @param {number} options.maxRetries - Max retry attempts (default 3)
   * @param {Function} options.fetchFn - Fetch function (for dependency injection)
   * @param {Function} options.onError - Error callback
   */
  constructor(authToken, options = {}) {
    if (!authToken || typeof authToken !== 'string') {
      throw new Error('ApiClient: authToken must be a non-empty string');
    }

    this.authToken = authToken;
    this.timeout = options.timeout || 5000;
    this.maxRetries = options.maxRetries || 3;
    this.fetchFn = options.fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
    this.onError = options.onError || null;

    if (!this.fetchFn) {
      throw new Error('ApiClient: fetch function not available');
    }
  }

  /**
   * Save flow data to backend
   * @param {Object} flowData - Flow data to save
   * @returns {Promise<Object>} Saved flow with ID
   * @throws {ApiError}
   */
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

  /**
   * Load flow by ID
   * @param {string} flowId - Flow ID to load
   * @returns {Promise<Object>} Flow data
   * @throws {ApiError}
   */
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

  /**
   * Publish a flow
   * @param {string} flowId - Flow ID to publish
   * @returns {Promise<Object>} Publish result
   * @throws {ApiError}
   */
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

  /**
   * Delete a flow
   * @param {string} flowId - Flow ID to delete
   * @returns {Promise<boolean>} Success status
   * @throws {ApiError}
   */
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

  /**
   * List all flows
   * @returns {Promise<Array>} Array of flows
   * @throws {ApiError}
   */
  async listFlows() {
    try {
      const response = await this._fetch('GET', '/api/flows');
      return response.data || [];
    } catch (err) {
      throw this._handleError(err, 'listFlows');
    }
  }

  /**
   * Generate flow from AI prompt
   * @param {string} prompt - AI prompt
   * @returns {Promise<Object>} Generated flow
   * @throws {ApiError}
   */
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

  /**
   * Validate flow structure
   * @param {Object} flowData - Flow to validate
   * @returns {Promise<Object>} Validation result { valid, errors }
   * @throws {ApiError}
   */
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

  /**
   * Fetch with retry logic and timeout
   * @private
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} body - Request body (optional)
   * @returns {Promise<ApiResponse>}
   */
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

        // Check response status
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
          error.status = response.status;
          error.retryable = response.status >= 500 || response.status === 408 || response.status === 429;

          if (!error.retryable || attempt === this.maxRetries - 1) {
            throw error;
          }

          // Wait before retry with exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await this._sleep(delay);
          lastError = error;
          continue;
        }

        // Parse response
        let data;
        try {
          data = await response.json();
        } catch (e) {
          data = null;
        }

        return new ApiResponse(response.status, data, response.headers);
      } catch (err) {
        lastError = err;

        // Check if error is retryable (network error, timeout, server error)
        const isNetworkError = err.message.includes('Failed to fetch') || err.message.includes('timeout');
        const shouldRetry = (err.retryable || isNetworkError) && attempt < this.maxRetries - 1;

        if (shouldRetry) {
          const delay = Math.pow(2, attempt) * 1000;
          await this._sleep(delay);
          continue;
        }

        throw err;
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Fetch with timeout
   * @private
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} body - Request body
   * @returns {Promise<Response>}
   */
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
        const timeoutError = new Error(`Request timeout after ${this.timeout}ms`);
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Sleep for specified milliseconds
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle and transform errors
   * @private
   * @param {Error} err - Error to handle
   * @param {string} method - Method name for context
   * @returns {Error} Transformed error
   */
  _handleError(err, method) {
    const context = { method, timestamp: new Date().toISOString() };

    // Call error callback if provided
    if (this.onError && typeof this.onError === 'function') {
      try {
        this.onError(err, context);
      } catch (callbackErr) {
        console.error('ApiClient error callback failed:', callbackErr.message);
      }
    }

    return err;
  }
}
