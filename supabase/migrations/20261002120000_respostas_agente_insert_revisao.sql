-- Hoje admin/especialista só conseguem UPDATE em respostas_agente. Quando o
-- agente não respondeu uma pergunta (nenhuma linha existe ainda), a tela de
-- revisão tentava um UPDATE que não afeta nenhuma linha (falha silenciosa) e
-- um INSERT seria bloqueado por falta de política. Adiciona INSERT para
-- admin/especialista nos mesmos casos em que eles já podem ver/editar.
CREATE POLICY "respostas admin insert"
ON public.respostas_agente FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') AND EXISTS (
    SELECT 1 FROM public.casos c
    WHERE c.id = respostas_agente.caso_id
      AND (c.criado_por = auth.uid() OR public.has_permissao_extra(auth.uid(), 'ver_todos_casos'))
  )
);

CREATE POLICY "respostas especialista insert"
ON public.respostas_agente FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'especialista') AND EXISTS (
    SELECT 1 FROM public.casos c
    WHERE c.id = respostas_agente.caso_id
      AND c.status IN ('aguardando_revisao', 'aprovado')
  )
);
