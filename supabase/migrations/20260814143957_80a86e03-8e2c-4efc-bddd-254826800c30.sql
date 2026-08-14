DO $mig$
DECLARE
  f_id uuid := gen_random_uuid();
  s0 uuid := gen_random_uuid();
  s1 uuid := gen_random_uuid();
  s11 uuid := gen_random_uuid();
  s2 uuid := gen_random_uuid();
  s21 uuid := gen_random_uuid();
  s3 uuid := gen_random_uuid();
  s31 uuid := gen_random_uuid();
  s4 uuid := gen_random_uuid();
  b0 uuid := gen_random_uuid();
  b1 uuid := gen_random_uuid();
  b11 uuid := gen_random_uuid();
  b2 uuid := gen_random_uuid();
  b2d uuid := gen_random_uuid();
  b21 uuid := gen_random_uuid();
  b3 uuid := gen_random_uuid();
  b31 uuid := gen_random_uuid();
  q_bomba uuid := gen_random_uuid();
  q_wifi uuid := gen_random_uuid();
  q_id uuid;
BEGIN

INSERT INTO public.formularios (id, nome, descricao, ativo, codigo, revisao, data_revisao, elaborado_por, aprovado_por, validar_imagens_ia)
VALUES (f_id,
  'FR-29-10 - Mapeamento Tecnico SSG Frota - Terminal Comboio / Pista',
  'Formulario padrao IONICS conforme documento FR-29-10 (revisao 00). Contempla descricao do dispositivo de abastecimento, pista, processo de abastecimento/transferencia de dados e 19 registros fotograficos obrigatorios.',
  true, 'FR-29-10', '00', DATE '2020-04-17', 'Pablo Haun', 'Pablo Haun', false);

INSERT INTO public.secoes (id, formulario_id, titulo, descricao, ordem) VALUES
 (s0,  f_id, 'Identificacao', 'Dados do cliente/unidade e responsavel pelo acompanhamento.', 0),
 (s1,  f_id, '1 - Descricao geral do dispositivo de abastecimento', NULL, 1),
 (s11, f_id, '1.1 - Registro fotografico - Dispositivo de abastecimento',
   'As fotos panoramicas, frontais ou laterais devem ser capturadas de tal modo que o objeto em questao fique centralizado, cuidando para que os outros que o circundam aparecam dentro do enquadramento. O conteudo descritivo e a confiabilidade do registro fotografico sao importantissimos para emitirmos um parecer assertivo. Forneca as imagens conforme solicitado e siga as orientacoes de cada uma delas.', 2),
 (s2,  f_id, '2 - Descricao geral da pista de abastecimento',
   'ATENCAO: tratando-se de Bomba Eletronica, considere-a no lugar do Bloco Medidor.', 3),
 (s21, f_id, '2.1 - Registro fotografico - Pista de abastecimento',
   'As fotos panoramicas, frontais ou laterais devem ser capturadas de tal modo que o objeto em questao fique centralizado, cuidando para que os outros que o circundam aparecam dentro do enquadramento.', 4),
 (s3,  f_id, '3 - Processo de abastecimento e transferencia de dados', NULL, 5),
 (s31, f_id, '3.1 - Registro fotografico - Transferencia de dados',
   'Para realizacao dos testes e captura de imagens sera necessario instalar no celular os aplicativos WiFi Network Analyzer (Zoltan Pallagi) e Aquario Analyzer (Aquario Wireless Technology), disponiveis gratuitamente na Play Store.', 6),
 (s4,  f_id, '4 - Observacoes e recomendacoes', NULL, 7);

INSERT INTO public.pergunta_blocos (id, secao_id, titulo, descricao, layout, ordem) VALUES
 (b0,  s0,  'Identificacao', NULL, 'cartao', 0),
 (b1,  s1,  'Dispositivo de abastecimento', NULL, 'cartao', 0),
 (b11, s11, 'Registros fotograficos do dispositivo', 'Envie as 11 fotos conforme as instrucoes.', 'fotos', 0),
 (b2,  s2,  'Caracteristicas da pista', NULL, 'cartao', 0),
 (b2d, s2,  'Distancias do Bloco Medidor', 'Informe o objeto mais proximo e a distancia em cada direcao.', 'matriz', 1),
 (b21, s21, 'Registros fotograficos da pista', 'Envie as 5 fotos conforme as instrucoes.', 'fotos', 0),
 (b3,  s3,  'Abastecimento e comunicacao', NULL, 'cartao', 0),
 (b31, s31, 'Prints dos aplicativos', NULL, 'fotos', 0);

