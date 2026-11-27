import { describe, expect, it } from "vitest";
import { OPCOES_PADRAO } from "@/lib/opcoes-agendamento";
import { descricaoRegraCatalogo, materialCorrespondeABusca, regraDeCampos } from "./catalogos-apresentacao";

describe("apresentação das regras do catálogo", () => {
  it("mostra alternativas dentro do mesmo campo e combina as condições distintas", () => {
    const regra = regraDeCampos({
      nivel: "nivel_2, nivel_3",
      bitola: '3/4"',
      tipo_objeto: "comboio, pista",
      area_classificada: true,
    });
    expect(regra.nivel).toEqual(["nivel_2", "nivel_3"]);
    expect(descricaoRegraCatalogo(regra, true, true, OPCOES_PADRAO)).toBe(
      'Nível 2 ou Nível 3 + bitola 3/4" + tipo de objeto Comboio ou Pista + área classificada',
    );
  });

  it("distingue item inativo, sugestão desativada e regra sem condições", () => {
    expect(descricaoRegraCatalogo({}, false, true, OPCOES_PADRAO)).toMatch(/inativo/);
    expect(descricaoRegraCatalogo({}, true, false, OPCOES_PADRAO)).toMatch(/desativada/);
    expect(descricaoRegraCatalogo({}, true, true, OPCOES_PADRAO)).toMatch(/todos os mapeamentos/);
  });

  it("encontra materiais por código e por palavras da descrição sem acentos", () => {
    expect(materialCorrespondeABusca("MAT-LUVA-EX", "Luva para área classificada", "mat-luva area")).toBe(true);
    expect(materialCorrespondeABusca("MAT-LUVA-EX", "Luva para área classificada", "mat-luva niple")).toBe(false);
  });
});
