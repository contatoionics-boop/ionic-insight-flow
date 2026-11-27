// Blocos padrão com condição de aparição ("regras em dados"), client-safe, funções puras.
//
// O especialista cadastra um texto padrão na tela "Blocos padrão" e diz quando ele entra sozinho no
// documento (solução, nível, itens do Escopo). A condição fica na coluna `escopo` (jsonb) do bloco padrão:
//   { automatico: true, solucao: ["ssg_frota"], nivel: ["nivel_2"], exige: ["comboio", "tx"] }
// Condição vazia em um campo = "qualquer". Todos os campos preenchidos precisam ser atendidos.

import type { ContextoLaudo } from "./contexto";
import { SLUG_CAMPO, SLUG_OPCAO, camposAtuais, rotuloOpcao } from "@/lib/opcoes-agendamento";
import { SLUG_TIPO, rotuloDoTipo, tiposNovos, type TipoCatalogo } from "@/lib/escopo/catalogo-tipos";
import type { BlocoLaudo } from "./tipos";

export const EXIGENCIAS = ["pista", "comboio", "rfid", "tx", "frota"] as const;
/** Item do Escopo exigido: os fixos acima ou a chave de um tipo criado em Configurações › Tipos de item (ex.: "predio"). */
export type Exigencia = (typeof EXIGENCIAS)[number] | (string & {});

export const ROTULO_EXIGENCIA: Record<(typeof EXIGENCIAS)[number], string> = {
  pista: "Posto / pista",
  comboio: "Comboio",
  rfid: "Cartão RFID",
  tx: "Telemetria TX",
  frota: "DIV / frota",
};
export const SOLUCOES_REGRA = [
  { valor: "ssg_frota", rotulo: "SSGFrota" },
  { valor: "on_premise", rotulo: "On-premise" },
] as const;
export const NIVEIS_REGRA = [
  { valor: "nivel_1", rotulo: "Nível 1" },
  { valor: "nivel_2", rotulo: "Nível 2" },
  { valor: "nivel_3", rotulo: "Nível 3" },
] as const;

/** Nome da exigência: os fixos, ou o do tipo novo no catálogo. */
export const rotuloExigencia = (x: Exigencia, catalogo?: TipoCatalogo[] | null): string =>
  (ROTULO_EXIGENCIA as Record<string, string>)[x] ?? rotuloDoTipo(catalogo, x);

/** Opções de "Só quando o Escopo tiver": os itens fixos e os tipos novos (os ocultos só se já estiverem marcados). */
export function opcoesExigencia(catalogo?: TipoCatalogo[] | null, marcados: string[] = []): { valor: string; rotulo: string }[] {
  // tipo que fica dentro de outro (tem pai) não vira opção: a condição vale pelo tipo de cima (a menos que já esteja marcado)
  const novos = tiposNovos(catalogo).filter((t) => marcados.includes(t.chave) || (t.ativo && !t.pai));
  return [...EXIGENCIAS.map((x) => ({ valor: x as string, rotulo: ROTULO_EXIGENCIA[x] })), ...novos.map((t) => ({ valor: t.chave, rotulo: t.rotulo }))];
}

/** Onde o bloco adicional automático entra no documento. */
export const POSICOES_BLOCO = ["apos_introducao", "antes_instrucoes", "fim"] as const;
export type PosicaoBloco = (typeof POSICOES_BLOCO)[number];
export const ROTULO_POSICAO: Record<PosicaoBloco, string> = {
  apos_introducao: "Logo após a Introdução",
  antes_instrucoes: "Antes das Instruções gerais",
  fim: "No fim do documento (depois das Instruções e das Considerações finais)",
};

export type RegraBlocoPadrao = {
  automatico: boolean;
  solucao: string[];
  nivel: string[];
  exige: Exigencia[];
  /** campos criados em Opções do agendamento (ex.: "Tipo de mapeamento"): campo → opções aceitas (vazio = qualquer) */
  extras?: Record<string, string[]>;
  posicao: PosicaoBloco;
};

export type BlocoPadraoAuto = { id: string; nome: string; escopo: Record<string, any> | null; blocos: BlocoLaudo[]; ordem?: number };

const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Condições dos campos criados em Opções do agendamento: só chaves válidas e listas não vazias. */
export function lerExtras(v: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const [campo, valores] of Object.entries(v as Record<string, unknown>)) {
      const l = lista(valores).filter((x) => SLUG_OPCAO.test(x));
      if (SLUG_CAMPO.test(campo) && l.length) out[campo] = l;
    }
  }
  return out;
}

/** Quantas condições de campos novos a regra tem (entra na "especificidade" de uma versão de texto). */
export const qtdCondicoesExtras = (r: Pick<RegraBlocoPadrao, "extras">): number => Object.keys(lerExtras(r.extras)).length;

/** Lê a regra gravada em `escopo`; qualquer coisa fora do formato vira "sem regra". */
export function lerRegra(escopo: Record<string, any> | null | undefined): RegraBlocoPadrao {
  const e = escopo ?? {};
  return {
    automatico: e.automatico === true,
    solucao: lista(e.solucao),
    nivel: lista(e.nivel),
    ...(Object.keys(lerExtras(e.extras)).length ? { extras: lerExtras(e.extras) } : {}),
    exige: lista(e.exige).filter((x) => (EXIGENCIAS as readonly string[]).includes(x) || SLUG_TIPO.test(x)),
    posicao: (POSICOES_BLOCO as readonly string[]).includes(e.posicao) ? e.posicao : "antes_instrucoes",
  };
}

