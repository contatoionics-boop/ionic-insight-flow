-- 1) Tabela singleton de configurações da empresa
CREATE TABLE IF NOT EXISTS public.configuracoes_empresa (
  id uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  nome_empresa text,
  logo_url text,
  cnpj text,
  telefone text,
  email_contato text,
  endereco text,
  cidade_estado text,
  site text,
  texto_rodape text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  singleton boolean NOT NULL DEFAULT true,
  CONSTRAINT configuracoes_empresa_singleton_unique UNIQUE (singleton)
);

-- Seed da linha única
INSERT INTO public.configuracoes_empresa (id, nome_empresa)
VALUES ('00000000-0000-0000-0000-000000000001', 'Ionics')
ON CONFLICT (id) DO NOTHING;

-- Grants para a Data API
GRANT SELECT ON public.configuracoes_empresa TO anon, authenticated;
GRANT INSERT, UPDATE ON public.configuracoes_empresa TO authenticated;
GRANT ALL ON public.configuracoes_empresa TO service_role;

-- RLS
ALTER TABLE public.configuracoes_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config empresa leitura publica"
  ON public.configuracoes_empresa FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "config empresa super admin update"
  ON public.configuracoes_empresa FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "config empresa super admin insert"
  ON public.configuracoes_empresa FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 2) Bucket público para logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('empresa-logos', 'empresa-logos', true)
ON CONFLICT (id) DO NOTHING;

-- 3) Policies de storage
CREATE POLICY "empresa-logos leitura publica"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'empresa-logos');

CREATE POLICY "empresa-logos super admin insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'empresa-logos' AND public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "empresa-logos super admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'empresa-logos' AND public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "empresa-logos super admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'empresa-logos' AND public.has_role(auth.uid(), 'super_admin'));