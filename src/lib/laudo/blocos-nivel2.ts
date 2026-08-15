// Blocos estruturais padrão condicionados ao escopo (Nível 2 / Comboio).
// Conteúdo literal do documento de instruções (seção VII) — não é gerado por IA.
//
// Todos os blocos carregam `chave` determinística (`nivel2:...`) para que a
// regeração atualize/substitua o bloco existente em vez de duplicá-lo.

import {
  FIGURA_N2_BICO,
  FIGURA_N2_PONTEIRA,
  FIGURA_N2_SUPORTE,
  type FiguraLaudo,
} from "./figuras";
import { pendencia, type BlocoLaudo, type VariaveisLaudo } from "./tipos";

/** Aceita nivel_2, "Nível 2", "Nivel 2", "2". */
export function ehNivel2(nivel: string | null | undefined): boolean {
  const s = (nivel ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
  if (!s) return false;
  if (s === "2") return true;
  return /(^|[^0-9])n[ií]?vel[_\s-]*2([^0-9]|$)/.test(s) || s === "nivel_2";
}

function bool(valor: string | null | undefined): boolean | null {
  const v = (valor ?? "").toLowerCase().trim();
  if (!v) return null;
  if (["sim", "s", "true", "yes", "1"].includes(v)) return true;
  if (["nao", "não", "n", "false", "no", "0"].includes(v)) return false;
  return null;
}

/** origens que confirmam o escopo em campo (proposta sozinha não confirma) */
const ORIGENS_CONFIRMADAS = new Set(["formulario", "manual", "ia"]);

function confirmada(vars: VariaveisLaudo, chave: string): string | null {
  const item = vars[chave];
  if (!item || !ORIGENS_CONFIRMADAS.has(String(item.origem))) return null;
  const s = (item.valor ?? "").toString().trim();
  return s.length ? s : null;
}

/**
 * Comboio SOMENTE por evidência estruturada CONFIRMADA em campo
 * (`comboio`, `qtd_comboios` ou `tipo_objeto` explicitamente comboio), com
 * origem formulário/manual/IA. Proposta isolada não liga o 2.4.1 — ela gera
 * divergência/pendência para o especialista. Nunca é inferido de texto livre.
 */
export function temComboio(vars: VariaveisLaudo): boolean {
  const direto = bool(confirmada(vars, "comboio"));
  if (direto !== null) return direto;
  const qtd = parseInt((confirmada(vars, "qtd_comboios") ?? "").replace(/[^0-9]/g, ""), 10);
  if (Number.isFinite(qtd)) return qtd > 0;
  const tipo = (confirmada(vars, "tipo_objeto") ?? "").trim().toLowerCase();
  if (tipo === "comboio" || tipo === "caminhao comboio" || tipo === "caminhão comboio") return true;
  return false;
}


/**
 * Nome da solução para o parágrafo de abertura do 2.4.
 */
export function nomeSolucaoNivel2(vars: VariaveisLaudo): string {
  const bruto = (vars["nome_solucao"]?.valor ?? "").trim();
  const s = bruto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();
  const saaf = /\bSAAF\b/.test(s);
  const ssg = /\bSSG\b/.test(s);
  if (saaf && !ssg) return "SAAF";
  if (ssg && !saaf) return "SSG Frota";
  if (bruto && !(saaf && ssg)) return bruto;
  return pendencia("nome_solucao", "solução contratada (SAAF ou SSG Frota)");
}

export type OpcoesNivel2 = {
  /** nome da solução já resolvido; padrão SAAF/SSG Frota genérico */
  solucao?: string;
  /** gerador de id (template usa o sequencial do documento) */
  id?: (prefixo: string) => string;
  /** numeração sequencial das figuras do documento; sem ele a legenda vai sem "Figura N" */
  proximaFigura?: (() => number) | null;
  /** blocos inseridos manualmente pela biblioteca */
  manual?: boolean;
};

function criarId(opcoes: OpcoesNivel2, prefixo: string): string {
  if (opcoes.id) return opcoes.id(prefixo);
  return `${prefixo}-${Math.random().toString(36).slice(2, 10)}`;
}

function figura(opcoes: OpcoesNivel2, chave: string, f: FiguraLaudo): BlocoLaudo {
  const n = opcoes.proximaFigura ? opcoes.proximaFigura() : null;
  return {
    id: criarId(opcoes, "img"),
    chave,
    tipo: "image",
    url: f.url,
    alt: f.alt,
    legenda: n ? `Figura ${n} — ${f.legendaBase}` : f.legendaBase,
    larguraMax: f.larguraMax,
  } as BlocoLaudo;
}

const TITULO_SECAO_VII_COMBOIO =
  "VII. Instruções a serem incluídas em Comboios com automatização Nível 2 (Padrão)";
const TITULO_SECAO_VII_NEUTRO =
  "VII. Instruções a serem incluídas em Pistas com automatização Nível 2 (Padrão)";

/** Heading único da seção VII. */
export function blocoSecaoVII(
  opcoes: OpcoesNivel2 = {},
  temComboio = false,
): BlocoLaudo {
  return {
    id: criarId(opcoes, "h"),
    chave: "nivel2:secao",
    tipo: "heading",
    numero: null,
    nivel: 1,
    texto: temComboio ? TITULO_SECAO_VII_COMBOIO : TITULO_SECAO_VII_NEUTRO,
  } as BlocoLaudo;
}

/** 2.4 — Bicos de Abastecimento (texto padrão editável + desenhos padrão). */
export function blocos24(opcoes: OpcoesNivel2 = {}): BlocoLaudo[] {
  const solucao = opcoes.solucao || "SAAF / SSG Frota";
  const p = (chave: string, texto: string): BlocoLaudo =>
    ({ id: criarId(opcoes, "p"), chave, tipo: "paragraph", texto }) as BlocoLaudo;

  return [
    {
      id: criarId(opcoes, "h"),
      chave: "nivel2:2.4",
      tipo: "heading",
      numero: null,
      nivel: 2,
      texto: "2.4. BICOS DE ABASTECIMENTO",
    } as BlocoLaudo,
    p(
      "nivel2:2.4:texto-1",
      `A Solução ${solucao} operará no Nível 2, portanto, os abastecimentos serão liberados mediante reconhecimento do DIV ` +
        "(Dispositivo de Identificação Veicular) fixado do lado interno/dentro dos bocais dos tanques de combustível dos veículos que serão abastecidos.",
    ),
    p(
      "nivel2:2.4:texto-2",
      "O suporte/descanso do bico deverá garantir que a NLDIV que será acoplada à ponteira não sofra impacto ou atrito que possa comprometer o seu funcionamento e/ou provocar a redução da vida útil.",
    ),
    p(
      "nivel2:2.4:texto-3",
      "A seguir imagem do bico automatizado com a Solução NLDIV Wireless V2; na entrada do Corpo do Bico (rosca NPT - fêmea de 1” apenas para os de ponteira de 1” e de 3/4” para aqueles com ponteira de 1/2” ou de 3/4”) será roscada uma conexão (niple) do diâmetro/bitola compatível com aproximadamente 120mm de comprimento na qual se fará o suporte do Módulo Bico Wireless.",
    ),
    figura(opcoes, "nivel2:2.4:img-bico", FIGURA_N2_BICO),
    p(
      "nivel2:2.4:texto-4",
      "Na ponteira do bico se acoplará a NLDIV Wireless (Antena/leitor) que resultará no aumento do diâmetro externo.",
    ),
    figura(opcoes, "nivel2:2.4:img-ponteira", FIGURA_N2_PONTEIRA),
    {
      id: criarId(opcoes, "bl"),
      chave: "nivel2:2.4:diametros",
      tipo: "bullets",
      itens: [
        "Ponteira de 1” + NLDIV = 1 7/8” ou 47mm;",
        "Ponteira de 3/4” + NLDIV = 1 3/8” ou 34mm;",
        "Ponteira de 1/2” + NLDIV = 1 3/16” ou 30mm.",
      ],
    } as BlocoLaudo,
    p(
      "nivel2:2.4:texto-5",
      "IMPORTANTE: considerar os diâmetros externos com a NLDIV acoplada para verificar a compatibilidade com o bocal do tanque e com o suporte/descanso do bico; caso necessário, utilizar a bitola imediatamente menor.",
    ),
    p(
      "nivel2:2.4:texto-6",
      "ATENÇÃO: para possibilitar a instalação da Solução NLDIV Wireless, os Bicos de Abastecimento obrigatoriamente deverão ser de marca e modelo dos homologados pela IONICS. Marcas e Modelos homologados: OPW 1”, 3/4” e 1/2”; Bremen 1”, 3/4” e 1/2”; Martinelli 1” Mod. MP-2. Todos eles com ponteira standard (140 a 160mm de comprimento).",
    ),
  ];
}

/** 2.4.1 — Adequação do Suporte/Descanso do Bico - Comboios. */
export function blocos241(opcoes: OpcoesNivel2 = {}): BlocoLaudo[] {
  const p = (chave: string, texto: string): BlocoLaudo =>
    ({ id: criarId(opcoes, "p"), chave, tipo: "paragraph", texto }) as BlocoLaudo;

  return [
    {
      id: criarId(opcoes, "h"),
      chave: "nivel2:2.4.1",
      tipo: "heading",
      numero: null,
      nivel: 3,
      texto: "2.4.1. ADEQUAÇÃO DO SUPORTE/DESCANSO DO BICO - COMBOIOS",
    } as BlocoLaudo,
    p(
      "nivel2:2.4.1:texto-1",
      "O suporte/descanso do bico deverá garantir que a NLDIV que será acoplada à ponteira não sofra impacto ou atrito que possa comprometer o seu funcionamento e/ou provocar a redução da vida útil; também precisará impedir que o corpo do bico se movimente enquanto o caminhão estiver transitando. Este último quesito é necessário para preservar a carga da bateria do Módulo Bico Wireless, já que o dispositivo é ativado quando balançado verticalmente com ângulo de 30°.",
    ),
    p(
      "nivel2:2.4.1:texto-2",
      "Esboço (layout) sugerido para construção do “Suporte de Bico” a ser implementado nos Caminhões Comboio (de modo que atenda o acima citado) usando barra chata de ferro galvanizado 2” x 3/16” (50,80 x 4,75mm). No ato da instalação da automação o Agente Técnico Credenciado (ATC) escolherá o local adequado para fixá-lo com parafusos e porcas 5/16” x 1” ou 3/4” na parte superior/teto do compartimento.",
    ),
    figura(opcoes, "nivel2:2.4.1:img-suporte", FIGURA_N2_SUPORTE),
  ];
}

export type EntradaBlocosNivel2 = {
  nivel: string | null;
  variaveis: VariaveisLaudo;
  bid: (prefixo: string) => string;
  proximaFigura: () => number;
};

/**
 * Seção VII do documento de instruções. Só é emitida para escopo Nível 2;
 * o tópico 2.4.1 só entra quando o escopo inclui comboio.
 */
export function blocosNivel2(entrada: EntradaBlocosNivel2): BlocoLaudo[] {
  const { nivel, variaveis, bid, proximaFigura } = entrada;
  if (!ehNivel2(nivel)) return [];

  const opcoes: OpcoesNivel2 = {
    solucao: nomeSolucaoNivel2(variaveis),
    id: bid,
    proximaFigura,
  };
  const out = [blocoSecaoVII(opcoes), ...blocos24(opcoes)];
  if (temComboio(variaveis)) out.push(...blocos241(opcoes));
  return out;
}
