-- Vínculo entre tipos de item: um tipo criado em Configurações › Tipos de item pode ficar "dentro" de
-- outro (ex.: Andar dentro de Prédio; Câmera dentro de Comboio). `pai` = chave do tipo pai; vazio = raiz.
-- Rode no SQL Editor do Supabase. É idempotente (pode rodar mais de uma vez).
ALTER TABLE public.escopo_tipos ADD COLUMN IF NOT EXISTS pai text;
