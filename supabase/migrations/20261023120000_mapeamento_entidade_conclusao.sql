-- Confirmação operacional "equipamento concluído" no preenchimento do agente.
-- Tabela aditiva: não altera respostas_agente nem a regra real de completude das perguntas.
CREATE TABLE IF NOT EXISTS public.mapeamento_entidade_conclusao (
  caso_id      uuid NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  entidade_id  uuid NOT NULL REFERENCES public.escopo_entidades(id) ON DELETE CASCADE,
  concluida_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (caso_id, entidade_id)
);

CREATE INDEX IF NOT EXISTS mapeamento_entidade_conclusao_caso_idx
  ON public.mapeamento_entidade_conclusao (caso_id);

-- Acesso somente pelo servidor (service role); sem políticas para clientes.
ALTER TABLE public.mapeamento_entidade_conclusao ENABLE ROW LEVEL SECURITY;
