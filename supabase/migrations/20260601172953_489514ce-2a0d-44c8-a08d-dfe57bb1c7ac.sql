
-- Campos de agendamento
ALTER TABLE public.casos
  ADD COLUMN IF NOT EXISTS agendado_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS duracao_min integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS endereco_vistoria text,
  ADD COLUMN IF NOT EXISTS observacoes_agendamento text;

CREATE INDEX IF NOT EXISTS idx_casos_agente_agendado
  ON public.casos (agente_id, agendado_em);

-- Policies para o vistoriador (agente_tecnico) ver e atualizar os próprios casos
DROP POLICY IF EXISTS "casos vistoriador select" ON public.casos;
CREATE POLICY "casos vistoriador select"
  ON public.casos FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'agente_tecnico'::app_role)
    AND agente_id = auth.uid()
  );

DROP POLICY IF EXISTS "casos vistoriador update" ON public.casos;
CREATE POLICY "casos vistoriador update"
  ON public.casos FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'agente_tecnico'::app_role)
    AND agente_id = auth.uid()
    AND status = ANY (ARRAY['agendado'::caso_status, 'em_andamento'::caso_status, 'rascunho'::caso_status])
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'agente_tecnico'::app_role)
    AND agente_id = auth.uid()
  );

-- Vistoriador também precisa ler o formulário, seções, perguntas e opções do caso dele
DROP POLICY IF EXISTS "formularios vistoriador select" ON public.formularios;
CREATE POLICY "formularios vistoriador select"
  ON public.formularios FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'agente_tecnico'::app_role));

DROP POLICY IF EXISTS "secoes vistoriador select" ON public.secoes;
CREATE POLICY "secoes vistoriador select"
  ON public.secoes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'agente_tecnico'::app_role));

DROP POLICY IF EXISTS "perguntas vistoriador select" ON public.perguntas;
CREATE POLICY "perguntas vistoriador select"
  ON public.perguntas FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'agente_tecnico'::app_role));

DROP POLICY IF EXISTS "opcoes vistoriador select" ON public.opcoes_pergunta;
CREATE POLICY "opcoes vistoriador select"
  ON public.opcoes_pergunta FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'agente_tecnico'::app_role));

DROP POLICY IF EXISTS "clientes vistoriador select" ON public.clientes;
CREATE POLICY "clientes vistoriador select"
  ON public.clientes FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'agente_tecnico'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.casos c
      WHERE c.cliente_id = clientes.id AND c.agente_id = auth.uid()
    )
  );

-- Respostas: vistoriador pode inserir/atualizar/selecionar nos casos dele
DROP POLICY IF EXISTS "respostas vistoriador select" ON public.respostas_agente;
CREATE POLICY "respostas vistoriador select"
  ON public.respostas_agente FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'agente_tecnico'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.casos c
      WHERE c.id = respostas_agente.caso_id AND c.agente_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "respostas vistoriador insert" ON public.respostas_agente;
CREATE POLICY "respostas vistoriador insert"
  ON public.respostas_agente FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'agente_tecnico'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.casos c
      WHERE c.id = respostas_agente.caso_id AND c.agente_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "respostas vistoriador update" ON public.respostas_agente;
CREATE POLICY "respostas vistoriador update"
  ON public.respostas_agente FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'agente_tecnico'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.casos c
      WHERE c.id = respostas_agente.caso_id AND c.agente_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'agente_tecnico'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.casos c
      WHERE c.id = respostas_agente.caso_id AND c.agente_id = auth.uid()
    )
  );
