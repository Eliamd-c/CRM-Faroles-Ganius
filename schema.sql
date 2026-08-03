-- Definición de la base de datos Supabase para CRM 2.0

-- Crear tabla customers
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    instagram_id TEXT UNIQUE NOT NULL,
    name TEXT,
    bot_paused BOOLEAN DEFAULT FALSE,
    bot_state TEXT DEFAULT 'active',
    awaiting_input_type TEXT,
    awaiting_input_field TEXT,
    awaiting_input_prompt TEXT,
    awaiting_input_retries INTEGER DEFAULT 0,
    current_flow_id TEXT,
    current_step_index TEXT,
    fields JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla messages
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    instagram_id TEXT NOT NULL,
    direction TEXT CHECK (direction IN ('inbound', 'outbound')),
    message_type TEXT DEFAULT 'text',
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_instagram_id ON public.messages(instagram_id);
