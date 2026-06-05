
-- 1) Funções auxiliares SECURITY DEFINER para evitar recursão entre as policies
CREATE OR REPLACE FUNCTION public.admin_pode_ver_empresa(_user_id uuid, _empresa_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = _empresa_id
      AND (e.criado_por = _user_id OR public.has_permissao_extra(_user_id, 'ver_todos_casos'))
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_pode_editar_empresa(_user_id uuid, _empresa_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = _empresa_id AND e.criado_por = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.empresa_da_matriz(_matriz_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT empresa_id FROM public.matrizes WHERE id = _matriz_id;
$$;

CREATE OR REPLACE FUNCTION public.matriz_da_unidade(_unidade_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT matriz_id FROM public.unidades WHERE id = _unidade_id;
$$;

CREATE OR REPLACE FUNCTION public.agente_tem_caso_em_unidade(_user_id uuid, _unidade_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.casos c WHERE c.unidade_id = _unidade_id AND c.agente_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.agente_tem_caso_em_matriz(_user_id uuid, _matriz_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.casos c
    JOIN public.unidades u ON u.id = c.unidade_id
    WHERE u.matriz_id = _matriz_id AND c.agente_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.agente_tem_caso_em_empresa(_user_id uuid, _empresa_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.casos c
    JOIN public.unidades u ON u.id = c.unidade_id
    JOIN public.matrizes m ON m.id = u.matriz_id
    WHERE m.empresa_id = _empresa_id AND c.agente_id = _user_id
  );
$$;

-- 2) Recriar policies sem subqueries recursivas
-- EMPRESAS
DROP POLICY IF EXISTS "empresas admin select" ON public.empresas;
DROP POLICY IF EXISTS "empresas admin update" ON public.empresas;
DROP POLICY IF EXISTS "empresas admin delete" ON public.empresas;
DROP POLICY IF EXISTS "empresas vistoriador select" ON public.empresas;

CREATE POLICY "empresas admin select" ON public.empresas FOR SELECT
USING (has_role(auth.uid(),'admin') AND (criado_por = auth.uid() OR has_permissao_extra(auth.uid(),'ver_todos_casos')));
CREATE POLICY "empresas admin update" ON public.empresas FOR UPDATE
USING (has_role(auth.uid(),'admin') AND (criado_por = auth.uid() OR has_permissao_extra(auth.uid(),'ver_todos_casos')));
CREATE POLICY "empresas admin delete" ON public.empresas FOR DELETE
USING (has_role(auth.uid(),'admin') AND criado_por = auth.uid());
CREATE POLICY "empresas agente_tecnico select" ON public.empresas FOR SELECT
USING (has_role(auth.uid(),'agente_tecnico') AND public.agente_tem_caso_em_empresa(auth.uid(), id));

-- MATRIZES
DROP POLICY IF EXISTS "matrizes admin select" ON public.matrizes;
DROP POLICY IF EXISTS "matrizes admin update" ON public.matrizes;
DROP POLICY IF EXISTS "matrizes admin delete" ON public.matrizes;
DROP POLICY IF EXISTS "matrizes vistoriador select" ON public.matrizes;

CREATE POLICY "matrizes admin select" ON public.matrizes FOR SELECT
USING (has_role(auth.uid(),'admin') AND public.admin_pode_ver_empresa(auth.uid(), empresa_id));
CREATE POLICY "matrizes admin update" ON public.matrizes FOR UPDATE
USING (has_role(auth.uid(),'admin') AND public.admin_pode_ver_empresa(auth.uid(), empresa_id));
CREATE POLICY "matrizes admin delete" ON public.matrizes FOR DELETE
USING (has_role(auth.uid(),'admin') AND public.admin_pode_editar_empresa(auth.uid(), empresa_id));
CREATE POLICY "matrizes agente_tecnico select" ON public.matrizes FOR SELECT
USING (has_role(auth.uid(),'agente_tecnico') AND public.agente_tem_caso_em_matriz(auth.uid(), id));

-- UNIDADES
DROP POLICY IF EXISTS "unidades admin select" ON public.unidades;
DROP POLICY IF EXISTS "unidades admin update" ON public.unidades;
DROP POLICY IF EXISTS "unidades admin delete" ON public.unidades;
DROP POLICY IF EXISTS "unidades vistoriador select" ON public.unidades;

CREATE POLICY "unidades admin select" ON public.unidades FOR SELECT
USING (has_role(auth.uid(),'admin') AND public.admin_pode_ver_empresa(auth.uid(), public.empresa_da_matriz(matriz_id)));
CREATE POLICY "unidades admin update" ON public.unidades FOR UPDATE
USING (has_role(auth.uid(),'admin') AND public.admin_pode_ver_empresa(auth.uid(), public.empresa_da_matriz(matriz_id)));
CREATE POLICY "unidades admin delete" ON public.unidades FOR DELETE
USING (has_role(auth.uid(),'admin') AND public.admin_pode_editar_empresa(auth.uid(), public.empresa_da_matriz(matriz_id)));
CREATE POLICY "unidades agente_tecnico select" ON public.unidades FOR SELECT
USING (has_role(auth.uid(),'agente_tecnico') AND public.agente_tem_caso_em_unidade(auth.uid(), id));

-- 3) Adiciona FK formularios.empresa_id -> empresas(id)
ALTER TABLE public.formularios
  ADD CONSTRAINT formularios_empresa_id_fkey
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL;
