
-- EMPRESAS
DROP POLICY IF EXISTS "empresas admin select" ON public.empresas;
CREATE POLICY "empresas admin select" ON public.empresas FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "empresas especialista select" ON public.empresas;
CREATE POLICY "empresas especialista select" ON public.empresas FOR SELECT
  USING (has_role(auth.uid(), 'especialista'::app_role));

-- MATRIZES
DROP POLICY IF EXISTS "matrizes admin select" ON public.matrizes;
CREATE POLICY "matrizes admin select" ON public.matrizes FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "matrizes especialista select" ON public.matrizes;
CREATE POLICY "matrizes especialista select" ON public.matrizes FOR SELECT
  USING (has_role(auth.uid(), 'especialista'::app_role));

-- UNIDADES
DROP POLICY IF EXISTS "unidades admin select" ON public.unidades;
CREATE POLICY "unidades admin select" ON public.unidades FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "unidades especialista select" ON public.unidades;
CREATE POLICY "unidades especialista select" ON public.unidades FOR SELECT
  USING (has_role(auth.uid(), 'especialista'::app_role));

-- FORMULARIOS
DROP POLICY IF EXISTS "formularios admin select" ON public.formularios;
CREATE POLICY "formularios admin select" ON public.formularios FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- (especialista já tem select global; super_admin tem ALL)

-- SECOES
DROP POLICY IF EXISTS "secoes admin select" ON public.secoes;
CREATE POLICY "secoes admin select" ON public.secoes FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "secoes especialista select" ON public.secoes;
CREATE POLICY "secoes especialista select" ON public.secoes FOR SELECT
  USING (has_role(auth.uid(), 'especialista'::app_role));

-- PERGUNTAS
DROP POLICY IF EXISTS "perguntas admin select" ON public.perguntas;
CREATE POLICY "perguntas admin select" ON public.perguntas FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "perguntas especialista select" ON public.perguntas;
CREATE POLICY "perguntas especialista select" ON public.perguntas FOR SELECT
  USING (has_role(auth.uid(), 'especialista'::app_role));

-- OPCOES_PERGUNTA
DROP POLICY IF EXISTS "opcoes admin select" ON public.opcoes_pergunta;
CREATE POLICY "opcoes admin select" ON public.opcoes_pergunta FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "opcoes especialista select" ON public.opcoes_pergunta;
CREATE POLICY "opcoes especialista select" ON public.opcoes_pergunta FOR SELECT
  USING (has_role(auth.uid(), 'especialista'::app_role));
