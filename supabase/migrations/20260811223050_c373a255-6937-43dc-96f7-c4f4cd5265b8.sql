CREATE TYPE public.bloco_layout AS ENUM ('cartao', 'matriz', 'fotos');

CREATE TABLE public.pergunta_blocos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  secao_id uuid NOT NULL REFERENCES public.secoes(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  layout public.bloco_layout NOT NULL DEFAULT 'cartao',
  ordem integer NOT NULL DEFAULT 0,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_pergunta_blocos_secao ON public.pergunta_blocos(secao_id, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pergunta_blocos TO authenticated;
GRANT SELECT ON public.pergunta_blocos TO anon;
GRANT ALL ON public.pergunta_blocos TO service_role;

ALTER TABLE public.pergunta_blocos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocos_select_auth" ON public.pergunta_blocos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "blocos_select_anon" ON public.pergunta_blocos
  FOR SELECT TO anon USING (true);

CREATE POLICY "blocos_manage_admin" ON public.pergunta_blocos
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

CREATE TRIGGER set_pergunta_blocos_atualizado_em
  BEFORE UPDATE ON public.pergunta_blocos
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

ALTER TABLE public.perguntas
  ADD COLUMN bloco_id uuid REFERENCES public.pergunta_blocos(id) ON DELETE SET NULL,
  ADD COLUMN bloco_linha text,
  ADD COLUMN bloco_coluna text;

CREATE INDEX idx_perguntas_bloco ON public.perguntas(bloco_id);