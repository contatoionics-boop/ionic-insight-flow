
-- Limpa dados de teste (usuário confirmou)
DELETE FROM public.respostas_agente;
DELETE FROM public.links_agente;
DELETE FROM public.casos;

-- 1) Tabela agendamentos
CREATE TABLE public.agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE RESTRICT,
  matriz_id uuid REFERENCES public.matrizes(id) ON DELETE SET NULL,
  agente_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  criado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  agendado_em timestamptz NOT NULL,
  duracao_min integer NOT NULL DEFAULT 60,
  endereco_vistoria text,
  observacoes_agendamento text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- 2) Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agendamentos TO authenticated;
GRANT ALL ON public.agendamentos TO service_role;

-- 3) RLS
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agendamentos super admin all" ON public.agendamentos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "agendamentos admin select" ON public.agendamentos
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos'))
  );

CREATE POLICY "agendamentos admin insert" ON public.agendamentos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND criado_por = auth.uid());

CREATE POLICY "agendamentos admin update" ON public.agendamentos
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND (criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos')))
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND (criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos')));

CREATE POLICY "agendamentos admin delete" ON public.agendamentos
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND criado_por = auth.uid());

CREATE POLICY "agendamentos agente select" ON public.agendamentos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'agente_tecnico') AND agente_id = auth.uid());

-- 4) Trigger updated
CREATE TRIGGER agendamentos_set_atualizado_em
  BEFORE UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

-- 5) Coluna agendamento_id em casos (NOT NULL, sem dados existentes)
ALTER TABLE public.casos
  ADD COLUMN agendamento_id uuid NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE;

CREATE INDEX idx_casos_agendamento_id ON public.casos(agendamento_id);

-- 6) Exclusividade: 1 caso 'em_andamento' por agendamento
CREATE UNIQUE INDEX uniq_caso_em_andamento_por_agendamento
  ON public.casos(agendamento_id)
  WHERE status = 'em_andamento';
