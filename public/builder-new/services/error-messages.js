/**
 * Error Messages Service
 *
 * Centralized user-facing error messages with:
 * - Localization support structure
 * - Error-specific messages
 * - Actionable guidance
 * - Recovery suggestions
 */

/**
 * User-facing error messages in Spanish (default) and English
 */
export const ERROR_MESSAGES = {
  es: {
    // Validation errors
    VALIDATION_ERROR: {
      title: 'Error de Validación',
      message: 'Por favor verifica tu información e intenta nuevamente.',
      action: 'Revisa los campos requeridos',
    },
    INVALID_FLOW_STRUCTURE: {
      title: 'Estructura de Flujo Inválida',
      message: 'El flujo no tiene la estructura correcta. Verifica que todos los nodos estén conectados.',
      action: 'Revisa las conexiones de nodos',
    },
    MISSING_TRIGGER: {
      title: 'Disparador Faltante',
      message: 'Cada flujo debe tener un nodo disparador. Por favor añade uno.',
      action: 'Añade un nodo disparador',
    },
    INVALID_NODE_DATA: {
      title: 'Datos de Nodo Inválidos',
      message: 'Los datos del nodo no son válidos. Por favor revísalos.',
      action: 'Corrige los datos del nodo',
    },

    // Network errors
    NETWORK_ERROR: {
      title: 'Error de Conexión',
      message: 'No se pudo conectar al servidor. Verifica tu conexión a internet.',
      action: 'Comprueba tu conexión e intenta de nuevo',
    },
    CONNECTION_TIMEOUT: {
      title: 'Conexión Agotada',
      message: 'La solicitud tardó demasiado. Por favor intenta nuevamente.',
      action: 'Intenta de nuevo o contacta al soporte',
    },
    CONNECTION_REFUSED: {
      title: 'Conexión Rechazada',
      message: 'No se puede conectar al servidor. Por favor intenta más tarde.',
      action: 'Intenta más tarde',
    },

    // Server errors
    SERVER_ERROR: {
      title: 'Error del Servidor',
      message: 'El servidor encontró un error. Por favor intenta más tarde.',
      action: 'Intenta más tarde o contacta al soporte',
    },
    SERVICE_UNAVAILABLE: {
      title: 'Servicio No Disponible',
      message: 'El servicio no está disponible. Por favor intenta más tarde.',
      action: 'Intenta más tarde',
    },
    INTERNAL_ERROR: {
      title: 'Error Interno',
      message: 'Ocurrió un error interno. Por favor intenta nuevamente.',
      action: 'Intenta de nuevo',
    },

    // Client errors
    BAD_REQUEST: {
      title: 'Solicitud Inválida',
      message: 'La solicitud no es válida. Por favor verifica tu entrada.',
      action: 'Verifica tu entrada e intenta de nuevo',
    },
    NOT_FOUND: {
      title: 'No Encontrado',
      message: 'El recurso solicitado no fue encontrado.',
      action: 'Verifica que el recurso existe',
    },
    UNAUTHORIZED: {
      title: 'No Autorizado',
      message: 'No tienes permiso para acceder a este recurso.',
      action: 'Comprueba tu autenticación',
    },
    FORBIDDEN: {
      title: 'Acceso Prohibido',
      message: 'No puedes acceder a este recurso.',
      action: 'Contacta al administrador',
    },

    // API errors
    API_ERROR: {
      title: 'Error de API',
      message: 'Ocurrió un error al comunicarse con el servidor.',
      action: 'Intenta de nuevo',
    },
    RATE_LIMIT_EXCEEDED: {
      title: 'Límite de Tasa Excedido',
      message: 'Has hecho demasiadas solicitudes. Por favor intenta en unos momentos.',
      action: 'Espera un momento e intenta de nuevo',
    },

    // Auth errors
    AUTH_ERROR: {
      title: 'Error de Autenticación',
      message: 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.',
      action: 'Inicia sesión nuevamente',
    },
    INVALID_TOKEN: {
      title: 'Token Inválido',
      message: 'Tu token de acceso no es válido. Por favor inicia sesión nuevamente.',
      action: 'Inicia sesión nuevamente',
    },

    // Flow errors
    FLOW_SAVE_FAILED: {
      title: 'Error al Guardar Flujo',
      message: 'No se pudo guardar el flujo. Por favor intenta nuevamente.',
      action: 'Intenta de nuevo',
    },
    FLOW_LOAD_FAILED: {
      title: 'Error al Cargar Flujo',
      message: 'No se pudo cargar el flujo. Por favor recarga la página.',
      action: 'Recarga la página e intenta de nuevo',
    },
    FLOW_DELETE_FAILED: {
      title: 'Error al Eliminar Flujo',
      message: 'No se pudo eliminar el flujo. Por favor intenta nuevamente.',
      action: 'Intenta de nuevo',
    },
    FLOW_PUBLISH_FAILED: {
      title: 'Error al Publicar Flujo',
      message: 'No se pudo publicar el flujo. Verifica que sea válido.',
      action: 'Verifica el flujo e intenta de nuevo',
    },

    // Generic error
    UNKNOWN_ERROR: {
      title: 'Error Desconocido',
      message: 'Ocurrió un error inesperado. Por favor intenta más tarde.',
      action: 'Intenta más tarde o contacta al soporte',
    },
  },

  en: {
    // Validation errors
    VALIDATION_ERROR: {
      title: 'Validation Error',
      message: 'Please check your information and try again.',
      action: 'Review the required fields',
    },
    INVALID_FLOW_STRUCTURE: {
      title: 'Invalid Flow Structure',
      message: 'The flow does not have the correct structure. Ensure all nodes are connected.',
      action: 'Review node connections',
    },
    MISSING_TRIGGER: {
      title: 'Missing Trigger',
      message: 'Each flow must have a trigger node. Please add one.',
      action: 'Add a trigger node',
    },
    INVALID_NODE_DATA: {
      title: 'Invalid Node Data',
      message: 'The node data is invalid. Please review it.',
      action: 'Fix the node data',
    },

    // Network errors
    NETWORK_ERROR: {
      title: 'Connection Error',
      message: 'Could not connect to server. Check your internet connection.',
      action: 'Check your connection and try again',
    },
    CONNECTION_TIMEOUT: {
      title: 'Connection Timeout',
      message: 'The request took too long. Please try again.',
      action: 'Try again or contact support',
    },
    CONNECTION_REFUSED: {
      title: 'Connection Refused',
      message: 'Cannot connect to the server. Please try later.',
      action: 'Try later',
    },

    // Server errors
    SERVER_ERROR: {
      title: 'Server Error',
      message: 'The server encountered an error. Please try later.',
      action: 'Try later or contact support',
    },
    SERVICE_UNAVAILABLE: {
      title: 'Service Unavailable',
      message: 'The service is unavailable. Please try later.',
      action: 'Try later',
    },
    INTERNAL_ERROR: {
      title: 'Internal Error',
      message: 'An internal error occurred. Please try again.',
      action: 'Try again',
    },

    // Client errors
    BAD_REQUEST: {
      title: 'Invalid Request',
      message: 'The request is invalid. Please check your input.',
      action: 'Check your input and try again',
    },
    NOT_FOUND: {
      title: 'Not Found',
      message: 'The requested resource was not found.',
      action: 'Verify that the resource exists',
    },
    UNAUTHORIZED: {
      title: 'Unauthorized',
      message: 'You do not have permission to access this resource.',
      action: 'Check your authentication',
    },
    FORBIDDEN: {
      title: 'Access Forbidden',
      message: 'You cannot access this resource.',
      action: 'Contact an administrator',
    },

    // API errors
    API_ERROR: {
      title: 'API Error',
      message: 'An error occurred while communicating with the server.',
      action: 'Try again',
    },
    RATE_LIMIT_EXCEEDED: {
      title: 'Rate Limit Exceeded',
      message: 'You have made too many requests. Please try again in a moment.',
      action: 'Wait a moment and try again',
    },

    // Auth errors
    AUTH_ERROR: {
      title: 'Authentication Error',
      message: 'Your session has expired. Please log in again.',
      action: 'Log in again',
    },
    INVALID_TOKEN: {
      title: 'Invalid Token',
      message: 'Your access token is invalid. Please log in again.',
      action: 'Log in again',
    },

    // Flow errors
    FLOW_SAVE_FAILED: {
      title: 'Flow Save Failed',
      message: 'Could not save the flow. Please try again.',
      action: 'Try again',
    },
    FLOW_LOAD_FAILED: {
      title: 'Flow Load Failed',
      message: 'Could not load the flow. Please refresh the page.',
      action: 'Refresh the page and try again',
    },
    FLOW_DELETE_FAILED: {
      title: 'Flow Delete Failed',
      message: 'Could not delete the flow. Please try again.',
      action: 'Try again',
    },
    FLOW_PUBLISH_FAILED: {
      title: 'Flow Publish Failed',
      message: 'Could not publish the flow. Verify it is valid.',
      action: 'Verify the flow and try again',
    },

    // Generic error
    UNKNOWN_ERROR: {
      title: 'Unknown Error',
      message: 'An unexpected error occurred. Please try later.',
      action: 'Try later or contact support',
    },
  },
};

