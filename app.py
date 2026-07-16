import os
import sqlite3
import time
import json
import logging
from flask import Flask, request, jsonify, render_template, g
from meta_client import MetaInstagramClient

# Configuración de logs
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

DATABASE = os.environ.get('DATABASE_PATH', 'crm.db')


app = Flask(__name__, 
            static_folder='static', 
            template_folder='templates')

# Cliente global de la API de Meta
meta_client = MetaInstagramClient()

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row  # Permite acceder a columnas por nombre
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    """Inicializa la base de datos con el esquema SQL si es necesario."""
    if not os.path.exists(DATABASE):
        logger.info("Base de datos no encontrada. Creándola...")
    
    with app.app_context():
        db = get_db()
        schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
        with open(schema_path, mode='r', encoding='utf-8') as f:
            db.cursor().executescript(f.read())
        db.commit()
        logger.info("Base de datos inicializada correctamente.")
        
        # Cargar configuraciones de Meta guardadas en la base de datos
        load_meta_settings()

def load_meta_settings():
    """Carga los tokens y credenciales de la base de datos en el cliente de Meta."""
    with app.app_context():
        db = get_db()
        cursor = db.cursor()
        cursor.execute("SELECT key, value FROM settings")
        settings = {row['key']: row['value'] for row in cursor.fetchall()}
        
        token = settings.get('page_access_token')
        ig_id = settings.get('instagram_account_id')
        
        if token or ig_id:
            meta_client.update_credentials(token, ig_id)
            logger.info("Credenciales de Meta cargadas en el cliente de API.")
        else:
            logger.info("No se encontraron credenciales de Meta. Operando en modo simulador.")

# --- MIDDLEWARE & CONFIG ---
@app.before_request
def before_request():
    # Asegurar que las tablas estén inicializadas
    pass

# --- RUTAS DE LA INTERFAZ ---
@app.route('/')
def index():
    return render_template('index.html')

# --- WEBHOOK ENDPOINTS (META GRAPH API) ---

@app.route('/webhook', methods=['GET'])
def verify_webhook():
    """
    Verificación del Webhook requerido por Meta.
    Meta envía un reto (challenge) y un token de verificación (verify_token) en una petición GET.
    """
    # Leer el token de verificación configurado en la base de datos
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = 'webhook_verify_token'")
    row = cursor.fetchone()
    expected_token = row['value'] if row else None

    # Parámetros enviados por Meta
    mode = request.args.get('hub.mode')
    token = request.args.get('hub.verify_token')
    challenge = request.args.get('hub.challenge')

    logger.info(f"Petición de verificación de Webhook recibida. Mode: {mode}, Token: {token}")

    if mode and token:
        if mode == 'subscribe' and token == expected_token:
            logger.info("Verificación de Webhook exitosa.")
            return challenge, 200
        else:
            logger.warning(f"Fallo en verificación de Webhook. Esperado: {expected_token}, Recibido: {token}")
            return 'Forbidden', 403
            
    return 'Bad Request', 400

@app.route('/webhook', methods=['POST'])
def receive_webhook_event():
    """
    Recibe eventos de Webhook en tiempo real desde Meta (mensajes, comentarios, etc.).
    """
    data = request.json
    logger.info(f"Webhook recibido de Meta: {json.dumps(data)}")

    if data.get('object') == 'instagram':
        for entry in data.get('entry', []):
            # Procesar mensajes de Instagram Direct (DMs)
            for messaging_event in entry.get('messaging', []):
                process_messaging_event(messaging_event)
            
            # Procesar comentarios en publicaciones (opcional, en el futuro)
            for changes_event in entry.get('changes', []):
                logger.info(f"Cambios recibidos (comentario/post): {changes_event}")
                # Aquí se podría implementar la lógica para comentarios
                
        return 'EVENT_RECEIVED', 200
    else:
        return 'Not Found', 404

