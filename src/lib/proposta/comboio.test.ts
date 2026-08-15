import { describe, expect, it } from "vitest";
import { compararPropostaCampo } from "@/lib/proposta/comparar";
import { normalizarEscopo } from "@/lib/proposta/tipos";
import { temComboio } from "@/lib/laudo/blocos-nivel2";
import type { VariaveisLaudo } from "@/lib/laudo/tipos";

function escopoComComboio(valor: boolean) {
  return normalizarEscopo({
    tem_comboio: { valor, confianca: 0.9, origem: "proposta" },
  });
}

function varsCampo(extra: Record<string, any> = {}): VariaveisLaudo {
  const base: VariaveisLaudo = {
    nivel_servico: { chave: "nivel_servico", valor: "nivel_2", origem: "manual", confianca: 1 },
  };
  for (const [chave, v] of Object.entries(extra)) base[chave] = { chave, ...v };
  return base;
}

const codigos = (r: { divergencias: { codigo: string }[] }) => r.divergencias.map((d) => d.codigo);

describe("comparação de comboio", () => {
  it("proposta com comboio + campo sem evidência estruturada -> pendência, não divergência", () => {
    const r = compararPropostaCampo(
      escopoComComboio(true),
      // tipo_objeto "Pesados" é tipo de veículo: não prova ausência de comboio
      varsCampo({ tipo_objeto: { valor: "Pesados", origem: "formulario", confianca: 1 } }),
    );
    expect(codigos(r)).not.toContain("comboio_divergente");
    expect(r.pendencias.join(" ")).toMatch(/comboio não confirmada/i);
  });

  it("campo comboio=false explícito + proposta true -> divergência", () => {
    const r = compararPropostaCampo(
      escopoComComboio(true),
      varsCampo({ comboio: { valor: "nao", origem: "formulario", confianca: 1 } }),
    );
    expect(codigos(r)).toContain("comboio_divergente");
  });

  it("campo comboio=true explícito + proposta false -> divergência", () => {
    const r = compararPropostaCampo(
      escopoComComboio(false),
      varsCampo({ comboio: { valor: "sim", origem: "formulario", confianca: 1 } }),
    );
    expect(codigos(r)).toContain("comboio_divergente");
  });

  it("qtd_comboios do campo conta como evidência", () => {
    const r = compararPropostaCampo(
      escopoComComboio(true),
      varsCampo({ qtd_comboios: { valor: "0", origem: "formulario", confianca: 1 } }),
    );
    expect(codigos(r)).toContain("comboio_divergente");
  });
});

describe("temComboio e origem da evidência", () => {
  it("ignora comboio vindo apenas da proposta", () => {
    expect(
      temComboio({ comboio: { chave: "comboio", valor: "sim", origem: "proposta", confianca: 1 } }),
    ).toBe(false);
  });

  it("aceita comboio confirmado no formulário", () => {
    expect(
      temComboio({
        comboio: { chave: "comboio", valor: "sim", origem: "formulario", confianca: 1 },
      }),
    ).toBe(true);
  });

  it("aceita comboio confirmado manualmente pelo especialista", () => {
    expect(
      temComboio({ comboio: { chave: "comboio", valor: "sim", origem: "manual", confianca: 1 } }),
    ).toBe(true);
  });

  it("qtd_comboios da proposta não liga o comboio", () => {
    expect(
      temComboio({
        qtd_comboios: { chave: "qtd_comboios", valor: "2", origem: "proposta", confianca: 1 },
      }),
    ).toBe(false);
  });
});