/**
 * Get error message by code and language
 * @param {string} code - Error code (e.g., 'VALIDATION_ERROR')
 * @param {string} lang - Language code (default 'es')
 * @returns {Object} Message object { title, message, action }
 */
export function getErrorMessage(code, lang = 'es') {
  const messages = ERROR_MESSAGES[lang] || ERROR_MESSAGES.es;
  return messages[code] || messages.UNKNOWN_ERROR;
}

/**
 * Format error message for display
 * @param {string} code - Error code
 * @param {Object} data - Additional data to interpolate
 * @param {string} lang - Language code
 * @returns {Object} Formatted message
 */
export function formatErrorMessage(code, data = {}, lang = 'es') {
  const msg = getErrorMessage(code, lang);

  // Interpolate data if provided
  let message = msg.message;
  let action = msg.action;

  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{${key}}`;
    message = message.replace(placeholder, String(value));
    action = action.replace(placeholder, String(value));
  }

  return {
    title: msg.title,
    message,
    action,
  };
}

/**
 * Get recovery suggestion based on error type
 * @param {string} type - Error type
 * @param {string} lang - Language code
 * @returns {string} Recovery suggestion
 */
export function getRecoverySuggestion(type, lang = 'es') {
  const baseCode = type.split('_')[0];
  const msg = getErrorMessage(type, lang);
  return msg.action || 'Please try again or contact support';
}

/**
 * Map HTTP status to error code
 * @param {number} status - HTTP status code
 * @returns {string} Error code
 */
export function mapHttpStatusToErrorCode(status) {
  switch (true) {
    case status === 400:
      return 'BAD_REQUEST';
    case status === 401:
      return 'UNAUTHORIZED';
    case status === 403:
      return 'FORBIDDEN';
    case status === 404:
      return 'NOT_FOUND';
    case status === 429:
      return 'RATE_LIMIT_EXCEEDED';
    case status >= 500 && status < 600:
      return 'SERVER_ERROR';
    case status === 0:
      return 'NETWORK_ERROR';
    default:
      return 'API_ERROR';
  }
}
