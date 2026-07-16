import requests
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MetaInstagramClient:
    def __init__(self, page_access_token=None, instagram_account_id=None):
        self.page_access_token = page_access_token
        self.instagram_account_id = instagram_account_id
        self.base_url = "https://graph.facebook.com/v19.0"

    def update_credentials(self, page_access_token, instagram_account_id):
        self.page_access_token = page_access_token
        self.instagram_account_id = instagram_account_id

    def is_configured(self):
        return bool(self.page_access_token and self.instagram_account_id)

    def send_message(self, recipient_id, text):
        """
        Envía un mensaje de texto directo a un usuario de Instagram usando la API de Meta.
        """
        if not self.is_configured():
            logger.warning("Meta Client no está configurado. El mensaje no se enviará a Meta.")
            return False, "Meta client no está configurado (falta Token de Acceso)."

        url = f"{self.base_url}/me/messages"
        params = {
            "access_token": self.page_access_token
        }
        payload = {
            "recipient": {
                "id": recipient_id
            },
            "message": {
                "text": text
            }
        }

        try:
            logger.info(f"Enviando mensaje a {recipient_id} vía Meta API...")
            response = requests.post(url, params=params, json=payload, timeout=10)
            response_data = response.json()
            
            if response.status_code == 200:
                logger.info(f"Mensaje enviado con éxito a {recipient_id}. Message ID: {response_data.get('message_id')}")
                return True, response_data
            else:
                error_msg = response_data.get("error", {}).get("message", "Error desconocido")
                logger.error(f"Error al enviar mensaje por Meta API: {error_msg}")
                return False, error_msg
        except Exception as e:
            logger.exception("Excepción ocurrida al conectar con la API de Meta")
            return False, str(e)

    def get_user_profile(self, sender_scoped_id):
        """
        Obtiene el perfil público del usuario (nombre de usuario, foto de perfil) usando el IGSID.
        """
        if not self.is_configured():
            return None

        # Para Instagram Graph API, obtener el perfil del remitente de mensajes se realiza consultando el IGSID.
        # GET https://graph.facebook.com/v19.0/<IGSID>?fields=name,profile_pic&access_token=<TOKEN>
        url = f"{self.base_url}/{sender_scoped_id}"
        params = {
            "fields": "name,profile_pic,username",
            "access_token": self.page_access_token
        }

        try:
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Error al obtener perfil de usuario: {response.text}")
                return None
        except Exception as e:
            logger.error(f"Excepción al obtener perfil: {e}")
            return None
