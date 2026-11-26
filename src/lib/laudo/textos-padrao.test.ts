import { describe, expect, it } from "vitest";
import { arvoreVazia } from "@/lib/escopo/tipos";
import { montarContextoLaudo } from "@/lib/laudo/contexto";
import { blocos24 } from "@/lib/laudo/blocos-nivel2";
import { montarBlocos } from "@/lib/laudo/template";
import type { VariaveisLaudo } from "@/lib/laudo/tipos";
import {
  TEXTO_ORIGINAL,
  blocosParaItens,
  camposDoSlot,
  corpoParaItens,
  escolherVersao,
  escopoDaVersao,
  itensParaBlocos,
  itensParaCorpo,
  lerSlot,
  nomeDaNovaVersao,
  renderizarCampos,
  type VersaoTexto,
} from "./textos-padrao";

const ctx = (config: Record<string, unknown>) => montarContextoLaudo({ entidades: [], arvore: { ...arvoreVazia(), config } as any, respostas: [] });
const nova = (chave: string, valor: string): VariaveisLaudo[string] => ({ chave, valor, origem: "formulario", confianca: 1 });
const cab = { cliente: "C", unidade: "U", data: "01/01/2026", agente: "A", especialista: "P", modalidade: "remoto" };
const variaveis: VariaveisLaudo = { nome_cliente: nova("nome_cliente", "Destilaria Seis Lagoas"), nivel_servico: nova("nivel_servico", "nivel_2") };

const versao = (id: string, slot: any, corpo: string, extra: Record<string, any> = {}, ordem = 0, nome = id): VersaoTexto => ({
  id, nome, ordem, escopo: escopoDaVersao(slot, extra.padrao ?? false, { solucao: extra.solucao ?? [], nivel: extra.nivel ?? [], exige: extra.exige ?? [] }),
  blocos: itensParaBlocos(corpoParaItens(corpo)),
});

describe("campos automáticos", () => {
  const campos = { cliente: "ACME", origem_dados: "", data: null };
  it("troca o campo pelo valor; vazio some; sem dado e campo desconhecido viram [CONFIRMAR]", () => {
    expect(renderizarCampos("Para {{cliente}}.{{origem_dados}}", campos)).toBe("Para ACME.");
    expect(renderizarCampos("Em {{ data }}", campos)).toContain("[CONFIRMAR");
    expect(renderizarCampos("Veja {{inventado}}", campos)).toContain("[CONFIRMAR: campo desconhecido {{inventado}}]");
  });
});

describe("corpo ⇄ itens", () => {
  it("parágrafo, lista e parágrafo destacado (!) fazem ida e volta", () => {
    const corpo = "!Parágrafo de revisão\n\nTexto normal\n\n- item 1\n- item 2";
    const itens = corpoParaItens(corpo);
    expect(itens).toEqual([
      { tipo: "paragraph", texto: "Parágrafo de revisão", destaque: true },
      { tipo: "paragraph", texto: "Texto normal" },
      { tipo: "bullets", itens: ["item 1", "item 2"] },
    ]);
    expect(itensParaCorpo(itens)).toBe(corpo);
    expect(blocosParaItens(itensParaBlocos(itens))).toEqual(itens);
  });
});

