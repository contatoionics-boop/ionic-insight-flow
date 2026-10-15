-- Formulários: "sugerir no agendamento quando o escopo tiver ..." (pista, comboio,
-- tanque com lubrificante, sonda, frota). Lista de chaves de entidade do escopo.
-- Rode no SQL Editor do Supabase. É idempotente.

ALTER TABLE public.formularios
  ADD COLUMN IF NOT EXISTS sugerir_quando text[] NOT NULL DEFAULT '{}'::text[];
