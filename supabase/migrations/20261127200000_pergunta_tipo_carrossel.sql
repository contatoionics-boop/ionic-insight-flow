-- Novo tipo de pergunta: "Carrossel de fotos" (várias fotos na mesma pergunta, no mínimo 2).
-- Rode no SQL Editor do Supabase. É idempotente (pode rodar mais de uma vez).
-- As respostas já guardam uma lista de arquivos (respostas_agente.arquivos_paths): não há outra mudança.
ALTER TYPE public.pergunta_tipo ADD VALUE IF NOT EXISTS 'carrossel';
