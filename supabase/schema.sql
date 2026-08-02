-- 1. Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create notes table
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  embedding vector(1536)
);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS notes_embedding_hnsw_idx 
ON public.notes 
USING hnsw (embedding vector_cosine_ops);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notes" 
ON public.notes FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes" 
ON public.notes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" 
ON public.notes FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" 
ON public.notes FOR DELETE 
USING (auth.uid() = user_id);

-- 4. PostgreSQL Function for Cosine Similarity RAG Search
CREATE OR REPLACE FUNCTION match_notes (
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.1,
  match_count int DEFAULT 5,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    notes.id,
    notes.title,
    notes.content,
    1 - (notes.embedding <=> query_embedding) AS similarity
  FROM notes
  WHERE notes.user_id = p_user_id
    AND notes.embedding IS NOT NULL
    AND (1 - (notes.embedding <=> query_embedding)) > match_threshold
  ORDER BY notes.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 5. Database Webhook / Trigger documentation:
-- To auto-trigger embedding generation on INSERT or UPDATE:
-- Option A: Go to Supabase Dashboard -> Database -> Webhooks -> Create Webhook
--           Event: INSERT, UPDATE on table public.notes
--           HTTP Request: POST to https://<your-project-ref>.supabase.co/functions/v1/generate-embedding
--
-- Option B: SQL Trigger with pg_net extension:
-- CREATE OR REPLACE FUNCTION trigger_generate_embedding()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   PERFORM net.http_post(
--     url := 'https://<your-project-ref>.supabase.co/functions/v1/generate-embedding',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
--     body := jsonb_build_object('record', row_to_json(NEW))
--   );
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
