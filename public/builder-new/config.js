/**
 * Configuration Constants
 *
 * Centralized constants for the builder application.
 * All magic numbers and strings extracted from builder.js.
 * Organized by functional category.
 */

// ─────────────────────────────────────────────
// UI Layer Z-Indexes
// ─────────────────────────────────────────────
export const ZINDEX = {
  BUTTON_EDIT_BACKDROP: 9999,      // Modal backdrop z-index
  BUTTON_EDIT_MODAL: 10000,        // Button editor modal z-index
};

// ─────────────────────────────────────────────
// Timing & Debounce (milliseconds)
// ─────────────────────────────────────────────
export const TIMING = {
  RENDER_NODE_DELAY: 50,           // Delay before rendering node content
  TRIGGER_PICKER_DELAY: 100,       // Delay before opening trigger picker
  DEBOUNCE_SAVE: 500,              // Debounce interval for auto-save
  CONNECTION_WAIT: 150,            // Wait before creating connection
  VALIDATION_BADGE_DELAY: 60,      // Delay before applying validation badges
  SAVE_BUTTON_RESET: 2500,         // Time to reset save button after success/error
};

// ─────────────────────────────────────────────
// Canvas & Node Positioning
// ─────────────────────────────────────────────
export const LAYOUT = {
  NODE_SPACING_X_PRIMARY: 380,     // Primary node spacing (button spawning)
  NODE_SPACING_X_SECONDARY: 350,   // Secondary node spacing (block nodes)
  NODE_SPACING_Y_BUTTON: 60,       // Button offset Y for spawned nodes
  NODE_DEFAULT_POS_X: 200,         // Default position X when no element reference
  NODE_INITIAL_X: 100,             // Initial X for generated flows
  OUTPUT_PORT_TOP_OFFSET: 12,      // Top offset for output ports
  OUTPUT_PORT_RIGHT_OFFSET: 8,     // Right offset for output ports
  DELETE_BUTTON_SIZE: 24,          // Delete block button size (px)
  UPLOAD_BUTTON_SIZE: 38,          // Upload image button size (px)
  MAX_OUTPUT_PORTS: 20,            // Maximum output ports to render
};

// ─────────────────────────────────────────────
// Modal & Dialog Dimensions
// ─────────────────────────────────────────────
export const MODAL = {
  BUTTON_EDITOR_WIDTH: 340,        // Button editor modal width (px)
  BUTTON_EDITOR_MAX_HEIGHT: 450,   // Button editor modal max-height (px)
  TEXTAREA_MIN_HEIGHT: 80,         // Text block textarea min-height (px)
};

// ─────────────────────────────────────────────
// Content Limits & Constraints
// ─────────────────────────────────────────────
export const LIMITS = {
  MAX_HISTORY: 50,                 // Maximum undo/redo snapshots
  MAX_BUTTONS_PER_BLOCK: 3,        // Maximum buttons per message block
  MAX_CAROUSEL_ELEMENTS: 10,       // Maximum carousel cards
  MAX_DELAY_SECONDS: 900,          // Maximum delay (15 minutes in seconds)
  MIN_DELAY_SECONDS: 1,            // Minimum delay seconds
  DEFAULT_DELAY_SECONDS: 5,        // Default delay seconds
  DEFAULT_GALLERY_DELAY_MS: 300,   // Default gallery image delay (ms)
};

// ─────────────────────────────────────────────
// Drawflow Configuration
// ─────────────────────────────────────────────
export const DRAWFLOW = {
  REROUTE: true,                   // Enable connection rerouting
  CURVATURE: 0.5,                  // Connection curve smoothness (0-1)
};

// ─────────────────────────────────────────────
// Validation Error Messages
// ─────────────────────────────────────────────
export const VALIDATION_MESSAGES = {
  // Message node
  MSG_NO_CONTENT: 'El mensaje no tiene contenido.',
  MSG_EMPTY: 'El mensaje está vacío.',

  // Trigger node
  TRIGGER_NO_KEYWORD: 'Falta la palabra clave del comentario.',
  TRIGGER_NO_TYPE: 'Falta configurar la palabra clave del disparador.',

  // Input node
  INPUT_NO_CONFIG: 'Falta el campo o la pregunta a mostrar.',

  // Condition node
  CONDITION_NO_CONFIG: 'Falta configurar la condición.',

  // Action node
  ACTION_NOT_SELECTED: 'No se eligió ninguna acción.',

  // Carousel node
  CAROUSEL_NO_ELEMENTS: 'El carrusel no tiene elementos con título.',

  // Gallery node
  GALLERY_NO_IMAGES: 'La galería no tiene imágenes.',

  // Audio node
  AUDIO_NO_FILE: 'Falta el archivo de audio.',

  // Video node
  VIDEO_NO_FILE: 'Falta el archivo de video.',

  // File node
  FILE_NO_FILE: 'Falta el archivo adjunto.',

  // Delay node
  DELAY_INVALID: 'El tiempo de espera debe ser mayor a 0.',

  // Goto node
  GOTO_NO_FLOW: 'Falta elegir el flujo destino.',

  // AI Agent node
  AI_AGENT_NO_PROMPT: 'Falta el prompt del agente IA.',
};

