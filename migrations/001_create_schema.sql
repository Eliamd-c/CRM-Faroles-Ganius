-- Migration: Create CMR Faroles Schema
-- Migrated from SQLite to Supabase PostgreSQL
-- Created: 2026-07-21

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    name TEXT,
    avatar_url TEXT,
    stage TEXT DEFAULT 'Lead',
    tags TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    phone_number TEXT,
    is_wholesaler_potential INTEGER DEFAULT 0,
    flow_step TEXT DEFAULT 'start',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- New fields for profile tracking
    last_message_received_at TIMESTAMP,
    last_message_sent_at TIMESTAMP,
    message_count INTEGER DEFAULT 0,
    response_rate DECIMAL(5,2) DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    days_since_last_message INTEGER DEFAULT 0
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    contact_id TEXT REFERENCES contacts(id) ON DELETE CASCADE,
    last_message_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id TEXT,
    recipient_id TEXT,
    text TEXT,
    media_url TEXT DEFAULT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    direction TEXT,
    sender_type TEXT,
    status TEXT DEFAULT 'sent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Auto responders table
CREATE TABLE IF NOT EXISTS auto_responders (
    id SERIAL PRIMARY KEY,
    keyword TEXT UNIQUE,
    response_text TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Flows table (embudo persuasivo)
CREATE TABLE IF NOT EXISTS flows (
    id TEXT PRIMARY KEY,
    message_text TEXT,
    media_url TEXT,
    buttons_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Triggers table
CREATE TABLE IF NOT EXISTS ai_triggers (
    id SERIAL PRIMARY KEY,
    intent_name TEXT UNIQUE,
    description TEXT,
    examples TEXT,
    target_flow TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agents table (NEW - para multi-user)
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'agent',
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity log table (NEW - auditoría)
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    contact_id TEXT REFERENCES contacts(id) ON DELETE CASCADE,
    action TEXT,
    details JSONB DEFAULT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conversation tracking table (NEW - control)
CREATE TABLE IF NOT EXISTS conversation_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
    stage TEXT DEFAULT 'active',
    assigned_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    priority INTEGER DEFAULT 2,
    next_follow_up_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_stage ON contacts(stage);
CREATE INDEX IF NOT EXISTS idx_contacts_is_active ON contacts(is_active);
CREATE INDEX IF NOT EXISTS idx_contacts_last_message ON contacts(last_message_received_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_ai_triggers_active ON ai_triggers(is_active);
CREATE INDEX IF NOT EXISTS idx_activity_log_agent ON activity_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_contact ON activity_log(contact_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log(timestamp);

-- Seed data: Default flows
INSERT INTO flows (id, message_text, buttons_json) VALUES
('start', '¡Hola! Qué alegría saludarte. 🌟 Sabemos que los faroles iluminan momentos especiales. ¿Buscas faroles para decorar tu hogar o te gustaría descubrir cómo generar ingresos extra con nosotros? 👇', '[{"type":"text","title":"🏠 Decorar mi hogar","payload":"FLOW_HOME"},{"type":"text","title":"💰 Generar ingresos","payload":"FLOW_BUSINESS"}]'),
('FLOW_BUSINESS', '¡Excelente visión! 🚀 Tenemos un programa para distribuidores donde puedes comprar con descuentos exclusivos y obtener un gran margen de ganancia. Además te damos todo el material publicitario.', '[{"type":"text","title":"📲 Enviar material al WA","payload":"WA_BUSINESS"}]'),
('FLOW_HOME', '¡Perfecto! Tenemos diseños hermosos listos. Por cierto, ¿sabías que si te unes con amigos o familiares para comprar, les sale a precio de mayorista? 😉', '[{"type":"text","title":"📲 Ver catálogo en WA","payload":"WA_HOME"}]')
ON CONFLICT (id) DO NOTHING;

-- Seed data: Default auto responders
INSERT INTO auto_responders (keyword, response_text, is_active) VALUES
('precio', '¡Hola! Nuestros precios varían según el producto. ¿De cuál te gustaría recibir información?', 1),
('hola', '¡Hola! Bienvenido a nuestro canal de soporte. ¿En qué podemos ayudarte hoy?', 1),
('info', 'Hola, gracias por escribirnos. Puedes ver nuestro catálogo completo en el enlace de nuestra biografía.', 1)
ON CONFLICT (keyword) DO NOTHING;

-- Seed data: Default AI triggers
INSERT INTO ai_triggers (intent_name, description, examples, target_flow, is_active) VALUES
('saludo', 'El cliente saluda o inicia la conversación sin pedir nada específico todavía', 'hola | buenas tardes | hey qué tal, vi su página', 'start', 1),
('interes_hogar', 'El cliente quiere comprar faroles para decorar su casa, un evento, un regalo o uso personal', 'quiero un farol para mi sala | ¿tienen faroles para una boda? | busco algo para decorar mi jardín', 'FLOW_HOME', 1),
('interes_negocio', 'El cliente pregunta por revender, distribuir, comprar al por mayor o generar ingresos con los productos', 'quiero vender sus faroles | ¿manejan precio mayorista? | ¿cómo funciona lo de distribuir?', 'FLOW_BUSINESS', 1)
ON CONFLICT (intent_name) DO NOTHING;
