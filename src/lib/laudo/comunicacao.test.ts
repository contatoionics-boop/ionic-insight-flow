import { describe, expect, it } from "vitest";
import { comunicacaoDoCampo, derivarComunicacaoTipos } from "@/lib/laudo/comunicacao";
import { chaveCorrigida } from "@/lib/laudo/mapear-chave";
import { compararPropostaCampo } from "@/lib/proposta/comparar";
import { evidenciaComboioCampo } from "@/lib/proposta/comparar";
import { ESCOPO_VAZIO, type EscopoProposta } from "@/lib/proposta/tipos";
import type { VariaveisLaudo } from "@/lib/laudo/tipos";

const campo = (vals: Record<string, string>): VariaveisLaudo =>
  Object.fromEntries(
    Object.entries(vals).map(([chave, valor]) => [
      chave,
      { chave, valor, origem: "formulario" as const, confianca: 1 },
    ]),
  );

const escopo = (patch: Partial<EscopoProposta>): EscopoProposta =>
  ({ ...ESCOPO_VAZIO, ...patch }) as EscopoProposta;

const c = <T,>(valor: T) => ({ valor, confianca: 1, trecho: "", secao: "t", origem: "regra", status: "confirmado" }) as any;

describe("mapeamento semântico das respostas", () => {
  it('toggle Sim de Wi-Fi não vira comunicacao_tipos="sim"', () => {
    expect(chaveCorrigida("comunicacao_tipos", "A empresa dispõe de sinal Wi-Fi no local", "sim")).toBe(
      "wifi_disponivel",
    );
    const vars = campo({ wifi_disponivel: "sim" });
    derivarComunicacaoTipos(vars);
    expect(vars["comunicacao_tipos"]?.valor).toBe("WiFi");
  });

  it("Wi-Fi confirmado por campos separados deriva comunicação Wi-Fi", () => {
    const vars = campo({ frequencia_wifi: "2.4 GHz", qualidade_wifi: "Boa" });
    const com = comunicacaoDoCampo(vars);
    expect(com.wifi).toBe(true);
    expect(com.rotulo).toContain("WiFi");
  });

  it('"Pesados" alimenta tipos_veiculos_abastecidos, não tipo_objeto', () => {
    expect(chaveCorrigida("tipo_objeto", "Tipos de veiculos que abastece", "Pesados")).toBe(
      "tipos_veiculos_abastecidos",
    );
    expect(chaveCorrigida("tipo_objeto", "Objeto do escopo", "Pista")).toBe("tipo_objeto");
  });

  it("comboio continua exigindo evidência explícita", () => {
    expect(evidenciaComboioCampo(campo({ tipos_veiculos_abastecidos: "Pesados" }))).toBeNull();
    expect(evidenciaComboioCampo(campo({ comboio: "sim" }))).toBe(true);
  });
});

describe("divergências de comunicação", () => {
  it("proposta Wi-Fi + campo Wi-Fi não gera divergência nem nivel2_sem_infra", () => {
    const vars = campo({
      nivel_servico: "nivel_2",
      wifi_disponivel: "sim",
      frequencia_wifi: "2.4 GHz",
      qualidade_sinal: "Regular",
    });
    derivarComunicacaoTipos(vars);
    const r = compararPropostaCampo(
      escopo({ nivel_automacao: c(2), comunicacao_prevista: c("wifi") }),
      vars,
    );
    const codigos = r.divergencias.map((d) => d.codigo);
    expect(codigos).not.toContain("comunicacao_divergente");
    expect(codigos).not.toContain("nivel2_sem_infra");
  });

  it("proposta Wi-Fi + campo apenas 4G explícito gera divergência", () => {
    const vars = campo({ wifi_disponivel: "nao", gsm_4g_disponivel: "sim" });
    derivarComunicacaoTipos(vars);
    const r = compararPropostaCampo(escopo({ comunicacao_prevista: c("wifi") }), vars);
    expect(r.divergencias.map((d) => d.codigo)).toContain("comunicacao_divergente");
  });

  it("proposta sem comunicação prevista não inventa divergência", () => {
    const vars = campo({ wifi_disponivel: "sim" });
    derivarComunicacaoTipos(vars);
    const r = compararPropostaCampo(escopo({}), vars);
    expect(r.divergencias.map((d) => d.codigo)).not.toContain("comunicacao_divergente");
  });

  it("quantidade de bicos do formulário elimina a pendência", () => {
    const r = compararPropostaCampo(escopo({ qtd_bicos: c(1) }), campo({ qtd_bicos: "1" }));
    expect(r.pendencias.join(" ")).not.toContain("Quantidade de bicos não informada");
  });
});
