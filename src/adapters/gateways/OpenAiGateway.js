// OpenAI Gateway Adapter
// Wraps openai.service to abstract AI agent calls

const openai = require('../../services/openai.service');

class OpenAiGateway {
  // Text processing
  removeAccents(text) {
    return openai.removeAccents(text);
  }

  // Intent detection
  async detectIntentWithAI(text, context) {
    return openai.detectIntentWithAI(text, context);
  }

  // Momento detection
  async detectarMomento(text, contact) {
    return openai.detectarMomento(text, contact);
  }

  // Intention detection
  async detectarIntencion(text, context) {
    return openai.detectarIntencion(text, context);
  }

  // Persuasion selection
  async seleccionarArma(moment, intention, context) {
    return openai.seleccionarArma(moment, intention, context);
  }

  // Grice validation
  async validarGrice(response) {
    return openai.validarGrice(response);
  }

  // Context retrieval
  async retrieveDynamicContext(query) {
    return openai.retrieveDynamicContext(query);
  }

  // Trimming
  async trimAiHistorySafely(history) {
    return openai.trimAiHistorySafely(history);
  }

  // Rate limit check
  checkAiAgentRateLimit(key) {
    return openai.checkAiAgentRateLimit(key);
  }

  checkSmartTriggerRateLimit(key) {
    return openai.checkSmartTriggerRateLimit(key);
  }
}

module.exports = OpenAiGateway;
