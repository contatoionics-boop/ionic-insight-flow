
DROP TRIGGER IF EXISTS casos_timeline_auto_trg ON public.casos;
CREATE TRIGGER casos_timeline_auto_trg
BEFORE UPDATE ON public.casos
FOR EACH ROW
EXECUTE FUNCTION public.casos_timeline_auto();

-- Backfill datas em mapeamentos existentes
UPDATE public.casos
SET data_execucao = COALESCE(data_execucao, atualizado_em)
WHERE status IN ('em_andamento','aguardando_revisao','aprovado','concluido')
  AND data_execucao IS NULL;

UPDATE public.casos
SET data_entrega_agente = COALESCE(data_entrega_agente, atualizado_em)
WHERE status IN ('aguardando_revisao','aprovado','concluido')
  AND data_entrega_agente IS NULL;

UPDATE public.casos
SET data_aprovacao_pablo = COALESCE(data_aprovacao_pablo, atualizado_em)
WHERE status IN ('aprovado','concluido')
  AND data_aprovacao_pablo IS NULL;
