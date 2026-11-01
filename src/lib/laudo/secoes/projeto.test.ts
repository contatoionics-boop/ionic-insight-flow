import { describe, expect, it } from "vitest";
import { montarContextoLaudo } from "@/lib/laudo/contexto";
import { arvoreVazia, type EntidadeEscopo } from "@/lib/escopo/tipos";
import { montarBlocos } from "@/lib/laudo/template";
import type { VariaveisLaudo } from "@/lib/laudo/tipos";
import { blocosProjeto, bitolaDosBicos, vazaoDaBomba } from "./projeto";

const ent = (id: string, tipo: EntidadeEscopo["tipo"], rotulo: string, parent_id: string | null, ordem = 0): EntidadeEscopo => ({ id, tipo, rotulo, parent_id, ordem });
const r = (entidadeId: string | null, chave: string, valor: string) => ({ entidadeId, chave, valor });

// Destilaria Seis Lagoas: 1 posto, 4 bombas (a 4ª é de alta vazão e não tem bico), 2 comboios, 70 cartões RFID
const entidades = [
  ent("p1", "posto", "Posto 01", null),
  ent("i1", "ilha", "Ilha 01", "p1"),
  ent("b1", "bomba", "Bomba 01", "i1", 0),
  ent("b2", "bomba", "Bomba 02", "i1", 1),
  ent("b3", "bomba", "Bomba 03", "i1", 2),
  ent("b4", "bomba", "Bomba 04", "i1", 3),
  ent("k1", "bico", "Bico 01", "b1"),
  ent("k2", "bico", "Bico 01", "b2"),
  ent("k3", "bico", "Bico 01", "b3"),
  ent("c1", "comboio", "Comboio 01", null, 0),
  ent("c2", "comboio", "Comboio 02", null, 1),
  ent("k4", "bico", "Bico 01", "c1"),
  ent("k5", "bico", "Bico 01", "c2"),
];
const respostas = [
  r("b1", "combustivel", "Diesel S10"), r("b1", "marca_bomba", "Wayne"), r("b1", "vazao", "30"), r("b1", "alta_vazao", "nao"), r("k1", "bitola_bico", '3/4"'),
  r("b2", "combustivel", "Diesel S500"), r("b2", "alta_vazao", "nao"), r("k2", "bitola_bico", '1"'),
  r("b3", "combustivel", "Etanol"), r("b3", "alta_vazao", "nao"), r("k3", "bitola_mangueira", '3/4"'),
  r("b4", "combustivel", "Diesel S500"), r("b4", "alta_vazao", "sim"), r("b4", "bico_ausente", "sim"), r("b4", "vazao", "120"),
  r("c1", "identificacao_comboio", "Comboio 400"), r("k4", "bitola_bico", '3/4"'),
  r("c2", "identificacao_comboio", "Comboio 409"), r("k5", "bitola_bico", '1"'),
];
const config = { solucao: "on_premise", comunicacao: "wifi", rfid: { ativo: true, itens: [{ tecnologia: "Mifare", quantidade: 70 }] } } as any;
const contexto = montarContextoLaudo({ entidades, arvore: { ...arvoreVazia(), postos: [{ ilhas: [] }], config }, respostas });
const ids = (p: string) => `${p}-x`;
const tab = (blocos: any[], chave: string) => blocos.find((b) => b.chave === chave);

describe("Projeto — caso Seis Lagoas", () => {
  const blocos = blocosProjeto({ contexto, vars: {}, nivel: "nivel_1", id: ids });

  it("monta as seções de Projeto na ordem do documento", () => {
    expect(blocos.map((b: any) => b.chave)).toEqual([
      "projeto:titulo", "projeto:solucao", "projeto:posto", "projeto:comunicacao_pista",
      "projeto:comboio", "projeto:comunicacao_comboio", "projeto:nivel",
    ]);
    expect(tab(blocos, "projeto:solucao").linhas[0].celulas).toEqual(["On-premise"]);
  });
  it("POSTO: uma linha por bomba, identificação ligada à entidade", () => {
    const t = tab(blocos, "projeto:posto");
    expect(t.colunas).toEqual(["Bomba", "Vazão", "QTD de bicos", "Bitola do bico"]);
    expect(t.linhas.map((l: any) => l.entidadeId)).toEqual(["b1", "b2", "b3", "b4"]);
    expect(t.linhas[0].celulas).toEqual(["Bomba 01 — Wayne — Diesel S10", "30 L/min — Baixa", "1", '3/4"']);
    expect(t.linhas[1].celulas[0]).toBe("Bomba 02 — Diesel S500"); // sem marca: não aparece
    expect(t.linhas[2].celulas[3]).toBe('3/4"'); // reserva: bitola da mangueira
  });
  it("bomba de alta vazão sem bico: valor numérico preservado e 0 bicos explicado", () => {
    expect(tab(blocos, "projeto:posto").linhas[3].celulas).toEqual(["Bomba 04 — Diesel S500", "120 L/min — Alta", "0 (sem bico)", "—"]);
  });
  it("COMBOIO: uma linha por comboio com a identificação respondida", () => {
    const t = tab(blocos, "projeto:comboio");
    expect(t.linhas.map((l: any) => l.celulas)).toEqual([["Comboio 400", "1", '3/4"'], ["Comboio 409", "1", '1"']]);
  });
  it("comunicação vem do Escopo", () => {
    expect(tab(blocos, "projeto:comunicacao_pista").linhas[0].celulas[0]).toBe("Comunicação via Wi-Fi");
  });
  it("NÍVEL: nível, tecnologia e quantidade do Escopo", () => {
    expect(tab(blocos, "projeto:nivel").linhas[0].celulas).toEqual(["Nível 1 (Posto e Comboio)", "Mifare", "70 unidades"]);
  });
  it("tabelas automáticas não têm linhas em branco", () => {
    for (const k of ["projeto:posto", "projeto:comboio"]) {
      expect(tab(blocos, k).linhas.every((l: any) => l.celulas.some((c: string) => c.trim()))).toBe(true);
    }
  });
});

