
-- 1) Enum de tipos de evento
DO $$ BEGIN
  CREATE TYPE public.mapeamento_evento_tipo AS ENUM (
    'mapeamento_criado',
    'agendamento_criado',
    'agente_atribuido',
    'aceite_confirmado',
    'aceite_recusado',
    'reagendado',
    'agendamento_cancelado',
    'vistoria_iniciada',
    'vistoria_finalizada',
    'revisao_aprovada',
    'revisao_reprovada',
    'mapeamento_concluido',
    'observacao_adicionada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ator_papel AS ENUM (
    'super_admin','admin','especialista','agente_tecnico','sistema'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Tabela
CREATE TABLE IF NOT EXISTS public.mapeamento_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id uuid NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  agendamento_id uuid REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  tipo public.mapeamento_evento_tipo NOT NULL,
  ocorrido_em timestamptz NOT NULL DEFAULT now(),
  ator_id uuid,
  ator_nome text,
  ator_papel public.ator_papel NOT NULL DEFAULT 'sistema',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mapeamento_eventos_caso_idx
  ON public.mapeamento_eventos (caso_id, ocorrido_em DESC);
CREATE INDEX IF NOT EXISTS mapeamento_eventos_tipo_idx
  ON public.mapeamento_eventos (tipo);

-- 3) GRANTs
GRANT SELECT ON public.mapeamento_eventos TO authenticated;
GRANT ALL ON public.mapeamento_eventos TO service_role;

-- 4) RLS
ALTER TABLE public.mapeamento_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eventos super admin all" ON public.mapeamento_eventos;
CREATE POLICY "eventos super admin all"
ON public.mapeamento_eventos FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "eventos admin select" ON public.mapeamento_eventos;
CREATE POLICY "eventos admin select"
ON public.mapeamento_eventos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "eventos especialista select" ON public.mapeamento_eventos;
CREATE POLICY "eventos especialista select"
ON public.mapeamento_eventos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'especialista'::public.app_role));

DROP POLICY IF EXISTS "eventos agente select" ON public.mapeamento_eventos;
CREATE POLICY "eventos agente select"
ON public.mapeamento_eventos FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'agente_tecnico'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.casos c
    WHERE c.id = mapeamento_eventos.caso_id AND c.agente_id = auth.uid()
  )
);

-- 5) Backfill do histórico existente a partir dos marcos já gravados
INSERT INTO public.mapeamento_eventos (caso_id, agendamento_id, tipo, ocorrido_em, ator_id, ator_nome, ator_papel, metadata)
SELECT c.id, c.agendamento_id, 'mapeamento_criado', c.criado_em,
       c.criado_por, p.nome, 'admin', '{}'::jsonb
FROM public.casos c LEFT JOIN public.profiles p ON p.id = c.criado_por
WHERE c.criado_em IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.mapeamento_eventos (caso_id, agendamento_id, tipo, ocorrido_em, ator_id, ator_nome, ator_papel, metadata)
SELECT c.id, c.agendamento_id, 'agendamento_criado', COALESCE(a.criado_em, c.criado_em),
       c.criado_por, p.nome, 'admin',
       jsonb_build_object('agendado_em', a.agendado_em, 'duracao_min', a.duracao_min)
FROM public.casos c
JOIN public.agendamentos a ON a.id = c.agendamento_id
LEFT JOIN public.profiles p ON p.id = c.criado_por
WHERE a.agendado_em IS NOT NULL;

INSERT INTO public.mapeamento_eventos (caso_id, agendamento_id, tipo, ocorrido_em, ator_id, ator_nome, ator_papel, metadata)
SELECT c.id, c.agendamento_id, 'aceite_confirmado', a.data_aceite,
       a.agente_id, p.nome, 'agente_tecnico', '{}'::jsonb
FROM public.casos c
JOIN public.agendamentos a ON a.id = c.agendamento_id
LEFT JOIN public.profiles p ON p.id = a.agente_id
WHERE a.aceite_status = 'confirmado' AND a.data_aceite IS NOT NULL;

INSERT INTO public.mapeamento_eventos (caso_id, agendamento_id, tipo, ocorrido_em, ator_id, ator_nome, ator_papel, metadata)
SELECT c.id, c.agendamento_id, 'aceite_recusado', COALESCE(a.data_aceite, a.atualizado_em, now()),
       a.agente_id, p.nome, 'agente_tecnico',
       jsonb_build_object('motivo', a.motivo_recusa)
FROM public.casos c
JOIN public.agendamentos a ON a.id = c.agendamento_id
LEFT JOIN public.profiles p ON p.id = a.agente_id
WHERE a.aceite_status = 'recusado_pelo_agente';

INSERT INTO public.mapeamento_eventos (caso_id, agendamento_id, tipo, ocorrido_em, ator_id, ator_nome, ator_papel, metadata)
SELECT c.id, c.agendamento_id, 'vistoria_iniciada', c.data_execucao,
       c.agente_id, p.nome, 'agente_tecnico', '{}'::jsonb
FROM public.casos c LEFT JOIN public.profiles p ON p.id = c.agente_id
WHERE c.data_execucao IS NOT NULL;

INSERT INTO public.mapeamento_eventos (caso_id, agendamento_id, tipo, ocorrido_em, ator_id, ator_nome, ator_papel, metadata)
SELECT c.id, c.agendamento_id, 'vistoria_finalizada', c.data_entrega_agente,
       c.agente_id, p.nome, 'agente_tecnico', '{}'::jsonb
FROM public.casos c LEFT JOIN public.profiles p ON p.id = c.agente_id
WHERE c.data_entrega_agente IS NOT NULL;

INSERT INTO public.mapeamento_eventos (caso_id, agendamento_id, tipo, ocorrido_em, ator_id, ator_nome, ator_papel, metadata)
SELECT c.id, c.agendamento_id, 'revisao_aprovada', c.data_aprovacao_pablo,
       NULL, NULL, 'especialista', '{}'::jsonb
FROM public.casos c
WHERE c.data_aprovacao_pablo IS NOT NULL AND c.status IN ('aprovado','concluido');

INSERT INTO public.mapeamento_eventos (caso_id, agendamento_id, tipo, ocorrido_em, ator_id, ator_nome, ator_papel, metadata)
SELECT c.id, c.agendamento_id, 'revisao_reprovada', COALESCE(c.data_aprovacao_pablo, c.atualizado_em, now()),
       NULL, NULL, 'especialista',
       jsonb_build_object('motivo', c.motivo_recusa)
FROM public.casos c
WHERE c.motivo_recusa IS NOT NULL AND c.status = 'em_analise';
