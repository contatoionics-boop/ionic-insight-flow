-- Amplia leitura de respostas_agente para IAM (admin) e Especialista verem todos os casos
DROP POLICY IF EXISTS "respostas admin select all" ON public.respostas_agente;
CREATE POLICY "respostas admin select all"
  ON public.respostas_agente FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "respostas especialista select all" ON public.respostas_agente;
CREATE POLICY "respostas especialista select all"
  ON public.respostas_agente FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'especialista'));
