/**
 * Nodes Module
 *
 * Node type definitions and node-specific utilities.
 * Provides centralized access to node registry and node implementations.
 */

import { getNodeRegistry } from './registry.js';

// Export registry singleton
export const nodeRegistry = getNodeRegistry();

// Export node registry function for initialization
export { getNodeRegistry };

// Export individual node implementations as they become available
export { TriggerNodeConfig, TRIGGER_HTML, renderTriggerPreview, renderTriggerInspector } from './nodes/trigger.js';
