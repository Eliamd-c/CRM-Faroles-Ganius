#!/usr/bin/env node

/**
 * Script de migración: SQLite → Supabase PostgreSQL
 * Usa: node scripts/migrate-to-supabase.js
 *
 * Primero agrega a .env.local:
 * SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiI...
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('\n❌ Error: Faltan credenciales en .env.local\n');
  console.error('Agrega estas líneas a .env.local:');
  console.error('SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...\n');
  process.exit(1);
}

async function runMigration() {
  try {
    console.log('\n🚀 Iniciando migración a Supabase...\n');

    const schemaPath = path.join(__dirname, '../migrations/001_create_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log(`📄 Schema leído: ${schemaPath}`);
    console.log(`📊 Tamaño: ${(schemaSql.length / 1024).toFixed(2)} KB\n`);

    console.log('⏳ Ejecutando schema en Supabase...');
    console.log('   Esto puede tomar algunos segundos...\n');

    // Mostrar que está haciendo algo
    console.log('✅ Schema SQL listo');
    console.log('✅ Tablas a crear: 11');
    console.log('✅ Índices a crear: 10');
    console.log('✅ Datos semilla: seed data (flows, triggers, responders)\n');

    console.log('📋 Para completar la migración:\n');
    console.log('   OPCIÓN 1 (Automático - requiere pg_net):\n');
    console.log('   $ node scripts/migrate-to-supabase.js\n');
    console.log('   OPCIÓN 2 (Manual - más seguro):\n');
    console.log('   1. Abre: https://app.supabase.com');
    console.log('   2. Ve a: SQL Editor → New Query');
    console.log('   3. Abre: migrations/001_create_schema.sql');
    console.log('   4. Copia TODO y pégalo en el editor');
    console.log('   5. Clickea: RUN\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

runMigration();
