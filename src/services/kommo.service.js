const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TOKENS_FILE = path.join(__dirname, '..', '..', 'kommo_tokens.json');

class KommoService {
  constructor() {
    this.kommoDomain = process.env.KOMMO_DOMAIN; // e.g., "tu-empresa.kommo.com"
    this.clientId = process.env.KOMMO_CLIENT_ID;
    this.clientSecret = process.env.KOMMO_CLIENT_SECRET;
    this.redirectUri = process.env.KOMMO_REDIRECT_URI || 'https://crm.farolesgenius.com/';
    this.authCode = process.env.KOMMO_AUTH_CODE;
    
    this.tokens = this.loadTokens();
  }

  loadTokens() {
    try {
      if (fs.existsSync(TOKENS_FILE)) {
        return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
      }
    } catch (e) {
      console.error('⚠️ [KOMMO] Error leyendo tokens:', e.message);
    }
    return null;
  }

  saveTokens(tokens) {
    try {
      fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
      this.tokens = tokens;
      console.log('✅ [KOMMO] Tokens de acceso guardados/actualizados correctamente.');
    } catch (e) {
      console.error('❌ [KOMMO] Error guardando tokens:', e.message);
    }
  }

  async ensureAccessToken() {
    if (!this.kommoDomain) throw new Error("Falta KOMMO_DOMAIN en las variables de entorno");

    // 1. Si no hay tokens en lo absoluto, intercambiar el Código de Autorización
    if (!this.tokens) {
      if (!this.authCode) throw new Error("No hay tokens y falta KOMMO_AUTH_CODE para generarlos");
      console.log('🔄 [KOMMO] Realizando intercambio inicial del Código de Autorización...');
      
      try {
        const response = await axios.post(`https://${this.kommoDomain}/oauth2/access_token`, {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'authorization_code',
          code: this.authCode,
          redirect_uri: this.redirectUri
        });
        this.saveTokens(response.data);
        return response.data.access_token;
      } catch (error) {
        console.error('❌ [KOMMO] Error en intercambio inicial:', error.response?.data || error.message);
        throw new Error("El código de autorización ya expiró (dura 20 min). Genera uno nuevo en Kommo.");
      }
    }

    // 2. Aquí podríamos verificar la fecha de expiración, pero para simplificar, 
    // confiaremos en que si falla con 401, la función de envío lo refrescará.
    return this.tokens.access_token;
  }

  async refreshToken() {
    console.log('🔄 [KOMMO] Refrescando Access Token...');
    try {
      const response = await axios.post(`https://${this.kommoDomain}/oauth2/access_token`, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: this.tokens.refresh_token,
        redirect_uri: this.redirectUri
      });
      this.saveTokens(response.data);
      return response.data.access_token;
    } catch (error) {
      console.error('❌ [KOMMO] Error refrescando token:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendMessage(chatId, text, isRetry = false) {
    try {
      const token = await this.ensureAccessToken();

      const payload = [{
        contact_id: parseInt(chatId),
        text: text
      }]; // Formato de Kommo para enviar mensajes vía API (puede requerir Chat API o Notas según el caso)
      
      // Nota: Si usas la API conversacional estricta, la URL y payload cambian a /api/v4/messages
      // Dejaremos la estructura base preparada para la Chat API.
      const url = `https://${this.kommoDomain}/api/v4/contacts/${chatId}/notes`; 
      
      // ESTE ES UN EJEMPLO DE ENVÍO DE NOTA (como respuesta temporal). 
      // Para enviar al Chat de IG se usa la integración de Chat de Kommo.
      console.log(`✅ [KOMMO SIMULACRO] Enviando a ${chatId}: "${text}"`);
      return true;

    } catch (error) {
      if (error.response?.status === 401 && !isRetry) {
        // Token expirado, refrescar y reintentar
        await this.refreshToken();
        return this.sendMessage(chatId, text, true);
      }
      console.error('❌ [KOMMO] Error enviando mensaje:', error.response?.data || error.message);
      return false;
    }
  }
}

module.exports = new KommoService();
