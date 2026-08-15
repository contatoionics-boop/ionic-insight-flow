UPDATE public.perguntas SET chave_laudo = 'wifi_disponivel'
WHERE chave_laudo = 'comunicacao_tipos'
  AND (texto ILIKE '%Wi-Fi%' OR texto ILIKE '%WiFi%');

UPDATE public.perguntas SET chave_laudo = 'tipos_veiculos_abastecidos'
WHERE chave_laudo = 'tipo_objeto'
  AND (texto ILIKE '%veicul%' OR texto ILIKE '%veícul%');

INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, chave_laudo, instrucao_agente)
SELECT s.id, 'Quantidade de bicos de abastecimento', 'texto', false,
       COALESCE((SELECT MAX(p.ordem) + 1 FROM public.perguntas p WHERE p.secao_id = s.id), 0),
       'qtd_bicos', 'Informe quantos bicos a bomba possui.'
FROM public.secoes s
WHERE s.titulo ILIKE '%Descricao geral do dispositivo de abastecimento%'
  AND NOT EXISTS (
    SELECT 1 FROM public.perguntas p
    WHERE p.secao_id = s.id AND p.chave_laudo = 'qtd_bicos'
  );