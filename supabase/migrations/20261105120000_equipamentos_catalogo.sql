-- Catálogo de equipamentos cadastrável (Fase 4C).
-- A tabela produtos_catalogo (código + nome, carga inicial do relatório do portal) passa a aceitar
-- equipamentos NOVOS cadastrados pelo especialista (origem = 'manual') e a guardar a regra de sugestão
-- (mesmo formato de catalogo_materiais.regra: nivel, bitola, tipo_objeto, area_classificada).
-- Nada muda para os 590 produtos existentes: sugerir = false e regra = {}.

ALTER TABLE public.produtos_catalogo
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS unidade text NOT NULL DEFAULT 'un',
  ADD COLUMN IF NOT EXISTS quantidade_padrao numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sugerir boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS regra jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS criado_por uuid;

GRANT INSERT, UPDATE ON public.produtos_catalogo TO authenticated;

-- Quem mantém o catálogo enxerga também os inativos (para reativar).
DROP POLICY IF EXISTS "Editores veem todo o catalogo de produtos" ON public.produtos_catalogo;
CREATE POLICY "Editores veem todo o catalogo de produtos"
ON public.produtos_catalogo FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'especialista')
);

DROP POLICY IF EXISTS "Editores cadastram produtos" ON public.produtos_catalogo;
CREATE POLICY "Editores cadastram produtos"
ON public.produtos_catalogo FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'especialista')
);

DROP POLICY IF EXISTS "Editores atualizam produtos" ON public.produtos_catalogo;
CREATE POLICY "Editores atualizam produtos"
ON public.produtos_catalogo FOR UPDATE TO authenticated
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

CREATE INDEX IF NOT EXISTS produtos_catalogo_sugerir_idx ON public.produtos_catalogo (sugerir) WHERE sugerir;
