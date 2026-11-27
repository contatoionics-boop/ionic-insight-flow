import { describe, expect, it } from "vitest";
import { normalizarOrdemSecoes, ordenarSecoesDocumento, secaoDoTitulo } from "./ordem-secoes";
import { SLOTS_TEXTO } from "./textos-padrao";
import { comChaves, mesclarDocumento } from "./mesclar";
import type { BlocoLaudo } from "./tipos";
import { montarBlocos } from "./template";
import { buildLaudoPdf } from "../pdf-laudo.server";
import { extractText } from "unpdf";

const h = (id: string, chave: string, texto: string, nivel: 1 | 2 | 3 = 1): BlocoLaudo => ({ id, chave, tipo: "heading", numero: "1", texto, nivel });
const p = (id: string): BlocoLaudo => ({ id, tipo: "paragraph", texto: id });
const ordem = normalizarOrdemSecoes(["radio", "gsm", "wifi", "instrucoes_gerais", "introducao"]);

describe("ordem compartilhada das seções", () => {
  it("restaura a ordem salva, remove repetições e inclui novas seções", () => {
    const salva = JSON.parse(JSON.stringify(["radio", "wifi", "radio", "invalida"]));
    expect(normalizarOrdemSecoes(salva).slice(0, 3)).toEqual(["radio", "wifi", "introducao"]);
    expect(normalizarOrdemSecoes(salva)).toHaveLength(SLOTS_TEXTO.length);
  });
  it("move seções completas do documento, não somente seus textos", () => {
    const imagem: BlocoLaudo = { id: "foto-wifi", tipo: "image", url: "/foto.png", alt: "", legenda: "Figura 9 — Foto" };
    const tabela: BlocoLaudo = { id: "tabela-wifi", tipo: "table", titulo: null, colunas: ["Valor"], linhas: [{ celulas: ["10"] }] };
    const blocos = [h("intro", "heading:1:introducao", "Introdução"), p("intro-texto"), h("infra", "infra", "Infraestrutura"),
      h("transferencia", "transferencia", "Transferência", 2), h("wifi", "dados:wifi", "WiFi", 3), p("wifi-texto"), tabela, imagem,
      h("gsm", "dados:gsm", "GSM / 4G", 3), p("gsm-texto"), h("radio", "dados:radio", "Rádio 2.4GHz", 3), p("radio-texto"),
      h("objeto", "objeto", "Objeto", 2), p("objeto-texto"), h("instrucoes", "heading:1:instrucoes-gerais", "Instruções gerais"), p("instrucoes-texto")];
    const resultado = ordenarSecoesDocumento(blocos, ordem);
    expect(resultado.map(secaoDoTitulo).filter(Boolean)).toEqual(["radio", "gsm", "wifi", "instrucoes_gerais", "introducao"]);
    const wifi = resultado.findIndex((b) => b.id === "wifi");
    expect(resultado.slice(wifi, wifi + 4).map((b) => b.id)).toEqual(["wifi", "wifi-texto", "tabela-wifi", "foto-wifi"]);
    expect(resultado.find((b) => b.id === "tabela-wifi")).toEqual(tabela);
    expect(resultado.find((b) => b.id === "foto-wifi")).toMatchObject({ legenda: "Figura 1 — Foto" });
    expect(resultado.some((b) => b.id === "objeto-texto")).toBe(true);
    expect(new Set(resultado.map((b) => b.id)).size).toBe(resultado.length);
  });
  it("mantém o formato original quando não foi escolhida outra ordem", () => {
    const blocos = [h("intro", "heading:1:introducao", "Introdução"), p("intro-texto")];
    expect(ordenarSecoesDocumento(blocos, null)).toBe(blocos);
    expect(ordenarSecoesDocumento(blocos, [...SLOTS_TEXTO])).toBe(blocos);
  });
  it("permite voltar à ordem original após já ter movido as seções", () => {
    const blocos = [h("intro", "heading:1:introducao", "Introdução"), p("intro-texto"), h("radio", "dados:radio", "Rádio 2.4GHz", 3), p("radio-texto")];
    const movidos = ordenarSecoesDocumento(blocos, ordem);
    expect(ordenarSecoesDocumento(movidos, [...SLOTS_TEXTO]).map(secaoDoTitulo).filter(Boolean)).toEqual(["introducao", "radio"]);
  });
  it("preserva as revisões manuais e mantém a ordem após regenerar", () => {
    const blocos = comChaves([h("intro", "heading:1:introducao", "Introdução"), { ...p("revisto"), editado_manualmente: true }, h("radio", "dados:radio", "Rádio 2.4GHz", 3), p("radio-texto")]);
    const anterior = ordenarSecoesDocumento(blocos, ordem);
    const novos = blocos.map((b) => b.id === "revisto" ? { ...b, texto: "Novo texto" } as BlocoLaudo : b);
    const resultado = ordenarSecoesDocumento(mesclarDocumento(anterior, novos).blocos, ordem);
    expect(resultado.map(secaoDoTitulo).filter(Boolean)).toEqual(["radio", "introducao"]);
    expect(resultado.find((b) => b.id === "revisto")).toMatchObject({ texto: "revisto", editado_manualmente: true });
  });
  it("aplica a ordem ao documento real sem ativar seções fora do escopo", () => {
    const original = comChaves(montarBlocos({ variaveis: {}, materiais: [], cabecalho: { cliente: "C", unidade: "U", data: "", agente: "", especialista: "", modalidade: null } }));
    const resultado = ordenarSecoesDocumento(original, ordem);
    expect(resultado.map(secaoDoTitulo).filter(Boolean)).toEqual(["radio", "gsm", "wifi", "instrucoes_gerais", "introducao"]);
    expect(resultado.filter((b) => b.tipo !== "heading").map((b) => b.id).sort()).toEqual(original.filter((b) => b.tipo !== "heading").map((b) => b.id).sort());
    expect(resultado.some((b) => secaoDoTitulo(b) === "rfid")).toBe(false);
  });
  it("emite o PDF com as seções na sequência escolhida", async () => {
    const blocos = [h("intro", "heading:1:introducao", "Introdução"), p("conteudo-introducao"), h("radio", "dados:radio", "Rádio 2.4GHz", 3), p("conteudo-radio")];
    const bytes = await buildLaudoPdf({
      meta: { titulo: "Resultado", codigo: null, revisao: null, empresaNome: "IONICS", cliente: "C", unidade: "U", data: "", agente: "" },
      blocos: ordenarSecoesDocumento(blocos, ordem),
    });
    const { text } = await extractText(bytes, { mergePages: true });
    expect(text.indexOf("conteudo-radio")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("conteudo-introducao")).toBeGreaterThan(text.indexOf("conteudo-radio"));
  });
});