describe("escolha da versão", () => {
  const a = { nivel: "nivel_2", contexto: ctx({ solucao: "ssg_frota" }) };
  const geral = versao("geral", "introducao", "Geral", { padrao: true }, 5);
  const ssg = versao("ssg", "introducao", "SSG", { padrao: true, solucao: ["ssg_frota"] }, 9);
  const onPrem = versao("onp", "introducao", "ONP", { padrao: true, solucao: ["on_premise"] });
  const semPadrao = versao("rascunho", "introducao", "Rascunho");
  const todas = [geral, ssg, onPrem, semPadrao, versao("outro", "instrucoes_gerais", "Outro slot", { padrao: true })];

  it("sem versão aplicável usa o texto original (null)", () => {
    expect(escolherVersao("introducao", [], {}, a)).toBeNull();
    expect(escolherVersao("consideracoes_finais", todas, {}, a)).toBeNull();
    expect(escolherVersao("introducao", [semPadrao], {}, a)).toBeNull();
  });
  it("entre as padrão que o caso atende, vence a mais específica (não a ordem)", () => {
    expect(escolherVersao("introducao", todas, {}, a)?.id).toBe("ssg");
    expect(escolherVersao("introducao", todas, {}, { nivel: null, contexto: ctx({ solucao: "on_premise" }) })?.id).toBe("onp");
    expect(escolherVersao("introducao", todas, {}, { nivel: null, contexto: ctx({}) })?.id).toBe("geral");
  });
  it("a escolha do mapeamento vence, mesmo sem padrão ou sem atender a condição", () => {
    expect(escolherVersao("introducao", todas, { introducao: "rascunho" }, a)?.id).toBe("rascunho");
    expect(escolherVersao("introducao", todas, { introducao: "onp" }, a)?.id).toBe("onp");
  });
  it("'sistema' força o texto original; versão apagada cai no padrão", () => {
    expect(escolherVersao("introducao", todas, { introducao: "sistema" }, a)).toBeNull();
    expect(escolherVersao("introducao", todas, { introducao: "sumiu" }, a)?.id).toBe("ssg");
  });
  it("versão sem conteúdo é ignorada e o slot vem do escopo gravado", () => {
    expect(escolherVersao("introducao", [{ ...geral, blocos: [] }], {}, a)).toBeNull();
    expect(lerSlot(geral.escopo)).toEqual({ slot: "introducao", padrao: true });
    expect(lerSlot({ slot: "qualquer" }).slot).toBeNull();
  });
});

const textosDe = (blocos: any[]) => blocos.map((b) => b.texto ?? (b.itens ?? []).join(" ")).join("\n");
const montar = (extra: Record<string, any>, config: Record<string, unknown> = { solucao: "on_premise" }) =>
  montarBlocos({ variaveis, materiais: [], cabecalho: cab, contexto: ctx(config), ...extra }) as any[];

