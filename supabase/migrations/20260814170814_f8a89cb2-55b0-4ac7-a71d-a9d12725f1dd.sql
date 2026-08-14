ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS laudo_analise jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.blocos_padrao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  categoria text NOT NULL DEFAULT 'geral',
  escopo jsonb NOT NULL DEFAULT '{}'::jsonb,
  blocos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocos_padrao TO authenticated;
GRANT ALL ON public.blocos_padrao TO service_role;

ALTER TABLE public.blocos_padrao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocos_padrao_select" ON public.blocos_padrao;
CREATE POLICY "blocos_padrao_select" ON public.blocos_padrao
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "blocos_padrao_write" ON public.blocos_padrao;
CREATE POLICY "blocos_padrao_write" ON public.blocos_padrao
  FOR ALL TO authenticated
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

DROP TRIGGER IF EXISTS trg_blocos_padrao_atualizado_em ON public.blocos_padrao;
CREATE TRIGGER trg_blocos_padrao_atualizado_em
  BEFORE UPDATE ON public.blocos_padrao
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();