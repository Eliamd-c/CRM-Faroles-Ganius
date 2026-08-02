-- ==========================================
-- TABLA DE FLUJOS PERSISTENTES (app_flows)
-- ==========================================
-- Los flujos del Builder se guardaban en flows.json, un archivo dentro del
-- repositorio. Como git lo sobreescribe en cada despliegue, los cambios hechos
-- desde el Builder (crear/editar/borrar flujos) se perdían al desplegar.
--
-- Esta tabla mueve el almacén de flujos a Supabase (persistente entre
-- despliegues). El backend la usa como fuente de verdad y deja flows.json solo
-- como semilla inicial y respaldo local.
--
-- Es seguro correrlo varias veces (IF NOT EXISTS / OR REPLACE de política).

CREATE TABLE IF NOT EXISTS app_flows (
  id INT PRIMARY KEY,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seguridad: solo el backend (Service Role) puede leer/escribir.
ALTER TABLE app_flows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON app_flows;
DROP POLICY IF EXISTS "Service Role Full Access" ON app_flows;
CREATE POLICY "Service Role Full Access" ON app_flows FOR ALL USING (auth.role() = 'service_role');

-- Nota: no hace falta insertar nada a mano. La primera vez que el backend
-- arranque y encuentre la tabla vacía, la sembrará automáticamente con el
-- contenido actual de flows.json. A partir de ahí, todo lo que hagas en el
-- Builder queda guardado aquí y sobrevive a los despliegues.