describe("textos do documento no template", () => {
  it("sem versão cadastrada o documento mantém o texto original (Introdução e Instruções com as chaves de sempre)", () => {
    const b = montar({});
    expect(textosDe(b)).toContain("Este documento apresenta o resultado do mapeamento técnico realizado para Destilaria Seis Lagoas");
    expect(textosDe(b)).toContain("da solução On-premise");
    expect(b.filter((x) => x.chave?.startsWith("instrucoes:")).map((x) => x.chave)).toEqual(["instrucoes:1", "instrucoes:2", "instrucoes:3"]);
    expect(b.some((x) => x.chave?.startsWith("texto:"))).toBe(false);
    expect(b.some((x) => x.texto === "Considerações finais")).toBe(false);
    // o primeiro parágrafo da Introdução segue como campo de revisão (amarelo no editor)
    expect(b.find((x) => x.tipo === "paragraph" && /^Este documento apresenta/.test(x.texto))?.destaque).toBe("editavel");
  });

  it("uma Introdução nova (padrão) substitui a original, com campos preenchidos e chaves da versão", () => {
    const intro = versao("v2", "introducao", "!Documento de {{cliente}} — {{solucao}}, {{nivel}}.\n\nSegundo parágrafo novo.", { padrao: true });
    const b = montar({ textosPadrao: [intro] });
    const novos = b.filter((x) => x.chave?.startsWith("texto:introducao:v2:"));
    expect(novos.map((x) => x.chave)).toEqual(["texto:introducao:v2:0", "texto:introducao:v2:1"]);
    expect(novos[0].texto).toBe("Documento de Destilaria Seis Lagoas — On-premise, Nível 2.");
    expect(novos[0].destaque).toBe("editavel");
    expect(textosDe(b)).not.toContain("Este documento apresenta o resultado");
    // o resto do documento não muda
    expect(b.some((x) => x.chave === "instrucoes:1")).toBe(true);
  });

  it("escolha por mapeamento troca só aquele caso; 'sistema' volta ao original", () => {
    const intro = versao("v2", "introducao", "Texto alternativo.", {});
    expect(textosDe(montar({ textosPadrao: [intro], textosEscolhidos: { introducao: "v2" } }))).toContain("Texto alternativo.");
    expect(textosDe(montar({ textosPadrao: [intro] }))).not.toContain("Texto alternativo.");
    const padrao = versao("v3", "introducao", "Padrão novo.", { padrao: true });
    expect(textosDe(montar({ textosPadrao: [padrao], textosEscolhidos: { introducao: "sistema" } }))).toContain("Este documento apresenta");
  });

  it("dado ausente num campo vira [CONFIRMAR] (o PDF segue bloqueado)", () => {
    const intro = versao("v2", "introducao", "Ação: {{tipo_acao}}.", { padrao: true });
    expect(textosDe(montar({ textosPadrao: [intro] }))).toContain("[CONFIRMAR: tipo de ação");
  });

  it("Instruções gerais: a versão substitui os três parágrafos oficiais", () => {
    const ins = versao("ins2", "instrucoes_gerais", "Nova instrução única.", { padrao: true });
    const b = montar({ textosPadrao: [ins] });
    expect(b.some((x) => x.chave?.startsWith("instrucoes:"))).toBe(false);
    expect(b.find((x) => x.chave === "texto:instrucoes_gerais:ins2:0")?.texto).toBe("Nova instrução única.");
  });

  it("Considerações finais: seção nova só quando há versão aplicável, depois das Instruções", () => {
    const fim = versao("fim", "consideracoes_finais", "Agradecemos a parceria.", { padrao: true, nivel: ["nivel_2"] });
    const b = montar({ textosPadrao: [fim] });
    const iTitulo = b.findIndex((x) => x.chave === "consideracoes_finais:titulo");
    expect(iTitulo).toBeGreaterThan(b.findIndex((x) => x.chave === "instrucoes:3"));
    expect(b[iTitulo]).toMatchObject({ tipo: "heading", texto: "Considerações finais", nivel: 1 });
    expect(b[iTitulo + 1].texto).toBe("Agradecemos a parceria.");
    // condição não atendida (Nível 1): a seção não aparece
    const n1 = montarBlocos({ variaveis: { ...variaveis, nivel_servico: nova("nivel_servico", "nivel_1") }, materiais: [], cabecalho: cab, contexto: ctx({ solucao: "on_premise" }), textosPadrao: [fim] }) as any[];
    expect(n1.some((x) => x.chave === "consideracoes_finais:titulo")).toBe(false);
  });

  it("TI e banco de dados: a versão troca o texto e mantém as tabelas (On-premise); SSGFrota sem regra continua sem a seção", () => {
    const ti = versao("ti2", "ti_bd", "- Requisito novo de TI.", { padrao: true });
    const onp = montar({ textosPadrao: [ti] });
    expect(onp.find((x) => x.chave === "texto:ti_bd:ti2:0")?.itens).toEqual(["Requisito novo de TI."]);
    expect(textosDe(onp)).not.toContain("TeamViewer");
    expect(onp.some((x) => x.tipo === "table" && /servidor/i.test(x.titulo ?? ""))).toBe(true);

    const ssgSemRegra = montar({ textosPadrao: [{ ...ti, escopo: escopoDaVersao("ti_bd", true, { solucao: ["on_premise"], nivel: [], exige: [] }) }] }, { solucao: "ssg_frota" });
    expect(ssgSemRegra.some((x) => x.texto === "Equipamentos de TI e banco de dados")).toBe(false);

    // regra explícita para SSGFrota: a seção aparece só com o texto (sem as tabelas do SAAF)
    const ssg = montar({ textosPadrao: [versao("ti3", "ti_bd", "- Internet para o SSGFrota.", { padrao: true, solucao: ["ssg_frota"] })] }, { solucao: "ssg_frota" });
    expect(ssg.some((x) => x.texto === "Equipamentos de TI e banco de dados")).toBe(true);
    expect(ssg.find((x) => x.chave === "texto:ti_bd:ti3:0")?.itens).toEqual(["Internet para o SSGFrota."]);
    expect(ssg.some((x) => x.tipo === "table" && /servidor/i.test(x.titulo ?? ""))).toBe(false);
  });
});

