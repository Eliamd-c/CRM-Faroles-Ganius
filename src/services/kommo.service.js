const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { broadcastLog } = require('../shared');

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
    if (!this.kommoDomain) {
      broadcastLog('ERROR', 'Falta KOMMO_DOMAIN en el .env');
      throw new Error("Falta KOMMO_DOMAIN en las variables de entorno");
    }

    // 1. Si no hay tokens en lo absoluto, intercambiar el Código de Autorización
    if (!this.tokens) {
      if (!this.authCode) {
        broadcastLog('ERROR', 'Falta KOMMO_AUTH_CODE en el .env');
        throw new Error("No hay tokens y falta KOMMO_AUTH_CODE para generarlos");
      }
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
        const errDetail = error.response?.data?.hint || error.message;
        console.error('❌ [KOMMO] Error en intercambio inicial:', error.response?.data || error.message);
        broadcastLog('ERROR', `Error Kommo OAuth: ${errDetail} (Genera un nuevo Código de Autorización)`);
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

  async ensureCustomField(token) {
    if (this.customFieldId) return this.customFieldId;
    
    // 1. Buscar si el campo ya existe en LEADS (Tratos)
    try {
      const res = await axios.get(`https://${this.kommoDomain}/api/v4/leads/custom_fields`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const fields = res.data?._embedded?.custom_fields || [];
      const field = fields.find(f => f.name === 'Respuesta_CRM');
      if (field) {
        this.customFieldId = field.id;
        return field.id;
      }
    } catch(e) {
      console.error('⚠️ [KOMMO] Error buscando campo en leads:', e.message);
    }

    // 2. Si no existe, crearlo automáticamente en LEADS
    try {
      console.log('🔄 [KOMMO] Creando campo personalizado Respuesta_CRM en Tratos...');
      const res = await axios.post(`https://${this.kommoDomain}/api/v4/leads/custom_fields`, [
        { name: 'Respuesta_CRM', type: 'text' }
      ], {
        headers: { Authorization: `Bearer ${token}` }
      });
      const newField = res.data?._embedded?.custom_fields?.[0];
      if (newField) {
        this.customFieldId = newField.id;
        return newField.id;
      }
    } catch(e) {
      console.error('❌ [KOMMO] Error creando campo en leads:', e.message);
    }
    throw new Error("No se pudo obtener ni crear el campo Respuesta_CRM en Kommo");
  }

  async sendMessage(chatId, text, isRetry = false) {
    try {
      const token = await this.ensureAccessToken();
      const fieldId = await this.ensureCustomField(token);

      // Paso extra: En Kommo las automatizaciones funcionan mejor con Tratos (Leads).
      // Buscamos el Trato asociado a este contacto.
      const leadRes = await axios.get(`https://${this.kommoDomain}/api/v4/leads?filter[contacts_ids]=${chatId}&limit=1`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const leads = leadRes.data?._embedded?.leads || [];
      if (leads.length === 0) {
         console.warn(`⚠️ No se encontró un Trato para el contacto ${chatId}. No se puede disparar el bot.`);
         return false;
      }
      const leadId = leads[0].id;

      // Inyectamos el texto en el Trato
      const payload = [{
        id: leadId,
        custom_fields_values: [
          {
            field_id: fieldId,
            values: [{ value: text }]
          }
        ]
      }];
      
      const url = `https://${this.kommoDomain}/api/v4/leads`; 
      await axios.patch(url, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log(`✅ [KOMMO REAL] Campo Respuesta_CRM actualizado para el Trato ${leadId}`);
      return true;

    } catch (error) {
      if (error.response?.status === 401 && !isRetry) {
        // Token expirado, refrescar y reintentar
        await this.refreshToken();
        return this.sendMessage(chatId, text, true);
      }
      const errMsg = error.response?.data?.detail || error.message;
      console.error('❌ [KOMMO] Error enviando mensaje:', error.response?.data || error.message);
      broadcastLog('ERROR', `Error al enviar por Kommo: ${errMsg}`);
      return false;
    }
  }
}

module.exports = new KommoService();
