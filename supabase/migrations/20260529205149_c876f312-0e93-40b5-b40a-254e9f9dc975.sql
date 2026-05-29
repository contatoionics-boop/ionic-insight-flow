GRANT SELECT, UPDATE ON public.respostas_agente TO anon;

CREATE POLICY "respostas anon select via link"
  ON public.respostas_agente
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.links_agente l
      WHERE l.caso_id = respostas_agente.caso_id
        AND (l.expira_em IS NULL OR l.expira_em > now())
    )
  );

CREATE POLICY "respostas anon update via link"
  ON public.respostas_agente
  FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.links_agente l
      WHERE l.caso_id = respostas_agente.caso_id
        AND (l.expira_em IS NULL OR l.expira_em > now())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.links_agente l
      WHERE l.caso_id = respostas_agente.caso_id
        AND (l.expira_em IS NULL OR l.expira_em > now())
    )
  );