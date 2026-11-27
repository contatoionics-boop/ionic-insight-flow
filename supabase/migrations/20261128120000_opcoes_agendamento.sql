-- Opções do agendamento editáveis (Configurações › Opções do agendamento):
-- tipo de solicitação, modalidade, nível do mapeamento e solução.
-- Rode no SQL Editor do Supabase. É idempotente (pode rodar mais de uma vez).
--
-- 1) opcoes_agendamento: nome exibido, visibilidade e ordem de cada opção (os valores gravados nos
--    mapeamentos não mudam). Opção nova entra pela função adicionar_opcao_agendamento (abaixo).
-- 2) adicionar_opcao_agendamento: acrescenta o valor novo ao tipo do banco (enum) quando o campo usa
--    um, e cadastra a opção. Só gestores (super_admin, admin, especialista).

CREATE TABLE IF NOT EXISTS public.opcoes_agendamento (
  campo text NOT NULL CHECK (campo IN ('tipo_solicitacao', 'modalidade', 'nivel', 'solucao')),
  valor text NOT NULL CHECK (valor ~ '^[a-z][a-z0-9_]{0,39}$'),
  rotulo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 100,
  sistema boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campo, valor)
);

ALTER TABLE public.opcoes_agendamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem opcoes_agendamento" ON public.opcoes_agendamento;
CREATE POLICY "Autenticados leem opcoes_agendamento" ON public.opcoes_agendamento
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Gestores gerenciam opcoes_agendamento" ON public.opcoes_agendamento;
CREATE POLICY "Gestores gerenciam opcoes_agendamento" ON public.opcoes_agendamento
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'especialista'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'especialista'));

INSERT INTO public.opcoes_agendamento (campo, valor, rotulo, ordem, sistema) VALUES
  ('tipo_solicitacao', 'instalacao', 'Instalação', 10, true),
  ('tipo_solicitacao', 'upgrade', 'Upgrade', 20, true),
  ('modalidade', 'presencial', 'Presencial', 10, true),
  ('modalidade', 'remoto', 'Remoto', 20, true),
  ('nivel', 'nivel_1', 'Nível 1', 10, true),
  ('nivel', 'nivel_2', 'Nível 2', 20, true),
  ('nivel', 'nivel_3', 'Nível 3', 30, true),
  ('solucao', 'ssg_frota', 'SSGFROTA', 10, true),
  ('solucao', 'on_premise', 'On-premise', 20, true)
ON CONFLICT (campo, valor) DO NOTHING;

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
  IF _campo NOT IN ('tipo_solicitacao', 'modalidade', 'nivel', 'solucao') THEN
    RAISE EXCEPTION 'Campo inválido: %', _campo;
  END IF;
  IF _valor !~ '^[a-z][a-z0-9_]{0,39}$' THEN
    RAISE EXCEPTION 'Valor inválido: %', _valor;
  END IF;
  IF coalesce(trim(_rotulo), '') = '' THEN
    RAISE EXCEPTION 'Informe o nome da opção.';
  END IF;

  -- campos que usam um tipo (enum) no banco: o valor novo precisa existir lá
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
