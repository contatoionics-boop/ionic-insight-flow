import { afterEach, describe, expect, it } from "vitest";
import { definirOpcoes, mesclarOpcoes, opcoesDoCampo, rotuloDeQualquerOpcao, rotuloOpcao, valorDoNome } from "./opcoes-agendamento";
import { resumoAtendimento } from "./casos";
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
      { campo: "inexistente", valor: "x", rotulo: "X" },
      { campo: "nivel", valor: "Inválido!", rotulo: "Y" },
    ] as never);
    expect(opcoesDoCampo("nivel", { todas }).map((o) => o.rotulo)).toEqual(["Nível 2", "Básico", "Nível 4"]);
    expect(opcoesDoCampo("nivel", { todas, incluir: ["nivel_3"] }).map((o) => o.valor)).toEqual(["nivel_2", "nivel_3", "nivel_1", "nivel_4"]);
    expect(todas.find((o) => o.valor === "nivel_4")?.sistema).toBe(false);
    expect(todas.some((o) => o.campo === ("inexistente" as never))).toBe(false);
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
