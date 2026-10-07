-- Escopo estruturado (Etapa 1): árvore Posto > Ilha > Bomba > Bico + comboios + frota,
-- versionada por unidade. Perguntas ganham "aplica-se a" e respostas passam a ter
-- instância (entidade). Tudo aditivo: perguntas e respostas atuais continuam válidas.

-- 1) Versões do escopo (V1, V2...) por unidade
CREATE TABLE IF NOT EXISTS public.escopo_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE CASCADE,
  caso_origem_id uuid REFERENCES public.casos(id) ON DELETE SET NULL,
  numero integer NOT NULL DEFAULT 1,
  tipo text NOT NULL DEFAULT 'implantacao'
    CHECK (tipo IN ('implantacao','upgrade','expansao','alteracao')),
  descricao text,
  base_versao_id uuid REFERENCES public.escopo_versoes(id) ON DELETE SET NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS escopo_versoes_unidade_numero_uq
  ON public.escopo_versoes (unidade_id, numero) WHERE unidade_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS escopo_versoes_caso_numero_uq
  ON public.escopo_versoes (caso_origem_id, numero) WHERE unidade_id IS NULL;

-- 2) Entidades com identidade persistente (nunca apagadas fisicamente)
CREATE TABLE IF NOT EXISTS public.escopo_entidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE CASCADE,
  caso_origem_id uuid REFERENCES public.casos(id) ON DELETE SET NULL,
  tipo text NOT NULL
    CHECK (tipo IN ('posto','ilha','bomba','bico','comboio','frota','sonda','tanque')),
  parent_id uuid REFERENCES public.escopo_entidades(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 1,
  rotulo text NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  criada_na_versao_id uuid REFERENCES public.escopo_versoes(id) ON DELETE SET NULL,
  desativada_na_versao_id uuid REFERENCES public.escopo_versoes(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS escopo_entidades_unidade_idx ON public.escopo_entidades (unidade_id, parent_id);
CREATE INDEX IF NOT EXISTS escopo_entidades_caso_idx ON public.escopo_entidades (caso_origem_id);

-- 3) Log de alterações entre versões
CREATE TABLE IF NOT EXISTS public.escopo_alteracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_id uuid NOT NULL REFERENCES public.escopo_versoes(id) ON DELETE CASCADE,
  entidade_id uuid REFERENCES public.escopo_entidades(id) ON DELETE CASCADE,
  acao text NOT NULL CHECK (acao IN ('adicionada','alterada','desativada','reativada')),
  antes jsonb,
  depois jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS escopo_alteracoes_versao_idx ON public.escopo_alteracoes (versao_id);

-- 4) Frota/DIV como coleção estruturada (preparo para etapas futuras)
CREATE TABLE IF NOT EXISTS public.escopo_frota_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_id uuid NOT NULL REFERENCES public.escopo_versoes(id) ON DELETE CASCADE,
  modelo_veiculo text NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  info jsonb NOT NULL DEFAULT '{}'::jsonb,
  ordem integer NOT NULL DEFAULT 1,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS escopo_frota_itens_versao_idx ON public.escopo_frota_itens (versao_id);

-- 5) Caso aponta para a versão de escopo que usa
ALTER TABLE public.casos
  ADD COLUMN IF NOT EXISTS escopo_versao_id uuid REFERENCES public.escopo_versoes(id) ON DELETE SET NULL;

-- 6) Aplicabilidade das perguntas (template). Padrão 'geral' = comportamento atual.
ALTER TABLE public.perguntas
  ADD COLUMN IF NOT EXISTS entidade_tipo text NOT NULL DEFAULT 'geral';
ALTER TABLE public.perguntas DROP CONSTRAINT IF EXISTS perguntas_entidade_tipo_check;
ALTER TABLE public.perguntas
  ADD CONSTRAINT perguntas_entidade_tipo_check
  CHECK (entidade_tipo IN ('geral','posto','ilha','bomba','bico','comboio','frota','div','sonda','tanque'));

-- 7) Respostas por instância. entidade_key = entidade_id ou UUID nulo (resposta geral).
ALTER TABLE public.respostas_agente
  ADD COLUMN IF NOT EXISTS entidade_id uuid REFERENCES public.escopo_entidades(id) ON DELETE SET NULL;
ALTER TABLE public.respostas_agente
  ADD COLUMN IF NOT EXISTS entidade_key uuid
  GENERATED ALWAYS AS (COALESCE(entidade_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS respostas_agente_caso_pergunta_entidade_unique
  ON public.respostas_agente (caso_id, pergunta_id, entidade_key);
DROP INDEX IF EXISTS public.respostas_agente_caso_pergunta_unique;

-- 8) RLS (mesmo padrão das propostas: gestores gerenciam; agente do caso lê)
ALTER TABLE public.escopo_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escopo_entidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escopo_alteracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escopo_frota_itens ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['escopo_versoes','escopo_entidades','escopo_alteracoes','escopo_frota_itens'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Gestores gerenciam %1$s" ON public.%1$s', t);
    EXECUTE format(
      'CREATE POLICY "Gestores gerenciam %1$s" ON public.%1$s FOR ALL TO authenticated
         USING (public.has_role(auth.uid(), ''super_admin'') OR public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''especialista''))
         WITH CHECK (public.has_role(auth.uid(), ''super_admin'') OR public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''especialista''))', t);
    EXECUTE format('DROP POLICY IF EXISTS "Agentes leem %1$s" ON public.%1$s', t);
    EXECUTE format(
      'CREATE POLICY "Agentes leem %1$s" ON public.%1$s FOR SELECT TO authenticated
         USING (public.has_role(auth.uid(), ''agente_tecnico''))', t);
  END LOOP;
END $$;
