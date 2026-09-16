DROP POLICY IF EXISTS "casos vistoriador select" ON public.casos;
CREATE POLICY "casos vistoriador select"
  ON public.casos FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(), 'agente_tecnico'::public.app_role)
      OR public.has_role(auth.uid(), 'especialista'::public.app_role))
    AND agente_id = auth.uid()
  );

DROP POLICY IF EXISTS "casos vistoriador update" ON public.casos;
CREATE POLICY "casos vistoriador update"
  ON public.casos FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'agente_tecnico'::public.app_role)
      OR public.has_role(auth.uid(), 'especialista'::public.app_role))
    AND agente_id = auth.uid()
    AND status = ANY (ARRAY['agendado'::public.caso_status, 'em_andamento'::public.caso_status, 'rascunho'::public.caso_status])
  )
  WITH CHECK (
    (public.has_role(auth.uid(), 'agente_tecnico'::public.app_role)
      OR public.has_role(auth.uid(), 'especialista'::public.app_role))
    AND agente_id = auth.uid()
  );

DROP POLICY IF EXISTS "agendamentos agente select" ON public.agendamentos;
CREATE POLICY "agendamentos agente select"
  ON public.agendamentos FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(), 'agente_tecnico'::public.app_role)
      OR public.has_role(auth.uid(), 'especialista'::public.app_role))
    AND agente_id = auth.uid()
  );

DROP POLICY IF EXISTS "respostas vistoriador select" ON public.respostas_agente;
CREATE POLICY "respostas vistoriador select"
  ON public.respostas_agente FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(), 'agente_tecnico'::public.app_role)
      OR public.has_role(auth.uid(), 'especialista'::public.app_role))
    AND EXISTS (
      SELECT 1 FROM public.casos c
      WHERE c.id = respostas_agente.caso_id AND c.agente_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "respostas vistoriador insert" ON public.respostas_agente;
CREATE POLICY "respostas vistoriador insert"
  ON public.respostas_agente FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'agente_tecnico'::public.app_role)
      OR public.has_role(auth.uid(), 'especialista'::public.app_role))
    AND EXISTS (
      SELECT 1 FROM public.casos c
      WHERE c.id = respostas_agente.caso_id AND c.agente_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "respostas vistoriador update" ON public.respostas_agente;
CREATE POLICY "respostas vistoriador update"
  ON public.respostas_agente FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'agente_tecnico'::public.app_role)
      OR public.has_role(auth.uid(), 'especialista'::public.app_role))
    AND EXISTS (
      SELECT 1 FROM public.casos c
      WHERE c.id = respostas_agente.caso_id AND c.agente_id = auth.uid()
    )
  )
  WITH CHECK (
    (public.has_role(auth.uid(), 'agente_tecnico'::public.app_role)
      OR public.has_role(auth.uid(), 'especialista'::public.app_role))
    AND EXISTS (
      SELECT 1 FROM public.casos c
      WHERE c.id = respostas_agente.caso_id AND c.agente_id = auth.uid()
    )
  );