-- Permite registrar o escopo comercial sem um PDF de proposta, para os casos
-- em que o cliente pede a visita antes de a proposta existir: o analista
-- descreve o escopo em texto livre e a mesma IA de extração da proposta
-- estrutura os campos.
ALTER TABLE public.propostas_comerciais
  ALTER COLUMN arquivo_nome DROP NOT NULL,
  ALTER COLUMN arquivo_path DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'pdf',
  ADD COLUMN IF NOT EXISTS texto_manual text;

ALTER TABLE public.propostas_comerciais
  DROP CONSTRAINT IF EXISTS propostas_comerciais_origem_check;
ALTER TABLE public.propostas_comerciais
  ADD CONSTRAINT propostas_comerciais_origem_check CHECK (origem IN ('pdf', 'manual'));
