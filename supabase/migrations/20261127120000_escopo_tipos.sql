-- Tipos de item do Escopo editáveis (Configurações › Tipos de item).
-- Rode no SQL Editor do Supabase. É idempotente (pode rodar mais de uma vez).
--
-- 1) escopo_tipos: catálogo dos tipos de item (os do sistema podem ser renomeados e ocultados;
--    os novos, como "Prédio" ou "Produto", são criados pela tela). As chaves dos tipos do sistema
--    não mudam, então estrutura, respostas e documentos atuais continuam iguais.
-- 2) escopo_entidades.tipo e perguntas.entidade_tipo deixam de ter lista fixa e passam a aceitar
--    qualquer chave de tipo (slug).

-- 1) Catálogo
CREATE TABLE IF NOT EXISTS public.escopo_tipos (
  chave text PRIMARY KEY CHECK (chave ~ '^[a-z][a-z0-9_]{1,40}$'),
  rotulo text NOT NULL,
  plural text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  sistema boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 100,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.escopo_tipos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem escopo_tipos" ON public.escopo_tipos;
CREATE POLICY "Autenticados leem escopo_tipos" ON public.escopo_tipos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Gestores gerenciam escopo_tipos" ON public.escopo_tipos;
CREATE POLICY "Gestores gerenciam escopo_tipos" ON public.escopo_tipos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'especialista'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'especialista'));

-- Tipos do sistema (não sobrescreve o que já foi renomeado)
INSERT INTO public.escopo_tipos (chave, rotulo, plural, sistema, ordem) VALUES
  ('posto', 'Posto', 'Postos', true, 10),
  ('ilha', 'Ilha', 'Ilhas', true, 11),
  ('bomba', 'Bomba', 'Bombas', true, 12),
  ('bico', 'Bico', 'Bicos', true, 13),
  ('comboio', 'Comboio', 'Comboios', true, 20),
  ('tanque', 'Tanque', 'Tanques do comboio', true, 21),
  ('tanque_lubrificante', 'Tanque lubrificante', 'Tanques com lubrificante', true, 30),
  ('sonda', 'Sonda', 'Tanques com medidores', true, 40),
  ('frota', 'Frota / DIV', 'Frota / DIV', true, 50)
ON CONFLICT (chave) DO NOTHING;

-- 2) escopo_entidades.tipo: qualquer chave de tipo
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.escopo_entidades'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%tipo%'
      AND pg_get_constraintdef(oid) ILIKE '%posto%'
  LOOP
    EXECUTE format('ALTER TABLE public.escopo_entidades DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.escopo_entidades DROP CONSTRAINT IF EXISTS escopo_entidades_tipo_check;
ALTER TABLE public.escopo_entidades
  ADD CONSTRAINT escopo_entidades_tipo_check CHECK (tipo ~ '^[a-z][a-z0-9_]{1,40}$');

-- 3) perguntas.entidade_tipo ("Aplica-se a"): geral, div ou qualquer chave de tipo
ALTER TABLE public.perguntas DROP CONSTRAINT IF EXISTS perguntas_entidade_tipo_check;
ALTER TABLE public.perguntas
  ADD CONSTRAINT perguntas_entidade_tipo_check
  CHECK (entidade_tipo IN ('geral', 'div') OR entidade_tipo ~ '^[a-z][a-z0-9_]{1,40}$');