-- ============ Secao 0 ============
INSERT INTO public.perguntas (secao_id, bloco_id, texto, tipo, obrigatoria, ordem, chave_laudo) VALUES
 (s0, b0, 'Cliente / Unidade', 'texto', true, 0, 'nome_cliente'),
 (s0, b0, 'Pista', 'texto', false, 1, NULL),
 (s0, b0, 'Data do mapeamento', 'data', true, 2, NULL),
 (s0, b0, 'Responsavel pelo acompanhamento', 'texto', true, 3, 'responsavel_cliente'),
 (s0, b0, 'Contato do responsavel', 'texto', true, 4, NULL);

-- ============ Secao 1 ============
INSERT INTO public.perguntas (id, secao_id, bloco_id, texto, tipo, obrigatoria, ordem, chave_laudo)
VALUES (q_bomba, s1, b1, 'Tipo de bomba', 'selecao_unica', true, 0, 'tipo_bomba');
INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem) VALUES
 (q_bomba, 'Eletronica', 0), (q_bomba, 'Mecanica', 1);

INSERT INTO public.perguntas (secao_id, bloco_id, texto, tipo, obrigatoria, ordem, chave_laudo) VALUES
 (s1, b1, 'Marca / Modelo da bomba', 'texto', true, 1, NULL),
 (s1, b1, 'Vazao fornecida pela bomba (L/min)', 'numero', true, 2, 'vazao');

INSERT INTO public.perguntas (id, secao_id, bloco_id, texto, tipo, obrigatoria, ordem)
VALUES (gen_random_uuid(), s1, b1, 'Tensao de alimentacao da bomba', 'selecao_unica', true, 3)
RETURNING id INTO q_id;
INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem) VALUES
 (q_id, '220VCA', 0), (q_id, '380VCA', 1);

INSERT INTO public.perguntas (secao_id, bloco_id, texto, tipo, obrigatoria, ordem, instrucao_agente, chave_laudo) VALUES
 (s1, b1, 'Marca / Modelo do Registrador Mecanico', 'texto', true, 4, 'Em bomba eletronica, informe o Display / CPU equivalente.', NULL),
 (s1, b1, 'Marca / Modelo do Bloco Medidor', 'texto', true, 5, NULL, NULL),
 (s1, b1, 'Diametro da saida do Bloco Medidor', 'texto', true, 6, 'Ex.: (1") 25,4 mm', NULL),
 (s1, b1, 'Diametro da mangueira de abastecimento', 'texto', true, 7, 'Ex.: (1") 25,4 mm', 'bitola_bico'),
 (s1, b1, 'Marca / Modelo do bico', 'texto', true, 8, NULL, NULL),
 (s1, b1, 'Diametro da ponteira do bico', 'texto', true, 9, 'Ex.: (1") 25,4 mm', NULL),
 (s1, b1, 'Comprimento da ponteira do bico', 'texto', true, 10, 'Ex.: 160 mm', NULL),
 (s1, b1, 'Diametro da entrada do corpo do bico', 'texto', true, 11, 'Ex.: (1") 25,4 mm', NULL);

