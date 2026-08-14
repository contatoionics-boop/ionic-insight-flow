// Chaves de laudo disponíveis para vincular a perguntas do formulário (client-safe).

export type ChaveLaudo = {
  chave: string;
  rotulo: string;
  descricao: string;
  /** valores sugeridos; usados como dica para a IA e para validação */
  exemplos?: string[];
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
  { chave: "bitola_bico", rotulo: "Bitola do bico", descricao: "Bitola da linha de abastecimento.", exemplos: ['1/2"', '3/4"', '1"'] },
  { chave: "vazao", rotulo: "Vazão", descricao: "Vazão da bomba em litros por minuto." },
  { chave: "terminal_atual", rotulo: "Terminal atual", descricao: "Terminal já instalado, quando houver.", exemplos: ["T850", "T1000", "nenhum"] },
  { chave: "comunicacao_tipos", rotulo: "Tipos de comunicação", descricao: "WiFi, 4G/GSM, rádio 2.4GHz (pode ser mais de um)." },
  { chave: "rfid", rotulo: "Usa RFID", descricao: "Se a operação usa identificação por RFID.", exemplos: ["sim", "nao"] },
  { chave: "cliente_ja_tem_saaf", rotulo: "Cliente já possui SAAF", descricao: "Se já existe automação SAAF instalada.", exemplos: ["sim", "nao"] },
  { chave: "marca_veiculo", rotulo: "Marca/modelo do veículo", descricao: "Marca e modelo do veículo ou comboio." },
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
  { chave: "marca_bomba", rotulo: "Marca/modelo da bomba", descricao: "Marca e modelo da bomba de abastecimento." },
  { chave: "tensao_bomba", rotulo: "Tensão de alimentação da bomba", descricao: "Tensão elétrica da bomba.", exemplos: ["220VCA", "380VCA"] },
  { chave: "combustivel", rotulo: "Combustível", descricao: "Combustível fornecido pela bomba." },
  { chave: "marca_registrador", rotulo: "Marca/modelo do registrador mecânico", descricao: "Registrador mecânico existente." },
  { chave: "altura_registrador", rotulo: "Altura do registrador", descricao: "Altura em que se encontra o registrador mecânico." },
  { chave: "marca_bloco_medidor", rotulo: "Marca/modelo do bloco medidor", descricao: "Bloco medidor existente." },
  { chave: "diametro_saida_bloco", rotulo: "Diâmetro da saída do bloco medidor", descricao: "Medida em mm ou polegadas." },
  { chave: "marca_bico", rotulo: "Marca/modelo do bico", descricao: "Bico de abastecimento existente." },
  { chave: "diametro_ponteira_bico", rotulo: "Diâmetro da ponteira do bico", descricao: "Medida em mm ou polegadas." },
  { chave: "comprimento_ponteira_bico", rotulo: "Comprimento da ponteira do bico", descricao: "Medida em mm." },
  { chave: "diametro_entrada_bico", rotulo: "Diâmetro da entrada do corpo do bico", descricao: "Medida em mm ou polegadas." },
  { chave: "suporte_bico", rotulo: "Possui suporte para o bico", descricao: "Se há descanso/suporte para acomodar o bico.", exemplos: ["sim", "nao"] },
  { chave: "area_coberta", rotulo: "Área coberta", descricao: "Se a área do dispositivo de abastecimento é coberta.", exemplos: ["sim", "nao"] },
  { chave: "distancia_pista", rotulo: "Distância até a pista", descricao: "Distância da ilha/plataforma até a pista, em metros." },
  { chave: "operadora_gsm", rotulo: "Operadora GSM local", descricao: "Operadora de telefonia disponível no local." },
  { chave: "frequencia_wifi", rotulo: "Frequência do Wi-Fi", descricao: "Frequência da rede sem fio no local.", exemplos: ["2.4 GHz", "5 GHz"] },
  { chave: "qualidade_wifi", rotulo: "Qualidade do Wi-Fi", descricao: "Potência/estabilidade do sinal Wi-Fi no local." },
];

export const CHAVES_POR_NOME = new Map(CHAVES_LAUDO.map((c) => [c.chave, c]));

export function rotuloChave(chave: string): string {
  return CHAVES_POR_NOME.get(chave)?.rotulo ?? chave;
}
