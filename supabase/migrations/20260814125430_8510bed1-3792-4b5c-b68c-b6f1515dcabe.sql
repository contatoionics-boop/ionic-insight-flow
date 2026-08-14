DO $$
DECLARE
  f uuid; s uuid; p uuid; p_comboio uuid;
BEGIN
  INSERT INTO public.formularios (nome, descricao, ativo, validar_imagens_ia, codigo, revisao)
  VALUES ('Mapeamento Técnico — Requisitos de Infraestrutura (Automação SAAF)',
          'Formulário baseado no documento "Resultado de Mapeamento Técnico" da IONICS. Coleta os dados necessários para gerar o laudo de requisitos de infraestrutura.',
          true, false, 'MT-SAAF', '1')
  RETURNING id INTO f;

  INSERT INTO public.secoes (formulario_id, titulo, ordem, descricao)
  VALUES (f, 'Identificação geral', 0, 'Dados do cliente, do atendimento e do agente responsável.') RETURNING id INTO s;

  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, chave_laudo) VALUES
    (s,'Nome do cliente / unidade','texto',true,0,'nome_cliente'),
    (s,'Solução IONICS contratada','texto',true,1,'nome_solucao'),
    (s,'Responsável do cliente (nome e telefone)','texto',true,2,'responsavel_cliente'),
    (s,'Data do mapeamento','data',true,5,null);

  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, chave_laudo) VALUES
    (s,'Tipo de ação','selecao_unica',true,3,'tipo_acao') RETURNING id INTO p;
  INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem) VALUES (p,'Instalação',0),(p,'Upgrade',1);

  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, chave_laudo) VALUES
    (s,'Modalidade do mapeamento','selecao_unica',true,4,'modalidade') RETURNING id INTO p;
  INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem) VALUES (p,'Presencial',0),(p,'Remoto',1);

  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, chave_laudo) VALUES
    (s,'Nível da automação','selecao_unica',true,6,'nivel_servico') RETURNING id INTO p;
  INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem) VALUES (p,'Nível 1',0),(p,'Nível 2',1),(p,'Nível 3',2);

  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, chave_laudo) VALUES
    (s,'Objeto do escopo (o que será automatizado)','texto',true,7,'objeto_escopo');
  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, chave_laudo) VALUES
    (s,'Identificação dos objetos (placas/prefixos/IDs, separados por vírgula)','texto',false,8,'ids_objetos');
  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, chave_laudo) VALUES
    (s,'Cliente já possui automação SAAF instalada?','toggle',true,9,'cliente_ja_tem_saaf');

  INSERT INTO public.secoes (formulario_id, titulo, ordem, descricao)
  VALUES (f, 'Equipamentos de TI e banco de dados', 1, 'Servidor, estação de consulta, banco de dados e integração com ERP (item 2.1 do laudo).') RETURNING id INTO s;

  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, chave_laudo) VALUES
    (s,'Existe servidor local disponível para a aplicação SAAF?','toggle',true,0,null),
    (s,'Especificações do servidor (processador, RAM, HD, SO)','texto',false,1,null),
    (s,'Há computador para consultas da automação?','toggle',true,2,null),
    (s,'Internet estável e sem restrições no servidor (acesso remoto TeamViewer/AnyDesk)?','toggle',true,4,null),
    (s,'Existe no-break (0,6 KVA ou superior)?','toggle',false,5,null),
    (s,'ERP utilizado pelo cliente (para integração/Views)','texto',false,6,null),
    (s,'Foto do servidor / rack / infraestrutura de TI','foto',false,7,null);

  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, chave_laudo) VALUES
    (s,'Banco de dados disponível','selecao_unica',true,3,null) RETURNING id INTO p;
  INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem) VALUES
    (p,'PostgreSQL',0),(p,'Oracle (Single-Byte)',1),(p,'MS SQL Server',2),(p,'Nenhum / a definir',3);

  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, chave_laudo) VALUES
    (s,'Variante de infraestrutura de TI aplicável','selecao_unica',false,8,'infra_ti_variante') RETURNING id INTO p;
  INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem) VALUES (p,'A',0),(p,'B_reduzida',1),(p,'B_completa',2),(p,'D',3);

  INSERT INTO public.secoes (formulario_id, titulo, ordem, descricao)
  VALUES (f, 'Transferência de dados e comunicação', 2, 'WIFI, GPRS 2G/4G e rádio 2.4GHz (item 2.2 do laudo).') RETURNING id INTO s;

  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, chave_laudo) VALUES
    (s,'Tipos de comunicação disponíveis no local (WIFI, 4G/GSM, rádio 2.4GHz)','texto',true,0,'comunicacao_tipos'),
    (s,'Intensidade do sinal WIFI medida no ponto de instalação (dBm)','texto',false,2,null),
    (s,'Cliente libera o MAC do Terminal e fornece SSID/senha?','toggle',false,3,null),
    (s,'Operadora com melhor cobertura no local','texto',false,4,null),
    (s,'Cliente providenciará chip/SIM com plano de dados?','toggle',false,5,null),
    (s,'Foto do teste/análise de sinal (app de medição, roteador, antena)','foto',false,6,null),
    (s,'Observações sobre a rede (canais 2.4GHz, largura de banda, restrições de firewall)','texto',false,7,null);

  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, chave_laudo) VALUES
    (s,'Qualidade do sinal no local','selecao_unica',true,1,'qualidade_sinal') RETURNING id INTO p;
  INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem) VALUES (p,'Bom',0),(p,'Médio',1),(p,'Fraco',2),(p,'Sem sinal',3);

  INSERT INTO public.secoes (formulario_id, titulo, ordem, descricao)
  VALUES (f, 'Pista de abastecimento', 3, 'Bombas, bicos e mangueiras (item 2.3 do laudo).') RETURNING id INTO s;

  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, chave_laudo) VALUES
    (s,'Marca e modelo da bomba','texto',true,1,null),
    (s,'Vazão da bomba (L/min)','numero',true,2,'vazao'),
    (s,'Quantidade de bicos a automatizar','numero',true,3,'qtd_bicos'),
    (s,'Combustível abastecido','texto',false,6,null),
    (s,'Foto da bomba / conjunto de abastecimento','foto',true,7,null),
    (s,'Foto do bico e da mangueira','foto',true,8,null),
    (s,'Vídeo do funcionamento do abastecimento','video',false,9,null);

  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, chave_laudo) VALUES
    (s,'Tipo da bomba','selecao_unica',true,0,'tipo_bomba') RETURNING id INTO p;
  INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem) VALUES (p,'Mecânica',0),(p,'Eletrônica',1),(p,'Elétrica',2);

  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, chave_laudo) VALUES
    (s,'Bitola do bico atual','selecao_unica',true,4,'bitola_bico') RETURNING id INTO p;
  INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem) VALUES (p,'1/2"',0),(p,'3/4"',1),(p,'1"',2);

  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, chave_laudo) VALUES
    (s,'Marca/modelo do bico (homologação IONICS)','selecao_unica',true,5,null) RETURNING id INTO p;
  INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem) VALUES
    (p,'OPW',0),(p,'Bremen',1),(p,'Martinelli MP-2',2),(p,'Outro (não homologado)',3);

  INSERT INTO public.secoes (formulario_id, titulo, ordem, descricao)
  VALUES (f, 'Gabinete, fixação e infraestrutura elétrica', 4, 'Local de instalação do Terminal T1000, painel e alimentação.') RETURNING id INTO s;

  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, chave_laudo) VALUES
    (s,'Dimensão do compartimento disponível para o T1000 (mm)','texto',true,0,'compartimento_dimensao'),
    (s,'O compartimento comporta o T1000 sem realocar carretel/bloco medidor?','toggle',true,1,null),
    (s,'Existe totem/estrutura para fixar o gabinete (suportar ~12 kg)?','toggle',true,2,null),
    (s,'O gabinete possui porta com fechadura/trava e é protegido de intempéries?','toggle',false,3,null),
    (s,'Existe tomada/alimentação elétrica próxima ao ponto de instalação?','toggle',true,4,null),
    (s,'Distância aproximada entre o ponto de energia e o gabinete (m)','numero',false,5,null),
    (s,'Existe aterramento disponível?','toggle',false,6,null),
    (s,'Instalação em área classificada (atmosfera explosiva)?','toggle',true,7,'area_classificada'),
    (s,'Terminal já instalado no local, se houver','texto',false,8,'terminal_atual'),
    (s,'Foto do local de instalação do terminal / compartimento','foto',true,9,null),
    (s,'Foto do quadro elétrico / ponto de alimentação','foto',false,10,null),
    (s,'Foto ou desenho do suporte do bico (obrigatório no Nível 2)','foto',false,11,null);

  INSERT INTO public.secoes (formulario_id, titulo, ordem, descricao)
  VALUES (f, 'Caminhão comboio', 5, 'Preencher quando a operação incluir caminhão comboio.') RETURNING id INTO s;

  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, chave_laudo) VALUES
    (s,'A operação inclui caminhão comboio?','toggle',true,0,'comboio') RETURNING id INTO p_comboio;

  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, chave_laudo,
      condicional_pergunta_id, condicional_operador, condicional_valor) VALUES
    (s,'Marca e modelo do caminhão comboio','texto',true,1,'marca_veiculo',p_comboio,'igual','sim'),
    (s,'Placa / prefixo do comboio','texto',true,2,null,p_comboio,'igual','sim'),
    (s,'Quantidade de bicos no comboio','numero',true,4,null,p_comboio,'igual','sim'),
    (s,'Usa conversor 24/12 VCC?','toggle',true,5,'usa_conversor_24_12',p_comboio,'igual','sim'),
    (s,'A operação utiliza identificação por RFID?','toggle',false,6,'rfid',p_comboio,'igual','sim'),
    (s,'Foto do compartimento do comboio (bomba/carretel)','foto',true,7,null,p_comboio,'igual','sim'),
    (s,'Foto do painel elétrico / bateria do veículo','foto',false,8,null,p_comboio,'igual','sim');

  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, chave_laudo,
      condicional_pergunta_id, condicional_operador, condicional_valor) VALUES
    (s,'Tensão elétrica do veículo','selecao_unica',true,3,'tensao_veiculo',p_comboio,'igual','sim') RETURNING id INTO p;
  INSERT INTO public.opcoes_pergunta (pergunta_id, texto, ordem) VALUES (p,'12V',0),(p,'24V',1);

  INSERT INTO public.secoes (formulario_id, titulo, ordem, descricao)
  VALUES (f, 'Observações e evidências finais', 6, 'Registros complementares e considerações do agente técnico.') RETURNING id INTO s;

  INSERT INTO public.perguntas (secao_id, texto, tipo, obrigatoria, ordem, chave_laudo) VALUES
    (s,'Adequações de infraestrutura necessárias identificadas','texto',false,0,null),
    (s,'Observações gerais do agente técnico (áudio)','audio',false,1,null),
    (s,'Fotos gerais adicionais do local','foto',false,2,null),
    (s,'Confirmo que as informações e evidências registradas estão corretas','checkbox',true,3,null);
END $$;