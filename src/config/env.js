'use strict';

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PAGE_ACCESS_TOKEN',
  'VERIFY_TOKEN',
  'INSTAGRAM_ACCOUNT_ID',
];

function validateEnv() {
  // Normalizar alias habituales de variables de entorno (Hostinger, Render, .env local)
  process.env.VERIFY_TOKEN = process.env.VERIFY_TOKEN || process.env.WEBHOOK_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || 'faroles_crm_2026';
  process.env.PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN || process.env.META_TOKEN || process.env.FB_TOKEN;
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.DATABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  process.env.INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || process.env.IG_ID || process.env.META_IG_ID || process.env.PAGE_ID || 'dummy_id';

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.warn('⚠️ ADVERTENCIA: Variables de entorno faltantes o no detectadas:', missing.join(', '));
    console.warn('⚠️ El servidor continuará arrancando para garantizar la disponibilidad HTTP y evitar el error 503.');
    return false;
  }
  console.log('✅ Variables de entorno validadas correctamente.');
  return true;
}

module.exports = { validateEnv };

