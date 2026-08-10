DO $$ BEGIN
  CREATE TYPE public.tipo_solicitacao AS ENUM ('instalacao','upgrade');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.modalidade_atendimento AS ENUM ('presencial','remoto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.nivel_mapeamento AS ENUM ('nivel_1','nivel_2','nivel_3');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS tipo_solicitacao public.tipo_solicitacao NOT NULL DEFAULT 'instalacao',
  ADD COLUMN IF NOT EXISTS modalidade public.modalidade_atendimento NOT NULL DEFAULT 'presencial',
  ADD COLUMN IF NOT EXISTS nivel public.nivel_mapeamento NOT NULL DEFAULT 'nivel_1',
  ADD COLUMN IF NOT EXISTS agente_nome_manual text;

ALTER TABLE public.casos
  ADD COLUMN IF NOT EXISTS tipo_solicitacao public.tipo_solicitacao NOT NULL DEFAULT 'instalacao',
  ADD COLUMN IF NOT EXISTS modalidade public.modalidade_atendimento NOT NULL DEFAULT 'presencial',
  ADD COLUMN IF NOT EXISTS nivel public.nivel_mapeamento NOT NULL DEFAULT 'nivel_1',
  ADD COLUMN IF NOT EXISTS agente_nome_manual text;

ALTER TABLE public.agendamentos ALTER COLUMN agente_id DROP NOT NULL;