-- ============ Secao 1.1 - 11 fotos ============
INSERT INTO public.perguntas (secao_id, bloco_id, texto, tipo, obrigatoria, ordem, instrucao_agente) VALUES
 (s11, b11, 'Foto 1 - Frontal do Registrador Mecanico', 'foto', true, 0, 'Aproximada frontal a distancia de 1 m do Registrador Mecanico (Display / CPU tratando-se de bomba eletronica).'),
 (s11, b11, 'Foto 2 - Lateral direita do Registrador Mecanico', 'foto', true, 1, 'Aproximada lateral direita (90 graus) a distancia de 1 m do Registrador Mecanico.'),
 (s11, b11, 'Foto 3 - Lateral esquerda do Registrador Mecanico', 'foto', true, 2, 'Aproximada lateral esquerda (90 graus) a distancia de 1 m do Registrador Mecanico.'),
 (s11, b11, 'Foto 4 - Frontal do dispositivo de abastecimento', 'foto', true, 3, 'Aproximada frontal do dispositivo de abastecimento.'),
 (s11, b11, 'Foto 5 - Lateral direita do dispositivo de abastecimento', 'foto', true, 4, 'Aproximada lateral direita do dispositivo de abastecimento.'),
 (s11, b11, 'Foto 6 - Lateral esquerda do dispositivo de abastecimento', 'foto', true, 5, 'Aproximada lateral esquerda do dispositivo de abastecimento.'),
 (s11, b11, 'Foto 7 - Frontal do Bloco Medidor', 'foto', true, 6, 'Aproximada frontal a distancia de 1 m do Bloco Medidor (ou interna "sem tampas" da parte inferior da bomba eletronica).'),
 (s11, b11, 'Foto 8 - Lateral direita do Bloco Medidor', 'foto', true, 7, 'Aproximada lateral direita (90 graus) a distancia de 1 m do Bloco Medidor (ou lateral completa tratando-se de bomba eletronica).'),
 (s11, b11, 'Foto 9 - Lateral esquerda do Bloco Medidor', 'foto', true, 8, 'Aproximada lateral esquerda (90 graus) a distancia de 1 m do Bloco Medidor (ou lateral completa tratando-se de bomba eletronica).'),
 (s11, b11, 'Foto 10 - Bico de abastecimento e conexoes da mangueira', 'foto', true, 9, 'Aproximada lateral direita ou esquerda (90 graus) a distancia de 70 cm do Bico de Abastecimento (corpo e ponteira), mostrando tambem a conexao da mangueira de combustivel no bico e no Bloco Medidor.'),
 (s11, b11, 'Foto 11 - Descanso / suporte do Bico de Abastecimento', 'foto', true, 10, 'Panoramica frontal a distancia aproximada de 2 m do descanso / suporte do Bico de Abastecimento e aproximada frontal ou lateral a 70 cm mostrando detalhadamente o descanso / suporte (bomba mecanica ou eletronica).');

-- ============ Secao 2 ============
INSERT INTO public.perguntas (secao_id, bloco_id, texto, tipo, obrigatoria, ordem, instrucao_agente) VALUES
 (s2, b2, 'A area onde esta instalado o dispositivo de abastecimento e coberta', 'toggle', true, 0, NULL),
 (s2, b2, 'O dispositivo de abastecimento possui algum tipo de controle / automacao', 'toggle', true, 1, NULL),
 (s2, b2, 'O dispositivo de abastecimento possui suporte para acomodar o bico', 'toggle', true, 2, NULL),
 (s2, b2, 'Distancia da ilha / plataforma onde se encontra o dispositivo ate a pista', 'texto', true, 3, 'Informe com unidade. Ex.: 0,70 m'),
 (s2, b2, 'Altura em que se encontra o Registrador Mecanico', 'texto', true, 4, 'Usar o nivel da ilha / plataforma como referencia. Ex.: 1,05 m');

INSERT INTO public.perguntas (secao_id, bloco_id, bloco_linha, bloco_coluna, texto, tipo, obrigatoria, ordem, instrucao_agente) VALUES
 (s2, b2d, 'A frente', 'Objeto',    'Objeto mais proximo localizado a frente do Bloco Medidor', 'texto', true, 0, 'Em bomba eletronica, considere a bomba no lugar do Bloco Medidor.'),
 (s2, b2d, 'A frente', 'Distancia', 'Distancia ate o objeto a frente', 'texto', true, 1, NULL),
 (s2, b2d, 'Atras', 'Objeto',    'Objeto mais proximo localizado atras do Bloco Medidor', 'texto', true, 2, NULL),
 (s2, b2d, 'Atras', 'Distancia', 'Distancia ate o objeto atras', 'texto', true, 3, NULL),
 (s2, b2d, 'Lado direito', 'Objeto',    'Objeto mais proximo do lado direito do Bloco Medidor', 'texto', true, 4, NULL),
 (s2, b2d, 'Lado direito', 'Distancia', 'Distancia ate o objeto do lado direito', 'texto', true, 5, NULL),
 (s2, b2d, 'Lado esquerdo', 'Objeto',    'Objeto mais proximo do lado esquerdo do Bloco Medidor', 'texto', true, 6, NULL),
 (s2, b2d, 'Lado esquerdo', 'Distancia', 'Distancia ate o objeto do lado esquerdo', 'texto', true, 7, NULL);

