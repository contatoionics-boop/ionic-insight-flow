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
  ["nome_cliente", ["cliente unidade", "nome do cliente", "razao social", "nome fantasia", "empresa cliente", "cliente"]],
  ["unidade", ["unidade filial", "cliente unidade", "nome da unidade", "unidade atendida", "filial"]],
  [
    "data_mapeamento",
    ["data do mapeamento", "data da vistoria", "data do atendimento", "data de realizacao", "data da visita"],
  ],
  ["responsavel_cliente", ["responsavel pelo acompanhamento", "responsavel do cliente"]],
  [
    "agente_tecnico",
    [
      "agente tecnico credenciado ionics",
      "agente tecnico credenciado",
      "agente tecnico responsavel",
      "nome do agente tecnico",
      "agente tecnico",
      "tecnico responsavel",
    ],
  ],
  [
    "analista_projetos",
    ["analista de projetos responsavel", "nome do analista de projetos", "analista de projetos", "analista projetos"],
  ],
  [
    "especialista_automacao",
    [
      "especialista em automacao responsavel",
      "nome do especialista em automacao",
      "especialista em automacao",
      "especialista de automacao",
      "especialista automacao",
    ],
  ],

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
  ["tipos_veiculos_abastecidos", ["tipos de veiculos que abastece", "tipo de veiculo", "veiculos atendidos"]],
  ["qualidade_sinal", ["potencia do sinal gprs", "sinal gsm", "sinal da operadora"]],
  ["operadora_gsm", ["operadora local"]],
  ["wifi_disponivel", ["dispoe de sinal wi fi", "possui sinal wi fi", "sinal wifi no local"]],
  ["gsm_4g_disponivel", ["dispoe de sinal gsm", "possui sinal 4g", "sinal gprs disponivel"]],
  ["comunicacao_tipos", ["tipo de comunicacao", "meio de comunicacao", "tecnologia de comunicacao"]],
  ["frequencia_wifi", ["frequencia do sinal de wi fi"]],
  ["qualidade_wifi", ["potencia do sinal de wi fi"]],
  ["marca_veiculo", ["marca modelo do veiculo", "marca e modelo do veiculo"]],
  ["tensao_veiculo", ["tensao do veiculo", "tensao de alimentacao do veiculo"]],
  ["ids_objetos", ["placa", "prefixo do veiculo"]],
  [
    "qtd_bicos",
    [
      "quantidade de bicos",
      "numero de bicos",
      "quantidade de bicos de abastecimento",
      "quantidade de bicos da bomba",
      "bicos por bomba",
      "qtd de bicos",
    ],
  ],
];

const INDEX: Array<{ chave: string; termo: string }> = ALIASES.flatMap(([chave, termos]) =>
  termos.map((t) => ({ chave, termo: norm(t) })),
).sort((a, b) => b.termo.length - a.termo.length);

/** Resolve as chaves do laudo a partir do texto da pergunta. */
export function chavesDaPergunta(texto: string | null | undefined): string[] {
  const t = norm(texto ?? "");
  if (!t) return [];
  const achados = INDEX.filter(({ termo }) => t === termo || t.includes(termo));
  if (!achados.length) return [];
  const maior = achados[0]!.termo.length;
  const chaves = achados
    .filter(({ termo }) => termo.length >= maior * 0.8)
    .map(({ chave }) => chave);
  return Array.from(new Set(chaves));
}

/** Compatibilidade: primeira chave encontrada. */
export function chaveDaPergunta(texto: string | null | undefined): string | null {
  return chavesDaPergunta(texto)[0] ?? null;
}
