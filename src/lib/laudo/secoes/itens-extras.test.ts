import { describe, expect, it } from "vitest";
import { mesclarCatalogo } from "@/lib/escopo/catalogo-tipos";
import { arvoreVazia, type EntidadeEscopo } from "@/lib/escopo/tipos";
import { mesclarContextos, montarContextoLaudo, type RespostaDeEntidade } from "@/lib/laudo/contexto";
import { blocosItensExtras } from "./itens-extras";

const cat = mesclarCatalogo([{ chave: "predio", rotulo: "Prédio", plural: "Prédios" }]);
const ent = (id: string, ordem: number, nome?: string): EntidadeEscopo => ({ id, tipo: "predio", parent_id: null, ordem, rotulo: `Prédio ${String(ordem).padStart(2, "0")}${nome ? ` — ${nome}` : ""}`, dados: nome ? { nome } : {} });
const resp = (entidadeId: string, pergunta: string, valor: string | null): RespostaDeEntidade => ({ entidadeId, chave: null, valor, pergunta });
let n = 0;
const id = (p: string) => `${p}-${++n}`;
const montar = (entidades: EntidadeEscopo[], respostas: RespostaDeEntidade[]) =>
  montarContextoLaudo({ entidades, arvore: arvoreVazia(), respostas, catalogo: cat });

describe("seção dos tipos novos no documento", () => {
  it("sem itens de tipo novo, nada muda", () => {
    expect(blocosItensExtras({ contexto: montar([], []), id })).toBeNull();
    expect(blocosItensExtras({ contexto: null, id })).toBeNull();
    expect(montar([], []).extras).toBeUndefined();
  });

  it("vários itens e poucas perguntas: título, resumo e tabela com '—' no que faltou", () => {
    const ctx = montar([ent("a", 1, "Bloco A"), ent("b", 2)], [resp("a", "Andares", "5"), resp("b", "Andares", "3"), resp("a", "Elevador", "sim"), resp("b", "Elevador", "  ")]);
    const b = blocosItensExtras({ contexto: ctx, id })!;
    expect(b.map((x) => x.tipo)).toEqual(["heading", "paragraph", "table"]);
    expect((b[0] as any).texto).toBe("Prédios");
    expect((b[1] as any).texto).toBe("Foram mapeados 2 prédios: Prédio 01 — Bloco A, Prédio 02.");
    expect((b[2] as any).colunas).toEqual(["Item", "Andares", "Elevador"]);
    expect((b[2] as any).linhas.map((l: any) => l.celulas)).toEqual([["Prédio 01 — Bloco A", "5", "sim"], ["Prédio 02", "3", "—"]]);
  });

  it("muitas perguntas: um bloco por item, com 'Pergunta: resposta'", () => {
    const ps = ["P1", "P2", "P3", "P4", "P5"];
    const ctx = montar([ent("a", 1), ent("b", 2)], ps.flatMap((p) => [resp("a", p, "x"), resp("b", p, "y")]));
    const b = blocosItensExtras({ contexto: ctx, id })!;
    expect(b.map((x) => x.tipo)).toEqual(["heading", "paragraph", "heading", "bullets", "heading", "bullets"]);
    expect((b[3] as any).itens[0]).toBe("P1: x");
  });

  it("item único e singular no resumo; sem respostas só traz o resumo", () => {
    const b = blocosItensExtras({ contexto: montar([ent("a", 1)], []), id })!;
    expect(b.map((x) => x.tipo)).toEqual(["heading", "paragraph"]);
    expect((b[1] as any).texto).toBe("Foi mapeado 1 prédio: Prédio 01.");
  });

  it("chaves estáveis (não dependem do texto nem da ordem de geração)", () => {
    const ctx = montar([ent("a", 1), ent("b", 2)], [resp("a", "Andares", "5")]);
    const k1 = blocosItensExtras({ contexto: ctx, id })!.map((x) => (x as any).chave);
    const k2 = blocosItensExtras({ contexto: ctx, id: (p) => `${p}-novo`})!.map((x) => (x as any).chave);
    expect(k1).toEqual(k2);
    expect(k1.every((k) => String(k).startsWith("extra:predio:"))).toBe(true);
  });

  it("mesclar mapeamentos da mesma visita completa lacunas e não sobrescreve", () => {
    const a = montar([ent("a", 1)], [resp("a", "Andares", "5")]);
    const b = montar([ent("z", 1), ent("y", 2)], [resp("z", "Andares", "9"), resp("z", "Elevador", "sim")]);
    const m = mesclarContextos(a, [b]);
    expect(m.extras![0].itens).toHaveLength(2);
    expect(m.extras![0].itens[0].respostas).toEqual([{ pergunta: "Andares", valor: "5" }, { pergunta: "Elevador", valor: "sim" }]);
  });
});