describe("nome da nova versão", () => {
  it("acrescenta v2, incrementa e não repete nome existente", () => {
    expect(nomeDaNovaVersao("Introdução 2026", [])).toBe("Introdução 2026 v2");
    expect(nomeDaNovaVersao("Introdução 2026 v2", [])).toBe("Introdução 2026 v3");
    expect(nomeDaNovaVersao("Introdução", ["Introdução v2", "introdução v3"])).toBe("Introdução v4");
  });
});

// ------------------------------------------------------------------ Etapa 2: demais textos do documento
const ctxCompleto = (config: Record<string, unknown>, frota?: Record<string, unknown>) =>
  montarContextoLaudo({ entidades: [], arvore: { ...arvoreVazia(), config, ...(frota ? { frota } : {}) } as any, respostas: [] });
const cfgCompleta = { solucao: "on_premise", comunicacao: "ambos", rfid: { ativo: true, itens: [{ tecnologia: "Mifare", quantidade: 10 }] }, tx: { ativo: true, itens: [{ quantidade: 2 }] } };
const frotaDiv = { ativo: true, itens: [{ modelo: "Scania", quantidade: 3 }, { modelo: "Volvo", quantidade: 1 }] };
const varsWifi: VariaveisLaudo = { ...variaveis, frequencia_wifi: nova("frequencia_wifi", "2.4 GHz"), qualidade_wifi: nova("qualidade_wifi", "boa"), comunicacao_tipos: nova("comunicacao_tipos", "WiFi, 4G"), operadora_gsm: nova("operadora_gsm", "Claro") };
const montar2 = (extra: Record<string, any>, config: Record<string, unknown> = cfgCompleta, vars: VariaveisLaudo = varsWifi, frota: Record<string, unknown> | undefined = frotaDiv) =>
  montarBlocos({ variaveis: vars, materiais: [], cabecalho: cab, contexto: ctxCompleto(config, frota), ...extra }) as any[];
const porChave = (b: any[], prefixo: string) => b.filter((x) => x.chave?.startsWith(prefixo));

describe("Etapa 2: textos de Wi-Fi, GSM e rádio", () => {
  it("sem versão, o documento mantém o texto gerado das respostas e o texto do rádio", () => {
    const b = montar2({});
    expect(textosDe(b)).toContain("A unidade dispõe de rede Wi-Fi operando em 2.4 GHz");
    expect(textosDe(b)).toContain("A comunicação entre o terminal e os periféricos sem fio ocorre em rádio 2.4GHz");
  });
  it("Wi-Fi: a versão substitui o texto técnico gerado e mantém tabela de condições, velocidades e prints", () => {
    const wifi = versao("w2", "wifi", "Wi-Fi em {{frequencia_wifi}} ({{potencia_wifi}}) para a aplicação {{aplicacao}}.", { padrao: true });
    const b = montar2({ textosPadrao: [wifi], fotosTransferencia: [{ tipo: "wifi_detalhes" as const, url: "https://x/d.png" }] });
    expect(b.find((x) => x.chave === "texto:wifi:w2:0")?.texto).toBe("Wi-Fi em 2.4 GHz (boa) para a aplicação SAAF.");
    expect(textosDe(b)).not.toContain("A unidade dispõe de rede Wi-Fi operando");
    expect(b.some((x) => x.chave === "dados:foto_wifi_detalhes")).toBe(true);
    // o texto do GSM continua o gerado
    expect(textosDe(b)).toContain("A comunicação por GSM/4G é viável no local");
  });
  it("GSM e rádio: versões próprias, cada uma no seu lugar", () => {
    const gsm = versao("g2", "gsm", "GSM com a operadora {{operadora_gsm}}.", { padrao: true });
    const radio = versao("r2", "radio", "Rádio novo.", { padrao: true });
    const b = montar2({ textosPadrao: [gsm, radio] });
    expect(b.find((x) => x.chave === "texto:gsm:g2:0")?.texto).toBe("GSM com a operadora Claro.");
    expect(b.find((x) => x.chave === "texto:radio:r2:0")?.texto).toBe("Rádio novo.");
    const i = (c: string) => b.findIndex((x) => x.chave === c);
    expect(i("texto:gsm:g2:0")).toBeGreaterThan(i("dados:gsm"));
    expect(i("texto:radio:r2:0")).toBeGreaterThan(i("dados:radio"));
    expect(textosDe(b)).not.toContain("alcance sujeito a obstruções metálicas");
  });
});

