-- 1. EMPRESAS
CREATE TABLE public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- 2. MATRIZES
CREATE TABLE public.matrizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cnpj text,
  razao_social text,
  email text,
  telefone text,
  cep text,
  logradouro text,
  numero text,
  bairro text,
  cidade text,
  estado text,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_matrizes_empresa ON public.matrizes(empresa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matrizes TO authenticated;
GRANT ALL ON public.matrizes TO service_role;
ALTER TABLE public.matrizes ENABLE ROW LEVEL SECURITY;

-- 3. UNIDADES
CREATE TABLE public.unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matriz_id uuid NOT NULL REFERENCES public.matrizes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text,
  telefone text,
  cep text,
  logradouro text,
  numero text,
  bairro text,
  cidade text,
  estado text,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_unidades_matriz ON public.unidades(matriz_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unidades TO authenticated;
GRANT ALL ON public.unidades TO service_role;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

-- 4. MIGRAÇÃO DE DADOS  (reutiliza clientes.id como empresas.id e unidades.id)
INSERT INTO public.empresas (id, nome, criado_por, criado_em)
SELECT id, nome, criado_por, criado_em FROM public.clientes;

INSERT INTO public.matrizes
  (empresa_id, nome, cnpj, email, telefone, cep, logradouro, numero, bairro, cidade, estado, criado_por, criado_em)
SELECT id, COALESCE(nome_fantasia, nome), cnpj, email, telefone,
       cep, logradouro, numero, bairro, cidade, estado, criado_por, criado_em
FROM public.clientes;

INSERT INTO public.unidades (id, matriz_id, nome, criado_por, criado_em)
SELECT c.id, m.id, 'Sede', c.criado_por, c.criado_em
FROM public.clientes c
JOIN public.matrizes m ON m.empresa_id = c.id;

-- 5. CASOS: adicionar unidade_id e backfill
ALTER TABLE public.casos ADD COLUMN unidade_id uuid REFERENCES public.unidades(id) ON DELETE RESTRICT;
UPDATE public.casos SET unidade_id = cliente_id;
ALTER TABLE public.casos ALTER COLUMN unidade_id SET NOT NULL;
CREATE INDEX idx_casos_unidade ON public.casos(unidade_id);

-- 6. FORMULARIOS: cliente_id -> empresa_id
ALTER TABLE public.formularios RENAME COLUMN cliente_id TO empresa_id;

-- 7. REMOVER clientes (CASCADE remove policies dependentes), depois dropar casos.cliente_id
DROP TABLE public.clientes CASCADE;
ALTER TABLE public.casos DROP COLUMN cliente_id;

-- 8. RLS POLICIES  -----------------------------------------------------------

-- EMPRESAS
CREATE POLICY "empresas super admin all" ON public.empresas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "empresas admin select" ON public.empresas
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND (criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos')));

CREATE POLICY "empresas admin insert" ON public.empresas
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND criado_por = auth.uid());

CREATE POLICY "empresas admin update" ON public.empresas
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND (criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos')))
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND (criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos')));

CREATE POLICY "empresas admin delete" ON public.empresas
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND criado_por = auth.uid());

CREATE POLICY "empresas vistoriador select" ON public.empresas
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'agente_tecnico')
    AND EXISTS (
      SELECT 1 FROM public.matrizes m
      JOIN public.unidades u ON u.matriz_id = m.id
      JOIN public.casos c ON c.unidade_id = u.id
      WHERE m.empresa_id = empresas.id AND c.agente_id = auth.uid()
    )
  );

-- MATRIZES
CREATE POLICY "matrizes super admin all" ON public.matrizes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "matrizes admin select" ON public.matrizes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = matrizes.empresa_id
      AND (e.criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos')))
  );

CREATE POLICY "matrizes admin insert" ON public.matrizes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') AND criado_por = auth.uid()
    AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = matrizes.empresa_id
      AND (e.criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos')))
  );

CREATE POLICY "matrizes admin update" ON public.matrizes
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = matrizes.empresa_id
      AND (e.criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos')))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = matrizes.empresa_id
      AND (e.criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos')))
  );

CREATE POLICY "matrizes admin delete" ON public.matrizes
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = matrizes.empresa_id AND e.criado_por = auth.uid())
  );

CREATE POLICY "matrizes vistoriador select" ON public.matrizes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'agente_tecnico')
    AND EXISTS (
      SELECT 1 FROM public.unidades u
      JOIN public.casos c ON c.unidade_id = u.id
      WHERE u.matriz_id = matrizes.id AND c.agente_id = auth.uid()
    )
  );

-- UNIDADES
CREATE POLICY "unidades super admin all" ON public.unidades
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "unidades admin select" ON public.unidades
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.matrizes m JOIN public.empresas e ON e.id = m.empresa_id
      WHERE m.id = unidades.matriz_id
        AND (e.criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos'))
    )
  );

CREATE POLICY "unidades admin insert" ON public.unidades
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') AND criado_por = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.matrizes m JOIN public.empresas e ON e.id = m.empresa_id
      WHERE m.id = unidades.matriz_id
        AND (e.criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos'))
    )
  );

CREATE POLICY "unidades admin update" ON public.unidades
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.matrizes m JOIN public.empresas e ON e.id = m.empresa_id
      WHERE m.id = unidades.matriz_id
        AND (e.criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos'))
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.matrizes m JOIN public.empresas e ON e.id = m.empresa_id
      WHERE m.id = unidades.matriz_id
        AND (e.criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos'))
    )
  );

CREATE POLICY "unidades admin delete" ON public.unidades
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.matrizes m JOIN public.empresas e ON e.id = m.empresa_id
      WHERE m.id = unidades.matriz_id AND e.criado_por = auth.uid()
    )
  );

CREATE POLICY "unidades vistoriador select" ON public.unidades
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'agente_tecnico')
    AND EXISTS (SELECT 1 FROM public.casos c WHERE c.unidade_id = unidades.id AND c.agente_id = auth.uid())
  );