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

// Export individual node implementations
export { TriggerNodeConfig, TRIGGER_HTML, renderTriggerPreview, renderTriggerInspector } from './nodes/trigger.js';
export { MessageNodeConfig, MESSAGE_HTML, renderBlocksPreview as renderMessagePreview, renderMessageInspector } from './nodes/message.js';
export { ActionNodeConfig, ACTION_HTML, renderActionPreview, renderActionInspector } from './nodes/action.js';
export { InputNodeConfig, INPUT_HTML, renderInputPreview, renderInputInspector } from './nodes/input.js';
export { ConditionNodeConfig, CONDITION_HTML, renderConditionPreview, renderConditionInspector } from './nodes/condition.js';
export { RandomizerNodeConfig, RANDOMIZER_HTML, renderRandomizerPreview, renderRandomizerInspector } from './nodes/randomizer.js';
export { CarouselNodeConfig, CAROUSEL_HTML, renderCarouselPreview, renderCarouselInspector } from './nodes/carousel.js';
export { GalleryNodeConfig, GALLERY_HTML, renderGalleryPreview, renderGalleryInspector } from './nodes/gallery.js';
export { AudioNodeConfig, AUDIO_HTML, renderAudioPreview, renderAudioInspector } from './nodes/audio.js';
export { VideoNodeConfig, VIDEO_HTML, renderVideoPreview, renderVideoInspector } from './nodes/video.js';
export { FileNodeConfig, FILE_HTML, renderFilePreview, renderFileInspector } from './nodes/file.js';
export { DelayNodeConfig, DELAY_HTML, renderDelayPreview, renderDelayInspector } from './nodes/delay.js';
export { GotoNodeConfig, GOTO_HTML, renderGotoPreview, renderGotoInspector } from './nodes/goto.js';
export { AiAgentNodeConfig, AI_AGENT_HTML, renderAiAgentPreview, renderAiAgentInspector } from './nodes/ai-agent.js';