describe("Etapa 2: Nível 2 (bicos) com desenhos", () => {
  it("o texto original do slot é exatamente o que o gerador produz (sem deriva)", () => {
    const render = (itens: any[]) => itens.map((i) => (i.tipo === "figura" ? `[${i.nome}]` : i.tipo === "bullets" ? i.itens.join("|") : renderizarCampos(i.texto, { solucao: "X" })));
    const gerado = blocos24({ solucao: "X", id: (p) => p })
      .filter((b) => b.tipo !== "heading")
      .map((b: any) => (b.tipo === "image" ? `[${b.url.includes("ponteira") ? "ponteira" : "bico"}]` : b.tipo === "bullets" ? b.itens.join("|") : b.texto));
    expect(render(TEXTO_ORIGINAL.nivel2)).toEqual(gerado);
  });
  it("a versão troca os textos e desenhos, mantém o título, e os desenhos entram numerados", () => {
    const n2 = versao("n2", "nivel2", "Texto novo dos bicos para {{solucao}}.\n\n[figura:bico]\n\n- item A\n- item B", { padrao: true });
    const b = montar2({ textosPadrao: [n2] });
    expect(b.some((x) => x.chave === "nivel2:2.4" && x.texto === "Bicos de abastecimento")).toBe(true);
    expect(b.some((x) => x.chave?.startsWith("nivel2:2.4:"))).toBe(false);
    const novos = porChave(b, "texto:nivel2:n2:");
    expect(novos.map((x) => x.tipo)).toEqual(["paragraph", "image", "bullets"]);
    expect(novos[0].texto).toBe("Texto novo dos bicos para On-premise.");
    expect(novos[1].legenda).toMatch(/^Figura \d+ — /);
  });
  it("fora do Nível 2 a versão não faz nada", () => {
    const n2 = versao("n2", "nivel2", "Texto novo.", { padrao: true });
    const b = montar2({ textosPadrao: [n2] }, cfgCompleta, { ...varsWifi, nivel_servico: nova("nivel_servico", "nivel_1") });
    expect(b.some((x) => x.chave?.startsWith("texto:nivel2:"))).toBe(false);
  });
  it("[figura:…] ida e volta no corpo; nome desconhecido vira parágrafo comum", () => {
    const itens = corpoParaItens("[figura:suporte]\n\n[figura:inventada]");
    expect(itens).toEqual([{ tipo: "figura", nome: "suporte" }, { tipo: "paragraph", texto: "[figura:inventada]" }]);
    expect(itensParaCorpo([{ tipo: "figura", nome: "bico" }])).toBe("[figura:bico]");
    expect(blocosParaItens(itensParaBlocos([{ tipo: "figura", nome: "ponteira" }]))).toEqual([{ tipo: "figura", nome: "ponteira" }]);
  });
});

