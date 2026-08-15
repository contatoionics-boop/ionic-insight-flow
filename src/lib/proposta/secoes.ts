// Leitura da proposta comercial IONICS por HIERARQUIA DE EVIDÊNCIA.
// Puro / client-safe / testável.
//
// A proposta mistura conteúdo institucional (que descreve TODAS as
// possibilidades da IONICS) com o escopo específico daquele cliente.
// Só as seções específicas (3.6/3.7 e equivalentes), o cabeçalho e as
// observações valem como evidência de escopo. O texto institucional serve
// apenas para interpretar Fase/Nível — nunca para afirmar que o cliente
// contratou algo.

import type { CampoProposta, EscopoProposta } from "@/lib/proposta/tipos";

export type SecoesProposta = {
  /** identificação: cliente, CNPJ, endereço, responsável… */
  cabecalho: string;
  /** escopo específico contratado (itens 3.6/3.7 ou equivalentes) */
  escopo: string;
  /** observações / condições preliminares */
  observacoes: string;
  /** descrições institucionais do produto (nunca confirmam escopo) */
  institucional: string;
};

function limpar(s: string): string {
  return (s ?? "").replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
}

const RE_ITEM = /^\s*(\d{1,2}\.\d{1,2})[.)\s-]/;
const RE_OBS = /^\s*(observa[cç][õo]es|obs\.?|condi[cç][õo]es\s+gerais)\b/i;

/** Marcadores de que um item numerado descreve o escopo daquele cliente. */
const RE_ESCOPO_ESPECIFICO =
  /(automatiza[cç][ãa]o\s+do\s+processo\s+de|escopo\s+contratado|\bkit\b|\bqtd\b|\b\d{1,3}\s*(?:x\s*)?(posto|bomba|bico|comboio|pista|ve[íi]culo|caminh))/i;

/** Segmenta o texto do PDF nas quatro camadas de evidência. */
export function segmentarProposta(textoBruto: string): SecoesProposta {
  const texto = (textoBruto ?? "").replace(/\r/g, "");
  const linhas = texto.split("\n");

  const cabecalho: string[] = [];
  const escopo: string[] = [];
  const observacoes: string[] = [];
  const institucional: string[] = [];

  let modo: "cabecalho" | "corpo" | "escopo" | "observacoes" = "cabecalho";
  let linhasCabecalho = 0;

  for (const linhaBruta of linhas) {
    const linha = limpar(linhaBruta);
    if (!linha) continue;

    if (RE_OBS.test(linha)) {
      modo = "observacoes";
      observacoes.push(linha);
      continue;
    }

    const item = linha.match(RE_ITEM);
    if (item) {
      modo = RE_ESCOPO_ESPECIFICO.test(linha) ? "escopo" : "corpo";
      (modo === "escopo" ? escopo : institucional).push(linha);
      continue;
    }

    if (modo === "cabecalho") {
      cabecalho.push(linha);
      linhasCabecalho += 1;
      // cabeçalho curto: identificação costuma ocupar o topo do documento
      if (linhasCabecalho >= 45) modo = "corpo";
      continue;
    }
    if (modo === "escopo") escopo.push(linha);
    else if (modo === "observacoes") observacoes.push(linha);
    else institucional.push(linha);
  }

  return {
    cabecalho: cabecalho.join("\n"),
    escopo: escopo.join("\n"),
    observacoes: observacoes.join("\n"),
    institucional: institucional.join("\n"),
  };
}

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * Remove trechos que NÃO podem confirmar escopo:
 * - títulos genéricos ("AUTOMAÇÃO PARA OS POSTOS FIXOS E COMBOIOS");
 * - conteúdo entre parênteses ("(para bomba FIXA ou MÓVEL)");
 * - alternativas com "ou" no nome de kits/produtos.
 */
export function textoConfirmatorio(escopoTexto: string): string {
  return escopoTexto
    .split("\n")
    .map((l) => l.replace(/\([^)]*\)/g, " "))
    .filter((l) => {
      const s = semAcento(l).toUpperCase();
      // título genérico do portfólio
      if (/AUTOMACAO\s+PARA\s+OS?\s+POSTOS?\s+FIXOS?\s+E\s+COMBOIOS?/.test(s)) return false;
      // linha totalmente em caixa alta e sem quantidade = título/section header
      const temQuantidade = /\d/.test(s);
      const caixaAlta = s === s.toUpperCase() && /[A-Z]{6,}/.test(s);
      if (caixaAlta && !temQuantidade) return false;
      return true;
    })
    .join("\n");
}

const NUM_EXTENSO: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
};

function quantidade(texto: string, unidade: RegExp): number | null {
  const fonte = semAcento(texto).toLowerCase();
  const re = new RegExp(
    `(\\d{1,3}|um|uma|dois|duas|tres|quatro|cinco|seis)\\s*(?:x\\s*)?(?:${unidade.source})`,
    "i",
  );
  const m = fonte.match(re);
  if (!m) return null;
  const bruto = m[1].toLowerCase();
  const n = /^\d+$/.test(bruto) ? Number(bruto) : (NUM_EXTENSO[bruto] ?? null);
  return n && Number.isFinite(n) ? n : null;
}

