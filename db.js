require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Hostinger inyectará estas variables de entorno en tiempo de ejecución
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
// Priorizar Service Role Key para evadir las políticas RLS y actuar como backend root
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
    try {
        supabase = createClient(supabaseUrl, supabaseKey);
        console.log('✅ Supabase conectado (URL detectada)');
    } catch (err) {
        console.warn('⚠️ Error inicializando Supabase:', err.message);
    }
} else {
    console.warn('⚠️ Supabase no está conectado: Faltan las variables SUPABASE_URL y SUPABASE_KEY. Hostinger las proveerá automáticamente en el despliegue.');
}

module.exports = supabase;
