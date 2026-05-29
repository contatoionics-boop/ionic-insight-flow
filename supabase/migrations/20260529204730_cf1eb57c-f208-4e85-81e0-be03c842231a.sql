ALTER TYPE public.pergunta_tipo ADD VALUE IF NOT EXISTS 'data';
ALTER TYPE public.pergunta_tipo ADD VALUE IF NOT EXISTS 'selecao_unica';
ALTER TYPE public.pergunta_tipo ADD VALUE IF NOT EXISTS 'toggle';

CREATE UNIQUE INDEX IF NOT EXISTS respostas_agente_caso_pergunta_unique
  ON public.respostas_agente (caso_id, pergunta_id);