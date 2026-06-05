ALTER TABLE public.formularios
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS revisao text,
  ADD COLUMN IF NOT EXISTS data_revisao date,
  ADD COLUMN IF NOT EXISTS elaborado_por text,
  ADD COLUMN IF NOT EXISTS aprovado_por text;