import { SLOTS_TEXTO, ehSlotTexto, type SlotTexto } from "./textos-padrao";
import { renumerar } from "./numeracao";
import type { BlocoLaudo } from "./tipos";

export const CONFIG_ORDEM_SECOES_ID = "7f3a6042-96bd-4c40-908a-d2b496460174";
export const CATEGORIA_ORDEM_SECOES = "configuracao_ordem_secoes";

export function normalizarOrdemSecoes(valor: unknown): SlotTexto[] {
  const salvos = Array.isArray(valor) ? valor.filter(ehSlotTexto) : [];
  return [...new Set([...salvos, ...SLOTS_TEXTO])];
}

const CHAVES: Record<string, SlotTexto> = {
  "dados:wifi": "wifi", "dados:gsm": "gsm", "dados:radio": "radio",
  "nivel2:secao": "nivel2", "rfid:titulo": "rfid", "div:titulo": "div", "tx:titulo": "tx",
  "consideracoes_finais:titulo": "consideracoes_finais",
};
const TITULOS: Record<string, SlotTexto> = {
  "Introdução": "introducao", "Equipamentos de TI e banco de dados": "ti_bd",
  "WiFi": "wifi", "GSM / 4G": "gsm", "Rádio 2.4GHz": "radio",
  "Instruções gerais": "instrucoes_gerais", "Considerações finais": "consideracoes_finais",
};
const ASSINATURAS: Record<string, SlotTexto> = {
  "introducao": "introducao", "equipamentos-de-ti-e-banco-de-dados": "ti_bd",
  "instrucoes-gerais": "instrucoes_gerais", "consideracoes-finais": "consideracoes_finais",
};

export function secaoDoTitulo(b: BlocoLaudo): SlotTexto | null {
  if (b.tipo !== "heading" || b.origem === "manual") return null;
  return CHAVES[b.chave ?? ""] ?? ASSINATURAS[(b.chave ?? "").replace(/^heading:\d:/, "")] ?? TITULOS[b.texto] ?? null;
}

type Titulo = Extract<BlocoLaudo, { tipo: "heading" }>;
type No = { titulo: Titulo; inicio: number; filhos: (No | BlocoLaudo)[] };
const ehNo = (item: No | BlocoLaudo): item is No => "filhos" in item;

/** Extracts complete configured sections, keeping their photos, tables and subheadings together. */
export function ordenarSecoesDocumento(blocos: BlocoLaudo[], ordem: SlotTexto[] | null): BlocoLaudo[] {
  if (!ordem) return blocos;
  const normalizada = normalizarOrdemSecoes(ordem);
  if (normalizada.every((slot, i) => slot === SLOTS_TEXTO[i])) {
    const presentes = blocos.map(secaoDoTitulo).filter((slot): slot is SlotTexto => slot !== null);
    const indices = presentes.map((slot) => normalizada.indexOf(slot));
    if (indices.every((indice, i) => indice >= (indices[i - 1] ?? -1))) return blocos;
  }
  const raizes: (No | BlocoLaudo)[] = [];
  const pilha: No[] = [];
  blocos.forEach((bloco, inicio) => {
    if (bloco.tipo === "heading") {
      while (pilha.length && (pilha.at(-1)?.titulo.nivel ?? 0) >= bloco.nivel) pilha.pop();
      const no: No = { titulo: bloco, inicio, filhos: [] };
      const pai = pilha.at(-1);
      (pai ? pai.filhos : raizes).push(no);
      pilha.push(no);
    } else {
      const pai = pilha.at(-1);
      (pai ? pai.filhos : raizes).push(bloco);
    }
  });
  const grupos: { inicio: number; slot: SlotTexto | null; conteudo: No | BlocoLaudo }[] = [];
  function separar(no: No): No | null {
    const filhos = no.filhos.flatMap<No | BlocoLaudo>((item) => {
      if (!ehNo(item)) return [item];
      const restante = separar(item);
      return restante ? [restante] : [];
    });
    const restante = { ...no, filhos };
    const slot = secaoDoTitulo(no.titulo);
    if (slot) {
      grupos.push({ inicio: no.inicio, slot, conteudo: restante });
      return null;
    }
    // Grouping headings with all children extracted must not become empty PDF sections.
    return no.filhos.length && !filhos.length ? null : restante;
  }
  for (const item of raizes) {
    if (ehNo(item)) {
      const restante = separar(item);
      if (restante) grupos.push({ inicio: item.inicio, slot: null, conteudo: restante });
    } else grupos.push({ inicio: blocos.indexOf(item), slot: null, conteudo: item });
  }
  grupos.sort((a, b) => a.inicio - b.inicio);
  const posicoes = new Map(normalizarOrdemSecoes(ordem).map((slot, i) => [slot, i]));
  const configurados = grupos.filter((g) => g.slot).sort((a, b) => (posicoes.get(a.slot as SlotTexto) ?? 0) - (posicoes.get(b.slot as SlotTexto) ?? 0));
  let cursor = 0;
  function achatar(no: No, nivelBase: number): BlocoLaudo[] {
    const nivel = Math.max(1, Math.min(4, no.titulo.nivel - nivelBase + 1)) as Titulo["nivel"];
    return [{ ...no.titulo, nivel }, ...no.filhos.flatMap((item) => ehNo(item) ? achatar(item, nivelBase) : [item])];
  }
  const resultado = grupos.flatMap((grupo) => {
    const escolhido = grupo.slot ? configurados[cursor++] ?? grupo : grupo;
    const item = escolhido.conteudo;
    if (!ehNo(item)) return [item];
    const raiz = escolhido.slot ? { ...item, titulo: { ...item.titulo, numero: item.titulo.numero ?? "1" } } : item;
    return achatar(raiz, raiz.titulo.nivel);
  });
  return renumerar(resultado);
}