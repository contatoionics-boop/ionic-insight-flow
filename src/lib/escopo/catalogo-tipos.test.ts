import { describe, expect, it } from "vitest";
import {
  CATALOGO_PADRAO,
  TIPOS_SISTEMA,
  mesclarCatalogo,
  opcoesAplicaA,
  opcoesSugerir,
  podeOcultarTipo,
  slugDoNome,
  tipoVisivel,
  tiposNovosAtivos,
} from "./catalogo-tipos";
import {
  ROTULO_TIPO,
  arvoreDeEntidades,
  entidadesDesejadas,
  normalizarArvore,
  quantidadesDoEscopo,
  resumoArvore,
  rotuloEntidade,
  tipoEntidadeDaAplicacao,
  type ArvoreEscopo,
  type EntidadeEscopo,
} from "./tipos";

const base = (): ArvoreEscopo => ({
  postos: [],
  comboios: [],
  tanquesLubrificante: [],
  sondas: [],
  frota: { ativo: false, itens: [] },
  config: {},
});

describe("catálogo de tipos de item", () => {
  it("o padrão tem os mesmos nomes de ROTULO_TIPO (renomear não pode ser disparado sem querer)", () => {
    for (const t of TIPOS_SISTEMA) expect(t.rotulo).toBe((ROTULO_TIPO as Record<string, string>)[t.chave]);
  });

  it("sem linhas do banco vale o padrão; com linhas, só o nome/visibilidade do sistema muda", () => {
    expect(mesclarCatalogo(null)).toEqual(CATALOGO_PADRAO);
    const cat = mesclarCatalogo([
      { chave: "comboio", rotulo: "Caminhão-comboio", plural: "Caminhões-comboio", ativo: false },
      { chave: "ilha", rotulo: "Ilha", plural: "Ilhas", ativo: false }, // filho: nunca oculto
    ]);
    const comboio = cat.find((t) => t.chave === "comboio")!;
    expect(comboio).toMatchObject({ rotulo: "Caminhão-comboio", plural: "Caminhões-comboio", ativo: false, sistema: true });
    expect(cat.find((t) => t.chave === "ilha")!.ativo).toBe(true);
    expect(podeOcultarTipo("ilha")).toBe(false);
    expect(podeOcultarTipo("comboio")).toBe(true);
  });

  it("tipo novo: aceita chave válida e ignora reservada ou inválida", () => {
    const cat = mesclarCatalogo([
      { chave: "predio", rotulo: "Prédio", plural: "Prédios" },
      { chave: "pista", rotulo: "Pista" }, // reservada
      { chave: "Chave Ruim", rotulo: "X" },
      { chave: "sem_nome", rotulo: "" },
    ]);
    expect(cat.filter((t) => !t.sistema).map((t) => t.chave)).toEqual(["predio"]);
    expect(tiposNovosAtivos(cat)).toHaveLength(1);
  });

  it("slugDoNome tira acento, evita reservadas e repetidas", () => {
    expect(slugDoNome("Prédio", [])).toBe("predio");
    expect(slugDoNome("Prédio", ["predio"])).toBe("predio_2");
    expect(slugDoNome("Posto", [])).not.toBe("posto");
    expect(slugDoNome("123", [])).toMatch(/^[a-z]/);
    expect(slugDoNome("%%", [])).toMatch(/^[a-z][a-z0-9_]{1,40}$/);
  });

  it("opções de Aplica-se a e Sugerir vêm do catálogo; oculto sai (menos o já gravado)", () => {
    const cat = mesclarCatalogo([
      { chave: "predio", rotulo: "Prédio", plural: "Prédios" },
      { chave: "sonda", rotulo: "Sonda", plural: "Sondas", ativo: false },
    ]);
    const aplica = opcoesAplicaA(cat).map((o) => o.value);
    expect(aplica).toContain("predio");
    expect(aplica).not.toContain("sonda");
    expect(opcoesAplicaA(cat, ["sonda"]).map((o) => o.value)).toContain("sonda");
    expect(opcoesAplicaA(null).map((o) => o.label)).toContain("Tanque com lubrificante");
    expect(opcoesSugerir(cat).map((o) => o.value)).toEqual(["pista", "comboio", "tanque_lubrificante", "frota", "predio"]);
  });

  it("seção só some quando oculta E vazia", () => {
    const cat = mesclarCatalogo([{ chave: "comboio", rotulo: "Comboio", plural: "Comboios", ativo: false }]);
    expect(tipoVisivel(cat, "comboio", 0)).toBe(false);
    expect(tipoVisivel(cat, "comboio", 2)).toBe(true);
    expect(tipoVisivel(cat, "posto", 0)).toBe(true);
  });
});

describe("árvore com tipos novos (extras)", () => {
  it("árvore antiga, sem extras, segue igual", () => {
    const a = normalizarArvore(base());
    expect(a.extras).toBeUndefined();
    expect(entidadesDesejadas(a)).toEqual([]);
  });

  it("normaliza: chaves inválidas e listas vazias somem, nomes são aparados", () => {
    const a = normalizarArvore({ ...base(), extras: { predio: [{ nome: " A " }, {}], vazio: [], "Ruim!": [{}], posto: [{}] } });
    expect(a.extras).toEqual({ predio: [{ nome: "A" }, { nome: undefined }] });
  });

  it("gera entidades com rótulo do catálogo e volta idêntico para a árvore", () => {
    const cat = mesclarCatalogo([{ chave: "predio", rotulo: "Prédio", plural: "Prédios" }]);
    const a = normalizarArvore({ ...base(), extras: { predio: [{ nome: "A" }, {}] } });
    const d = entidadesDesejadas(a, cat);
    expect(d.map((x) => x.rotulo)).toEqual(["Prédio 01 — A", "Prédio 02"]);
    expect(d.map((x) => x.chave)).toEqual(["predio:1", "predio:2"]);

    const entidades: EntidadeEscopo[] = d.map((x, i) => ({ id: `e${i}`, tipo: x.tipo, parent_id: null, ordem: x.ordem, rotulo: x.rotulo, dados: x.nome ? { nome: x.nome } : {} }));
    expect(arvoreDeEntidades(entidades).extras).toEqual({ predio: [{ nome: "A" }, {}] });
    expect(resumoArvore(a).extras).toEqual({ predio: 2 });
    expect(quantidadesDoEscopo(a).predio).toBe(2);
  });

  it("rótulo dos tipos do sistema não muda sem catálogo e muda com o nome configurado", () => {
    expect(rotuloEntidade("comboio", 1, "Frota 400")).toBe("Comboio 01 — Frota 400");
    const cat = mesclarCatalogo([{ chave: "comboio", rotulo: "Caminhão", plural: "Caminhões" }]);
    expect(rotuloEntidade("comboio", 1, null, cat)).toBe("Caminhão 01");
    expect(rotuloEntidade("frota", 1, null, cat)).toBe("Frota / DIV");
  });

  it("'Aplica-se a' de tipo novo vira o tipo da entidade; geral não", () => {
    expect(tipoEntidadeDaAplicacao("predio")).toBe("predio");
    expect(tipoEntidadeDaAplicacao("geral")).toBeNull();
    expect(tipoEntidadeDaAplicacao("div")).toBe("frota");
    expect(tipoEntidadeDaAplicacao(null)).toBeNull();
  });
});
