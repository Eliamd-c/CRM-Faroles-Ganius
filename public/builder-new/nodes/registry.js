/**
 * Node Registry
 *
 * Centralized registry for all node types.
 * Maps node types to their implementations and metadata.
 */

import { TriggerNodeConfig } from './nodes/trigger.js';
import { MessageNodeConfig } from './nodes/message.js';
import { ActionNodeConfig } from './nodes/action.js';
import { InputNodeConfig } from './nodes/input.js';
import { ConditionNodeConfig } from './nodes/condition.js';
import { RandomizerNodeConfig } from './nodes/randomizer.js';
import { CarouselNodeConfig } from './nodes/carousel.js';
import { GalleryNodeConfig } from './nodes/gallery.js';
import { AudioNodeConfig } from './nodes/audio.js';
import { VideoNodeConfig } from './nodes/video.js';
import { FileNodeConfig } from './nodes/file.js';
import { DelayNodeConfig } from './nodes/delay.js';
import { GotoNodeConfig } from './nodes/goto.js';
import { AiAgentNodeConfig } from './nodes/ai-agent.js';

/**
 * Node Registry - Maps node types to configurations
 */
class NodeRegistry {
  constructor() {
    this.nodes = new Map();
    this.nodeTypes = [];
    this._initializeRegistry();
  }

  /**
   * Register a node type
   * @param {string} type - Node type identifier
   * @param {Object} config - Node configuration
   * @param {string} config.label - Display label
   * @param {string} config.icon - Icon emoji
   * @param {number} config.inputs - Number of inputs
   * @param {number} config.outputs - Number of outputs
   * @param {string} config.html - HTML template
   * @param {Function} config.render - Render function
   * @param {Function} config.inspector - Inspector function
   */
  register(type, config) {
    if (!type || !config) {
      throw new Error('NodeRegistry: type and config are required');
    }

    this.nodes.set(type, {
      type,
      label: config.label || type,
      icon: config.icon || '◻️',
      inputs: config.inputs || 1,
      outputs: config.outputs || 1,
      html: config.html || '',
      render: config.render || (() => ''),
      inspector: config.inspector || null,
      ...config,
    });

    this.nodeTypes.push(type);
  }

  /**
   * Get node configuration by type
   * @param {string} type - Node type
   * @returns {Object|null} Node configuration or null
   */
  get(type) {
    return this.nodes.get(type) || null;
  }

  /**
   * Get all registered node types
   * @returns {string[]} Array of node types
   */
  getTypes() {
    return [...this.nodeTypes];
  }

  /**
   * Get all nodes
   * @returns {Map} All registered nodes
   */
  getAll() {
    return new Map(this.nodes);
  }

  /**
   * Check if node type exists
   * @param {string} type - Node type
   * @returns {boolean}
   */
  exists(type) {
    return this.nodes.has(type);
  }

  /**
   * Get HTML template for node type
   * @param {string} type - Node type
   * @returns {string} HTML template
   */
  getHTML(type) {
    const config = this.get(type);
    return config ? config.html : '';
  }

  /**
   * Render node preview
   * @param {string} type - Node type
   * @param {string} nodeId - Node ID
   * @param {Object} nodeData - Node data
   * @returns {string} HTML preview
   */
  renderPreview(type, nodeId, nodeData) {
    const config = this.get(type);
    if (!config || !config.render) {
      return '<div style="padding:12px; text-align:center; color:#9ca3af;">Nodo no configurado</div>';
    }

    try {
      return config.render(nodeId, nodeData);
    } catch (err) {
      console.error(`Error rendering ${type} preview:`, err.message);
      return '<div style="padding:12px; text-align:center; color:#ef4444;">Error al renderizar</div>';
    }
  }

  /**
   * Get inspector configuration for node
   * @param {string} type - Node type
   * @param {string} nodeId - Node ID
   * @param {Object} nodeData - Node data
   * @returns {Object} Inspector configuration { title, html }
   */
  getInspector(type, nodeId, nodeData) {
    const config = this.get(type);
    if (!config || !config.inspector) {
      return {
        title: config?.label || 'Nodo',
        html: '<p style="color:var(--text-muted); font-size:13px;">No hay configuraciones extra para este nodo.</p>'
      };
    }

    try {
      return config.inspector(nodeId, nodeData);
    } catch (err) {
      console.error(`Error getting ${type} inspector:`, err.message);
      return {
        title: config.label || 'Nodo',
        html: '<div style="color:#ef4444;">Error al cargar configuración</div>'
      };
    }
  }

  /**
   * Initialize registry with default nodes
   * @private
   */
  _initializeRegistry() {
    // Register trigger node
    this.register('trigger', TriggerNodeConfig);

    // Register message node
    this.register('message', MessageNodeConfig);

    // Register action node
    this.register('action', ActionNodeConfig);

    // Register input node
    this.register('input', InputNodeConfig);

    // Register condition node
    this.register('condition', ConditionNodeConfig);

    // Register randomizer node
    this.register('randomizer', RandomizerNodeConfig);

    // Register carousel node
    this.register('carousel', CarouselNodeConfig);

    // Register gallery node
    this.register('gallery', GalleryNodeConfig);

    // Register audio node
    this.register('audio', AudioNodeConfig);

    // Register video node
    this.register('video', VideoNodeConfig);

    // Register file node
    this.register('file', FileNodeConfig);

    // Register delay node
    this.register('delay', DelayNodeConfig);

    // Register goto node
    this.register('goto', GotoNodeConfig);

    // Register AI agent node
    this.register('ai_agent', AiAgentNodeConfig);
  }
}

// Singleton instance
let registryInstance = null;

/**
 * Get or create node registry
 * @returns {NodeRegistry} Node registry instance
 */
export function getNodeRegistry() {
  if (!registryInstance) {
    registryInstance = new NodeRegistry();
  }
  return registryInstance;
}

export default getNodeRegistry();
