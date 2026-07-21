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
    phone_number TEXT,             -- Capturado del puente WhatsApp
    is_wholesaler_potential INTEGER DEFAULT 0, -- 1 si mostró interés en vender
    flow_step TEXT DEFAULT 'start',-- Paso actual del embudo persuasivo
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

-- Disparadores de intención basados en IA
-- La IA lee cada mensaje entrante y decide cuál intención expresa el cliente,
-- sin importar las palabras exactas que use.
CREATE TABLE IF NOT EXISTS ai_triggers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    intent_name TEXT UNIQUE,       -- Identificador de la intención (ej: 'interes_negocio')
    description TEXT,              -- Qué significa la intención (esto lo lee la IA)
    examples TEXT,                 -- Frases de ejemplo separadas por " | "
    target_flow TEXT,              -- Paso del flujo que se dispara al detectarla
    is_active INTEGER DEFAULT 1
);

INSERT OR IGNORE INTO ai_triggers (intent_name, description, examples, target_flow, is_active) VALUES
('saludo', 'El cliente saluda o inicia la conversación sin pedir nada específico todavía', 'hola | buenas tardes | hey qué tal, vi su página', 'start', 1),
('interes_hogar', 'El cliente quiere comprar faroles para decorar su casa, un evento, un regalo o uso personal', 'quiero un farol para mi sala | ¿tienen faroles para una boda? | busco algo para decorar mi jardín', 'FLOW_HOME', 1),
('interes_negocio', 'El cliente pregunta por revender, distribuir, comprar al por mayor o generar ingresos con los productos', 'quiero vender sus faroles | ¿manejan precio mayorista? | ¿cómo funciona lo de distribuir?', 'FLOW_BUSINESS', 1);

-- Embudos persuasivos (Manychat style)
CREATE TABLE IF NOT EXISTS flows (
    id TEXT PRIMARY KEY,           -- Identificador del paso (ej: 'welcome', 'wholesaler_pitch')
    message_text TEXT,             -- El texto persuasivo
    media_url TEXT,                -- Opcional imagen
    buttons_json TEXT              -- Botones (Quick Replies) en formato JSON
);

-- Insertar pasos por defecto del embudo persuasivo
INSERT OR IGNORE INTO flows (id, message_text, buttons_json) VALUES 
('start', '¡Hola! Qué alegría saludarte. 🌟 Sabemos que los faroles iluminan momentos especiales. ¿Buscas faroles para decorar tu hogar o te gustaría descubrir cómo generar ingresos extra con nosotros? 👇', '[{"type":"text","title":"🏠 Decorar mi hogar","payload":"FLOW_HOME"},{"type":"text","title":"💰 Generar ingresos","payload":"FLOW_BUSINESS"}]'),
('FLOW_BUSINESS', '¡Excelente visión! 🚀 Tenemos un programa para distribuidores donde puedes comprar con descuentos exclusivos y obtener un gran margen de ganancia. Además te damos todo el material publicitario.', '[{"type":"text","title":"📲 Enviar material al WA","payload":"WA_BUSINESS"}]'),
('FLOW_HOME', '¡Perfecto! Tenemos diseños hermosos listos. Por cierto, ¿sabías que si te unes con amigos o familiares para comprar, les sale a precio de mayorista? 😉', '[{"type":"text","title":"📲 Ver catálogo en WA","payload":"WA_HOME"}]');