# --- LÓGICA DE PROCESAMIENTO DE MENSAJES (COMÚN PARA WEBHOOK Y SIMULADOR) ---

def process_messaging_event(messaging_event):
    """
    Procesa un evento de mensaje entrante de Instagram.
    """
    sender_id = messaging_event.get('sender', {}).get('id')
    recipient_id = messaging_event.get('recipient', {}).get('id')
    
    if not sender_id:
        return

    # Evitar bucles de autoreplicación (si el remitente es la cuenta de Instagram del CRM)
    # En producción, Meta no envía webhooks para nuestros propios mensajes enviados por API,
    # pero es una buena práctica de seguridad verificar.
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = 'instagram_account_id'")
    my_ig_id = cursor.fetchone()
    my_ig_id = my_ig_id['value'] if my_ig_id else None
    
    if sender_id == my_ig_id:
        logger.info("Ignorando mensaje autogenerado por el bot.")
        return

    message = messaging_event.get('message', {})
    message_text = message.get('text', '')
    media_url = None
    
    # Manejar adjuntos (si los hay)
    attachments = message.get('attachments', [])
    if attachments:
        media_url = attachments[0].get('payload', {}).get('url')

    # Si no hay texto ni adjunto, no procesamos
    if not message_text and not media_url:
        return

    logger.info(f"Procesando mensaje entrante de {sender_id}: '{message_text}'")

    # 1. Asegurar la existencia del contacto en la base de datos
    cursor.execute("SELECT * FROM contacts WHERE id = ?", (sender_id,))
    contact = cursor.fetchone()

    if not contact:
        # Intentar consultar perfil público del usuario a través de Meta API
        profile = meta_client.get_user_profile(sender_id)
        if profile:
            username = profile.get('username', f"user_{sender_id}")
            name = profile.get('name', f"Instagram User {sender_id}")
            avatar_url = profile.get('profile_pic', '/static/img/default-avatar.png')
        else:
            # Crear perfil ficticio por defecto si no hay conexión real
            username = f"ig_user_{sender_id}"
            name = f"Cliente @{username}"
            avatar_url = '/static/img/default-avatar.png'
            
        cursor.execute(
            "INSERT INTO contacts (id, username, name, avatar_url, stage) VALUES (?, ?, ?, ?, 'Lead')",
            (sender_id, username, name, avatar_url)
        )
    else:
        username = contact['username']

    # 2. Asegurar la existencia de la conversación
    cursor.execute("SELECT * FROM conversations WHERE id = ?", (sender_id,))
    conv = cursor.fetchone()
    
    if not conv:
        cursor.execute(
            "INSERT INTO conversations (id, contact_id, last_message_time, unread_count) VALUES (?, ?, CURRENT_TIMESTAMP, 1)",
            (sender_id, sender_id)
        )
    else:
        cursor.execute(
            "UPDATE conversations SET last_message_time = CURRENT_TIMESTAMP, unread_count = unread_count + 1 WHERE id = ?",
            (sender_id,)
        )

    # 3. Guardar el mensaje entrante en la base de datos
    cursor.execute(
        "INSERT INTO messages (conversation_id, sender_id, recipient_id, text, media_url, direction, sender_type) VALUES (?, ?, ?, ?, ?, 'incoming', 'customer')",
        (sender_id, sender_id, recipient_id, message_text, media_url)
    )
    db.commit()

    # 4. Comprobar disparadores de auto-responder (Auto-Respuestas)
    check_and_trigger_autoresponder(sender_id, message_text)

