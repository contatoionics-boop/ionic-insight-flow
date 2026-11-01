import { describe, expect, it } from "vitest";
import { CHAVES_LAUDO, CHAVES_POR_NOME } from "./chaves";
import { montarContextoLaudo } from "./contexto";
import { arvoreVazia, type EntidadeEscopo } from "@/lib/escopo/tipos";

const ent = (id: string, tipo: EntidadeEscopo["tipo"], rotulo: string, parent_id: string | null, ordem = 0): EntidadeEscopo => ({
  id,
  tipo,
  rotulo,
  parent_id,
  ordem,
});

// 1 posto › 1 ilha › 2 bombas (a segunda com 2 bicos), 2 comboios
const entidades = [
  ent("p1", "posto", "Posto 01", null),
  ent("i1", "ilha", "Ilha 01", "p1"),
  ent("b2", "bomba", "Bomba 02", "i1", 1),
  ent("b1", "bomba", "Bomba 01", "i1", 0),
  ent("k1", "bico", "Bico 01", "b1"),
  ent("k2", "bico", "Bico 01", "b2", 0),
  ent("k3", "bico", "Bico 02", "b2", 1),
  ent("c2", "comboio", "Comboio 02", null, 1),
  ent("c1", "comboio", "Comboio 01", null, 0),
  ent("k4", "bico", "Bico 01", "c1"),
];
const arvore = { ...arvoreVazia(), postos: [{ ilhas: [] }], config: { solucao: "on_premise", rfid: { ativo: true, itens: [{ tecnologia: "Mifare", quantidade: 70 }] } } } as any;
const r = (entidadeId: string | null, chave: string | null, valor: string | null) => ({ entidadeId, chave, valor });

describe("montarContextoLaudo", () => {
  const ctx = montarContextoLaudo({
    entidades,
    arvore,
    respostas: [
      r("b1", "combustivel", "Etanol"),
      r("b1", "vazao", "30"),
      r("b2", "combustivel", "Diesel S500"),
      r("b2", "alta_vazao", "sim"),
      r("k2", "bitola_bico", '1"'),
      r("c1", "identificacao_comboio", "Comboio 400"),
      r(null, "velocidade_download_mbps", "9.67"),
      r("b1", null, "ignorada: sem chave"),
      r("b1", "marca_bomba", "  "),
    ],
  });

  it("uma bomba por entidade, na ordem da pista, com posto e ilha", () => {
    expect(ctx.bombas.map((b) => b.rotulo)).toEqual(["Bomba 01", "Bomba 02"]);
    expect(ctx.bombas[0]).toMatchObject({ posto: "Posto 01", ilha: "Ilha 01" });
  });
  it("atributos por chave semântica; vazios e sem chave são ignorados", () => {
    expect(ctx.bombas[0].atributos).toEqual({ combustivel: "Etanol", vazao: "30" });
    expect(ctx.bombas[1].atributos).toMatchObject({ combustivel: "Diesel S500", alta_vazao: "sim" });
  });
  it("quantidade de bicos vem das entidades filhas; bico fica no contexto da sua bomba", () => {
    expect(ctx.bombas.map((b) => b.qtdBicos)).toEqual([1, 2]);
    expect(ctx.bombas[1].bicos[0].atributos.bitola_bico).toBe('1"');
    expect(ctx.comboios[0].qtdBicos).toBe(1);
  });
  it("comboio usa a identificação respondida ou, sem ela, o rótulo do Escopo", () => {
    expect(ctx.comboios.map((c) => c.identificacao)).toEqual(["Comboio 400", "Comboio 02"]);
  });
  it("escopo: solução, RFID, quantidades e respostas gerais", () => {
    expect(ctx.escopo).toMatchObject({ solucao: "on_premise", temPista: true, temComboio: true, qtdBombas: 2, qtdComboios: 2 });
    expect(ctx.escopo.rfid).toEqual({ ativo: true, quantidade: 70, tecnologias: ["Mifare"] });
    expect(ctx.gerais.velocidade_download_mbps).toBe("9.67");
  });
  it("sem estrutura: contexto vazio, sem pista nem comboio", () => {
    const v = montarContextoLaudo({ entidades: [], arvore: arvoreVazia(), respostas: [] });
    expect(v.escopo).toMatchObject({ temPista: false, temComboio: false, qtdBombas: 0 });
    expect(v.bombas).toEqual([]);
  });
});

describe("chaves do laudo", () => {
  it("são únicas e todas têm rótulo", () => {
    expect(new Set(CHAVES_LAUDO.map((c) => c.chave)).size).toBe(CHAVES_LAUDO.length);
    expect(CHAVES_LAUDO.every((c) => c.rotulo.trim())).toBe(true);
  });
  it("as chaves da Fase 0 estão registradas, cada uma no escopo certo", () => {
    const esperado: Record<string, string> = {
      modelo_bomba: "bomba", combustivel: undefined as any, alta_vazao: "bomba", bico_ausente: "bomba",
      bitola_bico: "bico", bitola_mangueira: "bico", modelo_bico: "bico",
      identificacao_comboio: "comboio", placa_comboio: "comboio", qtd_blocos_medidores: "comboio",
      velocidade_download_mbps: "geral", velocidade_upload_mbps: "geral", ssid_rede: "geral",
    };
    for (const [chave, escopo] of Object.entries(esperado)) {
      expect(CHAVES_POR_NOME.has(chave)).toBe(true);
      if (escopo) expect(CHAVES_POR_NOME.get(chave)!.escopo).toBe(escopo);
    }
  });
});
