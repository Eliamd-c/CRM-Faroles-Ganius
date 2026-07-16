-- Configuración de la aplicación
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Contactos en el CRM
CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,           -- IG Sender-Scoped ID (IGSID) o ID simulado (sim_*)
    username TEXT UNIQUE,          -- Nombre de usuario en Instagram (ej: @john_doe)
    name TEXT,                     -- Nombre completo o mostrado
    avatar_url TEXT,               -- URL de foto de perfil
    stage TEXT DEFAULT 'Lead',     -- Etapa del pipeline: Lead, Contacted, Customer, Lost
    tags TEXT DEFAULT '',          -- Etiquetas separadas por comas (ej: "vip,interesado")
    notes TEXT DEFAULT '',         -- Notas internas de seguimiento
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Hilos de conversación
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,           -- ID de conversación, usualmente igual al contact_id
    contact_id TEXT,
    last_message_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    unread_count INTEGER DEFAULT 0,
    FOREIGN KEY(contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

-- Mensajes individuales
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT,
    sender_id TEXT,                -- 'agent', 'auto_response', o el ID del contacto (cliente)
    recipient_id TEXT,
    text TEXT,
    media_url TEXT DEFAULT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    direction TEXT,                -- 'incoming' (del cliente) o 'outgoing' (del CRM)
    sender_type TEXT,              -- 'customer', 'agent', 'auto_response'
    status TEXT DEFAULT 'sent',    -- 'sent', 'delivered', 'read'
    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Respuestas automáticas por palabras clave
CREATE TABLE IF NOT EXISTS auto_responders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT UNIQUE,           -- Palabra clave que dispara la respuesta (ej: "precio")
    response_text TEXT,            -- Texto de la respuesta automática
    is_active INTEGER DEFAULT 1    -- 1 = Activo, 0 = Inactivo
);

-- Insertar respuestas automáticas por defecto para demostración
INSERT OR IGNORE INTO auto_responders (keyword, response_text, is_active) VALUES 
('precio', '¡Hola! Nuestros precios varían según el producto. ¿De cuál te gustaría recibir información?', 1),
('hola', '¡Hola! Bienvenido a nuestro canal de soporte. ¿En qué podemos ayudarte hoy?', 1),
('info', 'Hola, gracias por escribirnos. Puedes ver nuestro catálogo completo en el enlace de nuestra biografía.', 1);