-- ============ Secao 2.1 - 5 fotos ============
INSERT INTO public.perguntas (secao_id, bloco_id, texto, tipo, obrigatoria, ordem, instrucao_agente) VALUES
 (s21, b21, 'Foto 1 - Panoramica frontal da pista', 'foto', true, 0, 'Panoramica frontal na qual apareca toda a pista onde opera o dispositivo de abastecimento (bomba mecanica ou eletronica).'),
 (s21, b21, 'Foto 2 - Panoramica frontal a 5 m', 'foto', true, 1, 'Panoramica frontal a distancia aproximada de 5 m do dispositivo de abastecimento.'),
 (s21, b21, 'Foto 3 - Panoramica traseira a 5 m', 'foto', true, 2, 'Panoramica traseira a distancia aproximada de 5 m do dispositivo de abastecimento.'),
 (s21, b21, 'Foto 4 - Panoramica diagonal direita a 7 m', 'foto', true, 3, 'Panoramica diagonal direita (45 graus) a distancia aproximada de 7 m do dispositivo de abastecimento.'),
 (s21, b21, 'Foto 5 - Panoramica diagonal esquerda a 7 m', 'foto', true, 4, 'Panoramica diagonal esquerda (45 graus) a distancia aproximada de 7 m do dispositivo de abastecimento.');

-- ============ Secao 3 ============
INSERT INTO public.perguntas (id, secao_id, bloco_id, texto, tipo, obrigatoria, ordem)
VALUES (gen_random_uuid(), s3, b3, 'Combustivel fornecido pela bomba', 'selecao_unica', true, 0) RETURNING id INTO q_id;
INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem) VALUES
 (q_id,'Gasolina',0),(q_id,'Etanol',1),(q_id,'Diesel S10',2),(q_id,'Diesel S500',3);

INSERT INTO public.perguntas (id, secao_id, bloco_id, texto, tipo, obrigatoria, ordem, chave_laudo)
VALUES (gen_random_uuid(), s3, b3, 'Tipos de veiculos que abastece', 'checkbox', true, 1, 'tipo_objeto') RETURNING id INTO q_id;
INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem) VALUES
 (q_id,'Motos',0),(q_id,'Leves',1),(q_id,'Pesados',2),(q_id,'Maquinas',3),(q_id,'Comboios',4);

INSERT INTO public.perguntas (id, secao_id, bloco_id, texto, tipo, obrigatoria, ordem, chave_laudo)
VALUES (gen_random_uuid(), s3, b3, 'Potencia do sinal GPRS / 2G (GSM) no local da bomba', 'selecao_unica', true, 2, 'qualidade_sinal') RETURNING id INTO q_id;
INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem) VALUES (q_id,'Boa',0),(q_id,'Regular',1),(q_id,'Ruim',2);

INSERT INTO public.perguntas (id, secao_id, bloco_id, texto, tipo, obrigatoria, ordem)
VALUES (gen_random_uuid(), s3, b3, 'Estabilidade do sinal GPRS / 2G (GSM) no local da bomba', 'selecao_unica', true, 3) RETURNING id INTO q_id;
INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem) VALUES (q_id,'Boa',0),(q_id,'Regular',1),(q_id,'Ruim',2);

INSERT INTO public.perguntas (id, secao_id, bloco_id, texto, tipo, obrigatoria, ordem)
VALUES (gen_random_uuid(), s3, b3, 'Operadora local GPRS / 2G (GSM)', 'selecao_unica', true, 4) RETURNING id INTO q_id;
INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem) VALUES
 (q_id,'Vivo',0),(q_id,'Claro',1),(q_id,'TIM',2),(q_id,'Oi',3),(q_id,'Outras',4);

