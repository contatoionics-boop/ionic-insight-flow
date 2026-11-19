import { describe, expect, it } from "vitest";
import { montarContextoLaudo } from "@/lib/laudo/contexto";
import { arvoreVazia, type EntidadeEscopo } from "@/lib/escopo/tipos";
import { montarBlocos } from "@/lib/laudo/template";
import type { BlocoLaudo, VariaveisLaudo } from "@/lib/laudo/tipos";
import { ajustarAplicacao, blocoCondicoesWifi, blocosFotosTransferencia, blocoVelocidades, nomeDaAplicacao, tipoDaFotoTransferencia, usaWifi } from "./transferencia";

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
    expect(b?.texto).toBe(
      "Segundo informado no formulário, a velocidade de download medida no local é de 92 Mbps, atendendo ao recomendado, que é de 10 Mbps. " +
        "A velocidade de upload é de 18,5 Mbps, o que atende plenamente, já que a velocidade recomendada é de 2 Mbps.",
    );
    expect(b?.chave).toBe("dados:velocidades");
  });
  it("com Wi-Fi e sem medida vira pendência; sem Wi-Fi e sem medida não aparece", () => {
    expect(blocoVelocidades({ vars: {}, contexto: null, wifi: true, id: "x" })?.texto).toContain("[CONFIRMAR: velocidade de download]");
    expect(blocoVelocidades({ vars: {}, contexto: null, wifi: false, id: "x" })).toBeNull();
  });
  it("resposta sem número (fora do campo) não é repetida no documento: vira pendência", () => {
    const b = blocoVelocidades({ vars: { velocidade_download_mbps: v("velocidade_download_mbps", "Florianópolis"), velocidade_upload_mbps: v("velocidade_upload_mbps", "20") }, contexto: null, wifi: true, id: "x" });
    expect(b?.texto).toContain("[CONFIRMAR: velocidade de download]");
    expect(b?.texto).toContain("upload é de 20 Mbps");
    expect(b?.texto).not.toContain("Florianópolis");
  });
  it("compara com o recomendado: download abaixo de 10 Mbps e upload abaixo de 2 Mbps", () => {
    const b = blocoVelocidades({ vars: { velocidade_download_mbps: v("velocidade_download_mbps", "9.67"), velocidade_upload_mbps: v("velocidade_upload_mbps", "1,5") }, contexto: null, wifi: true, id: "x" });
    expect(b?.texto).toContain("é de 9.67 Mbps, abaixo do recomendado, que é de 10 Mbps");
    expect(b?.texto).toContain("é de 1,5 Mbps, abaixo da recomendada, que é de 2 Mbps");
  });
  it("só a velocidade qualitativa informada: não exige a medida em Mbps; sem nenhuma, continua pendência", () => {
    expect(blocoVelocidades({ vars: {}, contexto: null, wifi: true, id: "x", faixaInformada: true })).toBeNull();
    expect(blocoVelocidades({ vars: {}, contexto: null, wifi: true, id: "x", faixaInformada: false })?.texto).toContain("[CONFIRMAR");
    // medida presente continua aparecendo
    expect(blocoVelocidades({ vars: { velocidade_download_mbps: v("velocidade_download_mbps", "30") }, contexto: null, wifi: true, id: "x", faixaInformada: true })?.texto).toContain("30 Mbps");
  });
  it("lê a medida de outro mapeamento da mesma visita (contexto mesclado)", () => {
    const c = ctx({}, [{ chave: "velocidade_download_mbps", valor: "40" }, { chave: "velocidade_upload_mbps", valor: "10" }]);
    expect(blocoVelocidades({ vars: {}, contexto: c, wifi: true, id: "x" })?.texto).toContain("download medida no local é de 40 Mbps");
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

describe("Wi-Fi e GSM/4G conforme o Escopo", () => {
  const titulos = (config: Record<string, unknown>, comboio = false, comWifiNoCampo = true) => {
    const entidades = comboio ? [{ id: "k1", tipo: "comboio" as const, rotulo: "Comboio 01", parent_id: null, ordem: 0 }] : [];
    const c = montarContextoLaudo({ entidades, arvore: { ...arvoreVazia(), config } as any, respostas: [] });
    // campo com Wi-Fi 2.4 GHz encontrado: o achado de GSM só entra se o Escopo ou o comboio o pedirem
    const variaveis: VariaveisLaudo = !comWifiNoCampo ? {} : { frequencia_wifi: v("frequencia_wifi", "2.4 GHz"), comunicacao_tipos: v("comunicacao_tipos", "WiFi") };
    return (montarBlocos({ variaveis, materiais: [], cabecalho: cab, contexto: c }) as any[]).filter((b) => b.chave?.startsWith("dados:") && b.tipo === "heading").map((b) => b.chave);
  };
  it("só Wi-Fi: sem GSM/4G", () => expect(titulos({ comunicacao: "wifi" })).toEqual(["dados:wifi", "dados:radio"]));
  it("só 4G (e sem Wi-Fi no campo): sem Wi-Fi", () => expect(titulos({ comunicacao: "4g" }, false, false)).toEqual(["dados:gsm", "dados:radio"]));
  it("ambos: os dois", () => expect(titulos({ comunicacao: "ambos" })).toEqual(["dados:wifi", "dados:gsm", "dados:radio"]));
  it("comboio sempre leva GSM/4G", () => expect(titulos({ comunicacao: "wifi" }, true)).toContain("dados:gsm"));
  it("sem comunicação no Escopo mantém o comportamento anterior (Wi-Fi presente)", () => expect(titulos({})).toContain("dados:wifi"));
});

describe("Transferência de dados no documento", () => {
  it("o parágrafo das velocidades entra no Wi-Fi quando o Escopo tem Wi-Fi", () => {
    const c = ctx({ comunicacao: "wifi", solucao: "ssg_frota" }, [{ chave: "velocidade_download_mbps", valor: "92" }, { chave: "velocidade_upload_mbps", valor: "18" }]);
    const b = montarBlocos({ variaveis: {}, materiais: [], cabecalho: cab, contexto: c }) as any[];
    const i = b.findIndex((x) => x.chave === "dados:velocidades");
    expect(i).toBeGreaterThan(-1);
    expect(b[i].texto).toContain("download medida no local é de 92 Mbps");
  });
});

const ent = (id: string, tipo: EntidadeEscopo["tipo"], rotulo: string, parent_id: string | null, ordem = 0): EntidadeEscopo => ({ id, tipo, rotulo, parent_id, ordem });
const r = (entidadeId: string | null, chave: string, valor: string) => ({ entidadeId, chave, valor });
const entidades = [
  ent("p1", "posto", "Posto 01", null), ent("i1", "ilha", "Ilha 01", "p1"), ent("b1", "bomba", "Bomba 01", "i1"),
  ent("c1", "comboio", "Comboio 01", null), ent("c2", "comboio", "Comboio 02", null, 1),
];
const respostas = [
  r("b1", "frequencia_wifi", "2.4 GHz"), r("b1", "qualidade_wifi", "Boa"), r("b1", "estabilidade_wifi", "Boa"), r("b1", "velocidade_conexao_faixa", "Média"),
  r("c1", "wifi_disponivel", "nao"),
];
const contextoWifi = montarContextoLaudo({ entidades, arvore: { ...arvoreVazia(), config: { comunicacao: "ambos" } } as any, respostas });

describe("condições do Wi-Fi informadas no formulário", () => {
  it("uma linha por bomba/comboio que respondeu, com '—' para o que faltou", () => {
    const t = blocoCondicoesWifi({ contexto: contextoWifi, id: "t" })!;
    expect(t.chave).toBe("dados:wifi_condicoes");
    expect(t.colunas).toEqual(["Local", "Frequência", "Potência do sinal", "Estabilidade", "Velocidade de conexão"]);
    expect(t.linhas.map((l: any) => l.celulas)).toEqual([
      ["Bomba 01", "2.4 GHz", "Boa", "Boa", "Média"],
      ["Comboio 01", "Sem sinal Wi-Fi", "—", "—", "—"],
    ]);
    // a identidade da linha é a entidade
    expect(t.linhas.map((l: any) => l.entidadeId)).toEqual(["b1", "c1"]);
  });
  it("sem nenhuma resposta de Wi-Fi (ou sem contexto) não cria a tabela", () => {
    expect(blocoCondicoesWifi({ contexto: null, id: "t" })).toBeNull();
    expect(blocoCondicoesWifi({ contexto: montarContextoLaudo({ entidades, arvore: arvoreVazia(), respostas: [] }), id: "t" })).toBeNull();
  });
  it("entra no documento dentro do Wi-Fi e dispensa a medida em Mbps quando a velocidade foi informada", () => {
    const blocos = montarBlocos({ variaveis: {}, materiais: [], cabecalho: cab, contexto: contextoWifi }) as any[];
    const i = blocos.findIndex((x) => x.chave === "dados:wifi_condicoes");
    expect(i).toBeGreaterThan(blocos.findIndex((x) => x.chave === "dados:wifi"));
    expect(i).toBeLessThan(blocos.findIndex((x) => x.chave === "dados:gsm"));
    expect(blocos.some((x) => x.chave === "dados:velocidades")).toBe(false);
  });
});

describe("prints do registro fotográfico de transferência de dados", () => {
  it("reconhece o print pelo texto da pergunta", () => {
    expect(tipoDaFotoTransferencia("PRINT 1 - AQUARIO ANALYZER (SINAL DA OPERADORA)")).toBe("gsm_sinal");
    expect(tipoDaFotoTransferencia("PRINT 2 - WIFI NETWORK ANALYZER (SSID E DETALHES DA REDE)")).toBe("wifi_detalhes");
    expect(tipoDaFotoTransferencia("Print 3 - WiFi Network Analyzer (Gráfico Redes)")).toBe("wifi_grafico");
    expect(tipoDaFotoTransferencia("FOTO 1 - PANORAMICA FRONTAL DA PISTA")).toBeNull();
  });
  it("gera as imagens pedidas, na ordem, com 'Figura N' e chave estável; sem a foto, não cria o bloco", () => {
    let n = 0;
    const fotos = [{ tipo: "wifi_grafico" as const, url: "https://x/g.png" }, { tipo: "wifi_detalhes" as const, url: "https://x/d.png" }];
    const b = blocosFotosTransferencia(fotos, ["wifi_detalhes", "wifi_grafico", "gsm_sinal"], (p) => `${p}-x`, () => ++n) as any[];
    expect(b.map((x) => x.chave)).toEqual(["dados:foto_wifi_detalhes", "dados:foto_wifi_grafico"]);
    expect(b[0]).toMatchObject({ tipo: "image", url: "https://x/d.png" });
    expect(b[0].legenda).toMatch(/^Figura 1 — /);
    expect(b[1].legenda).toMatch(/^Figura 2 — /);
  });
  it("no documento: Wi-Fi leva os dois prints do Wi-Fi e o GSM leva o da operadora", () => {
    const fotosTransferencia = [
      { tipo: "gsm_sinal" as const, url: "https://x/gsm.png" }, { tipo: "wifi_detalhes" as const, url: "https://x/d.png" }, { tipo: "wifi_grafico" as const, url: "https://x/g.png" },
    ];
    const blocos = montarBlocos({ variaveis: {}, materiais: [], cabecalho: cab, contexto: contextoWifi, fotosTransferencia }) as any[];
    const pos = (chave: string) => blocos.findIndex((x) => x.chave === chave);
    expect(pos("dados:foto_wifi_detalhes")).toBeGreaterThan(pos("dados:wifi"));
    expect(pos("dados:foto_wifi_grafico")).toBeLessThan(pos("dados:gsm"));
    expect(pos("dados:foto_gsm_sinal")).toBeGreaterThan(pos("dados:gsm"));
    expect(pos("dados:foto_gsm_sinal")).toBeLessThan(pos("dados:radio"));
  });
  it("Escopo só 4G esconde o Wi-Fi, e os prints do Wi-Fi junto", () => {
    const c = montarContextoLaudo({ entidades: [], arvore: { ...arvoreVazia(), config: { comunicacao: "4g" } } as any, respostas: [] });
    const blocos = montarBlocos({ variaveis: {}, materiais: [], cabecalho: cab, contexto: c, fotosTransferencia: [{ tipo: "wifi_detalhes", url: "https://x/d.png" }] }) as any[];
    expect(blocos.some((x) => x.chave === "dados:foto_wifi_detalhes")).toBe(false);
  });
});
