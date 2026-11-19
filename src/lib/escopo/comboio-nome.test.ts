import { describe, expect, it } from "vitest";
import { arvoreDeEntidades, arvoreVazia, entidadesDesejadas, normalizarArvore, rotuloEntidade, type EntidadeEscopo } from "./tipos";

const ent = (id: string, tipo: EntidadeEscopo["tipo"], ordem: number, rotulo: string, parent_id: string | null = null, nome?: string): EntidadeEscopo =>
  ({ id, tipo, ordem, rotulo, parent_id, ...(nome ? { dados: { nome } } : {}) });

describe("identificação opcional do comboio no Escopo", () => {
  it("normaliza: guarda o nome sem espaços e não cria a chave quando vazio", () => {
    const a = normalizarArvore({ ...arvoreVazia(), comboios: [{ tanques: 1, bicos: 1, nome: "  Frota 400  " }, { tanques: 0, bicos: 2, nome: "   " }, { tanques: 0, bicos: 0 }] });
    expect(a.comboios).toEqual([{ tanques: 1, bicos: 1, nome: "Frota 400" }, { tanques: 0, bicos: 2 }, { tanques: 0, bicos: 0 }]);
    expect("nome" in a.comboios[1]).toBe(false);
  });
  it("vira nome da entidade e o rótulo leva a identificação, como tanques e sondas", () => {
    const d = entidadesDesejadas({ ...arvoreVazia(), comboios: [{ tanques: 0, bicos: 1, nome: "Frota 400" }, { tanques: 0, bicos: 0 }] }).filter((e) => e.tipo === "comboio");
    expect(d.map((e) => [e.chave, e.rotulo, e.nome])).toEqual([["comboio:1", "Comboio 01 — Frota 400", "Frota 400"], ["comboio:2", "Comboio 02", undefined]]);
    expect(rotuloEntidade("comboio", 1, "Frota 400")).toBe("Comboio 01 — Frota 400");
  });
  it("ao reconstruir a árvore das entidades, o nome volta", () => {
    const a = arvoreDeEntidades([ent("c1", "comboio", 1, "Comboio 01 — Frota 400", null, "Frota 400"), ent("c2", "comboio", 2, "Comboio 02")]);
    expect(a.comboios).toEqual([{ tanques: 0, bicos: 0, nome: "Frota 400" }, { tanques: 0, bicos: 0 }]);
  });
});
