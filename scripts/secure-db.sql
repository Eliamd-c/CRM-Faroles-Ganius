-- ==========================================
-- SCRIPT DE SEGURIDAD (Row Level Security)
-- ==========================================
-- Este script bloquea el acceso público a tus tablas
-- para que solo el backend (usando la Service Role Key)
-- pueda leer y escribir.
--
-- Es seguro correrlo varias veces: cada bloque revisa si la tabla
-- existe antes de tocarla, así que nunca falla por una tabla faltante
-- (por ejemplo sequence_subscriptions, si esa función aún no está en uso).

DO $$
BEGIN
  IF to_regclass('public.customers') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE customers ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Public Access" ON customers';
    EXECUTE 'DROP POLICY IF EXISTS "Service Role Full Access" ON customers';
    EXECUTE 'CREATE POLICY "Service Role Full Access" ON customers FOR ALL USING (auth.role() = ''service_role'')';
  END IF;

  IF to_regclass('public.knowledge_chunks') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Public Access" ON knowledge_chunks';
    EXECUTE 'DROP POLICY IF EXISTS "Service Role Full Access" ON knowledge_chunks';
    EXECUTE 'CREATE POLICY "Service Role Full Access" ON knowledge_chunks FOR ALL USING (auth.role() = ''service_role'')';
  END IF;

  IF to_regclass('public.learned_responses') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE learned_responses ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Public Access" ON learned_responses';
    EXECUTE 'DROP POLICY IF EXISTS "Service Role Full Access" ON learned_responses';
    EXECUTE 'CREATE POLICY "Service Role Full Access" ON learned_responses FOR ALL USING (auth.role() = ''service_role'')';
  END IF;

  IF to_regclass('public.media_catalog') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE media_catalog ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Public Access" ON media_catalog';
    EXECUTE 'DROP POLICY IF EXISTS "Service Role Full Access" ON media_catalog';
    EXECUTE 'CREATE POLICY "Service Role Full Access" ON media_catalog FOR ALL USING (auth.role() = ''service_role'')';
  END IF;

  IF to_regclass('public.ai_analytics') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE ai_analytics ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Public Access" ON ai_analytics';
    EXECUTE 'DROP POLICY IF EXISTS "Service Role Full Access" ON ai_analytics';
    EXECUTE 'CREATE POLICY "Service Role Full Access" ON ai_analytics FOR ALL USING (auth.role() = ''service_role'')';
  END IF;

  IF to_regclass('public.sequence_subscriptions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE sequence_subscriptions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Public Access" ON sequence_subscriptions';
    EXECUTE 'DROP POLICY IF EXISTS "Service Role Full Access" ON sequence_subscriptions';
    EXECUTE 'CREATE POLICY "Service Role Full Access" ON sequence_subscriptions FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
END $$;

-- Columnas del Agente IA (fuera del JSONB "fields" para evitar colisiones
-- con acciones de flujo tipo "set_field")
ALTER TABLE customers ADD COLUMN IF NOT EXISTS ai_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS current_ai_prompt TEXT DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS ignore_master_context BOOLEAN DEFAULT false;

-- Nota: Si usas Supabase client en el frontend con el anon_key,
-- el frontend ya no podrá leer directamente la DB (que es lo correcto y seguro).
-- Todo debe pasar por el backend (app.js), usando SUPABASE_SERVICE_ROLE_KEY.
