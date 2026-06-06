
ALTER TABLE public.perguntas
  ADD COLUMN IF NOT EXISTS condicional_pergunta_id uuid REFERENCES public.perguntas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS condicional_operador text,
  ADD COLUMN IF NOT EXISTS condicional_valor text;

ALTER TABLE public.perguntas
  DROP CONSTRAINT IF EXISTS perguntas_condicional_operador_check;

ALTER TABLE public.perguntas
  ADD CONSTRAINT perguntas_condicional_operador_check
  CHECK (condicional_operador IS NULL OR condicional_operador IN ('igual','diferente','contem'));
