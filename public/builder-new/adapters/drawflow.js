/**
 * Drawflow Adapter
 *
 * Wraps Drawflow library API with error handling and type validation.
 * Provides clean abstraction over direct editor access.
 * All public methods handle errors gracefully.
 */

/**
 * DrawflowAdapter - Encapsulates all Drawflow library interactions
 */
export class DrawflowAdapter {
  /**
   * Initialize the Drawflow adapter
   * @param {string} containerId - HTML element ID containing the Drawflow canvas
   * @param {Object} DrawflowClass - Drawflow library class (for dependency injection in tests)
   * @throws {Error} If container not found or Drawflow not available
   */
  constructor(containerId, DrawflowClass = null) {
    if (!containerId || typeof containerId !== 'string') {
      throw new Error('DrawflowAdapter: containerId must be a non-empty string');
    }

    // In tests, allow injecting a mock Drawflow class
    if (DrawflowClass) {
      this._drawflowClass = DrawflowClass;
    } else if (typeof Drawflow !== 'undefined') {
      this._drawflowClass = Drawflow;
    } else {
      throw new Error('DrawflowAdapter: Drawflow library not found in global scope');
    }

    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`DrawflowAdapter: Container with ID "${containerId}" not found`);
    }

    this.containerId = containerId;
    this.container = container;
    this.editor = null;
    this.eventListeners = new Map(); // Track listeners for cleanup

    try {
      this.editor = new this._drawflowClass(container);
      this.editor.reroute = true;
      this.editor.curvature = 0.5;
      this.editor.start();
    } catch (err) {
      throw new Error(`DrawflowAdapter: Failed to initialize Drawflow: ${err.message}`);
    }
  }

  /**
   * Validate that editor is initialized
   * @private
   * @throws {Error} If editor is not initialized
   */
  _ensureInitialized() {
    if (!this.editor) {
      throw new Error('DrawflowAdapter: Editor not initialized');
    }
  }

  /**
   * Add a node to the canvas
   * @param {string} nodeId - Unique node identifier
   * @param {string} nodeType - Node type (trigger, message, action, etc)
   * @param {Object} position - Node position {x, y}
   * @param {Object} data - Node configuration data
   * @param {string} html - Node HTML template (optional)
   * @returns {string} Node ID
   * @throws {Error} If parameters invalid or operation fails
   */
  addNode(nodeId, nodeType, position, data = {}, html = null) {
    this._ensureInitialized();

    if (!nodeId || typeof nodeId !== 'string') {
      throw new Error('DrawflowAdapter.addNode: nodeId must be a non-empty string');
    }
    if (!nodeType || typeof nodeType !== 'string') {
      throw new Error('DrawflowAdapter.addNode: nodeType must be a non-empty string');
    }
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
      throw new Error('DrawflowAdapter.addNode: position must be {x: number, y: number}');
    }
    if (typeof data !== 'object' || data === null) {
      throw new Error('DrawflowAdapter.addNode: data must be an object');
    }

    try {
      // Check if node already exists
      if (this.editor.getNodeFromId(nodeId)) {
        throw new Error(`Node with ID "${nodeId}" already exists`);
      }

      // Default template if not provided
      const template = html || `<div class="drawflow-node"><strong>${nodeType}</strong></div>`;

      // Add node to editor (inputs: 1, outputs: 1 by default)
      const addedNodeId = this.editor.addNode(
        nodeType,
        1,
        1,
        position.x,
        position.y,
        nodeType,
        data,
        template
      );

      return addedNodeId;
    } catch (err) {
      throw new Error(`DrawflowAdapter.addNode failed: ${err.message}`);
    }
  }

  /**
   * Remove a node from the canvas
   * @param {string} nodeId - Node ID to remove
   * @returns {boolean} True if node was removed
   * @throws {Error} If operation fails
   */
  removeNode(nodeId) {
    this._ensureInitialized();

    if (!nodeId || typeof nodeId !== 'string') {
      throw new Error('DrawflowAdapter.removeNode: nodeId must be a non-empty string');
    }

    try {
      const node = this.editor.getNodeFromId(nodeId);
      if (!node) {
        throw new Error(`Node "${nodeId}" not found`);
      }

      this.editor.removeNodeId(nodeId);
      return true;
    } catch (err) {
      throw new Error(`DrawflowAdapter.removeNode failed: ${err.message}`);
    }
  }

  /**
   * Update node data/properties
   * @param {string} nodeId - Node ID to update
   * @param {Object} data - New data to merge
   * @returns {Object} Updated node
   * @throws {Error} If operation fails
   */
  updateNode(nodeId, data) {
    this._ensureInitialized();

    if (!nodeId || typeof nodeId !== 'string') {
      throw new Error('DrawflowAdapter.updateNode: nodeId must be a non-empty string');
    }
    if (typeof data !== 'object' || data === null) {
      throw new Error('DrawflowAdapter.updateNode: data must be an object');
    }

    try {
      const node = this.editor.getNodeFromId(nodeId);
      if (!node) {
        throw new Error(`Node "${nodeId}" not found`);
      }

      // Merge new data with existing
      node.data = { ...node.data, ...data };

      return node;
    } catch (err) {
      throw new Error(`DrawflowAdapter.updateNode failed: ${err.message}`);
    }
  }

  /**
   * Create a connection between two nodes
   * @param {string} fromId - Source node ID
   * @param {string} fromOutput - Source output port (e.g., 'output_1')
   * @param {string} toId - Target node ID
   * @param {string} toInput - Target input port (e.g., 'input_1')
   * @returns {string} Connection ID
   * @throws {Error} If operation fails
   */
  addConnection(fromId, fromOutput, toId, toInput) {
    this._ensureInitialized();

    if (!fromId || typeof fromId !== 'string') {
      throw new Error('DrawflowAdapter.addConnection: fromId must be a non-empty string');
    }
    if (!fromOutput || typeof fromOutput !== 'string') {
      throw new Error('DrawflowAdapter.addConnection: fromOutput must be a non-empty string');
    }
    if (!toId || typeof toId !== 'string') {
      throw new Error('DrawflowAdapter.addConnection: toId must be a non-empty string');
    }
    if (!toInput || typeof toInput !== 'string') {
      throw new Error('DrawflowAdapter.addConnection: toInput must be a non-empty string');
    }

    try {
      // Validate nodes exist
      if (!this.editor.getNodeFromId(fromId)) {
        throw new Error(`Source node "${fromId}" not found`);
      }
      if (!this.editor.getNodeFromId(toId)) {
        throw new Error(`Target node "${toId}" not found`);
      }

      // Add connection
      this.editor.addConnection(fromId, toId, fromOutput, toInput);

      const connId = `conn_${fromId}_${fromOutput}_to_${toId}_${toInput}`;
      return connId;
    } catch (err) {
      throw new Error(`DrawflowAdapter.addConnection failed: ${err.message}`);
    }
  }

  /**
   * Remove a connection
   * @param {string|Array} connIdOrFromId - Connection ID or source node ID
   * @param {string} toId - Target node ID (if using source node ID)
   * @param {string} fromOutput - Source output port (if using source node ID)
   * @param {string} toInput - Target input port (if using source node ID)
   * @returns {boolean} True if connection was removed
   * @throws {Error} If operation fails
   */
  removeConnection(connIdOrFromId, toId = null, fromOutput = null, toInput = null) {
    this._ensureInitialized();

    try {
      if (toId && fromOutput && toInput) {
        // Called with node IDs and ports
        this.editor.removeSingleConnection(connIdOrFromId, toId, fromOutput, toInput);
      } else {
        // Called with connection ID - need to find and remove it
        throw new Error('removeConnection by connId not directly supported by Drawflow');
      }

      return true;
    } catch (err) {
      throw new Error(`DrawflowAdapter.removeConnection failed: ${err.message}`);
    }
  }

  /**
   * Get a single node
   * @param {string} nodeId - Node ID
   * @returns {Object|null} Node object or null if not found
   * @throws {Error} If operation fails
   */
  getNode(nodeId) {
    this._ensureInitialized();

    if (!nodeId || typeof nodeId !== 'string') {
      throw new Error('DrawflowAdapter.getNode: nodeId must be a non-empty string');
    }

    try {
      const node = this.editor.getNodeFromId(nodeId);
      return node || null;
    } catch (err) {
      throw new Error(`DrawflowAdapter.getNode failed: ${err.message}`);
    }
  }

  /**
   * Get all nodes
   * @returns {Object} All nodes in the flow
   * @throws {Error} If operation fails
   */
  getNodes() {
    this._ensureInitialized();

    try {
      if (this.editor.drawflow && this.editor.drawflow.drawflow && this.editor.drawflow.drawflow.Home) {
        return this.editor.drawflow.drawflow.Home.data || {};
      }
      return {};
    } catch (err) {
      throw new Error(`DrawflowAdapter.getNodes failed: ${err.message}`);
    }
  }

  /**
   * Zoom in on the canvas
   * @returns {number} New zoom level
   * @throws {Error} If operation fails
   */
  zoomIn() {
    this._ensureInitialized();

    try {
      if (this.editor.zoom >= 3) {
        return this.editor.zoom; // Max zoom reached
      }
      this.editor.zoom += 0.1;
      this.editor.setZoom(this.editor.zoom);
      return this.editor.zoom;
    } catch (err) {
      throw new Error(`DrawflowAdapter.zoomIn failed: ${err.message}`);
    }
  }

  /**
   * Zoom out on the canvas
   * @returns {number} New zoom level
   * @throws {Error} If operation fails
   */
  zoomOut() {
    this._ensureInitialized();

    try {
      if (this.editor.zoom <= 0.5) {
        return this.editor.zoom; // Min zoom reached
      }
      this.editor.zoom -= 0.1;
      this.editor.setZoom(this.editor.zoom);
      return this.editor.zoom;
    } catch (err) {
      throw new Error(`DrawflowAdapter.zoomOut failed: ${err.message}`);
    }
  }

  /**
   * Fit all nodes to view
   * @returns {number} Resulting zoom level
   * @throws {Error} If operation fails
   */
  zoomFit() {
    this._ensureInitialized();

    try {
      this.editor.zoom = 1;
      this.editor.setZoom(1);
      return this.editor.zoom;
    } catch (err) {
      throw new Error(`DrawflowAdapter.zoomFit failed: ${err.message}`);
    }
  }

  /**
   * Export flow as JSON
   * @returns {Object} Flow data
   * @throws {Error} If operation fails
   */
  exportFlow() {
    this._ensureInitialized();

    try {
      return this.editor.export();
    } catch (err) {
      throw new Error(`DrawflowAdapter.exportFlow failed: ${err.message}`);
    }
  }

  /**
   * Import flow from JSON
   * @param {Object} flowData - Flow data to import
   * @returns {boolean} True if import successful
   * @throws {Error} If operation fails
   */
  importFlow(flowData) {
    this._ensureInitialized();

    if (typeof flowData !== 'object' || flowData === null) {
      throw new Error('DrawflowAdapter.importFlow: flowData must be an object');
    }

    try {
      this.editor.import(flowData);
      return true;
    } catch (err) {
      throw new Error(`DrawflowAdapter.importFlow failed: ${err.message}`);
    }
  }

  /**
   * Register event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @throws {Error} If operation fails
   */
  on(event, callback) {
    this._ensureInitialized();

    if (!event || typeof event !== 'string') {
      throw new Error('DrawflowAdapter.on: event must be a non-empty string');
    }
    if (typeof callback !== 'function') {
      throw new Error('DrawflowAdapter.on: callback must be a function');
    }

    try {
      this.editor.on(event, callback);

      // Track listener for cleanup
      if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, []);
      }
      this.eventListeners.get(event).push(callback);
    } catch (err) {
      throw new Error(`DrawflowAdapter.on failed: ${err.message}`);
    }
  }

  /**
   * Unregister event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @throws {Error} If operation fails
   */
  off(event, callback) {
    this._ensureInitialized();

    if (!event || typeof event !== 'string') {
      throw new Error('DrawflowAdapter.off: event must be a non-empty string');
    }
    if (typeof callback !== 'function') {
      throw new Error('DrawflowAdapter.off: callback must be a function');
    }

    try {
      this.editor.off(event, callback);

      // Clean up from tracking
      if (this.eventListeners.has(event)) {
        const callbacks = this.eventListeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    } catch (err) {
      throw new Error(`DrawflowAdapter.off failed: ${err.message}`);
    }
  }

  /**
   * Clean up and destroy the adapter
   * @returns {boolean} True if cleanup successful
   */
  destroy() {
    try {
      // Cleanup event listeners
      this.eventListeners.clear();

      // Destroy editor if it has a destroy method
      if (this.editor && typeof this.editor.destroy === 'function') {
        this.editor.destroy();
      }

      this.editor = null;
      this.container = null;

      return true;
    } catch (err) {
      console.error(`DrawflowAdapter.destroy warning: ${err.message}`);
      return false;
    }
  }
}
