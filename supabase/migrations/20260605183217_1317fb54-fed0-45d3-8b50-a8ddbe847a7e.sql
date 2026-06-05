ALTER TABLE public.formularios
ADD COLUMN IF NOT EXISTS validar_imagens_ia boolean NOT NULL DEFAULT true;