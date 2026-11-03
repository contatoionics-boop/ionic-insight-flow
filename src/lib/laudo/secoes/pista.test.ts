import { describe, expect, it } from "vitest";
import { montarContextoLaudo } from "@/lib/laudo/contexto";
import { arvoreVazia, type EntidadeEscopo } from "@/lib/escopo/tipos";
import { montarBlocos } from "@/lib/laudo/template";
import { blocosPista } from "./pista";

const ent = (id: string, tipo: EntidadeEscopo["tipo"], rotulo: string, parent_id: string | null, ordem = 0): EntidadeEscopo => ({ id, tipo, rotulo, parent_id, ordem });
const r = (entidadeId: string | null, chave: string, valor: string) => ({ entidadeId, chave, valor });
const ids = (p: string) => `${p}-x`;

// 3 bombas: a 1ª mecânica Wayne, a 2ª eletrônica Gilbarco, a 3ª de alta vazão sem bico
const entidades = [
  ent("p1", "posto", "Posto 01", null), ent("i1", "ilha", "Ilha 01", "p1"),
  ent("b1", "bomba", "Bomba 01", "i1", 0), ent("b2", "bomba", "Bomba 02", "i1", 1), ent("b3", "bomba", "Bomba 03", "i1", 2),
  ent("k1", "bico", "Bico 01", "b1"), ent("k2", "bico", "Bico 01", "b2"), ent("k2b", "bico", "Bico 02", "b2"),
];
const respostas = [
  r("b1", "tipo_bomba", "Mecânica"), r("b1", "marca_bomba", "Wayne"), r("b1", "combustivel", "Diesel S10"), r("b1", "vazao", "30"), r("b1", "tensao_bomba", "220VCA"),
  r("b1", "marca_registrador", "Veeder"), r("b1", "altura_registrador", "1,6 m"), r("k1", "bitola_mangueira", '3/4"'), r("k1", "bitola_bico", '3/4"'), r("k1", "marca_bico", "OPW"),
  r("b2", "tipo_bomba", "Eletrônica"), r("b2", "marca_bomba", "Gilbarco"), r("b2", "combustivel", "Etanol"), r("k2", "bitola_bico", '1"'), r("k2b", "bitola_bico", '1"'),
  r("b3", "combustivel", "Diesel S500"), r("b3", "alta_vazao", "sim"), r("b3", "bico_ausente", "sim"),
];
const contexto = montarContextoLaudo({ entidades, arvore: { ...arvoreVazia(), postos: [{ ilhas: [] }] }, respostas });
const textos = (blocos: any[], id: string) => JSON.stringify(blocos.filter((b) => b.chave?.startsWith(`bomba:${id}:`)));

describe("Pista por bomba", () => {
  const blocos = blocosPista({ contexto, nivel: "nivel_1", id: ids }) as any[];

  it("um grupo por bomba do Escopo, com chaves estáveis pela entidade", () => {
    const titulos = blocos.filter((b) => b.tipo === "heading").map((b) => [b.chave, b.texto, b.numero]);
    expect(titulos).toEqual([["bomba:b1:titulo", "Bomba 01", "2.3.1"], ["bomba:b2:titulo", "Bomba 02", "2.3.2"], ["bomba:b3:titulo", "Bomba 03", "2.3.3"]]);
    const chaves = blocos.map((b) => b.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });
  it("o resumo usa só as respostas da própria bomba", () => {
    const b1 = textos(blocos, "b1");
    expect(b1).toContain("bomba mecânica Wayne");
    expect(b1).toContain("operando com Diesel S10");
    expect(b1).toContain("Registrador existente Veeder, instalado a 1,6 m do piso");
    expect(b1).not.toContain("Gilbarco");
    expect(textos(blocos, "b2")).toContain("bomba eletrônica Gilbarco");
    expect(textos(blocos, "b2")).not.toContain("Wayne");
  });
  it("bicos: quantidade vem das entidades do Escopo; bomba sem bico é dita como tal", () => {
    expect(textos(blocos, "b1")).toContain("A bomba possui 1 bico de abastecimento");
    expect(textos(blocos, "b2")).toContain("A bomba possui 2 bicos de abastecimento");
    expect(textos(blocos, "b3")).toContain("A bomba não possui bico de abastecimento.");
  });
  it("pontos de atenção: alta vazão sem bico e recomendações da própria bomba", () => {
    const itens = (id: string) => (blocos.find((b) => b.chave === `bomba:${id}:pontos_atencao`)?.itens ?? []).join(" | ");
    expect(itens("b3")).toContain("alta vazão");
    expect(itens("b3")).toContain("sem bico");
    expect(itens("b2")).toContain("Bomba eletrônica");
    expect(itens("b1")).toContain("Bomba mecânica");
    expect(itens("b1")).not.toContain("alta vazão");
  });
  it("o Escopo manda: bico cadastrado vence a resposta 'sem bico' (sem contradizer a tabela do Projeto)", () => {
    const c = montarContextoLaudo({ entidades, arvore: { ...arvoreVazia(), postos: [{ ilhas: [] }] }, respostas: [...respostas, r("b1", "bico_ausente", "sim"), r("b1", "alta_vazao", "sim")] });
    const bl = blocosPista({ contexto: c, nivel: "nivel_1", id: ids }) as any[];
    expect(textos(bl, "b1")).toContain("A bomba possui 1 bico de abastecimento");
    expect(textos(bl, "b1")).not.toContain("não possui bico");
    expect(textos(bl, "b1")).not.toContain("sem bico");
  });
  it("sem bombas no Escopo não cria a seção", () => {
    const c = montarContextoLaudo({ entidades: [], arvore: arvoreVazia(), respostas: [] });
    expect(blocosPista({ contexto: c, nivel: null, id: ids })).toBeNull();
    expect(blocosPista({ contexto: null, nivel: null, id: ids })).toBeNull();
  });
});

describe("Pista por bomba no documento", () => {
  const cab = { cliente: "C", unidade: "U", data: "01/01/2026", agente: "A", especialista: "P", modalidade: "remoto" };
  it("o Objeto do mapeamento vem das bombas, sem a pendência de identificação dos objetos", () => {
    const b = montarBlocos({ variaveis: {}, materiais: [], cabecalho: cab, contexto }) as any[];
    expect(b.some((x) => x.chave === "bomba:b2:resumo")).toBe(true);
    const i = b.findIndex((x) => x.chave === "pista:titulo");
    expect(i).toBeGreaterThan(-1);
    expect(b[i].texto).toBe("Objeto do mapeamento");
    expect(b.findIndex((x) => x.chave === "bomba:b1:titulo")).toBeGreaterThan(i);
    expect(JSON.stringify(b)).not.toContain("identificação dos objetos");
  });
  it("sem Escopo estruturado o fluxo anterior continua", () => {
    const b = montarBlocos({ variaveis: {}, materiais: [], cabecalho: cab }) as any[];
    expect(b.some((x) => x.chave?.startsWith("bomba:"))).toBe(false);
    expect(JSON.stringify(b)).toContain("identificação dos objetos");
  });
});
