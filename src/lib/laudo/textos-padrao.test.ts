import { describe, expect, it } from "vitest";
import { arvoreVazia } from "@/lib/escopo/tipos";
import { montarContextoLaudo } from "@/lib/laudo/contexto";
import { montarBlocos } from "@/lib/laudo/template";
import type { VariaveisLaudo } from "@/lib/laudo/tipos";
import {
  blocosParaItens,
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