describe("Etapa 2: RFID, DIV e TX", () => {
  it("sem versão, as seções ficam como sempre (RFID com texto do Escopo, TX com espaço a confirmar)", () => {
    const b = montar2({});
    expect(b.find((x) => x.chave === "rfid:resumo")?.texto).toContain("10 cartões RFID, tecnologia Mifare");
    expect(b.find((x) => x.chave === "tx:texto")?.texto).toContain("[CONFIRMAR: texto da Telemetria TX]");
    expect(b.find((x) => x.chave === "div:resumo")?.texto).toContain("Estão previstos 4 DIV");
  });
  it("a versão do RFID substitui os parágrafos e usa os campos do Escopo; o título fica", () => {
    const rfid = versao("rf2", "rfid", "Cartões: {{rfid_quantidade}} ({{rfid_tecnologia}}).", { padrao: true });
    const b = montar2({ textosPadrao: [rfid] });
    expect(b.some((x) => x.chave === "rfid:titulo")).toBe(true);
    expect(b.some((x) => x.chave === "rfid:resumo" || x.chave === "rfid:compatibilidade")).toBe(false);
    expect(b.find((x) => x.chave === "texto:rfid:rf2:0")?.texto).toBe("Cartões: 10 cartões RFID (Mifare).");
  });
  it("a versão do DIV troca o texto e mantém a tabela automática por tipo", () => {
    const div = versao("dv2", "div", "Previstos {{div_total}} DIV.", { padrao: true });
    const b = montar2({ textosPadrao: [div] });
    expect(b.find((x) => x.chave === "texto:div:dv2:0")?.texto).toBe("Previstos 4 DIV.");
    expect(b.some((x) => x.chave === "div:resumo")).toBe(false);
    expect(b.find((x) => x.chave === "div:tipos")?.linhas.map((l: any) => l.celulas)).toEqual([["Scania", "3"], ["Volvo", "1"]]);
  });
  it("a versão da TX substitui o espaço a confirmar (campo {{tx_quantidade}})", () => {
    const tx = versao("tx2", "tx", "Telemetria com {{tx_quantidade}} TX.", { padrao: true });
    const b = montar2({ textosPadrao: [tx] });
    expect(b.some((x) => x.chave === "tx:texto")).toBe(false);
    expect(b.find((x) => x.chave === "texto:tx:tx2:0")?.texto).toBe("Telemetria com 2 TX.");
    expect(textosDe(b)).not.toContain("[CONFIRMAR: texto da Telemetria TX]");
  });
  it("sem o item no Escopo a seção (e a versão) não aparece", () => {
    const rfid = versao("rf2", "rfid", "Cartões.", { padrao: true });
    const b = montar2({ textosPadrao: [rfid] }, { solucao: "on_premise" }, varsWifi, undefined);
    expect(b.some((x) => x.chave?.startsWith("texto:rfid:") || x.chave === "rfid:titulo")).toBe(false);
  });
});

describe("Etapa 2: campos por texto e posição dos blocos adicionais", () => {
  it("cada texto oferece só os campos que fazem sentido", () => {
    const chaves = (slot: any) => camposDoSlot(slot).map((c) => c.chave);
    expect(chaves("rfid")).toContain("rfid_tecnologia");
    expect(chaves("rfid")).not.toContain("div_total");
    expect(chaves("introducao")).toContain("origem_dados");
    expect(chaves("radio")).toEqual(expect.arrayContaining(["cliente", "solucao", "aplicacao"]));
  });
  it("blocos adicionais automáticos entram na posição escolhida", () => {
    const bloco = (id: string, posicao?: string) => ({ id, nome: id, ordem: 0, escopo: { automatico: true, ...(posicao ? { posicao } : {}) }, blocos: [{ id: `${id}-p`, tipo: "paragraph" as const, texto: `Texto ${id}` }] });
    const b = montar2({ blocosPadrao: [bloco("fim", "fim"), bloco("apos", "apos_introducao"), bloco("antes")] });
    const i = (t: string) => b.findIndex((x) => x.texto === t);
    expect(i("Texto apos")).toBeGreaterThan(b.findIndex((x) => x.texto === "Introdução"));
    expect(i("Texto apos")).toBeLessThan(b.findIndex((x) => x.texto === "Projeto"));
    expect(i("Texto antes")).toBeLessThan(b.findIndex((x) => x.texto === "Instruções gerais"));
    expect(i("Texto fim")).toBeGreaterThan(b.findIndex((x) => x.chave === "instrucoes:3"));
  });
});

// ------------------------------------------------------------------ formatação e imagens da biblioteca
import { renderizarCampos as renderCampos } from "./textos-padrao";