def check_and_trigger_autoresponder(sender_id, message_text):
    """
    Compara el mensaje entrante con las palabras clave activas y responde automáticamente.
    """
    if not message_text:
        return
        
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT keyword, response_text FROM auto_responders WHERE is_active = 1")
    responders = cursor.fetchall()
    
    matched_response = None
    cleaned_message = message_text.lower().strip()
    
    for responder in responders:
        keyword = responder['keyword'].lower().strip()
        # Coincidencia si la palabra clave está contenida en el mensaje (o coincidencia exacta)
        if keyword in cleaned_message:
            matched_response = responder['response_text']
            break
            
    if matched_response:
        logger.info(f"Disparador de respuesta automática activado para '{cleaned_message}'. Respondiendo: '{matched_response}'")
        
        # Guardar la respuesta en la base de datos
        cursor.execute(
            "INSERT INTO messages (conversation_id, sender_id, recipient_id, text, direction, sender_type) VALUES (?, 'auto_response', ?, ?, 'outgoing', 'auto_response')",
            (sender_id, sender_id, matched_response)
        )
        cursor.execute("UPDATE conversations SET last_message_time = CURRENT_TIMESTAMP WHERE id = ?", (sender_id,))
        db.commit()
        
        # Enviar físicamente el mensaje vía API de Meta si está configurado
        if meta_client.is_configured():
            meta_client.send_message(sender_id, matched_response)

# --- ENDPOINTS REST API PARA EL CRM ---

@app.route('/api/settings', methods=['GET', 'POST'])
def manage_settings():
    db = get_db()
    cursor = db.cursor()
    
    if request.method == 'GET':
        cursor.execute("SELECT key, value FROM settings")
        rows = cursor.fetchall()
        settings = {row['key']: row['value'] for row in rows}
        # Devolver placeholders u ocultar tokens parciales por seguridad
        return jsonify({
            'page_access_token': settings.get('page_access_token', ''),
            'instagram_account_id': settings.get('instagram_account_id', ''),
            'webhook_verify_token': settings.get('webhook_verify_token', '')
        })
        
    elif request.method == 'POST':
        data = request.json
        keys = ['page_access_token', 'instagram_account_id', 'webhook_verify_token']
        
        for k in keys:
            if k in data:
                cursor.execute(
                    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                    (k, data[k])
                )
        db.commit()
        
        # Actualizar el cliente de la API de Meta en caliente
        load_meta_settings()
        
        return jsonify({'status': 'success', 'message': 'Configuración guardada correctamente.'})

@app.route('/api/contacts', methods=['GET', 'POST'])
def manage_contacts():
    db = get_db()
    cursor = db.cursor()
    
    if request.method == 'GET':
        cursor.execute("SELECT * FROM contacts ORDER BY created_at DESC")
        contacts = [dict(row) for row in cursor.fetchall()]
        return jsonify(contacts)
        
    elif request.method == 'POST':
        data = request.json
        c_id = data.get('id')
        username = data.get('username')
        name = data.get('name')
        avatar_url = data.get('avatar_url', '/static/img/default-avatar.png')
        stage = data.get('stage', 'Lead')
        tags = data.get('tags', '')
        notes = data.get('notes', '')
        
        if not c_id or not username:
            return jsonify({'error': 'Falta id o username'}), 400
            
        try:
            cursor.execute(
                "INSERT INTO contacts (id, username, name, avatar_url, stage, tags, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (c_id, username, name, avatar_url, stage, tags, notes)
            )
            # También iniciar conversación
            cursor.execute(
                "INSERT OR IGNORE INTO conversations (id, contact_id, last_message_time, unread_count) VALUES (?, ?, CURRENT_TIMESTAMP, 0)",
                (c_id, c_id)
            )
            db.commit()
            return jsonify({'status': 'success', 'id': c_id})
        except sqlite3.IntegrityError:
            return jsonify({'error': 'El contacto ya existe'}), 409

