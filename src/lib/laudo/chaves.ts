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
];

export const CHAVES_POR_NOME = new Map(CHAVES_LAUDO.map((c) => [c.chave, c]));

export function rotuloChave(chave: string): string {
  return CHAVES_POR_NOME.get(chave)?.rotulo ?? chave;
}
