// Blocos estruturais padrão condicionados ao escopo (Nível 2 / Comboio).
// Conteúdo literal do documento de instruções (seção VII) — não é gerado por IA.

import { FIGURA_BICO_NLDIV, FIGURA_PONTEIRA_NLDIV } from "./figuras";
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

/**
 * Nome da solução para o parágrafo de abertura do 2.4. Não deixa
 * "SAAF/SSG Frota" literal quando a solução contratada é conhecida.
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
  const solucao = nomeSolucaoNivel2(variaveis);

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
      `A Solução ${solucao} operará no Nível 2, portanto, os abastecimentos serão liberados mediante reconhecimento do DIV ` +
      "(Dispositivo de Identificação Veicular) fixado do lado interno/dentro dos bocais dos tanques de combustível dos veículos que serão abastecidos.",
  });
  out.push({
    id: bid("p"),
    tipo: "paragraph",
    texto:
      "O suporte/descanso do bico deverá garantir que a NLDIV que será acoplada à ponteira não sofra impacto ou atrito que possa comprometer o seu funcionamento e/ou provocar a redução da vida útil.",
  });
  out.push({
    id: bid("p"),
    tipo: "paragraph",
    texto:
      "A seguir imagem do bico automatizado com a Solução NLDIV Wireless V2; na entrada do Corpo do Bico (rosca NPT - fêmea de 1” apenas para os de ponteira de 1” e de 3/4” para aqueles com ponteira de 1/2” ou de 3/4”) será roscada uma conexão (niple) do diâmetro/bitola compatível com aproximadamente 120mm de comprimento na qual se fará o suporte do Módulo Bico Wireless.",
  });
  out.push({
    id: bid("img"),
    tipo: "image",
    url: FIGURA_BICO_NLDIV.url,
    alt: FIGURA_BICO_NLDIV.alt,
    legenda: `Figura ${proximaFigura()} — ${FIGURA_BICO_NLDIV.legendaBase}`,
    larguraMax: FIGURA_BICO_NLDIV.larguraMax,
  });
  out.push({
    id: bid("p"),
    tipo: "paragraph",
    texto:
      "Na ponteira do bico se acoplará a NLDIV Wireless (Antena/leitor) que resultará no aumento do diâmetro externo.",
  });
  out.push({
    id: bid("img"),
    tipo: "image",
    url: FIGURA_PONTEIRA_NLDIV.url,
    alt: FIGURA_PONTEIRA_NLDIV.alt,
    legenda: `Figura ${proximaFigura()} — ${FIGURA_PONTEIRA_NLDIV.legendaBase}`,
    larguraMax: FIGURA_PONTEIRA_NLDIV.larguraMax,
  });
  out.push({
    id: bid("bl"),
    tipo: "bullets",
    itens: [
      "Ponteira de 1” + NLDIV = 1 7/8” ou 47mm;",
      "Ponteira de 3/4” + NLDIV = 1 3/8” ou 34mm;",
      "Ponteira de 1/2” + NLDIV = 1 3/16” ou 30mm.",
    ],
  });
  out.push({
    id: bid("a"),
    tipo: "alert",
    severidade: "info",
    codigo: "nivel2_bicos_homologados",
    texto:
      "ATENÇÃO: para possibilitar a instalação da Solução NLDIV Wireless, os Bicos de Abastecimento obrigatoriamente deverão ser de marca e modelo dos homologados pela IONICS.",
  });
  out.push({
    id: bid("p"),
    tipo: "paragraph",
    texto:
      "Marcas e Modelos de Bicos homologados: OPW 1”, 3/4” e 1/2”; Bremen 1”, 3/4” e 1/2”; Martinelli 1” Mod. MP-2. Todos eles com ponteira standard (140 a 160mm de comprimento).",
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
      "O suporte/descanso do bico deverá garantir que a NLDIV que será acoplada à ponteira não sofra impacto ou atrito que possa comprometer o seu funcionamento e/ou provocar a redução da vida útil; também precisará impedir que o corpo do bico se movimente enquanto o caminhão estiver transitando. Este último quesito é necessário para preservar a carga da bateria do Módulo Bico Wireless, já que o dispositivo é ativado quando balançado verticalmente com ângulo de 30°.",
  });
  out.push({
    id: bid("p"),
    tipo: "paragraph",
    texto:
      "Esboço (layout) sugerido para construção do “Suporte de Bico” a ser implementado nos Caminhões Comboio (de modo que atenda o acima citado) usando barra chata de ferro galvanizado 2” x 3/16” (50,80 x 4,75mm). No ato da instalação da automação o Agente Técnico Credenciado (ATC) escolherá o local adequado para fixá-lo com parafusos e porcas 5/16” x 1” ou 3/4” na parte superior/teto do compartimento.",
  });
  // Asset padrão do desenho verde do "Suporte de Bico" (pág. 10) ainda não
  // importado no projeto: bloco de imagem vazio para upload do especialista.
  out.push({
    id: bid("img"),
    tipo: "image",
    url: "",
    alt: "Desenho padrão do Suporte de Bico para Caminhões Comboio (asset padrão ausente)",
    legenda:
      "Desenho padrão ausente — anexe o esboço (layout) do “Suporte de Bico” em barra chata galvanizada para Caminhões Comboio.",
    larguraMax: 380,
  });

  return out;
}