INSERT INTO public.perguntas (secao_id, bloco_id, texto, tipo, obrigatoria, ordem, instrucao_agente)
VALUES (s3, b3, 'Outra operadora (se aplicavel)', 'texto', false, 5, 'Preencher apenas se a operadora local nao estiver na lista.');

INSERT INTO public.perguntas (id, secao_id, bloco_id, texto, tipo, obrigatoria, ordem, chave_laudo)
VALUES (q_wifi, s3, b3, 'A empresa dispoe de sinal Wi-Fi (internet) no local da bomba', 'toggle', true, 6, 'comunicacao_tipos');

INSERT INTO public.perguntas (id, secao_id, bloco_id, texto, tipo, obrigatoria, ordem, condicional_pergunta_id, condicional_operador, condicional_valor)
VALUES (gen_random_uuid(), s3, b3, 'Frequencia do sinal de Wi-Fi no local da bomba', 'selecao_unica', true, 7, q_wifi, 'igual', 'sim') RETURNING id INTO q_id;
INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem) VALUES (q_id,'2.4 GHz',0),(q_id,'5 GHz',1),(q_id,'Outra',2);

INSERT INTO public.perguntas (id, secao_id, bloco_id, texto, tipo, obrigatoria, ordem, condicional_pergunta_id, condicional_operador, condicional_valor)
VALUES (gen_random_uuid(), s3, b3, 'Potencia do sinal de Wi-Fi no local da bomba', 'selecao_unica', true, 8, q_wifi, 'igual', 'sim') RETURNING id INTO q_id;
INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem) VALUES (q_id,'Boa',0),(q_id,'Regular',1),(q_id,'Ruim',2);

INSERT INTO public.perguntas (id, secao_id, bloco_id, texto, tipo, obrigatoria, ordem, condicional_pergunta_id, condicional_operador, condicional_valor)
VALUES (gen_random_uuid(), s3, b3, 'Estabilidade do sinal de Wi-Fi no local da bomba', 'selecao_unica', true, 9, q_wifi, 'igual', 'sim') RETURNING id INTO q_id;
INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem) VALUES (q_id,'Boa',0),(q_id,'Regular',1),(q_id,'Ruim',2);

INSERT INTO public.perguntas (id, secao_id, bloco_id, texto, tipo, obrigatoria, ordem, condicional_pergunta_id, condicional_operador, condicional_valor)
VALUES (gen_random_uuid(), s3, b3, 'Velocidade de conexao (internet) no local da bomba', 'selecao_unica', true, 10, q_wifi, 'igual', 'sim') RETURNING id INTO q_id;
INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem) VALUES (q_id,'Boa',0),(q_id,'Regular',1),(q_id,'Ruim',2);

-- ============ Secao 3.1 - 3 prints ============
INSERT INTO public.perguntas (secao_id, bloco_id, texto, tipo, obrigatoria, ordem, instrucao_agente, condicional_pergunta_id, condicional_operador, condicional_valor) VALUES
 (s31, b31, 'Print 1 - Aquario Analyzer (sinal da operadora)', 'foto', true, 0, 'Mostrando a intensidade do sinal disponibilizado pela operadora de telefonia. O teste devera ser feito no local onde ocorrera a transferencia de dados, com o celular configurado em 2G (GSM) e com cartao SIM da empresa que forneca essa cobertura.', NULL, NULL, NULL),
 (s31, b31, 'Print 2 - WiFi Network Analyzer (SSID e detalhes da rede)', 'foto', true, 1, 'Mostrando o "SSID", "Intensidade do Sinal" e "Detalhes da Rede" que sera acessada pela automacao. O teste devera ser feito no local onde ocorrera a transferencia de dados.', q_wifi, 'igual', 'sim'),
 (s31, b31, 'Print 3 - WiFi Network Analyzer (grafico Redes)', 'foto', true, 2, 'Mostrando o grafico "Redes" (com legenda). O teste do sinal devera ser feito no local onde ocorrera a transferencia de dados.', q_wifi, 'igual', 'sim');

-- ============ Secao 4 ============
INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem) VALUES
 (s4, 'Anomalias observadas durante o mapeamento (se houver, descreva)', 'texto', false, 0),
 (s4, 'Recomendacoes / sugestoes adicionais', 'texto', false, 1);

END
$mig$;