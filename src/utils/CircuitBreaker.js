// ==========================================
// CircuitBreaker.js - Resiliencia
// Node.js Design Patterns - Cap. 11
// ==========================================

class CircuitOpenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CircuitOpenError';
    this.isCircuitBreakerError = true;
  }
}

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minuto por defecto
    this.state = 'CLOSED';
    this.failures = 0;
    this.nextAttempt = Date.now();
  }

  async fire(action) {
    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttempt) {
        // Enfriamiento terminado, probamos con 1 petición
        console.log('[CircuitBreaker] 🔄 Medio Abierto (HALF_OPEN). Probando conexión...');
        this.state = 'HALF_OPEN';
      } else {
        throw new CircuitOpenError('El circuito está ABIERTO. Operación bloqueada para prevenir sobrecarga.');
      }
    }

    try {
      const result = await action();
      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure(error);
      throw error;
    }
  }

  _onSuccess() {
    this.failures = 0;
    if (this.state !== 'CLOSED') {
      console.log('[CircuitBreaker] ✅ Operación exitosa. Circuito CERRADO (CLOSED).');
      this.state = 'CLOSED';
    }
  }

  _onFailure(error) {
    // Filtrado de Errores: Solo abrimos el circuito por fallos de infraestructura/red
    if (!this._isTransientError(error)) {
      console.warn(`[CircuitBreaker] Ignorando error de lógica/cliente: ${error.message}`);
      return;
    }

    this.failures += 1;
    console.error(`[CircuitBreaker] ❌ Fallo ${this.failures}/${this.failureThreshold} detectado: ${error.message}`);

    if (this.failures >= this.failureThreshold || this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.error(`[CircuitBreaker] 🚨 CIRCUITO ABIERTO (OPEN). Bloqueando peticiones por ${this.resetTimeout / 1000}s`);
    }
  }

  _isTransientError(error) {
    // Identificar si el error amerita abrir el circuito (Infraestructura vs Lógica)
    
    // Si es un error de Axios/HTTP
    if (error.response) {
      const status = error.response.status;
      // 408 Timeout, 429 Rate Limit, 500+ Errores de servidor OpenAI
      if (status === 408 || status === 429 || status >= 500) {
        return true;
      }
      return false; // Ignorar 400 Bad Request, 401 Auth, 404 Not Found
    }

    // Errores de red Node.js (ECONNRESET, ETIMEDOUT)
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }

    // Timeouts genéricos o errores del SDK de LangChain/OpenAI que no sean 400
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('network error') || msg.includes('500') || msg.includes('502') || msg.includes('503')) {
      return true;
    }

    return false;
  }
}

// Instancia Singleton recomendada por el arquitecto
const openAICircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 60000 // 60 segundos
});

module.exports = { CircuitBreaker, openAICircuitBreaker, CircuitOpenError };
