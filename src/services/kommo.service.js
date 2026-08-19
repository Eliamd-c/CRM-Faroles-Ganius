const axios = require('axios');

/**
 * Servicio para conectarse a la API de Kommo
 * Sirve como puente de salida para que el CRM responda sin necesidad de la Graph API de Meta
 */

class KommoService {
  constructor() {
    // Configuración que obtendrás desde tu cuenta de Kommo (Ajustes > Integraciones > Crear integración privada)
    // Es recomendable pasar estos valores a tu archivo .env
    this.kommoDomain = process.env.KOMMO_DOMAIN || 'tu-subdominio.amocrm.com'; 
    this.kommoToken = process.env.KOMMO_ACCESS_TOKEN || ''; 
  }

  /**
   * Envía un mensaje de texto al chat de Instagram a través de Kommo
   * @param {string} chatId El ID del chat o contacto en Kommo
   * @param {string} text El texto a enviar
   */
  async sendMessage(chatId, text) {
    if (!this.kommoToken) {
      console.warn('⚠️ [KOMMO] No se ha configurado el KOMMO_ACCESS_TOKEN. El mensaje no se enviará.');
      return false;
    }

    try {
      const payload = {
        message: {
          receiver_name: 'Cliente', // Opcional
          text: text
        }
      };

      // Nota: La ruta exacta puede variar dependiendo si usamos la Chat API o la API de Notas
      // Asumiremos la Chat API (Conversational API) para este puente. 
      // Debes asegurarte de obtener un token de Chat API o crear una nota en el Lead.
      const url = `https://${this.kommoDomain}/api/v4/messages`;

      /*
      // EJEMPLO DE PETICIÓN (Descomentar y ajustar cuando se tenga el token)
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.kommoToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ [KOMMO] Mensaje enviado correctamente al chat:', chatId);
      return response.data;
      */
     
      console.log(`✅ [KOMMO SIMULACRO] Mensaje listo para enviar a ${chatId}: "${text}"`);
      return true;

    } catch (error) {
      console.error('❌ [KOMMO] Error enviando mensaje:', error.response?.data || error.message);
      return false;
    }
  }
}

module.exports = new KommoService();
