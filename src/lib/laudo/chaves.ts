// Chaves de laudo disponíveis para vincular a perguntas do formulário (client-safe).

export type ChaveLaudo = {
  chave: string;
  rotulo: string;
  descricao: string;
  /** valores sugeridos; usados como dica para a IA e para validação */
  exemplos?: string[];
  /** a quem a chave pertence: "geral" (uma por mapeamento) ou o tipo de entidade que a responde (uma por unidade) */
  escopo?: "geral" | "bomba" | "bico" | "comboio";
};

export const CHAVES_LAUDO: ChaveLaudo[] = [
  { chave: "nome_cliente", rotulo: "Nome do cliente", descricao: "Razão social ou nome fantasia usado na introdução." },
  { chave: "nome_solucao", rotulo: "Nome da solução", descricao: "Solução IONICS contratada (ex.: SAAF)." },
  { chave: "tipo_acao", rotulo: "Tipo de ação", descricao: "Instalação ou upgrade.", exemplos: ["instalacao", "upgrade"] },
  { chave: "modalidade", rotulo: "Modalidade", descricao: "Presencial ou remoto.", exemplos: ["presencial", "remoto"] },
  { chave: "nivel_servico", rotulo: "Nível do serviço", descricao: "Define a inclusão do NLDIV na tabela de produtos.", exemplos: ["nivel_1", "nivel_2", "nivel_3"] },
  { chave: "objeto_escopo", rotulo: "Objeto do escopo", descricao: "Descrição do que será mapeado (frota, posto, comboio)." },
  { chave: "tipo_objeto", rotulo: "Tipo do objeto", descricao: "Posto, pista, comboio ou veículo.", exemplos: ["posto", "pista", "comboio", "veiculo"] },
  { chave: "ids_objetos", rotulo: "Identificação dos objetos", descricao: "Lista de placas/prefixos separados por vírgula." },
  { chave: "qtd_bicos", rotulo: "Quantidade de bicos", descricao: "Número de bicos de abastecimento." },
  { chave: "bitola_bico", rotulo: "Bitola do bico", descricao: "Bitola nominal do bico/ponteira (não é a mangueira).", exemplos: ['1/2"', '3/4"', '1"'], escopo: "bico" },
  { chave: "vazao", rotulo: "Vazão", descricao: "Vazão da bomba em litros por minuto." },
  { chave: "terminal_atual", rotulo: "Terminal atual", descricao: "Terminal já instalado, quando houver.", exemplos: ["T850", "T1000", "nenhum"] },
  { chave: "comunicacao_tipos", rotulo: "Tipos de comunicação", descricao: "Derivada: WiFi, 4G/GSM (não use perguntas Sim/Não aqui)." },
  { chave: "wifi_disponivel", rotulo: "Wi-Fi disponível", descricao: "Se há sinal Wi-Fi no ponto de abastecimento.", exemplos: ["sim", "nao"] },
  { chave: "gsm_4g_disponivel", rotulo: "GSM/4G disponível", descricao: "Se há sinal de rede móvel no ponto de abastecimento.", exemplos: ["sim", "nao"] },
  { chave: "tipos_veiculos_abastecidos", rotulo: "Tipos de veículos abastecidos", descricao: "Classes de veículos atendidas.", exemplos: ["Leves", "Utilitários", "Pesados", "Máquinas"] },
  { chave: "rfid", rotulo: "Usa RFID", descricao: "Se a operação usa identificação por RFID.", exemplos: ["sim", "nao"] },
  { chave: "cliente_ja_tem_saaf", rotulo: "Cliente já possui SAAF", descricao: "Se já existe automação SAAF instalada.", exemplos: ["sim", "nao"] },
  { chave: "marca_veiculo", rotulo: "Marca do veículo", descricao: "Marca do veículo ou comboio.", escopo: "comboio" },
  { chave: "tensao_veiculo", rotulo: "Tensão do veículo", descricao: "Tensão elétrica disponível.", exemplos: ["12V", "24V"] },
  { chave: "usa_conversor_24_12", rotulo: "Usa conversor 24/12VCC", descricao: "Alerta bloqueante: conversor não homologado.", exemplos: ["sim", "nao"] },
  { chave: "area_classificada", rotulo: "Área classificada", descricao: "Se a instalação ocorre em área classificada.", exemplos: ["sim", "nao"] },
  { chave: "compartimento_dimensao", rotulo: "Dimensão do compartimento", descricao: "Medida do compartimento do T1000 (medida em campo).", exemplos: ["550x550x250 mm", "550x550x300 mm"] },
  { chave: "infra_ti_variante", rotulo: "Variante de infraestrutura de TI", descricao: "Qual variante do item 2.1 aplicar.", exemplos: ["A", "B_reduzida", "B_completa", "D"] },
  { chave: "responsavel_cliente", rotulo: "Responsável do cliente", descricao: "Contato do cliente que acompanhou o mapeamento." },
  { chave: "tipo_bomba", rotulo: "Tipo da bomba", descricao: "Tipo da bomba de abastecimento (elétrica não aceita adaptação de pulso).", exemplos: ["mecanica", "eletronica", "eletrica"] },
  { chave: "qualidade_sinal", rotulo: "Qualidade do sinal", descricao: "Qualidade do sinal de rede no local (usado na comparação com a proposta).", exemplos: ["bom", "medio", "fraco", "sem sinal"] },
  { chave: "comboio", rotulo: "Possui caminhão comboio", descricao: "Se a operação mapeada inclui caminhão comboio.", exemplos: ["sim", "nao"] },
  { chave: "unidade", rotulo: "Unidade", descricao: "Unidade/filial onde o mapeamento foi realizado." },
  { chave: "analista_projetos", rotulo: "Analista de projetos", descricao: "Analista de projetos responsável pelo atendimento." },
  { chave: "especialista_automacao", rotulo: "Especialista em automação", descricao: "Especialista em automação responsável pelo laudo." },
  { chave: "agente_tecnico", rotulo: "Agente técnico credenciado", descricao: "Agente técnico credenciado IONICS que executou o mapeamento." },
  { chave: "data_mapeamento", rotulo: "Data do mapeamento", descricao: "Data em que o mapeamento foi realizado (dd/mm/aaaa)." },
  { chave: "marca_bomba", rotulo: "Marca da bomba", descricao: "Marca da bomba de abastecimento.", escopo: "bomba" },
  { chave: "tensao_bomba", rotulo: "Tensão de alimentação da bomba", descricao: "Tensão elétrica da bomba.", exemplos: ["220VCA", "380VCA"] },
  { chave: "combustivel", rotulo: "Combustível", descricao: "Combustível fornecido pela bomba." },
  { chave: "marca_registrador", rotulo: "Marca do registrador mecânico", descricao: "Registrador mecânico existente.", escopo: "bomba" },
  { chave: "altura_registrador", rotulo: "Altura do registrador", descricao: "Altura em que se encontra o registrador mecânico." },
  { chave: "marca_bloco_medidor", rotulo: "Marca do bloco medidor", descricao: "Bloco medidor existente.", escopo: "bomba" },
  { chave: "diametro_saida_bloco", rotulo: "Diâmetro da saída do bloco medidor", descricao: "Medida em mm ou polegadas." },
  { chave: "marca_bico", rotulo: "Marca do bico", descricao: "Bico de abastecimento existente.", escopo: "bico" },
  { chave: "diametro_ponteira_bico", rotulo: "Diâmetro da ponteira do bico", descricao: "Medida em mm ou polegadas." },
  { chave: "comprimento_ponteira_bico", rotulo: "Comprimento da ponteira do bico", descricao: "Medida em mm." },
  { chave: "diametro_entrada_bico", rotulo: "Diâmetro da entrada do corpo do bico", descricao: "Medida em mm ou polegadas." },
  { chave: "suporte_bico", rotulo: "Possui suporte para o bico", descricao: "Se há descanso/suporte para acomodar o bico.", exemplos: ["sim", "nao"] },
  { chave: "area_coberta", rotulo: "Área coberta", descricao: "Se a área do dispositivo de abastecimento é coberta.", exemplos: ["sim", "nao"] },
  { chave: "distancia_pista", rotulo: "Distância até a pista", descricao: "Distância da ilha/plataforma até a pista, em metros." },
  { chave: "operadora_gsm", rotulo: "Operadora GSM local", descricao: "Operadora de telefonia disponível no local." },
  { chave: "frequencia_wifi", rotulo: "Frequência do Wi-Fi", descricao: "Frequência da rede sem fio no local.", exemplos: ["2.4 GHz", "5 GHz"] },
  { chave: "qualidade_wifi", rotulo: "Qualidade do Wi-Fi", descricao: "Potência/estabilidade do sinal Wi-Fi no local." },
  // ---- Fase 0 do documento mestre: chaves por entidade (bomba, bico, comboio) e gerais de conectividade ----
  { chave: "modelo_bomba", rotulo: "Modelo da bomba", descricao: "Modelo da bomba de abastecimento.", escopo: "bomba" },
  { chave: "alta_vazao", rotulo: "Bomba de alta vazão", descricao: "Bomba de transferência/alta vazão (ex.: bomba do filtro).", exemplos: ["sim", "nao"], escopo: "bomba" },
  { chave: "bico_ausente", rotulo: "Bomba sem bico", descricao: "A bomba não possui bico de abastecimento.", exemplos: ["sim", "nao"], escopo: "bomba" },
  { chave: "modelo_registrador", rotulo: "Modelo do registrador mecânico", descricao: "Modelo do registrador mecânico.", escopo: "bomba" },
  { chave: "modelo_bloco_medidor", rotulo: "Modelo do bloco medidor", descricao: "Modelo do bloco medidor.", escopo: "bomba" },
  { chave: "possui_automacao", rotulo: "Possui controle/automação", descricao: "Se o dispositivo já possui algum controle ou automação.", exemplos: ["sim", "nao"], escopo: "bomba" },
  { chave: "objeto_proximo_frente", rotulo: "Objeto mais próximo (frente)", descricao: "Objeto mais próximo à frente do bloco medidor.", escopo: "bomba" },
  { chave: "objeto_proximo_atras", rotulo: "Objeto mais próximo (atrás)", descricao: "Objeto mais próximo atrás do bloco medidor.", escopo: "bomba" },
  { chave: "objeto_proximo_direita", rotulo: "Objeto mais próximo (direita)", descricao: "Objeto mais próximo ao lado direito do bloco medidor.", escopo: "bomba" },
  { chave: "objeto_proximo_esquerda", rotulo: "Objeto mais próximo (esquerda)", descricao: "Objeto mais próximo ao lado esquerdo do bloco medidor.", escopo: "bomba" },
  { chave: "bitola_mangueira", rotulo: "Bitola da mangueira", descricao: "Diâmetro da mangueira de abastecimento.", exemplos: ['1/2"', '3/4"', '1"'], escopo: "bico" },
  { chave: "modelo_bico", rotulo: "Modelo do bico", descricao: "Modelo do bico de abastecimento.", escopo: "bico" },
  { chave: "identificacao_comboio", rotulo: "Identificação do comboio", descricao: "Número/nome do comboio no documento (ex.: Comboio 400).", escopo: "comboio" },
  { chave: "placa_comboio", rotulo: "Placa/prefixo do comboio", descricao: "Placa ou prefixo do caminhão comboio.", escopo: "comboio" },
  { chave: "modelo_veiculo", rotulo: "Modelo do veículo", descricao: "Modelo do veículo ou comboio.", escopo: "comboio" },
  { chave: "possui_carretel", rotulo: "Mangueira em carretel", descricao: "Se a mangueira do comboio fica em carretel.", exemplos: ["sim", "nao"], escopo: "comboio" },
  { chave: "qtd_blocos_medidores", rotulo: "Quantidade de blocos medidores", descricao: "Sistemas de abastecimento (blocos medidores) do comboio.", escopo: "comboio" },
  { chave: "possui_compartimento", rotulo: "Possui compartimento", descricao: "Se existe compartimento que abriga o dispositivo de abastecimento.", exemplos: ["sim", "nao"], escopo: "comboio" },
  { chave: "distancia_frente", rotulo: "Distância à frente do bloco medidor", descricao: "Distância até o objeto mais próximo (frente).", escopo: "comboio" },
  { chave: "distancia_atras", rotulo: "Distância atrás do bloco medidor", descricao: "Distância até o objeto mais próximo (atrás).", escopo: "comboio" },
  { chave: "distancia_direita", rotulo: "Distância à direita do bloco medidor", descricao: "Distância até o objeto mais próximo (direita).", escopo: "comboio" },
  { chave: "distancia_esquerda", rotulo: "Distância à esquerda do bloco medidor", descricao: "Distância até o objeto mais próximo (esquerda).", escopo: "comboio" },
  { chave: "retorno_area_cobertura", rotulo: "Retorno à área com cobertura", descricao: "Se o comboio retorna a área com Wi-Fi/GPRS.", exemplos: ["sim", "nao"], escopo: "comboio" },
  { chave: "periodicidade_retorno", rotulo: "Periodicidade do retorno", descricao: "Com que frequência o comboio retorna à área com cobertura.", escopo: "comboio" },
  { chave: "estabilidade_gsm", rotulo: "Estabilidade do sinal GSM", descricao: "Estabilidade do sinal GPRS/2G no local.", escopo: "bomba" },
  { chave: "operadora_gsm_outra", rotulo: "Outra operadora GSM", descricao: "Operadora não listada.", escopo: "bomba" },
  { chave: "estabilidade_wifi", rotulo: "Estabilidade do Wi-Fi", descricao: "Estabilidade do sinal Wi-Fi no local.", escopo: "bomba" },
  { chave: "velocidade_conexao_faixa", rotulo: "Velocidade de conexão (faixa)", descricao: "Faixa de velocidade informada no local (seleção).", escopo: "bomba" },
  { chave: "nome_contato_cliente", rotulo: "Nome do contato do cliente", descricao: "Nome da pessoa do cliente que responde pelo mapeamento (nunca o agente).", escopo: "geral" },
  { chave: "contato_cliente", rotulo: "Contato do cliente", descricao: "Telefone do contato do cliente.", escopo: "geral" },
  { chave: "email_cliente", rotulo: "E-mail do cliente", descricao: "E-mail do contato do cliente.", escopo: "geral" },
  { chave: "velocidade_download_mbps", rotulo: "Velocidade de download (Mbps)", descricao: "Velocidade medida de download no local.", escopo: "geral" },
  { chave: "velocidade_upload_mbps", rotulo: "Velocidade de upload (Mbps)", descricao: "Velocidade medida de upload no local.", escopo: "geral" },
  { chave: "ssid_rede", rotulo: "Nome da rede Wi-Fi (SSID)", descricao: "SSID da rede disponível no local.", escopo: "geral" },
];

export const CHAVES_POR_NOME = new Map(CHAVES_LAUDO.map((c) => [c.chave, c]));

export function rotuloChave(chave: string): string {
  return CHAVES_POR_NOME.get(chave)?.rotulo ?? chave;
}
