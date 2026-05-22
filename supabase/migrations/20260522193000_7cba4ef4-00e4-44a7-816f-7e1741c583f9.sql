
CREATE OR REPLACE FUNCTION public.gen_caso_codigo()
RETURNS text
LANGUAGE sql VOLATILE
SET search_path = public
AS $$
  SELECT 'CS-' || lpad(nextval('public.casos_codigo_seq')::text, 4, '0');
$$;

CREATE OR REPLACE FUNCTION public.set_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_permissao_extra(uuid, text) FROM authenticated;