// ─────────────────────────────────────────────
// UI Messages & Labels
// ─────────────────────────────────────────────
export const UI_MESSAGES = {
  AI_IMPROVE_TEXT_BUTTON: 'Mejorar con IA',
  AI_THINKING: 'Pensando...',
  AI_IMPROVEMENT_SUCCESS: 'Texto mejorado con IA ✨',
  AI_ERROR_DEFAULT: 'Error de IA',
  AI_CONNECTION_ERROR: 'Error de conexión con la IA',
  AI_EMPTY_TEXT_WARNING: 'Escribe algo primero para que la IA lo mejore',

  IMAGE_UPLOAD_SUCCESS: 'Imagen subida correctamente',
  IMAGE_UPLOAD_ERROR: 'Error al subir',
  CONNECTION_ERROR: 'Error de conexión',

  FLOW_GENERATED: 'Flujo mágico generado con éxito ✨',

  NAME_UPDATED: 'Nombre actualizado',
  NAME_UPDATE_FAILED: 'No se pudo actualizar el nombre',

  NO_EXTRA_CONFIG: 'No hay configuraciones extra para este nodo.',
  SELECT_TO_CONFIGURE: 'Selecciona este nodo para configurar',
  SELECT_TO_CONFIGURE_SHORT: 'Selecciona para configurar',

  PLACEHOLDER_EMPTY: 'Vacío — añade bloques en el Inspector',
  PLACEHOLDER_NO_CONFIG: 'Sin configurar',
  PLACEHOLDER_NO_CARDS: 'Sin tarjetas configuradas',
  PLACEHOLDER_NO_IMAGES: 'Sin imágenes',
  PLACEHOLDER_NO_AUDIO: 'Sin audio configurado',
  PLACEHOLDER_NO_VIDEO: 'Sin video configurado',
  PLACEHOLDER_NO_FILE: 'Sin archivo configurado',
  PLACEHOLDER_NO_DURATION: 'Sin duración',
  PLACEHOLDER_NO_DESTINATION: 'Sin destino',
  PLACEHOLDER_NO_PROMPT: 'Sin Prompt Configurado',

  NO_INCOMPLETE_NODES: '{count} nodo{plural} incompleto{plural}',
  CANNOT_PUBLISH: 'No se puede publicar: {count} nodo{plural} incompleto{plural}',
  MAX_CAROUSEL_REACHED: 'Máximo 10 tarjetas',
  MAX_SECONDS_WARNING: 'Máximo 900 segundos (15 minutos)',
  MASTER_CONTEXT_WARNING: 'Si ignoras el Contexto Maestro, debes escribir instrucciones propias.',
  DESCRIPTION_REQUIRED: 'Escribe una descripción para el flujo.',
  RANDOMIZER_DESC: 'El nodo elegirá aleatoriamente entre sus salidas disponibles.',
  GOTO_DESC: 'El flujo saltará al destino y no continuará con los pasos siguientes.',

  NO_MEDIA_SELECTED: 'Sin media seleccionado',
  UPLOADING_IMAGE: 'Subiendo imagen...',
};

// ─────────────────────────────────────────────
// Input Type Labels
// ─────────────────────────────────────────────
export const INPUT_TYPE_LABELS = {
  email: '✉️ Email',
  phone: '📱 Teléfono',
  text: '📝 Texto Libre',
  choice: '✓ Opción múltiple',
};

// ─────────────────────────────────────────────
// Button Type Configuration
// ─────────────────────────────────────────────
export const BUTTON_TYPES = {
  POSTBACK: 'postback',           // Instagram/WhatsApp postback
  INSTAGRAM: 'instagram',         // Instagram direct message
  AI_STEP: 'ai_step',            // AI step execution
  WEB_URL: 'web_url',            // Open website
  ACTION: 'action',              // Perform actions
  CONDITION: 'condition',        // Condition branch
  RANDOMIZER: 'randomizer',      // Random path selection
  SMART_DELAY: 'smart_delay',    // Intelligent delay
};

// ─────────────────────────────────────────────
// Node Types
// ─────────────────────────────────────────────
export const NODE_TYPES = {
  TRIGGER: 'trigger',
  MESSAGE: 'message',
  ACTION: 'action',
  INPUT: 'input',
  CONDITION: 'condition',
  RANDOMIZER: 'randomizer',
  CAROUSEL: 'carousel',
  GALLERY: 'gallery',
  AUDIO: 'audio',
  VIDEO: 'video',
  FILE: 'file',
  DELAY: 'delay',
  GOTO: 'goto',
  AI_AGENT: 'ai_agent',
};

// ─────────────────────────────────────────────
// Content Block Types
// ─────────────────────────────────────────────
export const BLOCK_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
};

// ─────────────────────────────────────────────
// Condition Operators
// ─────────────────────────────────────────────
export const CONDITION_OPERATORS = {
  CONTAINS: 'contains',
  EQUALS: 'equals',
  NOT_EQUALS: 'not_equals',
  STARTS_WITH: 'starts_with',
  ENDS_WITH: 'ends_with',
};

// ─────────────────────────────────────────────
// Default Configuration Values
// ─────────────────────────────────────────────
export const DEFAULTS = {
  // Condition node
  CONDITION_FIELD: 'email',
  CONDITION_OPERATOR: 'contains',
  CONDITION_VALUE: '@',

  // Randomizer node
  RANDOMIZER_PATHS: 2,

  // Delay node
  DELAY_SECONDS: 5,

  // Gallery node
  GALLERY_DELAY_MS: 300,

  // AI Agent prompt
  AI_AGENT_PROMPT: 'Eres un asistente útil y amigable. Ayuda al usuario a resolver sus dudas basándote en la información de la tienda.',

  // Input node
  INPUT_TYPE: 'email',
  INPUT_FIELD: 'email',
  INPUT_PROMPT: 'Por favor ingresa tu email:',
  INPUT_RETRY: 'Ese correo no es válido. Intenta de nuevo:',

  // Message block
  MESSAGE_PLACEHOLDER_TEXT: '¡Hola! Escribe aquí...',
};
