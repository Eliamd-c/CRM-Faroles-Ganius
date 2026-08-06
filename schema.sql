-- Definición de la base de datos Supabase para CRM 2.0

-- Instrucciones dinámicas por etapa (Opción B Híbrida)
CREATE TABLE IF NOT EXISTS public.instruction_overrides (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    stage_name TEXT NOT NULL UNIQUE, -- 'ONBOARDING', 'DISCOVERY', 'RECOMMENDATION', 'CHECKOUT'
    instruction_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instruction_overrides_stage ON instruction_overrides(stage_name);

-- Crear tabla customers
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    instagram_id TEXT UNIQUE NOT NULL,
    name TEXT,
    username TEXT,
    profile_picture_url TEXT,
    bot_paused BOOLEAN DEFAULT FALSE,
    bot_paused_at TIMESTAMP WITH TIME ZONE,
    bot_paused_reason TEXT,
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instagram_id TEXT NOT NULL,
    mid TEXT UNIQUE, -- ID único del mensaje en Instagram (usado para message_edit)
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type TEXT DEFAULT 'text',
    content TEXT,
    attachment_type TEXT, -- image, video, audio, file, ig_reel, story_mention, etc.
    attachment_url TEXT,
    reply_to_mid TEXT, -- mid del mensaje al que se responde
    metadata JSONB DEFAULT '{}'::jsonb, -- datos extra: reaction, referral, postback, etc.
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_instagram_id ON public.messages(instagram_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

-- Índice para escalado a humano: ordena por antigüedad dentro de los pausados
CREATE INDEX IF NOT EXISTS idx_customers_bot_paused
  ON public.customers (bot_paused_at ASC NULLS FIRST)
  WHERE bot_paused = true;

-- Crear tabla app_config para configuraciones del sistema y tokens OAuth
CREATE TABLE IF NOT EXISTS public.app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla langgraph_checkpoints para memoria de agentes LangGraph
CREATE TABLE IF NOT EXISTS public.langgraph_checkpoints (
    thread_id TEXT PRIMARY KEY,
    checkpoint JSONB NOT NULL,
    metadata JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
