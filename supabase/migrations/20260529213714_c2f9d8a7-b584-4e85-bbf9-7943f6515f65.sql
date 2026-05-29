DO $$
DECLARE
  v_form_id uuid;
  v_sec_dados uuid;
  v_sec_desc uuid;
  v_sec_b1 uuid;
  v_sec_b2 uuid;
  v_sec_fotos_bomba uuid;
  v_sec_pista uuid;
  v_sec_fotos_pista uuid;
  v_sec_conect uuid;
  v_sec_fotos_conect uuid;
BEGIN
  SELECT id INTO v_form_id FROM public.formularios WHERE nome = 'BB0001' LIMIT 1;
  IF v_form_id IS NULL THEN
    RAISE EXCEPTION 'Formulário BB0001 não encontrado';
  END IF;

  -- ───── SEÇÃO 1: Dados Gerais ─────
  INSERT INTO public.secoes (formulario_id, titulo, ordem) VALUES (v_form_id, 'Dados Gerais', 1) RETURNING id INTO v_sec_dados;
  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem) VALUES
    (v_sec_dados, 'Cliente / Unidade', 'texto', true, 1),
    (v_sec_dados, 'Data da Vistoria', 'data', true, 2),
    (v_sec_dados, 'Responsável', 'texto', true, 3),
    (v_sec_dados, 'Contato', 'texto', true, 4);

  -- ───── SEÇÃO 2: Descrição Geral da Bomba ─────
  INSERT INTO public.secoes (formulario_id, titulo, ordem) VALUES (v_form_id, 'Descrição Geral dos Dispositivos de Abastecimento', 2) RETURNING id INTO v_sec_desc;
  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, contexto_ia) VALUES
    (v_sec_desc, 'Localização / Nº da Ilha onde está instalada a Bomba', 'audio', true, 1, 'O vistoriador deve informar o número ou nome da ilha onde a bomba está instalada.'),
    (v_sec_desc, 'Tipo de Bomba', 'selecao_unica', true, 2, NULL),
    (v_sec_desc, 'Marca / Modelo da Bomba', 'audio', true, 3, 'O vistoriador deve informar a marca e modelo da bomba de abastecimento.'),
    (v_sec_desc, 'Vazão fornecida pela Bomba (L/min.)', 'audio', true, 4, 'O vistoriador deve informar a vazão em litros por minuto.'),
    (v_sec_desc, 'Tensão de alimentação da Bomba', 'selecao_unica', true, 5, NULL);

  INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem)
  SELECT p.id, t.opcao, t.idx FROM public.perguntas p
  CROSS JOIN (VALUES ('Eletrônica',1),('Mecânica',2),('01 Bico',3),('02 Bicos',4)) AS t(opcao, idx)
  WHERE p.texto = 'Tipo de Bomba' AND p.secao_id = v_sec_desc;

  INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem)
  SELECT p.id, t.opcao, t.idx FROM public.perguntas p
  CROSS JOIN (VALUES ('220VCA',1),('380VCA',2)) AS t(opcao, idx)
  WHERE p.texto = 'Tensão de alimentação da Bomba' AND p.secao_id = v_sec_desc;

  -- ───── SEÇÃO 3: Bico 1 ─────
  INSERT INTO public.secoes (formulario_id, titulo, ordem) VALUES (v_form_id, 'Dados do Bico 1', 3) RETURNING id INTO v_sec_b1;
  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, contexto_ia) VALUES
    (v_sec_b1, 'Marca / Modelo - Bico 1', 'audio', true, 1, 'Informe a marca e modelo do bico 1.'),
    (v_sec_b1, 'Combustível / Insumo - Bico 1', 'selecao_unica', true, 2, NULL),
    (v_sec_b1, 'Diâmetro da Mangueira de Abastecimento - Bico 1 (pol. mm)', 'audio', true, 3, 'Informe o diâmetro da mangueira em polegadas ou milímetros.'),
    (v_sec_b1, 'Diâmetro da rosca de entrada do Corpo - Bico 1 (pol. mm)', 'audio', true, 4, 'Informe o diâmetro da rosca de entrada do corpo do bico 1.'),
    (v_sec_b1, 'Diâmetro da Ponteira - Bico 1 (pol. mm)', 'audio', true, 5, 'Informe o diâmetro da ponteira do bico 1.'),
    (v_sec_b1, 'Comprimento da Ponteira - Bico 1 (mm)', 'audio', true, 6, 'Informe o comprimento da ponteira em milímetros.');

  INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem)
  SELECT p.id, t.opcao, t.idx FROM public.perguntas p
  CROSS JOIN (VALUES ('Diesel S10',1),('Diesel S500',2),('Etanol',3),('Gasolina',4),('Querosene',5),('Lubrificante (óleo)',6),('ARLA (aditivo)',7)) AS t(opcao, idx)
  WHERE p.texto = 'Combustível / Insumo - Bico 1' AND p.secao_id = v_sec_b1;

  -- ───── SEÇÃO 4: Bico 2 ─────
  INSERT INTO public.secoes (formulario_id, titulo, ordem) VALUES (v_form_id, 'Dados do Bico 2', 4) RETURNING id INTO v_sec_b2;
  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, contexto_ia) VALUES
    (v_sec_b2, 'Marca / Modelo - Bico 2', 'audio', true, 1, 'Informe a marca e modelo do bico 2.'),
    (v_sec_b2, 'Combustível / Insumo - Bico 2', 'selecao_unica', true, 2, NULL),
    (v_sec_b2, 'Diâmetro da Mangueira de Abastecimento - Bico 2 (pol. mm)', 'audio', true, 3, 'Informe o diâmetro da mangueira em polegadas ou milímetros.'),
    (v_sec_b2, 'Diâmetro da rosca de entrada do Corpo - Bico 2 (pol. mm)', 'audio', true, 4, 'Informe o diâmetro da rosca de entrada do corpo do bico 2.'),
    (v_sec_b2, 'Diâmetro da Ponteira - Bico 2 (pol. mm)', 'audio', true, 5, 'Informe o diâmetro da ponteira do bico 2.'),
    (v_sec_b2, 'Comprimento da Ponteira - Bico 2 (mm)', 'audio', true, 6, 'Informe o comprimento da ponteira em milímetros.');

  INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem)
  SELECT p.id, t.opcao, t.idx FROM public.perguntas p
  CROSS JOIN (VALUES ('Diesel S10',1),('Diesel S500',2),('Etanol',3),('Gasolina',4),('Querosene',5),('Lubrificante (óleo)',6),('ARLA (aditivo)',7)) AS t(opcao, idx)
  WHERE p.texto = 'Combustível / Insumo - Bico 2' AND p.secao_id = v_sec_b2;

  -- ───── SEÇÃO 5: Fotos da Bomba ─────
  INSERT INTO public.secoes (formulario_id, titulo, ordem) VALUES (v_form_id, 'Registro Fotográfico da Bomba', 5) RETURNING id INTO v_sec_fotos_bomba;
  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, contexto_ia) VALUES
    (v_sec_fotos_bomba, 'Panorâmica frontal de toda a Ilha onde está localizada a bomba', 'foto', true, 1, 'Foto panorâmica frontal mostrando toda a ilha de abastecimento com a bomba centralizada e os objetos ao redor visíveis dentro do enquadramento.'),
    (v_sec_fotos_bomba, 'Panorâmica mostrando a distância da Ilha até o escritório/sala', 'foto', true, 2, 'Foto panorâmica mostrando o percurso entre a ilha de abastecimento e o escritório ou sala mais próxima, permitindo estimar a distância entre eles.'),
    (v_sec_fotos_bomba, 'Aproximada frontal a 1 m — Caixa de Conexões Elétricas (compartimento inferior)', 'foto', true, 3, 'Foto frontal aproximada a 1 metro mostrando a caixa de conexões elétricas localizada no compartimento inferior da bomba eletrônica. A caixa deve estar centralizada e os cabos ou conectores visíveis.'),
    (v_sec_fotos_bomba, 'Aproximada frontal a 1 m — Bloco Medidor (compartimento inferior)', 'foto', true, 4, 'Foto frontal aproximada a 1 metro do interior do compartimento inferior da bomba mostrando o bloco medidor. Aplicável para bomba eletrônica e mecânica. O bloco deve estar nítido e centralizado.'),
    (v_sec_fotos_bomba, 'Aproximada lateral direita (90°) a 1 m do Bloco Medidor', 'foto', true, 5, 'Foto lateral direita em ângulo de 90 graus a aproximadamente 1 metro do bloco medidor ou lateral completa da bomba eletrônica. O objeto deve estar centralizado e nítido.'),
    (v_sec_fotos_bomba, 'Aproximada lateral esquerda (90°) a 1 m do Bloco Medidor', 'foto', true, 6, 'Foto lateral esquerda em ângulo de 90 graus a aproximadamente 1 metro do bloco medidor ou lateral completa da bomba eletrônica. O objeto deve estar centralizado e nítido.'),
    (v_sec_fotos_bomba, 'Aproximada lateral (90°) a 70 cm do Bico 1 — corpo e ponteira', 'foto', true, 7, 'Foto lateral direita ou esquerda em ângulo de 90 graus a 70 centímetros do Bico 1 mostrando claramente o corpo e a ponteira do bico.'),
    (v_sec_fotos_bomba, 'Aproximada a 70 cm — conexão da mangueira de combustível no Bico 1', 'foto', true, 8, 'Foto aproximada a 70 centímetros mostrando claramente o ponto de conexão da mangueira de combustível no Bico 1.'),
    (v_sec_fotos_bomba, 'Aproximada a 70 cm — conexão da mangueira do Bico 1 na Bomba', 'foto', true, 9, 'Foto aproximada a 70 centímetros mostrando claramente o ponto onde a mangueira do Bico 1 se conecta à bomba.'),
    (v_sec_fotos_bomba, 'Panorâmica frontal a 2 m — descanso/suporte do Bico 1', 'foto', true, 10, 'Foto panorâmica frontal a aproximadamente 2 metros mostrando o descanso ou suporte do Bico 1, visível por completo.'),
    (v_sec_fotos_bomba, 'Aproximada frontal ou lateral a 70 cm — detalhe do descanso/suporte do Bico', 'foto', true, 11, 'Foto frontal ou lateral a 70 centímetros mostrando em detalhe o descanso ou suporte do bico de abastecimento, aplicável para bomba mecânica ou eletrônica.');

  -- ───── SEÇÃO 6: Pista ─────
  INSERT INTO public.secoes (formulario_id, titulo, ordem) VALUES (v_form_id, 'Descrição Geral da Pista de Abastecimento', 6) RETURNING id INTO v_sec_pista;
  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, contexto_ia) VALUES
    (v_sec_pista, 'A área onde está instalado o dispositivo é coberta?', 'selecao_unica', true, 1, NULL),
    (v_sec_pista, 'O dispositivo possui algum tipo de controle / automação?', 'selecao_unica', true, 2, NULL),
    (v_sec_pista, 'O dispositivo possui suporte para acomodar o bico?', 'selecao_unica', true, 3, NULL),
    (v_sec_pista, 'Distância da ilha/plataforma até a pista (m)', 'audio', true, 4, 'Informe a distância em metros entre a ilha de abastecimento e a pista.'),
    (v_sec_pista, 'Altura do Registrador Mecânico — nível da ilha como referência (m)', 'audio', true, 5, 'Informe a altura em metros do registrador mecânico usando o nível da ilha como referência.'),
    (v_sec_pista, 'Distância do Bloco Medidor até o objeto mais próximo À FRENTE — descreva o objeto e a distância', 'audio', true, 6, 'Informe qual é o objeto localizado à frente do bloco medidor e a distância em metros até ele.'),
    (v_sec_pista, 'Distância do Bloco Medidor até o objeto mais próximo ATRÁS — descreva o objeto e a distância', 'audio', true, 7, 'Informe qual é o objeto localizado atrás do bloco medidor e a distância em metros até ele.'),
    (v_sec_pista, 'Distância do Bloco Medidor até o objeto mais próximo LADO DIREITO — descreva o objeto e a distância', 'audio', true, 8, 'Informe qual é o objeto localizado ao lado direito do bloco medidor e a distância em metros até ele.'),
    (v_sec_pista, 'Distância do Bloco Medidor até o objeto mais próximo LADO ESQUERDO — descreva o objeto e a distância', 'audio', true, 9, 'Informe qual é o objeto localizado ao lado esquerdo do bloco medidor e a distância em metros até ele.');

  INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem)
  SELECT p.id, t.opcao, t.idx FROM public.perguntas p
  CROSS JOIN (VALUES ('Sim',1),('Não',2)) AS t(opcao, idx)
  WHERE p.secao_id = v_sec_pista AND p.tipo = 'selecao_unica';

  -- ───── SEÇÃO 7: Fotos da Pista ─────
  INSERT INTO public.secoes (formulario_id, titulo, ordem) VALUES (v_form_id, 'Registro Fotográfico da Pista', 7) RETURNING id INTO v_sec_fotos_pista;
  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, contexto_ia) VALUES
    (v_sec_fotos_pista, 'Panorâmica frontal de toda a pista onde opera o dispositivo', 'foto', true, 1, 'Foto panorâmica frontal mostrando toda a pista de abastecimento com o dispositivo centralizado. Aplicável para bomba mecânica ou eletrônica.'),
    (v_sec_fotos_pista, 'Panorâmica frontal a aproximadamente 5 m do dispositivo', 'foto', true, 2, 'Foto panorâmica frontal tirada a aproximadamente 5 metros do dispositivo de abastecimento, mostrando o contexto ao redor.'),
    (v_sec_fotos_pista, 'Panorâmica traseira a aproximadamente 5 m do dispositivo', 'foto', true, 3, 'Foto panorâmica traseira tirada a aproximadamente 5 metros do dispositivo, mostrando a visão pela parte de trás.'),
    (v_sec_fotos_pista, 'Panorâmica diagonal direita (45°) a aproximadamente 7 m do dispositivo', 'foto', true, 4, 'Foto panorâmica em ângulo diagonal de 45 graus pelo lado direito a aproximadamente 7 metros do dispositivo.'),
    (v_sec_fotos_pista, 'Panorâmica diagonal esquerda (45°) a aproximadamente 7 m do dispositivo', 'foto', true, 5, 'Foto panorâmica em ângulo diagonal de 45 graus pelo lado esquerdo a aproximadamente 7 metros do dispositivo.'),
    (v_sec_fotos_pista, 'Vídeo curto com visão geral da estrutura (mínimo 5 segundos)', 'foto', true, 6, 'Vídeo curto mostrando uma visão geral da estrutura da pista de abastecimento. Duração mínima de 5 segundos.');

  -- ───── SEÇÃO 8: Conectividade ─────
  INSERT INTO public.secoes (formulario_id, titulo, ordem) VALUES (v_form_id, 'Processo de Abastecimento e Transferência de Dados', 8) RETURNING id INTO v_sec_conect;
  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, contexto_ia) VALUES
    (v_sec_conect, 'Combustível fornecido pela bomba', 'selecao_unica', true, 1, NULL),
    (v_sec_conect, 'Tipos de veículos que abastece', 'selecao_unica', true, 2, NULL),
    (v_sec_conect, 'Potência do sinal GPRS/2G (GSM) no local da bomba', 'selecao_unica', true, 3, NULL),
    (v_sec_conect, 'Estabilidade do sinal GPRS/2G (GSM) no local da bomba', 'selecao_unica', true, 4, NULL),
    (v_sec_conect, 'Operadora local GPRS/2G (GSM)', 'selecao_unica', true, 5, NULL),
    (v_sec_conect, 'A empresa dispõe de sinal Wi-Fi no local da bomba?', 'selecao_unica', true, 6, NULL),
    (v_sec_conect, 'Frequência do sinal Wi-Fi no local da bomba', 'selecao_unica', false, 7, NULL),
    (v_sec_conect, 'Descreva caso seja outro tipo de frequência Wi-Fi', 'audio', false, 8, 'Descreva o tipo de frequência Wi-Fi caso não seja 2.4GHz ou 5GHz.'),
    (v_sec_conect, 'Potência do sinal Wi-Fi no local da bomba', 'selecao_unica', false, 9, NULL),
    (v_sec_conect, 'Estabilidade do sinal Wi-Fi no local da bomba', 'selecao_unica', false, 10, NULL),
    (v_sec_conect, 'Velocidade de conexão (internet) no local da bomba', 'selecao_unica', true, 11, NULL);

  INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem)
  SELECT p.id, t.opcao, t.idx FROM public.perguntas p
  CROSS JOIN (VALUES ('Gasolina',1),('Etanol',2),('Diesel S10',3),('Diesel S500',4)) AS t(opcao, idx)
  WHERE p.texto = 'Combustível fornecido pela bomba' AND p.secao_id = v_sec_conect;

  INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem)
  SELECT p.id, t.opcao, t.idx FROM public.perguntas p
  CROSS JOIN (VALUES ('Motos',1),('Leves',2),('Pesados',3),('Máquinas',4),('Comboios',5)) AS t(opcao, idx)
  WHERE p.texto = 'Tipos de veículos que abastece' AND p.secao_id = v_sec_conect;

  INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem)
  SELECT p.id, t.opcao, t.idx FROM public.perguntas p
  CROSS JOIN (VALUES ('Boa',1),('Regular',2),('Ruim',3)) AS t(opcao, idx)
  WHERE p.texto IN ('Potência do sinal GPRS/2G (GSM) no local da bomba','Estabilidade do sinal GPRS/2G (GSM) no local da bomba','Potência do sinal Wi-Fi no local da bomba','Estabilidade do sinal Wi-Fi no local da bomba','Velocidade de conexão (internet) no local da bomba')
    AND p.secao_id = v_sec_conect;

  INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem)
  SELECT p.id, t.opcao, t.idx FROM public.perguntas p
  CROSS JOIN (VALUES ('Vivo',1),('Claro',2),('TIM',3),('Oi/Outras',4)) AS t(opcao, idx)
  WHERE p.texto = 'Operadora local GPRS/2G (GSM)' AND p.secao_id = v_sec_conect;

  INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem)
  SELECT p.id, t.opcao, t.idx FROM public.perguntas p
  CROSS JOIN (VALUES ('Sim',1),('Não',2)) AS t(opcao, idx)
  WHERE p.texto = 'A empresa dispõe de sinal Wi-Fi no local da bomba?' AND p.secao_id = v_sec_conect;

  INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem)
  SELECT p.id, t.opcao, t.idx FROM public.perguntas p
  CROSS JOIN (VALUES ('2.4 GHz',1),('5 GHz',2),('Outros',3)) AS t(opcao, idx)
  WHERE p.texto = 'Frequência do sinal Wi-Fi no local da bomba' AND p.secao_id = v_sec_conect;

  -- ───── SEÇÃO 9: Fotos Conectividade ─────
  INSERT INTO public.secoes (formulario_id, titulo, ordem) VALUES (v_form_id, 'Registro Fotográfico — Conectividade', 9) RETURNING id INTO v_sec_fotos_conect;
  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, contexto_ia) VALUES
    (v_sec_fotos_conect, 'Print — App Aquário Analyzer: intensidade do sinal da operadora (2G/GSM)', 'foto', true, 1, 'Print de tela do aplicativo Aquário Analyzer mostrando a intensidade do sinal da operadora de telefonia. O celular deve estar configurado em 2G (GSM) com o cartão SIM da empresa. A interface do app deve ser reconhecível e o indicador de sinal visível.'),
    (v_sec_fotos_conect, 'Print — App WiFi Network Analyzer: SSID, intensidade e detalhes da rede', 'foto', true, 2, 'Print de tela do aplicativo WiFi Network Analyzer mostrando o SSID da rede, a intensidade do sinal e os detalhes da rede que será acessada pela automação. Esses dados devem estar claramente visíveis na tela.'),
    (v_sec_fotos_conect, 'Print — App WiFi Network Analyzer: gráfico Redes com legenda', 'foto', true, 3, 'Print de tela do aplicativo WiFi Network Analyzer mostrando o gráfico de Redes com legenda identificando as redes disponíveis no local. O gráfico e a legenda devem estar visíveis e legíveis.');
END $$;