@app.route('/api/contacts/<contact_id>', methods=['PUT', 'DELETE'])
def detail_contact(contact_id):
    db = get_db()
    cursor = db.cursor()
    
    if request.method == 'PUT':
        data = request.json
        
        # Construir consulta dinámica según campos proporcionados
        fields = []
        params = []
        
        for k in ['name', 'avatar_url', 'stage', 'tags', 'notes']:
            if k in data:
                fields.append(f"{k} = ?")
                params.append(data[k])
                
        if not fields:
            return jsonify({'error': 'No hay campos para actualizar'}), 400
            
        params.append(time.strftime('%Y-%m-%d %H:%M:%S'))  # updated_at
        fields.append("updated_at = ?")
        params.append(contact_id)
        
        query = f"UPDATE contacts SET {', '.join(fields)} WHERE id = ?"
        cursor.execute(query, tuple(params))
        db.commit()
        return jsonify({'status': 'success'})
        
    elif request.method == 'DELETE':
        cursor.execute("DELETE FROM contacts WHERE id = ?", (contact_id,))
        cursor.execute("DELETE FROM conversations WHERE id = ?", (contact_id,))
        db.commit()
        return jsonify({'status': 'success', 'message': 'Contacto eliminado.'})

@app.route('/api/chats', methods=['GET'])
def get_chats():
    db = get_db()
    cursor = db.cursor()
    
    # Consulta avanzada para traer las conversaciones con la info de contacto y el último mensaje
    query = """
        SELECT 
            c.id AS conversation_id,
            c.unread_count,
            c.last_message_time,
            cnt.id AS contact_id,
            cnt.username,
            cnt.name,
            cnt.avatar_url,
            cnt.stage,
            (SELECT text FROM messages WHERE conversation_id = c.id ORDER BY timestamp DESC LIMIT 1) AS last_message_text,
            (SELECT sender_type FROM messages WHERE conversation_id = c.id ORDER BY timestamp DESC LIMIT 1) AS last_message_sender
        FROM conversations c
        JOIN contacts cnt ON c.contact_id = cnt.id
        ORDER BY c.last_message_time DESC
    """
    cursor.execute(query)
    chats = [dict(row) for row in cursor.fetchall()]
    return jsonify(chats)

@app.route('/api/chats/<conv_id>/messages', methods=['GET', 'POST'])
def manage_messages(conv_id):
    db = get_db()
    cursor = db.cursor()
    
    if request.method == 'GET':
        # Marcar conversación como leída
        cursor.execute("UPDATE conversations SET unread_count = 0 WHERE id = ?", (conv_id,))
        db.commit()
        
        # Obtener los mensajes del hilo
        cursor.execute("SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC", (conv_id,))
        messages = [dict(row) for row in cursor.fetchall()]
        return jsonify(messages)
        
    elif request.method == 'POST':
        data = request.json
        text = data.get('text')
        
        if not text:
            return jsonify({'error': 'Mensaje vacío'}), 400
            
        # Determinar destinatario
        cursor.execute("SELECT id, username FROM contacts WHERE id = ?", (conv_id,))
        contact = cursor.fetchone()
        if not contact:
            return jsonify({'error': 'Contacto no encontrado para este chat'}), 404
            
        recipient_id = contact['id']
        
        # Guardar mensaje enviado por el agente en la BD
        cursor.execute(
            "INSERT INTO messages (conversation_id, sender_id, recipient_id, text, direction, sender_type) VALUES (?, 'agent', ?, ?, 'outgoing', 'agent')",
            (conv_id, recipient_id, text)
        )
        cursor.execute("UPDATE conversations SET last_message_time = CURRENT_TIMESTAMP, unread_count = 0 WHERE id = ?", (conv_id,))
        db.commit()
        
        # Enviar mensaje real a través de la API de Meta si está configurada
        meta_sent = False
        meta_error = None
        if meta_client.is_configured():
            success, response = meta_client.send_message(recipient_id, text)
            meta_sent = success
            if not success:
                meta_error = response
                
        return jsonify({
            'status': 'success', 
            'meta_sent': meta_sent,
            'meta_error': meta_error
        })

