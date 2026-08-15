-- 1) comboio marcado por trecho ambíguo (sem quantidade) volta a "não confirmado"
UPDATE public.propostas_comerciais
SET escopo = jsonb_set(
      escopo,
      '{comboio}',
      jsonb_build_object('valor', NULL, 'trecho', escopo->'comboio'->'trecho', 'confianca', 0)
    ),
    atualizado_em = now()
WHERE escopo->'comboio'->>'valor' = 'true'
  AND NOT (coalesce(escopo->'comboio'->>'trecho','') ~* '(\d{1,3}|um|uma|dois|duas|tres)\s*(x\s*)?(caminh\w+\s+)?comboi');

UPDATE public.propostas_comerciais
SET escopo = jsonb_set(
      escopo,
      '{tem_comboio}',
      jsonb_build_object('valor', NULL, 'trecho', escopo->'tem_comboio'->'trecho', 'confianca', 0)
    ),
    atualizado_em = now()
WHERE escopo->'tem_comboio'->>'valor' = 'true'
  AND NOT (coalesce(escopo->'tem_comboio'->>'trecho','') ~* '(\d{1,3}|um|uma|dois|duas|tres)\s*(x\s*)?(caminh\w+\s+)?comboi');

-- 2) limpa comparações salvas que contenham divergência de comboio (serão recalculadas)
UPDATE public.casos c
SET divergencias_proposta = '{}'::jsonb
WHERE c.divergencias_proposta::text ILIKE '%comboio_divergente%';