
CREATE POLICY "respostas especialista update"
ON public.respostas_agente FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'especialista'::app_role))
WITH CHECK (has_role(auth.uid(), 'especialista'::app_role));

CREATE POLICY "respostas admin update"
ON public.respostas_agente FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
