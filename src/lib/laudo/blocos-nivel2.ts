// Blocos estruturais padrão condicionados ao escopo (Nível 2 / Comboio).
// Conteúdo fixo do documento de instruções (seção VII) — não é gerado por IA.

import { FIGURA_SUPORTE_BICO } from "./figuras";
import type { BlocoLaudo, VariaveisLaudo } from "./tipos";

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

/**
 * Comboio pelo campo estruturado `comboio` (proposta/formulário). Só cai para
 * o tipo de objeto / objeto do escopo quando não há a chave confiável.
 */
export function temComboio(vars: VariaveisLaudo): boolean {
  const direto = bool(vars["comboio"]?.valor);
  if (direto !== null) return direto;
  const qtd = parseInt((vars["qtd_comboios"]?.valor ?? "").replace(/[^0-9]/g, ""), 10);
  if (Number.isFinite(qtd)) return qtd > 0;
  const texto = `${vars["tipo_objeto"]?.valor ?? ""} ${vars["objeto_escopo"]?.valor ?? ""}`;
  return /comboio/i.test(texto);
}

/** Asset padrão ainda não importado: o especialista faz upload no editor. */
const FIGURA_SUPORTE_COMBOIO_AUSENTE = {
  url: "",
  alt: "Desenho técnico padrão — suporte/descanso do bico em comboios (asset padrão ausente)",
  legenda:
    "Desenho técnico padrão ausente — anexe o esboço do suporte/descanso do bico do comboio (asset padrão não importado).",
  larguraMax: 380,
};

export type EntradaBlocosNivel2 = {
  nivel: string | null;
  variaveis: VariaveisLaudo;
  /** gerador de id do template */
  bid: (prefixo: string) => string;
  /** contador sequencial de figuras do documento */
  proximaFigura: () => number;
};

/**
 * Seção VII do documento de instruções. Só é emitida para escopo Nível 2;
 * o tópico 2.4.1 só entra quando o escopo inclui comboio.
 */
export function blocosNivel2(entrada: EntradaBlocosNivel2): BlocoLaudo[] {
  const { nivel, variaveis, bid, proximaFigura } = entrada;
  if (!ehNivel2(nivel)) return [];

  const out: BlocoLaudo[] = [];

  out.push({
    id: bid("h"),
    tipo: "heading",
    numero: null,
    nivel: 1,
    texto: "VII. Instruções a serem incluídas em Comboios com automatização Nível 2 (Padrão)",
  });

  out.push({
    id: bid("h"),
    tipo: "heading",
    numero: null,
    nivel: 2,
    texto: "2.4. BICOS DE ABASTECIMENTO",
  });

  out.push({
    id: bid("p"),
    tipo: "paragraph",
    texto:
      "Na automatização de Nível 2, o abastecimento somente é liberado mediante o reconhecimento do DIV (Dispositivo de Identificação Veicular) instalado no bocal do veículo. " +
      "O bico de abastecimento recebe o leitor/anel de identificação e passa a operar acoplado ao conjunto homologado pela IONICS, de modo que a liberação da vazão fica condicionada à leitura válida do DIV.",
  });
  out.push({
    id: bid("p"),
    tipo: "paragraph",
    texto:
      "O suporte/descanso do bico deve ser adequado ao novo conjunto: com o leitor instalado, o bico ganha volume e peso adicionais e precisa permanecer apoiado de forma estável, sem esforço sobre a mangueira e sem contato do leitor com a estrutura metálica. " +
      "Também devem ser observadas as ponteiras e bitolas do bico, que precisam ser compatíveis com o bocal do veículo e com a faixa de vazão homologada; quando houver incompatibilidade, é necessária a troca da ponteira ou a adequação da bitola com niple e luva de redução.",
  });
  out.push({
    id: bid("bl"),
    tipo: "bullets",
    itens: [
      "Somente componentes homologados pela IONICS podem ser instalados no bico e na linha de abastecimento.",
      "O leitor do bico deve ficar protegido contra impactos e livre de contato direto com o piso ou com o descanso metálico.",
      "A ponteira e a bitola do bico devem ser compatíveis com o bocal do veículo e com a faixa de vazão homologada.",
      "Após a adequação, o bico deve encaixar integralmente no suporte/descanso, sem folga e sem esforço na mangueira.",
    ],
  });
  out.push({
    id: bid("img"),
    tipo: "image",
    url: FIGURA_SUPORTE_BICO.url,
    alt: FIGURA_SUPORTE_BICO.alt,
    legenda: `Figura ${proximaFigura()} — ${FIGURA_SUPORTE_BICO.legendaBase}`,
    larguraMax: FIGURA_SUPORTE_BICO.larguraMax,
  });

  if (!temComboio(variaveis)) return out;

  out.push({
    id: bid("h"),
    tipo: "heading",
    numero: null,
    nivel: 3,
    texto: "2.4.1. ADEQUAÇÃO DO SUPORTE/DESCANSO DO BICO - COMBOIOS",
  });
  out.push({
    id: bid("p"),
    tipo: "paragraph",
    texto:
      "Nos caminhões comboio, o suporte/descanso do bico deve ser preservado e adequado ao conjunto com o leitor do DIV. " +
      "O bico não pode ficar solto, apoiado sobre o tanque ou pendurado pela mangueira durante o deslocamento, sob risco de dano ao leitor e de perda de identificação no abastecimento.",
  });
  out.push({
    id: bid("p"),
    tipo: "paragraph",
    texto:
      "O balanceamento do bico deve ser verificado após a instalação: o conjunto precisa permanecer estável no descanso, com o peso distribuído no apoio e sem tendência de tombamento com a movimentação do veículo. " +
      "Quando o suporte original não comportar o novo conjunto, deve ser construído um suporte conforme o esboço/layout sugerido a seguir, mantendo altura, abertura e reforço compatíveis com o bico automatizado.",
  });
  out.push({
    id: bid("img"),
    tipo: "image",
    url: FIGURA_SUPORTE_COMBOIO_AUSENTE.url,
    alt: FIGURA_SUPORTE_COMBOIO_AUSENTE.alt,
    legenda: FIGURA_SUPORTE_COMBOIO_AUSENTE.legenda,
    larguraMax: FIGURA_SUPORTE_COMBOIO_AUSENTE.larguraMax,
  });

  return out;
}