@app.route('/api/auto-responders', methods=['GET', 'POST'])
def manage_autoresponders():
    db = get_db()
    cursor = db.cursor()
    
    if request.method == 'GET':
        cursor.execute("SELECT * FROM auto_responders ORDER BY keyword ASC")
        responders = [dict(row) for row in cursor.fetchall()]
        return jsonify(responders)
        
    elif request.method == 'POST':
        data = request.json
        keyword = data.get('keyword', '').lower().strip()
        response_text = data.get('response_text', '').strip()
        is_active = int(data.get('is_active', 1))
        
        if not keyword or not response_text:
            return jsonify({'error': 'Keyword y response_text son obligatorios.'}), 400
            
        try:
            cursor.execute(
                "INSERT OR REPLACE INTO auto_responders (keyword, response_text, is_active) VALUES (?, ?, ?)",
                (keyword, response_text, is_active)
            )
            db.commit()
            return jsonify({'status': 'success'})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

@app.route('/api/auto-responders/<int:responder_id>', methods=['PUT', 'DELETE'])
def detail_autoresponder(responder_id):
    db = get_db()
    cursor = db.cursor()
    
    if request.method == 'PUT':
        data = request.json
        is_active = data.get('is_active')
        response_text = data.get('response_text')
        
        fields = []
        params = []
        if is_active is not None:
            fields.append("is_active = ?")
            params.append(int(is_active))
        if response_text is not None:
            fields.append("response_text = ?")
            params.append(response_text)
            
        if not fields:
            return jsonify({'error': 'Nada que actualizar'}), 400
            
        params.append(responder_id)
        cursor.execute(f"UPDATE auto_responders SET {', '.join(fields)} WHERE id = ?", tuple(params))
        db.commit()
        return jsonify({'status': 'success'})
        
    elif request.method == 'DELETE':
        cursor.execute("DELETE FROM auto_responders WHERE id = ?", (responder_id,))
        db.commit()
        return jsonify({'status': 'success'})

# --- SIMULADOR DE MENSAJES ENTRANTES ---

@app.route('/api/simulator/receive', methods=['POST'])
def simulate_incoming_message():
    """
    Simula la llegada de un Webhook inyectando el mensaje en el flujo de negocio del backend.
    """
    data = request.json
    sender_id = data.get('sender_id')
    username = data.get('username')
    name = data.get('name')
    text = data.get('text', '')
    
    if not sender_id or not username:
        return jsonify({'error': 'sender_id y username son requeridos para la simulación.'}), 400
        
    # Limpiar username (asegurar que no lleve @ al guardar)
    username = username.replace('@', '').strip()
    
    # 1. Asegurar que el contacto existe
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT * FROM contacts WHERE id = ?", (sender_id,))
    contact = cursor.fetchone()
    
    if not contact:
        cursor.execute(
            "INSERT INTO contacts (id, username, name, avatar_url, stage) VALUES (?, ?, ?, ?, 'Lead')",
            (sender_id, username, name or f"Simulado @{username}", f"https://api.dicebear.com/7.x/bottts/svg?seed={username}")
        )
    
    # 2. Construir objeto de evento similar al webhook de Meta
    messaging_event = {
        'sender': {'id': sender_id},
        'recipient': {'id': 'my_instagram_page_id'},
        'message': {
            'mid': f'mid_sim_{int(time.time()*1000)}',
            'text': text
        }
    }
    
    # 3. Procesar como si fuera un webhook real
    process_messaging_event(messaging_event)
    
    return jsonify({
        'status': 'success',
        'message': 'Mensaje simulado procesado correctamente.',
        'details': {
            'sender_id': sender_id,
            'username': username,
            'text': text
        }
    })

if __name__ == '__main__':
    # Inicializar Base de Datos en el arranque
    init_db()
    
    # Ejecutar la aplicación
    port = int(os.environ.get('PORT', 5000))
    logger.info(f"Iniciando Servidor CRM de Instagram en puerto {port}...")
    app.run(host='0.0.0.0', port=port, debug=True)
