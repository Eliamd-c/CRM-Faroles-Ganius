require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('Connecting to Supabase...');
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('✅ Extension "vector" enabled.');

    // Ensure ai_knowledge table exists and has an embedding column
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_knowledge (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        section_title TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding VECTOR(1536),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Table "ai_knowledge" verified.');

    // Create match_knowledge function
    await pool.query(`DROP FUNCTION IF EXISTS match_knowledge(vector,double precision,integer);`);
    await pool.query(`
      CREATE OR REPLACE FUNCTION match_knowledge (
        query_embedding vector(1536),
        match_threshold float,
        match_count int
      )
      RETURNS TABLE (
        id uuid,
        section_title text,
        content text,
        similarity float
      )
      LANGUAGE sql STABLE
      AS $$
        SELECT
          ai_knowledge.id,
          ai_knowledge.section_title,
          ai_knowledge.content,
          1 - (ai_knowledge.embedding <=> query_embedding) AS similarity
        FROM ai_knowledge
        WHERE 1 - (ai_knowledge.embedding <=> query_embedding) > match_threshold
        ORDER BY (ai_knowledge.embedding <=> query_embedding) ASC
        LIMIT match_count;
      $$;
    `);
    console.log('✅ Function "match_knowledge" created.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

run();