/** Grava a regra no formato de `escopo` (campos vazios não são gravados). */
export function regraParaEscopo(r: RegraBlocoPadrao): Record<string, any> {
  if (!r.automatico) return {};
  return {
    automatico: true,
    ...(r.solucao.length ? { solucao: r.solucao } : {}),
    ...(r.nivel.length ? { nivel: r.nivel } : {}),
    ...(r.exige.length ? { exige: r.exige } : {}),
    ...(qtdCondicoesExtras(r) ? { extras: lerExtras(r.extras) } : {}),
    ...(r.posicao && r.posicao !== "antes_instrucoes" ? { posicao: r.posicao } : {}),
  };
}

/** Resumo legível da regra, para a lista de blocos padrão. */
export function resumoDaRegra(r: RegraBlocoPadrao, catalogo?: TipoCatalogo[] | null): string {
  if (!r.automatico) return "Inserção manual";
  const partes: string[] = [];
  if (r.solucao.length) partes.push(r.solucao.map((s) => rotuloOpcao("solucao", s) ?? s).join(" ou "));
  if (r.nivel.length) partes.push(r.nivel.map((n) => rotuloOpcao("nivel", n) ?? n).join(" ou "));
  if (r.exige.length) partes.push(`com ${r.exige.map((x) => rotuloExigencia(x, catalogo)).join(" e ")}`);
  for (const [campo, valores] of Object.entries(lerExtras(r.extras))) {
    const titulo = camposAtuais().find((c) => c.campo === campo)?.titulo ?? campo;
    partes.push(`${titulo}: ${valores.map((v) => rotuloOpcao(campo, v) ?? v).join(" ou ")}`);
  }
  if (r.posicao !== "antes_instrucoes") partes.push(r.posicao === "fim" ? "no fim" : "após a Introdução");
  return `Automático${partes.length ? `: ${partes.join(" · ")}` : ": em todos os documentos"}`;
}

export type AvaliacaoRegra = {
  nivel: string | null;
  contexto: ContextoLaudo | null;
  /** escolhas do caso nos campos criados em Opções do agendamento ({ campo: valor }) */
  camposExtras?: Record<string, string> | null;
};

/** A regra é atendida pelo caso? Dado desconhecido nunca satisfaz uma condição (não inclui por engano). */
export function regraAtende(r: RegraBlocoPadrao, a: AvaliacaoRegra): boolean {
  if (!r.automatico) return false;
  return condicoesAtendidas(r, a);
}

/** Só as condições (solução, nível, itens do Escopo), sem exigir o flag "automático" (usado pelas versões de texto). */
export function condicoesAtendidas(r: RegraBlocoPadrao, a: AvaliacaoRegra): boolean {
  const e = a.contexto?.escopo;
  if (r.solucao.length && (!e?.solucao || !r.solucao.includes(e.solucao))) return false;
  if (r.nivel.length && (!a.nivel || !r.nivel.includes(a.nivel))) return false;
  // campos novos do agendamento: o valor escolhido no caso precisa estar entre os aceitos (sem escolha não atende)
  for (const [campo, aceitos] of Object.entries(lerExtras(r.extras))) {
    const escolhido = a.camposExtras?.[campo];
    if (!escolhido || !aceitos.includes(escolhido)) return false;
  }
  const tem: Record<string, boolean> = {
    pista: !!e?.temPista,
    comboio: !!e?.temComboio,
    rfid: !!e?.rfid.ativo,
    tx: !!e?.tx.ativo,
    frota: !!e?.frota.ativa,
  };
  // tipo novo (Prédio, Produto…): há ao menos um item dele no escopo, em qualquer nível
  return r.exige.every((x) => (x in tem ? tem[x] : (e?.qtdPorTipo?.[x] ?? 0) > 0));
}

/**
 * Blocos dos padrões automáticos que se aplicam ao caso. Cada bloco ganha chave estável
 * (`padrao:<id>:<posição>`): a edição do especialista sobrevive ao "Regerar rascunho".
 * O título de seção vira título numerado automaticamente.
 */
export function blocosPadraoAutomaticos(
  padroes: BlocoPadraoAuto[],
  a: AvaliacaoRegra,
  id: (prefixo: string) => string,
  posicao: PosicaoBloco = "antes_instrucoes",
): BlocoLaudo[] {
  const saida: BlocoLaudo[] = [];
  const ordenados = [...padroes].sort((x, y) => (x.ordem ?? 0) - (y.ordem ?? 0) || x.nome.localeCompare(y.nome));
  for (const p of ordenados) {
    const regra = lerRegra(p.escopo);
    if (regra.posicao !== posicao || !regraAtende(regra, a)) continue;
    (p.blocos ?? []).forEach((b, i) => {
      const base = { ...b, id: id("bp"), chave: `padrao:${p.id}:${i}`, origem: "dynamic", editavel: true, removivel: true } as any;
      saida.push(b.tipo === "heading" ? ({ ...base, numero: "0", nivel: 2 } as BlocoLaudo) : (base as BlocoLaudo));
    });
  }
  return saida;
}

/** Algum padrão automático aplicável exige este item do Escopo? (ex.: o texto da TX cadastrado substitui o espaço vazio) */
export function padraoCobre(padroes: BlocoPadraoAuto[], a: AvaliacaoRegra, item: Exigencia): boolean {
  return padroes.some((p) => {
    const r = lerRegra(p.escopo);
    return r.exige.includes(item) && regraAtende(r, a) && (p.blocos ?? []).length > 0;
  });
}
