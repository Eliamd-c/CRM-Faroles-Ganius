-- ==========================================
-- SCRIPT DE SEGURIDAD (Row Level Security)
-- ==========================================
-- Este script bloquea el acceso público a tus tablas
-- para que solo el backend (usando la Service Role Key) 
-- o roles autenticados puedan leer y escribir.

-- 1. Habilitar RLS en todas las tablas
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE learned_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_subscriptions ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar cualquier política pública existente (por si acaso)
DROP POLICY IF EXISTS "Public Access" ON customers;
DROP POLICY IF EXISTS "Public Access" ON knowledge_chunks;
DROP POLICY IF EXISTS "Public Access" ON learned_responses;
DROP POLICY IF EXISTS "Public Access" ON media_catalog;
DROP POLICY IF EXISTS "Public Access" ON ai_analytics;
DROP POLICY IF EXISTS "Public Access" ON sequence_subscriptions;

-- 3. Crear política para que solo el Service Role (Backend) tenga acceso total
CREATE POLICY "Service Role Full Access" ON customers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service Role Full Access" ON knowledge_chunks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service Role Full Access" ON learned_responses FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service Role Full Access" ON media_catalog FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service Role Full Access" ON ai_analytics FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service Role Full Access" ON sequence_subscriptions FOR ALL USING (auth.role() = 'service_role');

-- 4. Agregar columna ai_history si no existe (Fase 3)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS ai_history JSONB DEFAULT '[]'::jsonb;

-- 5. Mover current_ai_prompt / ignore_master_context fuera del JSONB "fields"
-- para que no colisionen con acciones de flujo tipo "set_field" (Fase 4)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS current_ai_prompt TEXT DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS ignore_master_context BOOLEAN DEFAULT false;

-- Nota: Si usas Supabase client en el frontend con el anon_key,
-- el frontend ya no podrá leer directamente la DB (que es lo correcto y seguro).
-- Todo debe pasar por el backend (app.js).
