-- ==========================================
-- SETUP DE MEMORIA VECTORIAL (RAG)
-- ==========================================
-- Crea todo lo necesario para que el Agente IA pueda buscar
-- información relevante por similitud semántica:
--   1. Extensión pgvector
--   2. Tabla knowledge_chunks (contexto maestro indexado por scripts/index-context.js)
--   3. Tabla learned_responses (respuestas aprendidas vía /api/ai/learn)
--   4. Funciones RPC match_knowledge() y match_learned_responses()
--
-- Es seguro correrlo aunque ya exista algo: usa IF NOT EXISTS / OR REPLACE,
-- así que no borra ni duplica datos existentes.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id BIGSERIAL PRIMARY KEY,
  section_title TEXT,
  content TEXT,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learned_responses (
  id BIGSERIAL PRIMARY KEY,
  question TEXT,
  answer TEXT,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id BIGINT,
  section_title TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    knowledge_chunks.id,
    knowledge_chunks.section_title,
    knowledge_chunks.content,
    1 - (knowledge_chunks.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks
  WHERE 1 - (knowledge_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY knowledge_chunks.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_learned_responses(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id BIGINT,
  question TEXT,
  answer TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    learned_responses.id,
    learned_responses.question,
    learned_responses.answer,
    1 - (learned_responses.embedding <=> query_embedding) AS similarity
  FROM learned_responses
  WHERE 1 - (learned_responses.embedding <=> query_embedding) > match_threshold
  ORDER BY learned_responses.embedding <=> query_embedding
  LIMIT match_count;
$$;
