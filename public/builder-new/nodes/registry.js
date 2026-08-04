/**
 * Node Registry
 *
 * Centralized registry for all node types.
 * Maps node types to their implementations and metadata.
 */

import { TriggerNodeConfig } from './nodes/trigger.js';

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

    // Register message node (stub - to be implemented)
    this.register('message', {
      type: 'message',
      label: 'Enviar mensaje',
      icon: '💬',
      inputs: 1,
      outputs: 1,
      html: '<div class="mc-node mc-content"><div class="mc-header"><span>💬</span> Send Message</div><div class="box node-blocks-container"></div></div>',
      render: (nodeId, data) => '<div class="nd-placeholder">Mensaje</div>',
    });

    // Register action node (stub)
    this.register('action', {
      type: 'action',
      label: 'Acción',
      icon: '⚡',
      inputs: 1,
      outputs: 1,
      html: '<div class="mc-node mc-action"><div class="mc-header"><span>⚡</span> Action</div><div class="box action-node-preview"><em style="color:#8492a6; font-size:11px;">Sin configurar</em></div></div>',
      render: (nodeId, data) => '<div class="nd-placeholder">Acción</div>',
    });

    // Register input node (stub)
    this.register('input', {
      type: 'input',
      label: 'Entrada del Usuario',
      icon: '📥',
      inputs: 1,
      outputs: 2,
      html: '<div class="mc-node mc-action"><div class="mc-header"><span>📥</span> User Input</div><div class="box input-node-preview"><em style="color:#8492a6; font-size:11px;">Sin configurar</em></div></div>',
      render: (nodeId, data) => '<div class="nd-placeholder">Entrada</div>',
    });

    // Register condition node (stub)
    this.register('condition', {
      type: 'condition',
      label: 'Condición',
      icon: '🔀',
      inputs: 1,
      outputs: 2,
      html: '<div class="mc-node mc-logic"><div class="mc-header"><span>🔀</span> Condition</div><div class="box condition-node-preview"><em style="color:#8492a6; font-size:11px;">Configura en el panel...</em></div></div>',
      render: (nodeId, data) => '<div class="nd-placeholder">Condición</div>',
    });

    // Register randomizer node (stub)
    this.register('randomizer', {
      type: 'randomizer',
      label: 'Aleatorizador',
      icon: '🎲',
      inputs: 1,
      outputs: 2,
      html: '<div class="mc-node mc-logic"><div class="mc-header"><span>🎲</span> Randomizer</div><div class="box randomizer-node-preview"><em style="color:#8492a6; font-size:11px;">Configura salidas en el panel...</em></div></div>',
      render: (nodeId, data) => '<div class="nd-placeholder">Aleatorio</div>',
    });

    // Register carousel node (stub)
    this.register('carousel', {
      type: 'carousel',
      label: 'Carrusel',
      icon: '🖼️',
      inputs: 1,
      outputs: 1,
      html: '<div class="mc-node mc-content"><div class="mc-header"><span>🖼️</span> Carrusel</div><div class="box carousel-node-preview"><em style="color:#8492a6; font-size:11px;">Sin tarjetas configuradas</em></div></div>',
      render: (nodeId, data) => '<div class="nd-placeholder">Carrusel</div>',
    });

    // Register gallery node (stub)
    this.register('gallery', {
      type: 'gallery',
      label: 'Galería',
      icon: '📸',
      inputs: 1,
      outputs: 1,
      html: '<div class="mc-node mc-content"><div class="mc-header"><span>📸</span> Galería</div><div class="box gallery-node-preview"><em style="color:#8492a6; font-size:11px;">Sin imágenes</em></div></div>',
      render: (nodeId, data) => '<div class="nd-placeholder">Galería</div>',
    });

    // Register audio node (stub)
    this.register('audio', {
      type: 'audio',
      label: 'Audio',
      icon: '🎵',
      inputs: 1,
      outputs: 1,
      html: '<div class="mc-node mc-content"><div class="mc-header"><span>🎵</span> Audio</div><div class="box audio-node-preview"><em style="color:#8492a6; font-size:11px;">Sin audio configurado</em></div></div>',
      render: (nodeId, data) => '<div class="nd-placeholder">Audio</div>',
    });

    // Register video node (stub)
    this.register('video', {
      type: 'video',
      label: 'Video',
      icon: '🎥',
      inputs: 1,
      outputs: 1,
      html: '<div class="mc-node mc-content"><div class="mc-header"><span>🎥</span> Video</div><div class="box video-node-preview"><em style="color:#8492a6; font-size:11px;">Sin video configurado</em></div></div>',
      render: (nodeId, data) => '<div class="nd-placeholder">Video</div>',
    });

    // Register file node (stub)
    this.register('file', {
      type: 'file',
      label: 'Archivo',
      icon: '📄',
      inputs: 1,
      outputs: 1,
      html: '<div class="mc-node mc-content"><div class="mc-header"><span>📄</span> Archivo / PDF</div><div class="box file-node-preview"><em style="color:#8492a6; font-size:11px;">Sin archivo configurado</em></div></div>',
      render: (nodeId, data) => '<div class="nd-placeholder">Archivo</div>',
    });

    // Register delay node (stub)
    this.register('delay', {
      type: 'delay',
      label: 'Espera',
      icon: '⏱',
      inputs: 1,
      outputs: 1,
      html: '<div class="mc-node mc-action"><div class="mc-header"><span>⏱</span> Espera</div><div class="box delay-node-preview"><em style="color:#8492a6; font-size:11px;">Sin duración</em></div></div>',
      render: (nodeId, data) => '<div class="nd-placeholder">Espera</div>',
    });

    // Register goto node (stub)
    this.register('goto', {
      type: 'goto',
      label: 'Saltar',
      icon: '↗️',
      inputs: 1,
      outputs: 0,
      html: '<div class="mc-node mc-logic"><div class="mc-header"><span>↗️</span> Goto / Saltar</div><div class="box goto-node-preview"><em style="color:#8492a6; font-size:11px;">Sin destino</em></div></div>',
      render: (nodeId, data) => '<div class="nd-placeholder">Saltar</div>',
    });

    // Register AI agent node (stub)
    this.register('ai_agent', {
      type: 'ai_agent',
      label: 'Agente IA',
      icon: '🧠',
      inputs: 1,
      outputs: 1,
      html: '<div class="mc-node mc-ai"><div class="mc-header"><span>🧠</span> Agente IA</div><div class="box ai-agent-node-preview" style="padding: 12px; background: #f8fafc; text-align: center; border-radius: 6px;"><em style="color:#64748b; font-size:11px;">Sin Prompt Configurado</em></div></div>',
      render: (nodeId, data) => '<div class="nd-placeholder">Agente IA</div>',
    });
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
