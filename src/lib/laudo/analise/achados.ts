// Camada de análise técnica do laudo (pura, client-safe).
//
// Transforma as variáveis do mapeamento (proposta + FR-29-10 + cadastro) em
// ACHADOS técnicos: conclusão + recomendações + evidências. Nenhum achado é
// gerado por concatenação de campo: cada regra decide o que a evidência
// significa. A redação dos blocos fica em `redacao.ts`.

import { limparTexto } from "@/lib/texto";
import { rotuloChave } from "@/lib/laudo/chaves";
import type { VariaveisLaudo } from "@/lib/laudo/tipos";

export type SecaoAchado = "2.1" | "2.2" | "2.3" | "2.4";

export type Evidencia = { chave: string; rotulo: string; valor: string };

export type Achado = {
  /** id estável entre gerações */
  chave: string;
  secao: SecaoAchado;
  titulo: string;
  conclusao: string;
  recomendacoes: string[];
  evidencias: Evidencia[];
  severidade: "info" | "atencao";
  /** 0..1 — média da confiança das variáveis que originaram o achado */
  confianca: number;
};

function val(vars: VariaveisLaudo, chave: string): string | null {
  return limparTexto(vars[chave]?.valor) || null;
}

function bool(vars: VariaveisLaudo, chave: string): boolean | null {
  const v = (val(vars, chave) ?? "").toLowerCase();
  if (!v) return null;
  if (/^(sim|s|true|yes|1|possui|há|ha)$/.test(v)) return true;
  if (/^(nao|não|n|false|no|0|nenhum)$/.test(v)) return false;
  if (v.includes("sim")) return true;
  if (v.includes("não") || v.includes("nao")) return false;
  return null;
}

function evid(vars: VariaveisLaudo, chaves: string[]): Evidencia[] {
  const out: Evidencia[] = [];
  for (const c of chaves) {
    const v = val(vars, c);
    if (v) out.push({ chave: c, rotulo: rotuloChave(c), valor: v });
  }
  return out;
}

function confiancaMedia(vars: VariaveisLaudo, evidencias: Evidencia[]): number {
  if (!evidencias.length) return 0;
  const soma = evidencias.reduce((s, e) => s + (vars[e.chave]?.confianca ?? 0), 0);
  return Math.round((soma / evidencias.length) * 100) / 100;
}

function mk(
  vars: VariaveisLaudo,
  a: Omit<Achado, "evidencias" | "confianca"> & { chavesEvidencia: string[] },
): Achado {
  const evidencias = evid(vars, a.chavesEvidencia);
  const { chavesEvidencia: _ignorado, ...resto } = a;
  return { ...resto, evidencias, confianca: confiancaMedia(vars, evidencias) };
}

/** "bom", "ótimo", "forte", "100%" → true; "fraco", "ruim", "instável" → false */
function sinalBom(texto: string | null): boolean | null {
  if (!texto) return null;
  const t = texto.toLowerCase();
  if (/(otim|ótim|bom|boa|excelent|forte|est[aá]vel|alta)/.test(t)) return true;
  if (/(fraco|fraca|ruim|baixa|inst[aá]vel|p[eé]ssim|sem sinal|ausente|inexistente)/.test(t))
    return false;
  const pct = t.match(/(\d{1,3})\s*%/);
  if (pct) return Number(pct[1]) >= 60;
  return null;
}

// ------------------------------------------------- normalização de unidades
// Só acrescenta unidade quando o valor veio apenas como número (a evidência
// mantém sempre o valor original informado).

function soNumero(v: string): boolean {
  return /^\s*\d+(?:[.,]\d+)?\s*$/.test(v);
}

/** acrescenta a unidade quando o valor não traz nenhuma indicação de unidade */
function comUnidade(v: string | null, unidade: string): string | null {
  if (!v) return v;
  return soNumero(v) ? `${v.trim()} ${unidade}` : v;
}

