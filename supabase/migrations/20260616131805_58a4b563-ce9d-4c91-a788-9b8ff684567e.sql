
-- ============================================================
-- IONICS codes for empresas / unidades
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.empresas_ionics_seq START 1;

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS codigo_ionics TEXT UNIQUE
  DEFAULT ('ION-' || lpad(nextval('public.empresas_ionics_seq')::text, 5, '0'));

ALTER TABLE public.unidades
  ADD COLUMN IF NOT EXISTS codigo_ionics TEXT;

-- Backfill empresas without code (use criado_em order to be deterministic)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.empresas WHERE codigo_ionics IS NULL ORDER BY criado_em ASC, id ASC LOOP
    UPDATE public.empresas
      SET codigo_ionics = 'ION-' || lpad(nextval('public.empresas_ionics_seq')::text, 5, '0')
      WHERE id = r.id;
  END LOOP;
END $$;

-- Trigger to auto-generate unidade.codigo_ionics on insert
CREATE OR REPLACE FUNCTION public.gen_unidade_codigo_ionics()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  emp_id uuid;
  emp_codigo TEXT;
  next_n INT;
BEGIN
  IF NEW.codigo_ionics IS NOT NULL AND NEW.codigo_ionics <> '' THEN
    RETURN NEW;
  END IF;
  SELECT m.empresa_id INTO emp_id FROM public.matrizes m WHERE m.id = NEW.matriz_id;
  IF emp_id IS NULL THEN RETURN NEW; END IF;
  SELECT codigo_ionics INTO emp_codigo FROM public.empresas WHERE id = emp_id;
  IF emp_codigo IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(MAX(NULLIF(regexp_replace(u.codigo_ionics, '^.*-', ''), '')::int), 0) + 1
    INTO next_n
  FROM public.unidades u
  JOIN public.matrizes m ON m.id = u.matriz_id
  WHERE m.empresa_id = emp_id
    AND u.codigo_ionics LIKE emp_codigo || '-%';
  NEW.codigo_ionics := emp_codigo || '-' || lpad(next_n::text, 2, '0');
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_unidade_codigo_ionics ON public.unidades;
CREATE TRIGGER trg_unidade_codigo_ionics
  BEFORE INSERT ON public.unidades
  FOR EACH ROW EXECUTE FUNCTION public.gen_unidade_codigo_ionics();

-- Backfill unidades
DO $$
DECLARE r RECORD; emp_codigo TEXT; next_n INT;
BEGIN
  FOR r IN
    SELECT u.id, m.empresa_id
    FROM public.unidades u
    JOIN public.matrizes m ON m.id = u.matriz_id
    WHERE u.codigo_ionics IS NULL
    ORDER BY u.criado_em ASC, u.id ASC
  LOOP
    SELECT codigo_ionics INTO emp_codigo FROM public.empresas WHERE id = r.empresa_id;
    IF emp_codigo IS NULL THEN CONTINUE; END IF;
    SELECT COALESCE(MAX(NULLIF(regexp_replace(u2.codigo_ionics, '^.*-', ''), '')::int), 0) + 1
      INTO next_n
    FROM public.unidades u2
    JOIN public.matrizes m2 ON m2.id = u2.matriz_id
    WHERE m2.empresa_id = r.empresa_id AND u2.codigo_ionics LIKE emp_codigo || '-%';
    UPDATE public.unidades SET codigo_ionics = emp_codigo || '-' || lpad(next_n::text, 2, '0')
      WHERE id = r.id;
  END LOOP;
END $$;

-- ============================================================
-- Agendamentos: aceite do agente
-- ============================================================
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS aceite_status TEXT NOT NULL DEFAULT 'aguardando_aceite'
    CHECK (aceite_status IN ('aguardando_aceite','confirmado','recusado_pelo_agente')),
  ADD COLUMN IF NOT EXISTS aceite_agente BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_aceite TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_recusa TEXT;

-- Permitir que o agente atualize seu próprio agendamento (aceite/recusa)
DROP POLICY IF EXISTS "Agente pode atualizar aceite do próprio agendamento" ON public.agendamentos;
CREATE POLICY "Agente pode atualizar aceite do próprio agendamento"
  ON public.agendamentos
  FOR UPDATE
  TO authenticated
  USING (agente_id = auth.uid())
  WITH CHECK (agente_id = auth.uid());
