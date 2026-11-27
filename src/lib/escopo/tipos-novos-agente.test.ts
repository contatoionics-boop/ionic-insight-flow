import { describe, expect, it } from "vitest";
import { montarArvore } from "./arvore-perguntas";
import { mesclarCatalogo, titulosDosTipos } from "./catalogo-tipos";
import { montarNavegacao, type ItemNav } from "./navegacao-entidades";
import { montarOrientacoes } from "./orientacoes";
import { arvoreVazia, type EntidadeEscopo } from "./tipos";

const ent = (id: string, tipo: string, ordem: number, rotulo: string): EntidadeEscopo => ({ id, tipo, parent_id: null, ordem, rotulo });
const item = (id: string, entidadeId: string | null): ItemNav => ({
  id,
  entidadeId,
  obrigatoria: true,
  respondida: false,
  completa: false,
  texto: "Pergunta",
  valor: "",
  etapaId: "e1",
  etapaTitulo: "Etapa 1",
  etapaOrdem: 1,
});

const entidades = [ent("p1", "predio", 1, "Prédio 01"), ent("p2", "predio", 2, "Prédio 02"), ent("c1", "comboio", 1, "Comboio 01"), ent("x1", "produto", 1, "Produto 01")];

describe("tipos novos no checklist do agente", () => {
  it("navegação: um grupo por tipo novo, com sequência 'próximo'", () => {
    const m = montarNavegacao(entidades, [item("a", "p1"), item("b", "p2"), item("c", "c1"), item("d", "x1")]);
    expect(m.extras.map((g) => [g.tipo, g.unidades.length])).toEqual([
      ["predio", 2],
      ["produto", 1],
    ]);
    expect(m.outros).toEqual([]);
    expect(m.proxima("p1")?.id).toBe("p2");
    expect(m.proxima("p2")).toBeNull();
  });

  it("árvore de perguntas (revisão): grupo próprio com o plural do catálogo, antes da frota", () => {
    const cat = mesclarCatalogo([{ chave: "predio", rotulo: "Prédio", plural: "Prédios" }]);
    const { grupos } = montarArvore(entidades, [item("a", "p1"), item("c", "c1")], (p) => p.entidadeId, new Map(), titulosDosTipos(cat));
    expect(grupos.map((g) => [g.chave, g.titulo])).toEqual([
      ["comboios", "Comboios"],
      ["tipo:predio", "Prédios"],
    ]);
  });

  it("orientações ao agente citam os tipos novos", () => {
    const cat = mesclarCatalogo([{ chave: "predio", rotulo: "Prédio", plural: "Prédios" }]);
    const texto = montarOrientacoes(null, { ...arvoreVazia(), extras: { predio: [{}, {}] } }, "", cat);
    expect(texto).toContain("2 prédios");
  });
});
