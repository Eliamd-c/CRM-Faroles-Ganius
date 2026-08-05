-- Migración: Escalado a Humano (Bloque 3b)
-- Agregar columnas de timestamp y razón para rastrear cuándo se pausó un bot

-- Agregar columnas si no existen
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS bot_paused_at TIMESTAMPTZ;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS bot_paused_reason TEXT;

-- Backfill: los ya pausados entran a la cola con su última actualización conocida
UPDATE public.customers
   SET bot_paused_at = COALESCE(updated_at, NOW())
 WHERE bot_paused = true AND bot_paused_at IS NULL;

-- Índice parcial optimizado: busca por antigüedad dentro de los pausados
CREATE INDEX IF NOT EXISTS idx_customers_bot_paused
  ON public.customers (bot_paused_at ASC NULLS FIRST)
  WHERE bot_paused = true;
