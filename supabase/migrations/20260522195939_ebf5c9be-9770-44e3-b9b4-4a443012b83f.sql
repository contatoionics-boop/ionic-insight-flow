-- Enum para tipo de pergunta
CREATE TYPE public.pergunta_tipo AS ENUM ('texto','foto','audio','checkbox','numero');

-- Tabela formularios
CREATE TABLE public.formularios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- Tabela secoes
CREATE TABLE public.secoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formulario_id uuid NOT NULL REFERENCES public.formularios(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  ordem integer NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_secoes_formulario ON public.secoes(formulario_id);

-- Tabela perguntas
CREATE TABLE public.perguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secao_id uuid NOT NULL REFERENCES public.secoes(id) ON DELETE CASCADE,
  texto text NOT NULL,
  tipo public.pergunta_tipo NOT NULL,
  obrigatoria boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL,
  instrucao_agente text,
  contexto_ia text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_perguntas_secao ON public.perguntas(secao_id);

-- Tabela opcoes_pergunta
CREATE TABLE public.opcoes_pergunta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pergunta_id uuid NOT NULL REFERENCES public.perguntas(id) ON DELETE CASCADE,
  texto text NOT NULL,
  ordem integer
);
CREATE INDEX idx_opcoes_pergunta_pergunta ON public.opcoes_pergunta(pergunta_id);

-- Helper: verifica se usuário tem acesso ao formulário (admin que criou cliente, com ver_todos_casos, ou super_admin)
CREATE OR REPLACE FUNCTION public.admin_pode_ver_formulario(_user_id uuid, _formulario_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.formularios f
    JOIN public.clientes c ON c.id = f.cliente_id
    WHERE f.id = _formulario_id
      AND (
        c.criado_por = _user_id
        OR public.has_permissao_extra(_user_id, 'ver_todos_casos')
      )
  );
$$;

-- Enable RLS
ALTER TABLE public.formularios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opcoes_pergunta ENABLE ROW LEVEL SECURITY;

-- ===== formularios =====
CREATE POLICY "formularios super admin all" ON public.formularios
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "formularios admin select" ON public.formularios
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id
        AND (c.criado_por = auth.uid() OR has_permissao_extra(auth.uid(), 'ver_todos_casos'))
    )
  );

CREATE POLICY "formularios admin insert" ON public.formularios
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    AND criado_por = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id AND c.criado_por = auth.uid()
    )
  );

CREATE POLICY "formularios admin update" ON public.formularios
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id
        AND (c.criado_por = auth.uid() OR has_permissao_extra(auth.uid(), 'ver_todos_casos'))
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id
        AND (c.criado_por = auth.uid() OR has_permissao_extra(auth.uid(), 'ver_todos_casos'))
    )
  );

CREATE POLICY "formularios admin delete" ON public.formularios
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id AND c.criado_por = auth.uid()
    )
  );

CREATE POLICY "formularios especialista select" ON public.formularios
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'especialista'));

-- ===== secoes =====
CREATE POLICY "secoes super admin all" ON public.secoes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "secoes admin select" ON public.secoes
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') AND admin_pode_ver_formulario(auth.uid(), formulario_id));

CREATE POLICY "secoes admin insert" ON public.secoes
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') AND admin_pode_ver_formulario(auth.uid(), formulario_id));

CREATE POLICY "secoes admin update" ON public.secoes
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') AND admin_pode_ver_formulario(auth.uid(), formulario_id))
  WITH CHECK (has_role(auth.uid(), 'admin') AND admin_pode_ver_formulario(auth.uid(), formulario_id));

CREATE POLICY "secoes admin delete" ON public.secoes
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') AND admin_pode_ver_formulario(auth.uid(), formulario_id));

CREATE POLICY "secoes especialista select" ON public.secoes
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'especialista'));

-- ===== perguntas =====
CREATE POLICY "perguntas super admin all" ON public.perguntas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "perguntas admin select" ON public.perguntas
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.secoes s
      WHERE s.id = secao_id AND admin_pode_ver_formulario(auth.uid(), s.formulario_id)
    )
  );

CREATE POLICY "perguntas admin insert" ON public.perguntas
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.secoes s
      WHERE s.id = secao_id AND admin_pode_ver_formulario(auth.uid(), s.formulario_id)
    )
  );

CREATE POLICY "perguntas admin update" ON public.perguntas
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.secoes s
      WHERE s.id = secao_id AND admin_pode_ver_formulario(auth.uid(), s.formulario_id)
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.secoes s
      WHERE s.id = secao_id AND admin_pode_ver_formulario(auth.uid(), s.formulario_id)
    )
  );

CREATE POLICY "perguntas admin delete" ON public.perguntas
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.secoes s
      WHERE s.id = secao_id AND admin_pode_ver_formulario(auth.uid(), s.formulario_id)
    )
  );

CREATE POLICY "perguntas especialista select" ON public.perguntas
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'especialista'));

-- ===== opcoes_pergunta =====
CREATE POLICY "opcoes super admin all" ON public.opcoes_pergunta
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "opcoes admin select" ON public.opcoes_pergunta
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.perguntas p
      JOIN public.secoes s ON s.id = p.secao_id
      WHERE p.id = pergunta_id AND admin_pode_ver_formulario(auth.uid(), s.formulario_id)
    )
  );

CREATE POLICY "opcoes admin insert" ON public.opcoes_pergunta
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.perguntas p
      JOIN public.secoes s ON s.id = p.secao_id
      WHERE p.id = pergunta_id AND admin_pode_ver_formulario(auth.uid(), s.formulario_id)
    )
  );

CREATE POLICY "opcoes admin update" ON public.opcoes_pergunta
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.perguntas p
      JOIN public.secoes s ON s.id = p.secao_id
      WHERE p.id = pergunta_id AND admin_pode_ver_formulario(auth.uid(), s.formulario_id)
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.perguntas p
      JOIN public.secoes s ON s.id = p.secao_id
      WHERE p.id = pergunta_id AND admin_pode_ver_formulario(auth.uid(), s.formulario_id)
    )
  );

CREATE POLICY "opcoes admin delete" ON public.opcoes_pergunta
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.perguntas p
      JOIN public.secoes s ON s.id = p.secao_id
      WHERE p.id = pergunta_id AND admin_pode_ver_formulario(auth.uid(), s.formulario_id)
    )
  );

CREATE POLICY "opcoes especialista select" ON public.opcoes_pergunta
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'especialista'));