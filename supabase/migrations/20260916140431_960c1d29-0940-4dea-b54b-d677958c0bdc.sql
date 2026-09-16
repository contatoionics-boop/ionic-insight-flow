CREATE OR REPLACE FUNCTION public.exigir_responsavel_mapeamento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.agente_id IS NULL THEN
    RAISE EXCEPTION 'Selecione o responsável pelo mapeamento.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agendamentos_exigir_responsavel ON public.agendamentos;
CREATE TRIGGER agendamentos_exigir_responsavel
BEFORE INSERT ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.exigir_responsavel_mapeamento();

DROP TRIGGER IF EXISTS casos_exigir_responsavel ON public.casos;
CREATE TRIGGER casos_exigir_responsavel
BEFORE INSERT ON public.casos
FOR EACH ROW
EXECUTE FUNCTION public.exigir_responsavel_mapeamento();