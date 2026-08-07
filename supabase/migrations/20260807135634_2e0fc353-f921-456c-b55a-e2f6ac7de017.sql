UPDATE public.perguntas
SET tipo = 'video'::public.pergunta_tipo
WHERE tipo = 'foto'::public.pergunta_tipo
  AND (
    lower(texto) LIKE '%vídeo%'
    OR lower(texto) LIKE '%video%'
    OR lower(COALESCE(contexto_ia, '')) LIKE '%vídeo%'
    OR lower(COALESCE(contexto_ia, '')) LIKE '%video%'
    OR lower(COALESCE(instrucao_agente, '')) LIKE '%vídeo%'
    OR lower(COALESCE(instrucao_agente, '')) LIKE '%video%'
  );