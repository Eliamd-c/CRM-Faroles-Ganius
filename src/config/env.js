'use strict';

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PAGE_ACCESS_TOKEN',
  'VERIFY_TOKEN',
  'INSTAGRAM_ACCOUNT_ID',
];

function validateEnv() {
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Variables de entorno faltantes:', missing.join(', '));
    process.exit(1);
  }
  console.log('✅ Variables de entorno validadas correctamente.');
}

module.exports = { validateEnv };