/** Fase declarada na proposta → nível de automação (só o que é oficial). */
export function faseParaNivel(fase: number | null | undefined): 1 | 2 | null {
  if (fase === 1) return 1;
  if (fase === 2) return 2;
  return null; // Fase 3/4: sem equivalência oficial → revisão humana
}

/**
 * Comboio só é verdadeiro quando o escopo ESPECÍFICO cita comboio como
 * estrutura contratada, com quantidade/aplicação explícita.
 *
 * - `true`  -> quantidade ou enumeração de estrutura ("02 caminhões comboio");
 * - `null`  -> menção ambígua (catálogo, "Terminal Comboio", compatibilidade);
 * - `false` -> nenhuma menção no escopo específico do cliente.
 */
export function comboioExplicito(secoes: SecoesProposta): {
  valor: boolean | null;
  trecho: string | null;
} {
  const alvo = textoConfirmatorio(secoes.escopo);
  const linhas = alvo.split("\n");
  let ambiguo: string | null = null;
  for (const linha of linhas) {
    const s = semAcento(linha).toLowerCase();
    if (!/comboi/.test(s)) continue;
    const comQuantidade =
      /(\d{1,3}|um|uma|dois|duas|tres)\s*(?:x\s*)?(?:caminh\w+\s+)?comboi/.test(s);
    if (comQuantidade) return { valor: true, trecho: linha.trim().slice(0, 240) };
    // nome de produto/terminal ou capacidade genérica não confirma escopo
    if (ambiguo === null) ambiguo = linha.trim().slice(0, 240);
  }
  return ambiguo ? { valor: null, trecho: ambiguo } : { valor: false, trecho: null };
}


type Parcial = Partial<Record<keyof EscopoProposta, CampoProposta<any>>>;

function campo<T>(
  valor: T | null,
  confianca: number,
  secao: string,
  trecho?: string | null,
): CampoProposta<T> | null {
  if (valor === null || valor === undefined || valor === "") return null;
  return { valor, confianca, trecho: trecho ?? null, secao, origem: "proposta", status: "previsto" };
}

function primeiro(texto: string, re: RegExp): string | null {
  const m = texto.match(re);
  return m?.[1]?.trim() || null;
}

function linhaComTermo(texto: string, re: RegExp): string | null {
  for (const l of texto.split("\n")) if (re.test(semAcento(l).toLowerCase())) return l.trim();
  return null;
}

/**
 * Extração determinística — o que dá para provar por regra, sem IA.
 * A IA só complementa o que sobrar (ver `extrair.server.ts`).
 */