describe("Projeto — dados ausentes e regras", () => {
  it("tecnologia não definida no Escopo fica [CONFIRMAR], sem assumir RFID/Teclado", () => {
    const c = montarContextoLaudo({ entidades: [], arvore: { ...arvoreVazia(), config: { rfid: { ativo: true, itens: [{ tecnologia: "", quantidade: 5 }] } } as any }, respostas: [] });
    const t = tab(blocosProjeto({ contexto: c, vars: {}, nivel: null, id: ids }), "projeto:nivel");
    expect(t.linhas[0].celulas[1]).toContain("[CONFIRMAR: tecnologia de identificação]");
    expect(t.linhas[0].celulas[0]).toContain("[CONFIRMAR: nível de automação]");
    expect(t.linhas[0].celulas[2]).toBe("5 unidades");
  });
  it("sem posto e sem comboio no Escopo: só Solução e Nível", () => {
    const c = montarContextoLaudo({ entidades: [], arvore: arvoreVazia(), respostas: [] });
    expect(blocosProjeto({ contexto: c, vars: {}, nivel: "nivel_2", id: ids }).map((b: any) => b.chave)).toEqual(["projeto:titulo", "projeto:solucao", "projeto:nivel"]);
  });
  it("sem contexto (mapeamento sem estrutura): a seção não é criada", () => {
    expect(blocosProjeto({ contexto: null, vars: {}, nivel: null, id: ids })).toEqual([]);
  });
  it("vazão: valor numérico nunca é trocado só pela classificação", () => {
    expect(vazaoDaBomba({ vazao: "120" })).toBe("120 L/min");
    expect(vazaoDaBomba({ vazao: "120", alta_vazao: "sim" })).toBe("120 L/min — Alta");
    expect(vazaoDaBomba({ alta_vazao: "nao" })).toBe("Baixa");
    expect(vazaoDaBomba({})).toBeNull();
  });
  it("bicos com bitolas diferentes são todos listados; sem nominal usa a da mangueira", () => {
    expect(bitolaDosBicos([{ atributos: { bitola_bico: '1"' } }, { atributos: { bitola_bico: '3/4"' } }])).toEqual(['1"', '3/4"']);
    expect(bitolaDosBicos([{ atributos: { bitola_mangueira: '1"' } }])).toEqual(['1"']);
  });
  it("rótulos repetidos em ilhas diferentes ganham o local", () => {
    const es = [
      ent("p1", "posto", "Posto 01", null), ent("i1", "ilha", "Ilha 01", "p1", 0), ent("i2", "ilha", "Ilha 02", "p1", 1),
      ent("a", "bomba", "Bomba 01", "i1"), ent("b", "bomba", "Bomba 01", "i2"),
    ];
    const c = montarContextoLaudo({ entidades: es, arvore: { ...arvoreVazia(), postos: [{ ilhas: [] }] }, respostas: [] });
    const t = tab(blocosProjeto({ contexto: c, vars: {}, nivel: null, id: ids }), "projeto:posto");
    expect(t.linhas[0].celulas[0]).toContain("Bomba 01 (Ilha 01)");
    expect(t.linhas[1].celulas[0]).toContain("Bomba 01 (Ilha 02)");
  });
});

