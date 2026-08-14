// Mapeia perguntas do formulário para chaves do laudo pelo TEXTO da pergunta,
// para formulários (antigos ou padrão FR-29-10) cujas perguntas não têm
// `chave_laudo` vinculada. Client-safe e puro.

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** pares [chave do laudo, trechos que identificam a pergunta] */
const ALIASES: Array<[string, string[]]> = [
  ["nome_cliente", ["cliente unidade", "nome do cliente", "razao social", "cliente"]],
  ["unidade", ["unidade filial", "cliente unidade", "nome da unidade"]],
  ["data_mapeamento", ["data do mapeamento", "data da vistoria"]],
  ["responsavel_cliente", ["responsavel pelo acompanhamento", "responsavel do cliente"]],
  ["agente_tecnico", ["agente tecnico"]],
  ["analista_projetos", ["analista de projetos"]],
  ["especialista_automacao", ["especialista em automacao"]],
  ["tipo_bomba", ["tipo de bomba"]],
  ["marca_bomba", ["marca modelo da bomba"]],
  ["tensao_bomba", ["tensao de alimentacao da bomba"]],
  ["vazao", ["vazao fornecida pela bomba", "vazao"]],
  ["combustivel", ["combustivel fornecido pela bomba", "tipo de combustivel"]],
  ["marca_registrador", ["marca modelo do registrador"]],
  ["altura_registrador", ["altura em que se encontra o registrador"]],
  ["marca_bloco_medidor", ["marca modelo do bloco medidor"]],
  ["diametro_saida_bloco", ["diametro da saida do bloco medidor"]],
  ["bitola_bico", ["diametro da mangueira", "bitola"]],
  ["marca_bico", ["marca modelo do bico"]],
  ["diametro_ponteira_bico", ["diametro da ponteira do bico"]],
  ["comprimento_ponteira_bico", ["comprimento da ponteira do bico"]],
  ["diametro_entrada_bico", ["diametro da entrada do corpo do bico"]],
  ["suporte_bico", ["suporte para acomodar o bico", "descanso suporte do bico"]],
  ["area_coberta", ["area onde esta instalado o dispositivo de abastecimento e coberta"]],
  ["distancia_pista", ["distancia da ilha", "ate a pista"]],
  ["cliente_ja_tem_saaf", ["possui algum tipo de controle automacao"]],
  ["tipo_objeto", ["tipos de veiculos que abastece", "tipo de veiculo"]],
  ["qualidade_sinal", ["potencia do sinal gprs", "sinal gsm", "sinal da operadora"]],
  ["operadora_gsm", ["operadora local"]],
  ["comunicacao_tipos", ["dispoe de sinal wi fi", "sinal wifi", "tipo de comunicacao"]],
  ["frequencia_wifi", ["frequencia do sinal de wi fi"]],
  ["qualidade_wifi", ["potencia do sinal de wi fi"]],
  ["marca_veiculo", ["marca modelo do veiculo", "marca e modelo do veiculo"]],
  ["tensao_veiculo", ["tensao do veiculo", "tensao de alimentacao do veiculo"]],
  ["ids_objetos", ["placa", "prefixo do veiculo"]],
  ["qtd_bicos", ["quantidade de bicos", "numero de bicos"]],
];

const INDEX: Array<{ chave: string; termo: string }> = ALIASES.flatMap(([chave, termos]) =>
  termos.map((t) => ({ chave, termo: norm(t) })),
).sort((a, b) => b.termo.length - a.termo.length);

/** Resolve a chave do laudo a partir do texto da pergunta (ou null). */
export function chaveDaPergunta(texto: string | null | undefined): string | null {
  const t = norm(texto ?? "");
  if (!t) return null;
  for (const { chave, termo } of INDEX) {
    if (t === termo || t.includes(termo)) return chave;
  }
  return null;
}
