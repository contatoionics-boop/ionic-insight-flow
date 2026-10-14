-- Escopo: "tanque com lubrificante" (raiz, com formulário próprio) passa a ser um tipo
-- separado de "tanque" (filho do comboio, como o bico é filho da bomba).
-- Rode no SQL Editor do Supabase. É idempotente (pode rodar mais de uma vez).

-- 1) escopo_entidades.tipo aceita 'tanque_lubrificante'
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.escopo_entidades'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%posto%'
      AND pg_get_constraintdef(oid) ILIKE '%tipo%'
  LOOP
    EXECUTE format('ALTER TABLE public.escopo_entidades DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.escopo_entidades
  ADD CONSTRAINT escopo_entidades_tipo_check
  CHECK (tipo IN ('posto','ilha','bomba','bico','comboio','frota','sonda','tanque','tanque_lubrificante'));

-- 2) perguntas.entidade_tipo ("Aplica-se a") aceita 'tanque_lubrificante'
ALTER TABLE public.perguntas DROP CONSTRAINT IF EXISTS perguntas_entidade_tipo_check;
ALTER TABLE public.perguntas
  ADD CONSTRAINT perguntas_entidade_tipo_check
  CHECK (entidade_tipo IN ('geral','posto','ilha','bomba','bico','comboio','frota','div','sonda','tanque','tanque_lubrificante'));

-- 3) Dados existentes: os tanques que já estavam na RAIZ do escopo eram tanques independentes
--    da pista; passam a ser "tanque com lubrificante" (mesmos UUIDs, respostas preservadas).
UPDATE public.escopo_entidades
SET tipo = 'tanque_lubrificante',
    rotulo = regexp_replace(rotulo, '^Tanque ', 'Tanque lubrificante ')
WHERE tipo = 'tanque' AND parent_id IS NULL;

-- 4) Perguntas que estavam marcadas como "Tanque" passam a "Tanque com lubrificante".
UPDATE public.perguntas
SET entidade_tipo = 'tanque_lubrificante'
WHERE entidade_tipo = 'tanque';
