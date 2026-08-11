DO $$
DECLARE
  v_src uuid := 'd521252d-fd30-42f9-928f-eed50d4bcbaa';
  v_new uuid := gen_random_uuid();
  s record; p record; nid uuid; sid uuid;
  b_ident uuid; b_infra uuid; b_energia uuid; b_quant uuid; b_fotos uuid; b_croqui uuid;
BEGIN
  INSERT INTO public.formularios (id, nome, descricao, empresa_id, ativo, criado_por, codigo, revisao, data_revisao, elaborado_por, aprovado_por, validar_imagens_ia)
  SELECT v_new, 'FR-11-10 — Pista de Abastecimento (Formato Blocos • Teste)', descricao, empresa_id, true, criado_por, codigo, revisao, data_revisao, elaborado_por, aprovado_por, validar_imagens_ia
  FROM public.formularios WHERE id = v_src;

  FOR s IN SELECT * FROM public.secoes WHERE formulario_id = v_src ORDER BY ordem LOOP
    sid := gen_random_uuid();
    INSERT INTO public.secoes (id, formulario_id, titulo, descricao, ordem)
    VALUES (sid, v_new, s.titulo, s.descricao, s.ordem);

    IF s.ordem = 0 THEN
      b_ident := gen_random_uuid();
      INSERT INTO public.pergunta_blocos (id, secao_id, titulo, descricao, layout, ordem)
      VALUES (b_ident, sid, 'Identificação do atendimento', 'Preencha os dados básicos de uma só vez.', 'cartao', 0);
    ELSIF s.ordem = 1 THEN
      b_infra := gen_random_uuid(); b_energia := gen_random_uuid();
      INSERT INTO public.pergunta_blocos (id, secao_id, titulo, descricao, layout, ordem) VALUES
        (b_infra, sid, 'Escritório e infraestrutura', 'Área coberta, rack e internet.', 'cartao', 0),
        (b_energia, sid, 'Energia e comunicação', 'Tensão, energia, tubulação e base de comunicação.', 'cartao', 1);
    ELSIF s.ordem = 2 THEN
      b_quant := gen_random_uuid();
      INSERT INTO public.pergunta_blocos (id, secao_id, titulo, descricao, layout, ordem)
      VALUES (b_quant, sid, 'Quantitativos de equipamentos Ionics', 'Informe as quantidades em uma única tabela.', 'matriz', 0);
    ELSIF s.ordem = 3 THEN
      b_croqui := gen_random_uuid();
      INSERT INTO public.pergunta_blocos (id, secao_id, titulo, descricao, layout, ordem)
      VALUES (b_croqui, sid, 'Infraestrutura e layout', 'Descrição e croqui da instalação.', 'cartao', 0);
    ELSIF s.ordem = 4 THEN
      b_fotos := gen_random_uuid();
      INSERT INTO public.pergunta_blocos (id, secao_id, titulo, descricao, layout, ordem)
      VALUES (b_fotos, sid, 'Registro fotográfico e diagnóstico WiFi', 'Envie todas as fotos em lote.', 'fotos', 0);
    END IF;

    FOR p IN SELECT * FROM public.perguntas WHERE secao_id = s.id ORDER BY ordem LOOP
      nid := gen_random_uuid();
      INSERT INTO public.perguntas (id, secao_id, texto, tipo, obrigatoria, ordem, instrucao_agente, contexto_ia, chave_laudo, bloco_id, bloco_linha, bloco_coluna)
      VALUES (
        nid, sid, p.texto, p.tipo, p.obrigatoria, p.ordem, p.instrucao_agente, p.contexto_ia, p.chave_laudo,
        CASE
          WHEN s.ordem = 0 AND p.ordem <= 2 THEN b_ident
          WHEN s.ordem = 1 AND p.ordem <= 2 THEN b_infra
          WHEN s.ordem = 1 AND p.ordem >= 3 THEN b_energia
          WHEN s.ordem = 2 THEN b_quant
          WHEN s.ordem = 3 THEN b_croqui
          WHEN s.ordem = 4 THEN b_fotos
          ELSE NULL
        END,
        CASE WHEN s.ordem = 2 THEN p.texto ELSE NULL END,
        NULL
      );

      INSERT INTO public.opcoes_pergunta (id, pergunta_id, texto, ordem)
      SELECT gen_random_uuid(), nid, o.texto, o.ordem FROM public.opcoes_pergunta o WHERE o.pergunta_id = p.id;
    END LOOP;
  END LOOP;
END $$;