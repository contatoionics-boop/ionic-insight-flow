import { describe, expect, it } from "vitest";
import { montarContextoLaudo } from "@/lib/laudo/contexto";
import { arvoreVazia, type EntidadeEscopo } from "@/lib/escopo/tipos";
import { montarBlocos } from "@/lib/laudo/template";
import { blocosComboio } from "./comboio";

const ent = (id: string, tipo: EntidadeEscopo["tipo"], rotulo: string, parent_id: string | null, ordem = 0): EntidadeEscopo => ({ id, tipo, rotulo, parent_id, ordem });
const r = (entidadeId: string | null, chave: string, valor: string) => ({ entidadeId, chave, valor });
const ids = (p: string) => `${p}-x`;

// 2 comboios: o 1º (Comboio 400) completo, com 2 bicos; o 2º sem respostas, com 1 bico
const entidades = [
  ent("c1", "comboio", "Comboio 01", null, 0), ent("c2", "comboio", "Comboio 02", null, 1),
  ent("k1", "bico", "Bico 01", "c1"), ent("k2", "bico", "Bico 02", "c1", 1), ent("k3", "bico", "Bico 01", "c2"),
];
const respostas = [
  r("c1", "identificacao_comboio", "Comboio 400"), r("c1", "marca_veiculo", "Volvo"), r("c1", "modelo_veiculo", "FH"), r("c1", "placa_comboio", "ABC1D23"), r("c1", "tensao_veiculo", "24VCC"),
  r("c1", "qtd_blocos_medidores", "2"), r("c1", "marca_bloco_medidor", "Liquid Controls"), r("c1", "diametro_saida_bloco", '2"'),
  r("c1", "possui_carretel", "sim"), r("c1", "retorno_area_cobertura", "nao"), r("c1", "distancia_frente", "0,5"), r("c1", "distancia_atras", "0,4"),
  r("k1", "bitola_mangueira", '3/4"'), r("k1", "bitola_bico", '3/4"'), r("k2", "bitola_bico", '3/4"'),
];
const contexto = montarContextoLaudo({ entidades, arvore: arvoreVazia(), respostas });
const textos = (blocos: any[], id: string) => JSON.stringify(blocos.filter((b) => b.chave?.startsWith(`comboio:${id}:`)));

describe("Caminhão comboio por unidade", () => {
  const blocos = blocosComboio({ contexto, id: ids }) as any[];

  it("título da seção e um grupo por comboio, com chaves estáveis pela entidade", () => {
    expect(blocos[0]).toMatchObject({ chave: "comboio:titulo", texto: "Caminhão comboio", nivel: 2 });
    const grupos = blocos.filter((b) => b.tipo === "heading" && b.nivel === 3).map((b) => [b.chave, b.texto, b.numero]);
    expect(grupos).toEqual([["comboio:c1:titulo", "Comboio 400", "2.4.1"], ["comboio:c2:titulo", "Comboio 02", "2.4.2"]]);
    const chaves = blocos.map((b) => b.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });
  it("o resumo usa só as respostas do próprio comboio", () => {
    expect(textos(blocos, "c1")).toContain("é um veículo Volvo FH, placa ABC1D23, alimentado em 24VCC");
    expect(textos(blocos, "c2")).not.toContain("Volvo");
  });
  it("comboio sem dados do veículo vira pendência, nunca texto inventado", () => {
    expect(textos(blocos, "c2")).toContain("[CONFIRMAR: marca e modelo do veículo]");
  });
  it("bicos e medição vêm do Escopo e das respostas", () => {
    expect(textos(blocos, "c1")).toContain("O comboio possui 2 bicos de abastecimento, com mangueira de 3/4");
    expect(textos(blocos, "c2")).toContain("O comboio possui 1 bico de abastecimento");
    expect(textos(blocos, "c1")).toContain("2 sistemas de abastecimento (bloco medidor)");
    const um = montarContextoLaudo({ entidades, arvore: arvoreVazia(), respostas: [...respostas, r("c2", "qtd_blocos_medidores", "1")] });
    expect(textos(blocosComboio({ contexto: um, id: ids }) as any[], "c2")).toContain("1 sistema de abastecimento");
    expect(textos(blocos, "c1")).toContain("Bloco medidor Liquid Controls, com saída de 2");
    expect(textos(blocos, "c1")).toContain("frente 0,5 m, atrás 0,4 m");
  });
  it("pontos de atenção só do comboio que os tem", () => {
    const itens = (id: string) => (blocos.find((b) => b.chave === `comboio:${id}:pontos_atencao`)?.itens ?? []).join(" | ");
    expect(itens("c1")).toContain("carretel");
    expect(itens("c1")).toContain("GSM/4G");
    expect(blocos.some((b) => b.chave === "comboio:c2:pontos_atencao")).toBe(false);
  });
  it("tabelas de equipamentos e materiais por comboio nascem com 3 linhas em branco", () => {
    for (const id of ["c1", "c2"]) {
      for (const t of ["equipamentos", "materiais"]) {
        const b = blocos.find((x) => x.chave === `comboio:${id}:${t}`);
        expect(b.linhas).toHaveLength(3);
        expect(b.linhas.every((l: any) => l.celulas.every((c: string) => c === ""))).toBe(true);
      }
    }
  });
  it("sem comboios no Escopo a seção não existe", () => {
    const c = montarContextoLaudo({ entidades: [], arvore: arvoreVazia(), respostas: [] });
    expect(blocosComboio({ contexto: c, id: ids })).toBeNull();
    expect(blocosComboio({ contexto: null, id: ids })).toBeNull();
  });
});

describe("Caminhão comboio no documento", () => {
  const cab = { cliente: "C", unidade: "U", data: "01/01/2026", agente: "A", especialista: "P", modalidade: "remoto" };
  it("entra antes de Bicos de abastecimento quando há comboios, e não entra sem eles", () => {
    const b = montarBlocos({ variaveis: {}, materiais: [], cabecalho: cab, contexto }) as any[];
    const i = b.findIndex((x) => x.chave === "comboio:titulo");
    expect(i).toBeGreaterThan(-1);
    expect(b.findIndex((x) => x.tipo === "heading" && x.texto === "Bicos de abastecimento")).toBeGreaterThan(i);
    const sem = montarBlocos({ variaveis: {}, materiais: [], cabecalho: cab }) as any[];
    expect(sem.some((x) => x.chave?.startsWith("comboio:"))).toBe(false);
  });
});
