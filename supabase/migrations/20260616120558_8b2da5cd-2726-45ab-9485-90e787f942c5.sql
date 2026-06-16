
-- 1. Novas colunas em casos
ALTER TABLE public.casos
  ADD COLUMN IF NOT EXISTS data_execucao timestamptz,
  ADD COLUMN IF NOT EXISTS data_entrega_agente timestamptz,
  ADD COLUMN IF NOT EXISTS data_aprovacao_pablo timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_recusa text;

-- 2. mapeamento_observacoes
CREATE TABLE IF NOT EXISTS public.mapeamento_observacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id uuid NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  texto text NOT NULL,
  usuario_id uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mapeamento_observacoes TO authenticated;
GRANT ALL ON public.mapeamento_observacoes TO service_role;
ALTER TABLE public.mapeamento_observacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth pode ler observacoes" ON public.mapeamento_observacoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth pode inserir observacoes" ON public.mapeamento_observacoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "autor pode apagar observacao" ON public.mapeamento_observacoes
  FOR DELETE TO authenticated USING (auth.uid() = usuario_id);

CREATE INDEX IF NOT EXISTS mapeamento_observacoes_caso_idx
  ON public.mapeamento_observacoes(caso_id, criado_em DESC);

-- 3. notificacoes
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  caso_id uuid REFERENCES public.casos(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  lido boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver minhas notificacoes" ON public.notificacoes
  FOR SELECT TO authenticated USING (auth.uid() = usuario_id);
CREATE POLICY "atualizar minhas notificacoes" ON public.notificacoes
  FOR UPDATE TO authenticated USING (auth.uid() = usuario_id);
CREATE POLICY "apagar minhas notificacoes" ON public.notificacoes
  FOR DELETE TO authenticated USING (auth.uid() = usuario_id);

CREATE INDEX IF NOT EXISTS notificacoes_usuario_idx
  ON public.notificacoes(usuario_id, lido, criado_em DESC);

-- 4. Trigger para timeline automática
CREATE OR REPLACE FUNCTION public.casos_timeline_auto()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'aguardando_revisao' AND NEW.data_entrega_agente IS NULL THEN
      NEW.data_entrega_agente := now();
    END IF;
    IF NEW.status IN ('aprovado', 'concluido') AND NEW.data_aprovacao_pablo IS NULL THEN
      NEW.data_aprovacao_pablo := now();
    END IF;
    IF NEW.status = 'em_andamento' AND NEW.data_execucao IS NULL THEN
      NEW.data_execucao := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_casos_timeline_auto ON public.casos;
CREATE TRIGGER trg_casos_timeline_auto
  BEFORE UPDATE ON public.casos
  FOR EACH ROW EXECUTE FUNCTION public.casos_timeline_auto();
