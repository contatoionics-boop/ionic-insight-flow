import { describe, expect, it } from "vitest";
import { montarContextoLaudo } from "@/lib/laudo/contexto";
import { arvoreVazia } from "@/lib/escopo/tipos";
import { montarBlocos } from "@/lib/laudo/template";
import type { BlocoLaudo, VariaveisLaudo } from "@/lib/laudo/tipos";
import { ajustarAplicacao, blocoVelocidades, nomeDaAplicacao, usaWifi } from "./transferencia";

const ctx = (config: Record<string, unknown>, gerais: { chave: string; valor: string }[] = []) =>
  montarContextoLaudo({
    entidades: [],
    arvore: { ...arvoreVazia(), config } as any,
    respostas: gerais.map((g) => ({ entidadeId: null, ...g })),
  });
const v = (chave: string, valor: string): VariaveisLaudo[string] => ({ chave, valor, origem: "formulario", confianca: 1 });
const cab = { cliente: "C", unidade: "U", data: "01/01/2026", agente: "A", especialista: "P", modalidade: "remoto" };

describe("velocidades de conexão", () => {
  it("mostra download e upload medidos, com unidade", () => {
    const b = blocoVelocidades({ vars: { velocidade_download_mbps: v("velocidade_download_mbps", "92"), velocidade_upload_mbps: v("velocidade_upload_mbps", "18,5") }, contexto: null, wifi: true, id: "x" });
    expect(b?.texto).toBe("Velocidade de conexão medida no local: download 92 Mbps e upload 18,5 Mbps.");
    expect(b?.chave).toBe("dados:velocidades");
  });
  it("com Wi-Fi e sem medida vira pendência; sem Wi-Fi e sem medida não aparece", () => {
    expect(blocoVelocidades({ vars: {}, contexto: null, wifi: true, id: "x" })?.texto).toContain("[CONFIRMAR: velocidade de download]");
    expect(blocoVelocidades({ vars: {}, contexto: null, wifi: false, id: "x" })).toBeNull();
  });
  it("lê a medida de outro mapeamento da mesma visita (contexto mesclado)", () => {
    const c = ctx({}, [{ chave: "velocidade_download_mbps", valor: "40" }, { chave: "velocidade_upload_mbps", valor: "10" }]);
    expect(blocoVelocidades({ vars: {}, contexto: c, wifi: true, id: "x" })?.texto).toContain("download 40 Mbps e upload 10 Mbps");
  });
});

describe("Wi-Fi e aplicação pela solução do Escopo", () => {
  it("o Escopo decide se há Wi-Fi; sem ele, valem as respostas", () => {
    expect(usaWifi(ctx({ comunicacao: "wifi" }), false)).toBe(true);
    expect(usaWifi(ctx({ comunicacao: "ambos" }), false)).toBe(true);
    expect(usaWifi(ctx({ comunicacao: "4g" }), true)).toBe(false);
    expect(usaWifi(ctx({}), true)).toBe(true);
    expect(usaWifi(null, false)).toBe(false);
  });
  it("SSGFrota troca o nome da aplicação; os demais mantêm SAAF", () => {
    expect(nomeDaAplicacao(ctx({ solucao: "ssg_frota" }))).toBe("SSGFrota");
    expect(nomeDaAplicacao(ctx({ solucao: "on_premise" }))).toBe("SAAF");
    const blocos = [
      { id: "1", tipo: "paragraph", texto: "com a aplicação SAAF." },
      { id: "2", tipo: "bullets", itens: ["portas da aplicação SAAF"] },
    ] as BlocoLaudo[];
    expect(JSON.stringify(ajustarAplicacao(blocos, "SSGFrota"))).not.toContain("SAAF");
    expect(ajustarAplicacao(blocos, "SAAF")).toBe(blocos);
  });
});

describe("Transferência de dados no documento", () => {
  it("o parágrafo das velocidades entra no Wi-Fi quando o Escopo tem Wi-Fi", () => {
    const c = ctx({ comunicacao: "wifi", solucao: "ssg_frota" }, [{ chave: "velocidade_download_mbps", valor: "92" }, { chave: "velocidade_upload_mbps", valor: "18" }]);
    const b = montarBlocos({ variaveis: {}, materiais: [], cabecalho: cab, contexto: c }) as any[];
    const i = b.findIndex((x) => x.chave === "dados:velocidades");
    expect(i).toBeGreaterThan(-1);
    expect(b[i].texto).toContain("download 92 Mbps");
  });
});
