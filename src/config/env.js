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
  process.env.VERIFY_TOKEN = process.env.VERIFY_TOKEN || process.env.WEBHOOK_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN;
  process.env.PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN;
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Variables de entorno faltantes:', missing.join(', '));
    process.exit(1);
  }
  console.log('✅ Variables de entorno validadas correctamente.');
}

module.exports = { validateEnv };

