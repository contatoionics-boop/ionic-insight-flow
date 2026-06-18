
-- Enums
CREATE TYPE public.knowledge_classificacao AS ENUM ('OK','ATENCAO','BLOQUEIO');
CREATE TYPE public.knowledge_categoria AS ENUM (
  'estrutura_documento','catalogo_produtos','catalogo_materiais',
  'regras_tecnicas','exemplos_laudos','textos_padrao','glossario_tecnico'
);

-- Importações
CREATE TABLE public.knowledge_base_importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('json','csv','xlsx')),
  total_registros integer NOT NULL DEFAULT 0,
  total_inseridos integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processando' CHECK (status IN ('processando','pronto','erro')),
  erro_mensagem text,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_base_importacoes TO authenticated;
GRANT ALL ON public.knowledge_base_importacoes TO service_role;
ALTER TABLE public.knowledge_base_importacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin manage importacoes"
ON public.knowledge_base_importacoes FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Tabela principal
CREATE TABLE public.knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria public.knowledge_categoria NOT NULL,
  titulo text NOT NULL,
  conteudo text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  classificacao public.knowledge_classificacao NOT NULL DEFAULT 'OK',
  fonte text,
  importacao_id uuid REFERENCES public.knowledge_base_importacoes(id) ON DELETE CASCADE,
  embedding vector(1536),
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_base TO authenticated;
GRANT ALL ON public.knowledge_base TO service_role;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin manage knowledge_base"
ON public.knowledge_base FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Índices
CREATE INDEX knowledge_base_embedding_idx
  ON public.knowledge_base USING hnsw (embedding vector_cosine_ops);
CREATE INDEX knowledge_base_tags_idx ON public.knowledge_base USING gin (tags);
CREATE INDEX knowledge_base_categoria_idx ON public.knowledge_base (categoria);
CREATE INDEX knowledge_base_classificacao_idx ON public.knowledge_base (classificacao);
CREATE INDEX knowledge_base_importacao_idx ON public.knowledge_base (importacao_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_knowledge_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER knowledge_base_set_updated_at
BEFORE UPDATE ON public.knowledge_base
FOR EACH ROW EXECUTE FUNCTION public.set_knowledge_updated_at();

CREATE TRIGGER knowledge_base_importacoes_set_updated_at
BEFORE UPDATE ON public.knowledge_base_importacoes
FOR EACH ROW EXECUTE FUNCTION public.set_knowledge_updated_at();

-- RPC de busca
CREATE OR REPLACE FUNCTION public.buscar_knowledge_base(
  query_embedding vector,
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.5,
  p_categoria public.knowledge_categoria DEFAULT NULL,
  p_tags text[] DEFAULT NULL,
  p_classificacao public.knowledge_classificacao DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  titulo text,
  conteudo text,
  categoria public.knowledge_categoria,
  tags text[],
  classificacao public.knowledge_classificacao,
  fonte text,
  similarity float
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    k.id, k.titulo, k.conteudo, k.categoria, k.tags, k.classificacao, k.fonte,
    1 - (k.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_base k
  WHERE k.embedding IS NOT NULL
    AND 1 - (k.embedding <=> query_embedding) >= similarity_threshold
    AND (p_categoria IS NULL OR k.categoria = p_categoria)
    AND (p_classificacao IS NULL OR k.classificacao = p_classificacao)
    AND (p_tags IS NULL OR k.tags && p_tags)
  ORDER BY k.embedding <=> query_embedding
  LIMIT match_count;
$$;