describe("Projeto no documento completo", () => {
  const vars: VariaveisLaudo = {
    nome_cliente: { chave: "nome_cliente", valor: "Destilaria Seis Lagoas", origem: "formulario", confianca: 1 },
    responsavel_cliente: { chave: "responsavel_cliente", valor: "Mateus", origem: "formulario", confianca: 1 },
    contato_cliente: { chave: "contato_cliente", valor: "(17) 99605-2315", origem: "formulario", confianca: 1 },
    modalidade: { chave: "modalidade", valor: "remoto", origem: "formulario", confianca: 1 },
  };
  const cab = { cliente: "C", unidade: "U", data: "01/01/2026", agente: "A", especialista: "P", modalidade: "remoto" };
  const blocos = montarBlocos({ variaveis: vars, materiais: [], cabecalho: cab, contexto }) as any[];

  it("Projeto vem entre a Introdução e os Requisitos, e a numeração acompanha", () => {
    const titulos = blocos.filter((b) => b.tipo === "heading" && b.nivel === 1).map((b) => b.texto);
    expect(titulos.slice(0, 3)).toEqual(["Introdução", "Projeto", "Requisitos de infraestrutura"]);
  });
  it("introdução cita quem informou os dados e vem marcada como campo de revisão", () => {
    const p = blocos.find((b) => b.tipo === "paragraph");
    expect(p.destaque).toBe("editavel");
    expect(p.texto).toContain("(Mateus - (17) 99605-2315)");
    expect(p.texto).toContain("Mapeamento Técnico - Remoto");
  });
  it("sem contexto o documento continua como antes (sem Projeto)", () => {
    const sem = montarBlocos({ variaveis: vars, materiais: [], cabecalho: cab }) as any[];
    expect(sem.some((b) => b.chave === "projeto:titulo")).toBe(false);
  });
  it("chaves dos blocos de Projeto são únicas e estáveis", () => {
    const chaves = blocos.map((b) => b.chave).filter((k) => k?.startsWith("projeto:"));
    expect(new Set(chaves).size).toBe(chaves.length);
  });
});

describe("solução do Escopo na introdução e nas instruções", () => {
  const cab = { cliente: "C", unidade: "U", data: "01/01/2026", agente: "A", especialista: "P", modalidade: "remoto" };
  const textos = (blocos: any[]) => JSON.stringify(blocos);
  it("usa a solução definida no Escopo, sem pendência", () => {
    const b = montarBlocos({ variaveis: {}, materiais: [], cabecalho: cab, contexto });
    expect(textos(b)).toContain("da solução On-premise no escopo:");
    expect(textos(b)).toContain("instalação da solução On-premise.");
    expect(textos(b)).not.toContain("CONFIRMAR: nome da solução");
  });
  it("sem solução no Escopo, mantém a pendência", () => {
    const c = montarContextoLaudo({ entidades: [], arvore: arvoreVazia(), respostas: [] });
    expect(textos(montarBlocos({ variaveis: {}, materiais: [], cabecalho: cab, contexto: c }))).toContain("CONFIRMAR: nome da solução");
  });
});

describe("TI/banco de dados pela solução do Escopo e contato do cliente", () => {
  const cab = { cliente: "C", unidade: "U", data: "01/01/2026", agente: "Cledir Nunes", especialista: "P", modalidade: "remoto" };
  const titulos = (b: any[]) => b.filter((x) => x.tipo === "heading").map((x) => x.texto);
  it("On-premise inclui a seção de TI e banco de dados, sem pendência de solução", () => {
    const b = montarBlocos({ variaveis: {}, materiais: [], cabecalho: cab, contexto });
    expect(titulos(b)).toContain("Equipamentos de TI e banco de dados");
    expect(JSON.stringify(b)).not.toContain("solução contratada (SAAF ou SSGFROTA)");
  });
  it("SSGFrota no Escopo não leva TI/banco de dados", () => {
    const c = { ...contexto, escopo: { ...contexto.escopo, solucao: "ssg_frota" } };
    const b = montarBlocos({ variaveis: {}, materiais: [], cabecalho: cab, contexto: c });
    expect(titulos(b)).not.toContain("Equipamentos de TI e banco de dados");
  });
  it("o agente nunca aparece como contato do cliente", () => {
    const v = (valor: string) => ({
      responsavel_cliente: { chave: "responsavel_cliente", valor, origem: "formulario", confianca: 1 },
      contato_cliente: { chave: "contato_cliente", valor: "(17) 99605-2315", origem: "formulario", confianca: 1 },
    }) as VariaveisLaudo;
    const intro = (valor: string) => JSON.stringify(montarBlocos({ variaveis: v(valor), materiais: [], cabecalho: cab, contexto }));
    expect(intro("Cledir Nunes - Mateus")).toContain("(Mateus - (17) 99605-2315)");
    expect(intro("Cledir Nunes")).toContain("((17) 99605-2315)");
    expect(intro("Cledir Nunes")).not.toContain("Cledir Nunes -");
  });
});
