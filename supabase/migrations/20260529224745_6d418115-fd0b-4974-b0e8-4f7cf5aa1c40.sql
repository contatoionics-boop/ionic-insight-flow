DO $$
DECLARE
  v_sec_id uuid := '1bc04be0-71cc-4037-b81b-4103d2686bf0';
  v_base int;
BEGIN
  SELECT COALESCE(MAX(ordem), 0) INTO v_base FROM public.perguntas WHERE secao_id = v_sec_id;

  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem) VALUES
    (v_sec_id, 'CNPJ do Cliente',           'cnpj'::public.pergunta_tipo,  false, v_base + 1),
    (v_sec_id, 'CEP do local da vistoria',  'cep'::public.pergunta_tipo,   false, v_base + 2),
    (v_sec_id, 'Logradouro',                'texto'::public.pergunta_tipo, false, v_base + 3),
    (v_sec_id, 'Número',                    'texto'::public.pergunta_tipo, false, v_base + 4),
    (v_sec_id, 'Bairro',                    'texto'::public.pergunta_tipo, false, v_base + 5),
    (v_sec_id, 'Cidade / Estado',           'texto'::public.pergunta_tipo, false, v_base + 6);
END $$;