ALTER TABLE public.respostas_agente
ADD COLUMN IF NOT EXISTS arquivos_paths text[] NOT NULL DEFAULT '{}'::text[];

-- Backfill: incluir arquivo_path existente como primeiro item, se houver
UPDATE public.respostas_agente
SET arquivos_paths = ARRAY[arquivo_path]
WHERE arquivo_path IS NOT NULL
  AND (arquivos_paths IS NULL OR array_length(arquivos_paths, 1) IS NULL);