/** medidas de bitola/diâmetro: respeita polegadas (1", 3/4") e unidades já escritas */
function comMm(v: string | null): string | null {
  if (!v) return v;
  if (/["\u2033]|pol|'/i.test(v)) return v;
  return comUnidade(v, "mm");
}

// ---------------------------------------------------------------- comunicação

function achadosComunicacao(vars: VariaveisLaudo): Achado[] {
  const out: Achado[] = [];
  const tipos = (val(vars, "comunicacao_tipos") ?? "").toLowerCase();
  const freq = val(vars, "frequencia_wifi");
  const qualidadeWifi = val(vars, "qualidade_wifi") ?? val(vars, "qualidade_sinal");
  const temWifi = tipos.includes("wi") || bool(vars, "comunicacao_tipos") === true || !!freq;
  const wifiBom = sinalBom(qualidadeWifi);

  if (temWifi) {
    const conclusao = (() => {
      const base = freq
        ? `A unidade dispõe de rede Wi-Fi operando em ${freq}`
        : "A unidade dispõe de rede Wi-Fi no ponto de abastecimento";
      if (wifiBom === true)
        return `${base}, com sinal de boa intensidade e estabilidade adequada para a comunicação do terminal com a aplicação SAAF.`;
      if (wifiBom === false)
        return `${base}, porém com sinal de baixa intensidade/estabilidade no ponto de abastecimento, insuficiente para garantir a comunicação contínua do terminal.`;
      return `${base}. A intensidade do sinal no ponto de abastecimento deve ser confirmada antes da instalação.`;
    })();

    const recomendacoes = [
      "Configurar os roteadores em canal fixo (modo estático), evitando sobreposição de canais e interferência entre pontos de acesso próximos.",
      "Disponibilizar rede dedicada (ou VLAN) para os equipamentos da automação, com IP fixo e sem portal de autenticação.",
      "Liberar no firewall as portas de comunicação utilizadas pela aplicação SAAF.",
    ];
    if ((freq ?? "").includes("5"))
      recomendacoes.push(
        "O terminal opera em 2.4 GHz: manter o SSID de 2.4 GHz habilitado e separado da rede de 5 GHz.",
      );
    if (wifiBom === false)
      recomendacoes.push(
        "Reforçar a cobertura com repetidor/ponto de acesso próximo à pista ou prever comunicação por GSM/4G como alternativa.",
      );

    out.push(
      mk(vars, {
        chave: "comunicacao_wifi",
        secao: "2.2",
        titulo: "Rede Wi-Fi existente",
        conclusao,
        recomendacoes,
        severidade: wifiBom === false ? "atencao" : "info",
        chavesEvidencia: ["comunicacao_tipos", "frequencia_wifi", "qualidade_wifi", "qualidade_sinal"],
      }),
    );
  }

  const temGsm = tipos.includes("4g") || tipos.includes("gsm") || !!val(vars, "operadora_gsm");
  if (temGsm || wifiBom === false || !temWifi) {
    const operadora = val(vars, "operadora_gsm");
    const conclusao = temGsm
      ? `A comunicação por GSM/4G é viável no local${operadora ? `, com cobertura da operadora ${operadora}` : ""}, e será utilizada ${temWifi ? "como alternativa à rede Wi-Fi" : "como meio principal de transferência de dados"}.`
      : "Não foi identificada rede Wi-Fi adequada no ponto de abastecimento; a transferência de dados deverá ocorrer por GSM/4G.";
    out.push(
      mk(vars, {
        chave: "comunicacao_gsm",
        secao: "2.2",
        titulo: "Transferência por GSM / 4G",
        conclusao,
        recomendacoes: [
          "Chip de dados (M2M) com plano ativo é de responsabilidade do cliente.",
          "Instalar antena externa em ponto de boa recepção, afastada de estruturas metálicas e do painel elétrico.",
          "Validar a intensidade do sinal da operadora no ponto exato de instalação do terminal antes da fixação definitiva.",
        ],
        severidade: temGsm ? "info" : "atencao",
        chavesEvidencia: ["comunicacao_tipos", "operadora_gsm", "qualidade_sinal"],
      }),
    );
  }

  return out;
}

// ------------------------------------------------------- bomba / registrador

function achadosBomba(vars: VariaveisLaudo): Achado[] {
  const out: Achado[] = [];
  const tipo = (val(vars, "tipo_bomba") ?? "").toLowerCase();
  const marca = val(vars, "marca_bomba");
  const vazao = comUnidade(val(vars, "vazao"), "L/min");
  const tensao = val(vars, "tensao_bomba") ?? val(vars, "tensao_veiculo");
  const combustivel = val(vars, "combustivel");

  if (marca || tipo || vazao || tensao) {
    const eletronica = tipo.includes("eletr") && !tipo.includes("eletrica") && !tipo.includes("elétrica");
    const partes: string[] = [];
    partes.push(
      `O dispositivo de abastecimento mapeado é uma bomba${tipo ? ` ${tipo}` : ""}${marca ? ` ${marca}` : ""}`,
    );
    if (vazao) partes.push(`com vazão de ${vazao}`);
    if (tensao) partes.push(`alimentada em ${tensao}`);
    if (combustivel) partes.push(`operando com ${combustivel}`);
    const conclusao = `${partes.join(", ")}.`;

    const recomendacoes: string[] = [];
    if (eletronica)
      recomendacoes.push(
        "Bomba eletrônica: a integração ocorre pelo pulso do registrador eletrônico; confirmar com o fabricante a disponibilidade da saída de pulso antes da instalação.",
      );
    if (tipo.includes("mecan") || tipo.includes("mecân"))
      recomendacoes.push(
        "Bomba mecânica: será necessário emissor de pulso acoplado ao registrador mecânico existente.",
      );
    if (tipo === "eletrica" || tipo.includes("elétrica"))
      recomendacoes.push(
        "Bomba elétrica sem registrador não aceita adaptação de pulso: o controle de volume será feito pelo medidor de vazão instalado na linha.",
      );
    if (tensao && /380/.test(tensao))
      recomendacoes.push(
        "Alimentação em 380 VCA: prever contator de comando compatível e ponto de 220/127 VCA para o terminal.",
      );
    recomendacoes.push(
      "O acionamento da bomba será intertravado pelo terminal; o quadro de comando deve permitir a inserção do contator da automação.",
    );

    out.push(
      mk(vars, {
        chave: "bomba_identificacao",
        secao: "2.3",
        titulo: "Dispositivo de abastecimento",
        conclusao,
        recomendacoes,
        severidade: "info",
        chavesEvidencia: ["tipo_bomba", "marca_bomba", "vazao", "tensao_bomba", "combustivel"],
      }),
    );
  }

  const registrador = val(vars, "marca_registrador");
  const altura = val(vars, "altura_registrador");
  if (registrador || altura) {
    out.push(
      mk(vars, {
        chave: "registrador",
        secao: "2.3",
        titulo: "Registrador",
        conclusao:
          `Registrador existente${registrador ? ` ${registrador}` : ""}` +
          `${altura ? `, instalado a ${altura} do piso` : ""}. O ponto de leitura de volume será obtido a partir deste conjunto.`,
        recomendacoes: [
          "Confirmar espaço livre para acoplamento do emissor de pulso sem obstruir a leitura do registrador.",
        ],
        severidade: "info",
        chavesEvidencia: ["marca_registrador", "altura_registrador"],
      }),
    );
  }

  const bloco = val(vars, "marca_bloco_medidor");
  const saida = comMm(val(vars, "diametro_saida_bloco"));
  if (bloco || saida) {
    out.push(
      mk(vars, {
        chave: "bloco_medidor",
        secao: "2.3",
        titulo: "Bloco medidor",
        conclusao:
          `Bloco medidor${bloco ? ` ${bloco}` : ""}${saida ? `, com saída de ${saida}` : ""}. ` +
          "A interligação hidráulica da automação será feita a partir deste ponto.",
        recomendacoes: saida
          ? [`Prever adaptações de bitola compatíveis com a saída de ${saida}.`]
          : ["Confirmar em campo o diâmetro da saída do bloco medidor para dimensionar as adaptações."],
        severidade: "info",
        chavesEvidencia: ["marca_bloco_medidor", "diametro_saida_bloco"],
      }),
    );
  }

  return out;
}

// -------------------------------------------------------------------- pista

function achadosPista(vars: VariaveisLaudo): Achado[] {
  const out: Achado[] = [];
  const coberta = bool(vars, "area_coberta");
  const distancia = comUnidade(val(vars, "distancia_pista"), "m");
  const classificada = bool(vars, "area_classificada");

  if (coberta !== null || distancia || classificada !== null) {
    const partes: string[] = [];
    if (coberta === true) partes.push("A pista de abastecimento é coberta");
    else if (coberta === false)
      partes.push("A pista de abastecimento não é coberta, ficando exposta a intempéries");
    else partes.push("A pista de abastecimento foi mapeada");
    if (distancia) partes.push(`com distância aproximada de ${distancia} entre a ilha e o ponto de instalação`);

    const recomendacoes: string[] = [];
    if (coberta === false)
      recomendacoes.push(
        "Instalar o terminal em gabinete com proteção IP adequada, ou prever abrigo/cobertura para o conjunto.",
      );
    recomendacoes.push(
      "Posicionar o gabinete do terminal a aproximadamente 1,50 m do piso, em local de fácil acesso ao operador e livre de tráfego de veículos.",
      "Manter distância mínima de 1,00 m entre o gabinete e a projeção do bocal de descarga, respeitando o afastamento das áreas classificadas.",
    );
    if (classificada === true)
      recomendacoes.push(
        "Área classificada: eletrodutos, prensa-cabos e luvas devem ser certificados EX, com selagem nas passagens entre áreas.",
      );

    out.push(
      mk(vars, {
        chave: "pista_abastecimento",
        secao: "2.3",
        titulo: "Pista de abastecimento",
        conclusao: `${partes.join(", ")}.`,
        recomendacoes,
        severidade: classificada === true ? "atencao" : "info",
        chavesEvidencia: ["area_coberta", "distancia_pista", "area_classificada"],
      }),
    );
  }

  return out;
}

// --------------------------------------------------------------------- bico

function achadosBico(vars: VariaveisLaudo, bitola: string | null, nivel: string | null): Achado[] {
  const out: Achado[] = [];
  const marca = val(vars, "marca_bico");
  const ponteira = comMm(val(vars, "diametro_ponteira_bico"));
  const comprimento = comMm(val(vars, "comprimento_ponteira_bico"));
  const entrada = comMm(val(vars, "diametro_entrada_bico"));
  const suporte = bool(vars, "suporte_bico");

  if (marca || ponteira || entrada || bitola) {
    const partes: string[] = [];
    partes.push(`Bico de abastecimento${marca ? ` ${marca}` : ""}`);
    if (entrada) partes.push(`com entrada de ${entrada}`);
    if (ponteira) partes.push(`ponteira de ${ponteira}`);
    if (comprimento) partes.push(`comprimento de ponteira de ${comprimento}`);
    if (bitola) partes.push(`linha de abastecimento em ${bitola}`);

    const recomendacoes: string[] = [];
    if (nivel === "nivel_2" && bitola === '1"')
      recomendacoes.push(
        'Recomenda-se a redução da linha de 1" para 3/4" com niple e luva de redução, mantendo a vazão dentro da faixa homologada do medidor.',
      );
    if (suporte === false)
      recomendacoes.push(
        "Não há suporte/descanso para o bico: é obrigatória a instalação do suporte conforme desenho técnico desta seção, para o correto acionamento do sensor.",
      );
    if (suporte === true)
      recomendacoes.push(
        "O suporte existente deve ser conferido quanto ao posicionamento do sensor de acomodação do bico.",
      );
    recomendacoes.push(
      "Somente componentes homologados pela IONICS podem ser inseridos na linha de abastecimento.",
    );

    out.push(
      mk(vars, {
        chave: "bico_abastecimento",
        secao: "2.4",
        titulo: "Bico e linha de abastecimento",
        conclusao: `${partes.join(", ")}.`,
        recomendacoes,
        severidade: suporte === false ? "atencao" : "info",
        chavesEvidencia: [
          "marca_bico",
          "diametro_entrada_bico",
          "diametro_ponteira_bico",
          "comprimento_ponteira_bico",
          "bitola_bico",
          "suporte_bico",
        ],
      }),
    );
  }

  return out;
}

export type EntradaAnalise = {
  variaveis: VariaveisLaudo;
  bitola: string | null;
  nivel: string | null;
};

/** Executa todas as regras determinísticas de análise técnica. */
export function analisarMapeamento(entrada: EntradaAnalise): Achado[] {
  const { variaveis: vars, bitola, nivel } = entrada;
  return [
    ...achadosComunicacao(vars),
    ...achadosBomba(vars),
    ...achadosPista(vars),
    ...achadosBico(vars, bitola, nivel),
  ];
}

export function achadosDaSecao(achados: Achado[], secao: SecaoAchado): Achado[] {
  return achados.filter((a) => a.secao === secao);
}
