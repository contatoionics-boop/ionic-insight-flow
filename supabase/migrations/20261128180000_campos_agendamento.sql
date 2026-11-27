-- Campos novos no agendamento (Configurações › Opções do agendamento › "Novo campo"):
-- além dos quatro fixos (tipo de solicitação, modalidade, nível, solução), o gestor cria listas próprias
-- (ex.: "Tipo de mapeamento"), cada uma com suas opções.
-- Rode no SQL Editor do Supabase. É idempotente (pode rodar mais de uma vez).
-- Rode DEPOIS da migration 20261128120000_opcoes_agendamento.

-- 1) campos_agendamento: os campos criados pelo gestor
CREATE TABLE IF NOT EXISTS public.campos_agendamento (
  chave text PRIMARY KEY CHECK (chave ~ '^[a-z][a-z0-9_]{1,39}$'),
  titulo text NOT NULL,
  descricao text,
  obrigatorio boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 100,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campos_agendamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem campos_agendamento" ON public.campos_agendamento;
CREATE POLICY "Autenticados leem campos_agendamento" ON public.campos_agendamento
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Gestores gerenciam campos_agendamento" ON public.campos_agendamento;
CREATE POLICY "Gestores gerenciam campos_agendamento" ON public.campos_agendamento
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'especialista'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'especialista'));

-- 2) a escolha de cada campo novo fica no agendamento: { "<chave do campo>": "<valor da opção>" }
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS campos_extras jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3) opcoes_agendamento passa a aceitar a chave de qualquer campo (os quatro fixos ou um criado acima)
ALTER TABLE public.opcoes_agendamento DROP CONSTRAINT IF EXISTS opcoes_agendamento_campo_check;
ALTER TABLE public.opcoes_agendamento ADD CONSTRAINT opcoes_agendamento_campo_check CHECK (campo ~ '^[a-z][a-z0-9_]{1,39}$');

-- 4) adicionar_opcao_agendamento: campo fixo (acrescenta ao enum quando houver) ou campo criado pelo gestor
CREATE OR REPLACE FUNCTION public.adicionar_opcao_agendamento(_campo text, _valor text, _rotulo text, _ordem integer DEFAULT 100)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'especialista')) THEN
    RAISE EXCEPTION 'Sem permissão para criar opções do agendamento.';
  END IF;
  IF _campo NOT IN ('tipo_solicitacao', 'modalidade', 'nivel', 'solucao')
     AND NOT EXISTS (SELECT 1 FROM public.campos_agendamento WHERE chave = _campo) THEN
    RAISE EXCEPTION 'Campo inválido: %', _campo;
  END IF;
  IF _valor !~ '^[a-z][a-z0-9_]{0,39}$' THEN
    RAISE EXCEPTION 'Valor inválido: %', _valor;
  END IF;
  IF coalesce(trim(_rotulo), '') = '' THEN
    RAISE EXCEPTION 'Informe o nome da opção.';
  END IF;

  IF _campo = 'tipo_solicitacao' THEN
    EXECUTE format('ALTER TYPE public.tipo_solicitacao ADD VALUE IF NOT EXISTS %L', _valor);
  ELSIF _campo = 'modalidade' THEN
    EXECUTE format('ALTER TYPE public.modalidade_atendimento ADD VALUE IF NOT EXISTS %L', _valor);
  ELSIF _campo = 'nivel' THEN
    EXECUTE format('ALTER TYPE public.nivel_mapeamento ADD VALUE IF NOT EXISTS %L', _valor);
  END IF;

  INSERT INTO public.opcoes_agendamento (campo, valor, rotulo, ordem, sistema)
  VALUES (_campo, _valor, trim(_rotulo), _ordem, false)
  ON CONFLICT (campo, valor) DO UPDATE SET rotulo = excluded.rotulo, ativo = true, atualizado_em = now();
END;
$$;

REVOKE ALL ON FUNCTION public.adicionar_opcao_agendamento(text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adicionar_opcao_agendamento(text, text, text, integer) TO authenticated;