export function escopoDeterministico(secoes: SecoesProposta): Parcial {
  const out: Parcial = {};
  const set = (k: keyof EscopoProposta, c: CampoProposta<any> | null) => {
    if (c) out[k] = c;
  };

  const cab = secoes.cabecalho;
  const esc = textoConfirmatorio(secoes.escopo);
  const obs = secoes.observacoes;
  const tudo = `${cab}\n${esc}\n${obs}`;

  // ---- cabeçalho / identificação ----
  set("cnpj", campo(primeiro(cab, /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/), 1, "cabecalho"));
  set("cep", campo(primeiro(cab, /\b(\d{5}-?\d{3})\b/), 0.9, "cabecalho"));
  set(
    "cidade_uf",
    campo(primeiro(cab, /([A-ZÀ-Ú][\wÀ-ú' ]+?\s*-\s*[A-Z]{2})\b/), 0.7, "cabecalho"),
  );
  set(
    "responsavel_proposta",
    campo(
      primeiro(cab, /respons[áa]vel\s+(?:pela\s+)?proposta[^:\n]*:?\s*([^\n]{3,80})/i),
      0.9,
      "cabecalho",
    ),
  );
  set(
    "nome_cliente",
    campo(
      primeiro(cab, /(?:empresa|cliente|raz[ãa]o\s+social)[^:\n]*:?\s*([^\n]{3,120})/i) ||
        primeiro(cab, /^([^\n]*\b(?:LTDA|S\.?A\.?|EIRELI|ME)\b[^\n]*)$/im),
      0.85,
      "cabecalho",
    ),
  );
  set(
    "contato",
    campo(primeiro(cab, /contato[^:\n]*:?\s*([^\n]{2,80})/i), 0.7, "cabecalho"),
  );
  set(
    "endereco",
    campo(primeiro(cab, /endere[çc]o[^:\n]*:?\s*([^\n]{5,140})/i), 0.8, "cabecalho"),
  );
  set(
    "numero_proposta",
    campo(primeiro(cab, /proposta\s*(?:n[ºo°]|n[úu]mero)\s*:?\s*([\w./-]{2,20})/i), 0.8, "cabecalho"),
  );
  set(
    "data_proposta",
    campo(primeiro(cab, /\b(\d{2}\/\d{2}\/\d{4})\b/), 0.6, "cabecalho"),
  );

  // ---- solução ----
  const solTexto = semAcento(tudo).toUpperCase();
  const solucao = /SSG\s*FROTA/.test(solTexto)
    ? "SSG Frota"
    : /\bSAAF\b/.test(solTexto)
      ? "SAAF"
      : null;
  set("nome_solucao", campo(solucao, 0.9, "escopo"));

  // ---- fase / nível (do escopo específico) ----
  const faseTxt = esc.match(/fase\s*0?([1-4])/i) ?? tudo.match(/fase\s*0?([1-4])/i);
  const fase = faseTxt ? Number(faseTxt[1]) : null;
  if (fase) {
    set("fase_automacao", campo(fase, 0.95, "escopo", linhaComTermo(esc, /fase/)));
    const nivel = faseParaNivel(fase);
    if (nivel) set("nivel_automacao", campo(nivel, 0.9, "escopo", `FASE ${fase} = Nível ${nivel}`));
  }
  const nivelDireto = esc.match(/n[íi]vel\s*0?([1-3])/i);
  if (nivelDireto) {
    set("nivel_automacao", campo(Number(nivelDireto[1]), 0.95, "escopo", linhaComTermo(esc, /nivel/)));
  }

  // ---- estruturas ----
  const postos = quantidade(esc, /postos?\s*fix\w*|postos?\b/);
  if (postos !== null) {
    set("qtd_postos", campo(postos, 0.9, "escopo", linhaComTermo(esc, /posto/)));
    set("tem_pista", campo(postos > 0, 0.9, "escopo", linhaComTermo(esc, /posto/)));
  } else if (/\b(pista|posto\s*fixo)\b/i.test(semAcento(esc))) {
    set("tem_pista", campo(true, 0.7, "escopo", linhaComTermo(esc, /pista|posto/)));
  }

  const comboio = comboioExplicito(secoes);
  set(
    "tem_comboio",
    campo(comboio.valor, comboio.valor ? 0.9 : 0.8, "escopo", comboio.trecho),
  );
  if (comboio.valor) {
    const qtdC = quantidade(esc, /(?:caminh\w+\s+)?comboi\w*/);
    if (qtdC !== null) set("qtd_comboios", campo(qtdC, 0.85, "escopo", comboio.trecho));
  } else {
    set("qtd_comboios", campo(0, 0.8, "escopo", null));
  }

  const bombas = quantidade(esc, /bombas?\b/);
  if (bombas !== null) set("qtd_bombas", campo(bombas, 0.9, "escopo", linhaComTermo(esc, /bomba/)));

  const bicos = quantidade(esc, /bicos?\b/);
  if (bicos !== null) set("qtd_bicos", campo(bicos, 0.9, "escopo", linhaComTermo(esc, /bico/)));

  const pistas = quantidade(esc, /pistas?\b/);
  if (pistas !== null) set("qtd_pistas", campo(pistas, 0.85, "escopo", linhaComTermo(esc, /pista/)));

  const tipoBomba = semAcento(esc).match(/bombas?\s+(mecanicas?|eletricas?|submersas?|digitais?)/i);
  if (tipoBomba) {
    const t = tipoBomba[1].toLowerCase();
    const rotulo = t.startsWith("mecanic")
      ? "mecânica"
      : t.startsWith("eletric")
        ? "elétrica"
        : t.startsWith("submers")
          ? "submersa"
          : "digital";
    set("tipo_bomba_previsto", campo(rotulo, 0.9, "escopo", linhaComTermo(esc, /bomba/)));
  }

  // ---- observações: comunicação prevista ----
  const obsNorm = semAcento(obs).toLowerCase();
  const temWifi = /wi-?fi/.test(obsNorm);
  const tem4g = /\b4g\b|gprs|gsm/.test(obsNorm);
  const quatroGAdicional = /(4g[^.\n]*\b(adicional|opcional|opcao)\b)|(\b(adicional|opcional)\b[^.\n]*4g)/.test(
    obsNorm,
  );
  const com = temWifi && tem4g && !quatroGAdicional ? "ambos" : temWifi ? "wifi" : tem4g ? "4g" : null;
  set(
    "comunicacao_prevista",
    campo(com, 0.85, "observacoes", linhaComTermo(obs, /wi-?fi|4g|gprs/)),
  );

  if (/comodato/.test(semAcento(tudo).toLowerCase())) {
    set("regime_contratacao", campo("comodato", 0.7, "observacoes", linhaComTermo(tudo, /comodato/)));
  }

  const obsLista = obs
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 15 && !RE_OBS.test(l))
    .slice(0, 12);
  if (obsLista.length) set("observacoes_preliminares", campo(obsLista, 0.8, "observacoes"));

  const itens = secoes.escopo
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /kit|terminal|div|nldiv|antena|modulo|módulo|sensor|leitor/i.test(l))
    .slice(0, 20);
  if (itens.length) set("itens_previstos", campo(itens, 0.7, "escopo"));

  return out;
}