const versaoDeItens = (id: string, slot: any, itens: any[], extra: Record<string, any> = {}): VersaoTexto => ({
  id, nome: id, ordem: 0, escopo: escopoDaVersao(slot, extra.padrao ?? true, { solucao: [], nivel: [], exige: [] }), blocos: itensParaBlocos(itens),
});

describe("texto com formatação nas versões", () => {
  it("formatação e alinhamento sobrevivem ao salvar e ao gerar o documento", () => {
    const itens = [
      { tipo: "paragraph" as const, texto: "Para **{{cliente}}**, em *{{modalidade}}*", rico: true, alinhamento: "centro" as const, caixaAlta: true },
      { tipo: "bullets" as const, itens: ["item **forte**"], rico: true },
    ];
    expect(blocosParaItens(itensParaBlocos(itens))).toEqual(itens);
    const b = montar2({ textosPadrao: [versaoDeItens("fm", "introducao", itens)] });
    const p = b.find((x) => x.chave === "texto:introducao:fm:0");
    expect(p).toMatchObject({ tipo: "paragraph", rico: true, alinhamento: "centro", caixaAlta: true });
    expect(p.texto).toBe("Para **Destilaria Seis Lagoas**, em *[CONFIRMAR: modalidade]*");
    expect(b.find((x) => x.chave === "texto:introducao:fm:1")).toMatchObject({ tipo: "bullets", rico: true });
  });
  it("valor de campo com asterisco ou mais não vira formatação por acaso", () => {
    expect(renderCampos("Cliente: {{c}}", { c: "A*B ++C++" }, { escapar: true })).toBe("Cliente: A\\*B \\+\\+C\\+\\+");
    expect(renderCampos("Cliente: {{c}}", { c: "A*B" })).toBe("Cliente: A*B");
  });
  it("parágrafo comum continua sem as chaves novas (documento idêntico)", () => {
    const b = montar2({ textosPadrao: [versaoDeItens("simples", "introducao", [{ tipo: "paragraph", texto: "Texto simples." }])] });
    const p = b.find((x) => x.chave === "texto:introducao:simples:0");
    expect(p).not.toHaveProperty("rico");
    expect(p).not.toHaveProperty("alinhamento");
    expect(p).not.toHaveProperty("caixaAlta");
  });
});

describe("imagens da biblioteca nos textos", () => {
  const imagens = { img1: { id: "img1", nome: "Esquema do painel", url: "https://x/painel.png", alt: "Painel", legenda: "Esquema do painel elétrico", larguraMax: 420 } };
  it("[imagem:id] ida e volta e vira bloco de imagem com Figura N e a referência", () => {
    expect(corpoParaItens("[imagem:img1]")).toEqual([{ tipo: "imagem", id: "img1" }]);
    expect(itensParaCorpo([{ tipo: "imagem", id: "img1" }])).toBe("[imagem:img1]");
    expect(blocosParaItens(itensParaBlocos([{ tipo: "imagem", id: "img1" }]))).toEqual([{ tipo: "imagem", id: "img1" }]);
    const b = montar2({ textosPadrao: [versaoDeItens("im", "introducao", [{ tipo: "paragraph", texto: "Veja:" }, { tipo: "imagem", id: "img1" }])], imagensBiblioteca: imagens });
    const img = b.find((x) => x.chave === "texto:introducao:im:1");
    expect(img).toMatchObject({ tipo: "image", url: "https://x/painel.png", larguraMax: 420, bibliotecaId: "img1" });
    expect(img.legenda).toMatch(/^Figura \d+ — Esquema do painel elétrico$/);
  });
  it("imagem apagada da biblioteca vira pendência visível, nunca some", () => {
    const b = montar2({ textosPadrao: [versaoDeItens("im", "introducao", [{ tipo: "imagem", id: "sumiu" }])], imagensBiblioteca: imagens });
    const x = b.find((y) => y.chave === "texto:introducao:im:0");
    expect(x.tipo).toBe("paragraph");
    expect(x.texto).toContain("[CONFIRMAR: imagem removida da biblioteca");
  });
});
