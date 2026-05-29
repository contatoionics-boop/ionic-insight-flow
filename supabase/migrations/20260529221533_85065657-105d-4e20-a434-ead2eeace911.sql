-- Desacoplar formulário de cliente: torna cliente_id opcional e ajusta RLS

ALTER TABLE public.formularios ALTER COLUMN cliente_id DROP NOT NULL;

-- Reescreve função: admin pode ver formulário se for criador ou tiver permissão ver_todos_casos
CREATE OR REPLACE FUNCTION public.admin_pode_ver_formulario(_user_id uuid, _formulario_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.formularios f
    WHERE f.id = _formulario_id
      AND (
        f.criado_por = _user_id
        OR public.has_permissao_extra(_user_id, 'ver_todos_casos')
      )
  );
$$;

-- Drop e recria policies de formularios (sem depender de cliente)
DROP POLICY IF EXISTS "formularios admin delete" ON public.formularios;
DROP POLICY IF EXISTS "formularios admin insert" ON public.formularios;
DROP POLICY IF EXISTS "formularios admin select" ON public.formularios;
DROP POLICY IF EXISTS "formularios admin update" ON public.formularios;

CREATE POLICY "formularios admin select"
ON public.formularios FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND (criado_por = auth.uid() OR has_permissao_extra(auth.uid(), 'ver_todos_casos'))
);

CREATE POLICY "formularios admin insert"
ON public.formularios FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND criado_por = auth.uid()
);

CREATE POLICY "formularios admin update"
ON public.formularios FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND (criado_por = auth.uid() OR has_permissao_extra(auth.uid(), 'ver_todos_casos'))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND (criado_por = auth.uid() OR has_permissao_extra(auth.uid(), 'ver_todos_casos'))
);

CREATE POLICY "formularios admin delete"
ON public.formularios FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND criado_por = auth.uid()
);