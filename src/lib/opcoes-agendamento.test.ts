import { afterEach, describe, expect, it } from "vitest";
import { camposExtrasAtivos, chaveDoCampo, definirCampos, definirOpcoes, mesclarCampos, mesclarOpcoes, opcoesDoCampo, resumoCamposExtras, rotuloDeQualquerOpcao, rotuloOpcao, valorDoNome } from "./opcoes-agendamento";
import { resumoAtendimento } from "./casos";
import { condicoesAtendidas, lerRegra, regraParaEscopo, resumoDaRegra } from "./laudo/blocos-padrao-regras";
import { escolherVersao } from "./laudo/textos-padrao";
import { rotuloModalidade, rotuloTipoAcao } from "./texto";
import { rotuloSolucao } from "./escopo/tipos";

afterEach(() => definirOpcoes());

describe("opções do agendamento", () => {
  it("sem linhas do banco valem os padrões", () => {
    expect(opcoesDoCampo("nivel").map((o) => o.rotulo)).toEqual(["Nível 1", "Nível 2", "Nível 3"]);
    expect(rotuloOpcao("solucao", "on_premise")).toBe("On-premise");
    expect(rotuloOpcao("nivel", null)).toBeNull();
    expect(rotuloOpcao("nivel", "nivel_9")).toBe("nivel_9");
  });

  it("renomear, ocultar, reordenar e criar opção; oculta só aparece se já estiver em uso", () => {
    const todas = mesclarOpcoes([
      { campo: "nivel", valor: "nivel_1", rotulo: "Básico", ordem: 30 },
      { campo: "nivel", valor: "nivel_3", rotulo: "Nível 3", ativo: false, ordem: 20 },
      { campo: "nivel", valor: "nivel_4", rotulo: "Nível 4", ordem: 40 },
      { campo: "Campo Ruim", valor: "x", rotulo: "X" },
      { campo: "nivel", valor: "Inválido!", rotulo: "Y" },
    ] as never);
    expect(opcoesDoCampo("nivel", { todas }).map((o) => o.rotulo)).toEqual(["Nível 2", "Básico", "Nível 4"]);
    expect(opcoesDoCampo("nivel", { todas, incluir: ["nivel_3"] }).map((o) => o.valor)).toEqual(["nivel_2", "nivel_3", "nivel_1", "nivel_4"]);
    expect(todas.find((o) => o.valor === "nivel_4")?.sistema).toBe(false);
    // campo com chave inválida é descartado (campo de chave válida é um campo criado pelo gestor)
    expect(todas.some((o) => o.valor === "Inválido!")).toBe(false);
  });

  it("os rótulos configurados valem em resumo, documento e escopo (via registro)", () => {
    definirOpcoes([
      { campo: "tipo_solicitacao", valor: "instalacao", rotulo: "Implantação" },
      { campo: "modalidade", valor: "remoto", rotulo: "A distância" },
      { campo: "nivel", valor: "nivel_2", rotulo: "Avançado" },
      { campo: "solucao", valor: "ssg_frota", rotulo: "SSG Frota" },
    ] as never);
    expect(resumoAtendimento({ tipo_solicitacao: "instalacao", modalidade: "remoto", nivel: "nivel_2" })).toBe("Implantação · A distância · Avançado");
    expect(rotuloTipoAcao("instalacao")).toBe("implantação");
    expect(rotuloModalidade("remoto")).toBe("a distância");
    expect(rotuloSolucao("ssg_frota")).toBe("SSG Frota");
    expect(rotuloDeQualquerOpcao("nivel_2")).toBe("Avançado");
  });

  it("sem personalização o texto do documento continua o de antes", () => {
    expect(rotuloTipoAcao("instalacao")).toBe("instalação");
    expect(rotuloTipoAcao("Instalação")).toBe("instalação");
    expect(rotuloModalidade("presencial")).toBe("presencial");
    expect(rotuloTipoAcao("algo novo")).toBe("algo novo");
  });

  it("valor novo a partir do nome, sem repetir", () => {
    expect(valorDoNome("Nível 4", [])).toBe("nivel_4");
    expect(valorDoNome("Nível 4", ["nivel_4"])).toBe("nivel_4_2");
    expect(valorDoNome("%%", [])).toBe("opcao");
  });
});

