
-- ============ respostas_agente ============
CREATE TABLE public.respostas_agente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id uuid NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  pergunta_id uuid NOT NULL REFERENCES public.perguntas(id) ON DELETE CASCADE,
  tipo public.pergunta_tipo NOT NULL,
  valor_texto text,
  arquivo_path text,
  transcricao text,
  ia_aprovado boolean,
  ia_motivo text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_respostas_caso ON public.respostas_agente(caso_id);
CREATE INDEX idx_respostas_pergunta ON public.respostas_agente(pergunta_id);

GRANT SELECT, INSERT ON public.respostas_agente TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.respostas_agente TO authenticated;
GRANT ALL ON public.respostas_agente TO service_role;

ALTER TABLE public.respostas_agente ENABLE ROW LEVEL SECURITY;

-- super admin: tudo
CREATE POLICY "respostas super admin all" ON public.respostas_agente
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- admin: ver e gerenciar respostas dos casos que vê
CREATE POLICY "respostas admin select" ON public.respostas_agente
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') AND EXISTS (
      SELECT 1 FROM public.casos c
      WHERE c.id = respostas_agente.caso_id
        AND (c.criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos'))
    )
  );

CREATE POLICY "respostas admin delete" ON public.respostas_agente
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') AND EXISTS (
      SELECT 1 FROM public.casos c
      WHERE c.id = respostas_agente.caso_id AND c.criado_por = auth.uid()
    )
  );

-- especialista: ler respostas de casos em revisão/aprovados
CREATE POLICY "respostas especialista select" ON public.respostas_agente
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'especialista') AND EXISTS (
      SELECT 1 FROM public.casos c
      WHERE c.id = respostas_agente.caso_id
        AND c.status IN ('aguardando_revisao','aprovado')
    )
  );

-- anon: inserir resposta se houver link de agente válido (não expirado) para o caso
CREATE POLICY "respostas anon insert via link" ON public.respostas_agente
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.links_agente l
      WHERE l.caso_id = respostas_agente.caso_id
        AND (l.expira_em IS NULL OR l.expira_em > now())
    )
  );

-- ============ Storage bucket ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('agente-uploads', 'agente-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- anon pode fazer upload em pastas {caso_id}/... se houver link válido
CREATE POLICY "agente uploads anon insert"
ON storage.objects FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'agente-uploads'
  AND EXISTS (
    SELECT 1 FROM public.links_agente l
    WHERE l.caso_id::text = (storage.foldername(name))[1]
      AND (l.expira_em IS NULL OR l.expira_em > now())
  )
);

-- anon pode ler os próprios uploads (mesma regra)
CREATE POLICY "agente uploads anon select"
ON storage.objects FOR SELECT TO anon
USING (
  bucket_id = 'agente-uploads'
  AND EXISTS (
    SELECT 1 FROM public.links_agente l
    WHERE l.caso_id::text = (storage.foldername(name))[1]
  )
);

-- usuários autenticados (admin/especialista/super_admin) podem ler arquivos
CREATE POLICY "agente uploads auth select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'agente-uploads');

CREATE POLICY "agente uploads auth all"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'agente-uploads' AND public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (bucket_id = 'agente-uploads' AND public.has_role(auth.uid(), 'super_admin'));
