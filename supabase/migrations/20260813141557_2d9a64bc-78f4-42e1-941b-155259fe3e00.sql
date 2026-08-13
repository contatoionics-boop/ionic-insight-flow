ALTER TYPE public.mapeamento_evento_tipo ADD VALUE IF NOT EXISTS 'proposta_anexada';
ALTER TYPE public.mapeamento_evento_tipo ADD VALUE IF NOT EXISTS 'proposta_extraida';
ALTER TYPE public.mapeamento_evento_tipo ADD VALUE IF NOT EXISTS 'divergencias_calculadas';

ALTER TABLE public.casos
  ADD COLUMN IF NOT EXISTS divergencias_proposta jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.propostas_comerciais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id uuid NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  arquivo_nome text NOT NULL,
  arquivo_path text NOT NULL,
  tamanho_bytes bigint,
  status text NOT NULL DEFAULT 'pendente',
  erro_mensagem text,
  escopo jsonb NOT NULL DEFAULT '{}'::jsonb,
  texto_extraido text,
  criado_por uuid,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS propostas_comerciais_caso_idx ON public.propostas_comerciais(caso_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.propostas_comerciais TO authenticated;
GRANT ALL ON public.propostas_comerciais TO service_role;

ALTER TABLE public.propostas_comerciais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestores gerenciam propostas"
ON public.propostas_comerciais FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'especialista')
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'especialista')
);

CREATE POLICY "Agente ve proposta do seu caso"
ON public.propostas_comerciais FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.casos c
    WHERE c.id = propostas_comerciais.caso_id AND c.agente_id = auth.uid()
  )
);

DROP TRIGGER IF EXISTS trg_propostas_comerciais_atualizado_em ON public.propostas_comerciais;
CREATE TRIGGER trg_propostas_comerciais_atualizado_em
BEFORE UPDATE ON public.propostas_comerciais
FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

CREATE POLICY "Gestores gerenciam arquivos de proposta"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'propostas' AND (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'especialista')
  )
)
WITH CHECK (
  bucket_id = 'propostas' AND (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'especialista')
  )
);
