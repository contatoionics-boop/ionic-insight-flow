
-- 1) Adiciona novos valores ao enum caso_status
ALTER TYPE public.caso_status ADD VALUE IF NOT EXISTS 'agendado';
ALTER TYPE public.caso_status ADD VALUE IF NOT EXISTS 'em_andamento';
ALTER TYPE public.caso_status ADD VALUE IF NOT EXISTS 'concluido';
ALTER TYPE public.caso_status ADD VALUE IF NOT EXISTS 'cancelado';
