-- 1) Adiciona novos valores ao enum pergunta_tipo
ALTER TYPE public.pergunta_tipo ADD VALUE IF NOT EXISTS 'cep';
ALTER TYPE public.pergunta_tipo ADD VALUE IF NOT EXISTS 'cnpj';

-- 2) Adiciona colunas de endereço/identificação em clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS nome_fantasia text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS logradouro text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text;