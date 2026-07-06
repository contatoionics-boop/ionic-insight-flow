
-- Ampliar acesso do papel admin (IAM) em casos e agendamentos:
-- passa a enxergar, editar e excluir TODOS os registros (não só os que criou).

-- CASOS
DROP POLICY IF EXISTS "casos admin select" ON public.casos;
DROP POLICY IF EXISTS "casos admin update" ON public.casos;
DROP POLICY IF EXISTS "casos admin delete" ON public.casos;

CREATE POLICY "casos admin select"
ON public.casos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "casos admin update"
ON public.casos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "casos admin delete"
ON public.casos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- AGENDAMENTOS
DROP POLICY IF EXISTS "agendamentos admin select" ON public.agendamentos;
DROP POLICY IF EXISTS "agendamentos admin update" ON public.agendamentos;
DROP POLICY IF EXISTS "agendamentos admin delete" ON public.agendamentos;

CREATE POLICY "agendamentos admin select"
ON public.agendamentos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "agendamentos admin update"
ON public.agendamentos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "agendamentos admin delete"
ON public.agendamentos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- EMPRESAS/MATRIZES/UNIDADES: admin já tem SELECT amplo em empresas/matrizes;
-- garantir UPDATE/DELETE em matrizes e unidades sem restrição por criador.
DROP POLICY IF EXISTS "empresas admin update" ON public.empresas;
DROP POLICY IF EXISTS "empresas admin delete" ON public.empresas;

CREATE POLICY "empresas admin update"
ON public.empresas FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "empresas admin delete"
ON public.empresas FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
