ALTER TABLE public.casos
  ADD COLUMN IF NOT EXISTS laudo_variaveis jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS laudo_conteudo jsonb,
  ADD COLUMN IF NOT EXISTS laudo_alertas jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.perguntas
  ADD COLUMN IF NOT EXISTS chave_laudo text;

CREATE TABLE IF NOT EXISTS public.catalogo_materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  descricao text NOT NULL,
  aplicacao text,
  unidade text NOT NULL DEFAULT 'un',
  quantidade_padrao numeric NOT NULL DEFAULT 1,
  regra jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogo_materiais TO authenticated;
GRANT ALL ON public.catalogo_materiais TO service_role;

ALTER TABLE public.catalogo_materiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver catalogo de materiais"
ON public.catalogo_materiais FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Gestores podem inserir materiais"
ON public.catalogo_materiais FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'especialista')
);

CREATE POLICY "Gestores podem editar materiais"
ON public.catalogo_materiais FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'especialista')
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'especialista')
);

CREATE POLICY "Gestores podem remover materiais"
ON public.catalogo_materiais FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'especialista')
);

CREATE TRIGGER trg_catalogo_materiais_atualizado_em
BEFORE UPDATE ON public.catalogo_materiais
FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

INSERT INTO public.catalogo_materiais (codigo, descricao, aplicacao, unidade, quantidade_padrao, regra, ordem) VALUES
('MAT-NIP-034', 'Niple galvanizado 3/4"', 'Instalação do NLDIV na linha de abastecimento', 'un', 2, '{"nivel":["nivel_2"],"bitola":["3/4\""]}'::jsonb, 10),
('MAT-NIP-100', 'Niple galvanizado 1"', 'Instalação do NLDIV na linha de abastecimento', 'un', 2, '{"nivel":["nivel_2"],"bitola":["1\""]}'::jsonb, 20),
('MAT-LUV-RED', 'Luva de redução 1" x 3/4"', 'Adequação de bitola quando o bico é 1"', 'un', 2, '{"nivel":["nivel_2"],"bitola":["1\""]}'::jsonb, 30),
('MAT-COT-034', 'Cotovelo galvanizado 3/4"', 'Direcionamento da tubulação', 'un', 1, '{"nivel":["nivel_2"]}'::jsonb, 40),
('MAT-CAB-PP4', 'Cabo PP 4x1,5 mm²', 'Alimentação do terminal e sensores', 'm', 10, '{}'::jsonb, 50),
('MAT-CAB-PP2', 'Cabo PP 2x1,5 mm²', 'Alimentação da válvula solenoide', 'm', 10, '{}'::jsonb, 60),
('MAT-CONT-12', 'Contator 12 VCC', 'Acionamento da bomba', 'un', 1, '{"tipo_objeto":["posto","pista"]}'::jsonb, 70),
('MAT-PRENSA', 'Prensa-cabo', 'Vedação de entrada de cabos no painel', 'un', 4, '{}'::jsonb, 80),
('MAT-LUVA-EX', 'Luva EX para área classificada', 'Obrigatório em área classificada', 'un', 2, '{"area_classificada":true}'::jsonb, 90);