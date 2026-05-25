-- Vincula caso ao formulário usado
ALTER TABLE public.casos ADD COLUMN formulario_id uuid;

-- Token público do agente técnico
CREATE TABLE public.links_agente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  caso_id uuid NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz,
  utilizado_em timestamptz
);
CREATE INDEX idx_links_agente_token ON public.links_agente(token);

ALTER TABLE public.links_agente ENABLE ROW LEVEL SECURITY;

-- Super admin gerencia tudo
CREATE POLICY "links super admin all" ON public.links_agente
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Admin cria/lê links dos próprios casos
CREATE POLICY "links admin select" ON public.links_agente
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.casos c
      WHERE c.id = links_agente.caso_id
        AND (c.criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos'))
    )
  );

CREATE POLICY "links admin insert" ON public.links_agente
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.casos c
      WHERE c.id = links_agente.caso_id AND c.criado_por = auth.uid()
    )
  );

-- Acesso público anônimo pelo token (agente técnico em campo sem login)
CREATE POLICY "links anon select by token" ON public.links_agente
  FOR SELECT TO anon
  USING (true);