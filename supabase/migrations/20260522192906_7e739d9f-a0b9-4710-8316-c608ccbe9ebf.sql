
-- 1) profiles: campo permissoes_extras
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS permissoes_extras text[] NOT NULL DEFAULT '{}';

-- 2) Enum status do caso
DO $$ BEGIN
  CREATE TYPE public.caso_status AS ENUM ('rascunho','enviado','em_analise','aguardando_revisao','aprovado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3) Helpers de autorização (SECURITY DEFINER, evita recursão RLS)
CREATE OR REPLACE FUNCTION public.has_permissao_extra(_user_id uuid, _perm text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND _perm = ANY(permissoes_extras)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_permissao_extra(uuid, text) FROM PUBLIC, anon;

-- 4) Tabela clientes
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text UNIQUE,
  email text,
  telefone text,
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- 5) Sequência + função para gerar código CS-XXXX
CREATE SEQUENCE IF NOT EXISTS public.casos_codigo_seq START 1;

CREATE OR REPLACE FUNCTION public.gen_caso_codigo()
RETURNS text
LANGUAGE sql VOLATILE
AS $$
  SELECT 'CS-' || lpad(nextval('public.casos_codigo_seq')::text, 4, '0');
$$;

-- 6) Tabela casos
CREATE TABLE public.casos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE DEFAULT public.gen_caso_codigo(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  agente_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.caso_status NOT NULL DEFAULT 'rascunho',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.casos ENABLE ROW LEVEL SECURITY;

-- Trigger atualizado_em
CREATE OR REPLACE FUNCTION public.set_atualizado_em()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_casos_atualizado_em
BEFORE UPDATE ON public.casos
FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

-- Índices úteis
CREATE INDEX idx_casos_cliente_id ON public.casos(cliente_id);
CREATE INDEX idx_casos_agente_id ON public.casos(agente_id);
CREATE INDEX idx_casos_criado_por ON public.casos(criado_por);
CREATE INDEX idx_casos_status ON public.casos(status);
CREATE INDEX idx_clientes_criado_por ON public.clientes(criado_por);

-- =========================
-- RLS: clientes
-- =========================

-- Super admin: tudo
CREATE POLICY "clientes super admin all"
  ON public.clientes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Admin: vê os que criou OU se tem permissão extra ver_todos_casos
CREATE POLICY "clientes admin select"
  ON public.clientes FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos'))
  );

-- Admin: insere (criado_por deve ser ele)
CREATE POLICY "clientes admin insert"
  ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') AND criado_por = auth.uid()
  );

-- Admin: atualiza apenas os que criou (ou com ver_todos_casos)
CREATE POLICY "clientes admin update"
  ON public.clientes FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos'))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND (criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos'))
  );

-- Admin: deleta apenas os que criou
CREATE POLICY "clientes admin delete"
  ON public.clientes FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') AND criado_por = auth.uid()
  );

-- =========================
-- RLS: casos
-- =========================

-- Super admin: tudo
CREATE POLICY "casos super admin all"
  ON public.casos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Admin: vê os que criou (ou todos com ver_todos_casos)
CREATE POLICY "casos admin select"
  ON public.casos FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos'))
  );

CREATE POLICY "casos admin insert"
  ON public.casos FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') AND criado_por = auth.uid()
  );

CREATE POLICY "casos admin update"
  ON public.casos FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos'))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND (criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos'))
  );

CREATE POLICY "casos admin delete"
  ON public.casos FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') AND criado_por = auth.uid()
  );

-- Especialista: vê casos aguardando_revisao e aprovado
CREATE POLICY "casos especialista select"
  ON public.casos FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'especialista')
    AND status IN ('aguardando_revisao','aprovado')
  );

-- Especialista: pode atualizar casos sob revisão (transições de fluxo)
CREATE POLICY "casos especialista update"
  ON public.casos FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'especialista')
    AND status IN ('aguardando_revisao','aprovado')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'especialista')
  );