describe("campos novos do agendamento", () => {
  it("os quatro fixos sempre existem; campo novo precisa de chave válida e não colide com eles", () => {
    const campos = mesclarCampos([
      { chave: "tipo_mapeamento", titulo: "Tipo de mapeamento", obrigatorio: true },
      { chave: "nivel", titulo: "Duplicado do fixo" },
      { chave: "Ruim!", titulo: "Inválido" },
      { chave: "sem_titulo", titulo: "" },
      { chave: "oculto", titulo: "Oculto", ativo: false, ordem: 5 },
    ] as never);
    expect(campos.map((c) => c.campo)).toEqual(["tipo_solicitacao", "modalidade", "nivel", "solucao", "oculto", "tipo_mapeamento"]);
    expect(campos.find((c) => c.campo === "tipo_mapeamento")).toMatchObject({ sistema: false, obrigatorio: true, ativo: true });
    expect(camposExtrasAtivos(campos).map((c) => c.campo)).toEqual(["tipo_mapeamento"]);
  });

  it("chave do campo a partir do título, sem repetir nem usar a de um fixo", () => {
    expect(chaveDoCampo("Tipo de mapeamento", [])).toBe("tipo_de_mapeamento");
    expect(chaveDoCampo("Tipo de mapeamento", ["tipo_de_mapeamento"])).toBe("tipo_de_mapeamento_2");
    expect(chaveDoCampo("Nível", [])).not.toBe("nivel");
  });

  it("opções de um campo novo e o resumo das escolhas", () => {
    definirCampos([{ chave: "tipo_mapeamento", titulo: "Tipo de mapeamento" }] as never);
    definirOpcoes([
      { campo: "tipo_mapeamento", valor: "completo", rotulo: "Completo", ordem: 10 },
      { campo: "tipo_mapeamento", valor: "rapido", rotulo: "Rápido", ordem: 20 },
    ] as never);
    expect(opcoesDoCampo("tipo_mapeamento").map((o) => o.rotulo)).toEqual(["Completo", "Rápido"]);
    expect(resumoCamposExtras({ tipo_mapeamento: "rapido", campo_apagado: "x" })).toEqual(["Rápido"]);
    expect(resumoAtendimento({ tipo_solicitacao: "instalacao", campos_extras: { tipo_mapeamento: "completo" } })).toBe("Instalação · Completo");
    expect(resumoAtendimento({ tipo_solicitacao: "instalacao" })).toBe("Instalação");
    definirCampos();
  });
});

describe("campos novos como condição dos textos e blocos padrão", () => {
  const base = { automatico: true, solucao: [], nivel: [], exige: [], posicao: "antes_instrucoes" as const };
  const ctx = { nivel: null, contexto: null };

  it("a regra só atende quando a escolha do caso está entre as aceitas", () => {
    const regra = { ...base, extras: { tipo_mapeamento: ["completo", "rapido"] } };
    expect(condicoesAtendidas(regra, { ...ctx, camposExtras: { tipo_mapeamento: "completo" } })).toBe(true);
    expect(condicoesAtendidas(regra, { ...ctx, camposExtras: { tipo_mapeamento: "outro" } })).toBe(false);
    expect(condicoesAtendidas(regra, { ...ctx, camposExtras: {} })).toBe(false); // sem escolha não atende
    expect(condicoesAtendidas(regra, ctx)).toBe(false);
    // sem condição de campo novo, nada muda
    expect(condicoesAtendidas({ ...base }, ctx)).toBe(true);
    expect(condicoesAtendidas({ ...base, extras: {} }, ctx)).toBe(true);
  });

  it("lê e grava só chaves válidas e listas não vazias; resumo usa os nomes configurados", () => {
    definirCampos([{ chave: "tipo_mapeamento", titulo: "Tipo de mapeamento" }] as never);
    definirOpcoes([{ campo: "tipo_mapeamento", valor: "completo", rotulo: "Completo" }] as never);
    const r = lerRegra({ automatico: true, extras: { tipo_mapeamento: ["completo"], "Ruim!": ["x"], vazio: [] } });
    expect(r.extras).toEqual({ tipo_mapeamento: ["completo"] });
    expect(regraParaEscopo(r)).toMatchObject({ extras: { tipo_mapeamento: ["completo"] } });
    expect(regraParaEscopo({ ...r, extras: {} })).not.toHaveProperty("extras");
    expect(resumoDaRegra(r)).toBe("Automático: Tipo de mapeamento: Completo");
    definirCampos();
  });

  it("versão de texto com condição de campo novo vence a genérica (mais específica) e só entra quando bate", () => {
    const v = (id: string, escopo: Record<string, unknown>) => ({ id, nome: id, escopo: { slot: "introducao", padrao: true, ...escopo }, blocos: [{ id: "b", tipo: "paragraph", texto: id }], ordem: 0 }) as never;
    const versoes = [v("geral", {}), v("completo", { extras: { tipo_mapeamento: ["completo"] } })];
    expect(escolherVersao("introducao", versoes, null, { ...ctx, camposExtras: { tipo_mapeamento: "completo" } })?.id).toBe("completo");
    expect(escolherVersao("introducao", versoes, null, { ...ctx, camposExtras: { tipo_mapeamento: "rapido" } })?.id).toBe("geral");
  });
});
