import { describe, expect, it } from "vitest";
import { descendentesDoTipo, filhosDoTipo, mesclarCatalogo, paisPossiveis, tiposRaiz } from "./catalogo-tipos";
import { montarNavegacao, type ItemNav } from "./navegacao-entidades";
import { arvoreDeEntidades, arvoreVazia, contarItensExtras, entidadesDesejadas, normalizarArvore, quantidadesDoEscopo, resumoArvore, type ArvoreEscopo, type EntidadeEscopo } from "./tipos";
import { montarContextoLaudo } from "@/lib/laudo/contexto";
import { blocosItensExtras } from "@/lib/laudo/secoes/itens-extras";
import { lerRegra, opcoesExigencia, regraAtende, resumoDaRegra } from "@/lib/laudo/blocos-padrao-regras";

const cat = mesclarCatalogo([
  { chave: "predio", rotulo: "Prédio", plural: "Prédios" },
  { chave: "andar", rotulo: "Andar", plural: "Andares", pai: "predio" },
  { chave: "sala", rotulo: "Sala", plural: "Salas", pai: "andar" },
  { chave: "camera", rotulo: "Câmera", plural: "Câmeras", pai: "comboio" },
]);

/** Entidades (lista plana) a partir da árvore, como o banco devolveria. */
function entidadesDaArvore(a: ArvoreEscopo): EntidadeEscopo[] {
  const d = entidadesDesejadas(a, cat);
  const idPorChave = new Map(d.map((x, i) => [x.chave, `e${i}`]));
  return d.map((x) => ({
    id: idPorChave.get(x.chave)!,
    tipo: x.tipo,
    parent_id: x.paiChave ? idPorChave.get(x.paiChave)! : null,
    ordem: x.ordem,
    rotulo: x.rotulo,
    dados: x.nome ? { nome: x.nome } : {},
  }));
}

const arvore = (): ArvoreEscopo =>
  normalizarArvore({
    ...arvoreVazia(),
    postos: [{ ilhas: [{ bombas: [{ bicos: 2, filhos: { camera: [{}] } }], filhos: { camera: [{ nome: "Ilha" }] } }], filhos: { predio: [{ nome: "Loja" }] } }],
    comboios: [{ tanques: 1, bicos: 1, filhos: { camera: [{}, {}] } }],
    extras: {
      predio: [
        { nome: "A", filhos: { andar: [{ filhos: { sala: [{}, { nome: "TI" }] } }, {}] } },
        { filhos: { andar: [{}] } },
      ],
    },
  });

describe("catálogo: vínculo entre tipos", () => {
  it("pai válido: tipo do sistema que aceita filhos ou outro tipo novo", () => {
    expect(cat.find((t) => t.chave === "andar")!.pai).toBe("predio");
    expect(cat.find((t) => t.chave === "camera")!.pai).toBe("comboio");
    expect(tiposRaiz(cat).map((t) => t.chave)).toEqual(["predio"]);
    expect(filhosDoTipo(cat, "comboio").map((t) => t.chave)).toEqual(["camera"]);
    expect(descendentesDoTipo(cat, "predio").map((t) => t.chave)).toEqual(["andar", "sala"]);
  });

  it("pai inválido, ciclo ou próprio tipo viram raiz", () => {
    const c = mesclarCatalogo([
      { chave: "a1", rotulo: "A", pai: "b1" },
      { chave: "b1", rotulo: "B", pai: "a1" }, // ciclo
      { chave: "c1", rotulo: "C", pai: "c1" }, // ele mesmo
      { chave: "d1", rotulo: "D", pai: "bico" }, // bico não aceita filhos
      { chave: "e1", rotulo: "E", pai: "naoexiste" },
    ]);
    expect(c.filter((t) => !t.sistema).map((t) => t.pai)).toEqual([null, null, null, null, null]);
  });

  it("paisPossiveis exclui o próprio tipo e o que está dentro dele", () => {
    const valores = paisPossiveis(cat, "predio").map((o) => o.value);
    expect(valores).toContain("posto");
    expect(valores).toContain("comboio");
    expect(valores).not.toContain("bico");
    expect(valores).not.toContain("predio");
    expect(valores).not.toContain("andar");
    expect(valores).not.toContain("sala");
    expect(paisPossiveis(cat, "andar").map((o) => o.value)).toContain("predio");
  });
});

describe("árvore com tipos novos dentro de outros", () => {
  it("ida e volta idêntica em 3 níveis e dentro de posto, ilha, bomba e comboio", () => {
    const a = arvore();
    const volta = normalizarArvore(arvoreDeEntidades(entidadesDaArvore(a)));
    expect(volta.extras).toEqual(a.extras);
    expect(volta.postos).toEqual(a.postos);
    expect(volta.comboios).toEqual(a.comboios);
  });

  it("conta os itens de cada tipo em todos os níveis", () => {
    const a = arvore();
    expect(contarItensExtras(a)).toEqual({ camera: 4, predio: 3, andar: 3, sala: 2 });
    expect(resumoArvore(a).extras.sala).toBe(2);
    expect(quantidadesDoEscopo(a).andar).toBe(3);
  });

  it("entidades: o pai é o item de verdade (chave por caminho, pai antes do filho)", () => {
    const d = entidadesDesejadas(arvore(), cat);
    const chaves = d.map((x) => x.chave);
    expect(chaves).toContain("predio:1/andar:1/sala:2");
    expect(chaves).toContain("posto:1/ilha:1/bomba:1/camera:1");
    expect(chaves).toContain("comboio:1/camera:2");
    expect(chaves.indexOf("predio:1")).toBeLessThan(chaves.indexOf("predio:1/andar:1"));
    expect(d.find((x) => x.chave === "predio:1/andar:1/sala:2")!.rotulo).toBe("Sala 02 — TI");
  });

  it("árvore antiga e listas vazias continuam iguais; chave inválida é descartada", () => {
    const a = normalizarArvore({ ...arvoreVazia(), extras: { predio: [{ filhos: { andar: [], "Ruim!": [{}] } }] } });
    expect(a.extras).toEqual({ predio: [{ nome: undefined }] });
    expect(normalizarArvore(arvoreVazia()).extras).toBeUndefined();
  });
});

describe("agente e documento com tipos dentro de outros", () => {
  const ent = entidadesDaArvore(arvore());
  const item = (id: string, entidadeId: string): ItemNav => ({
    id, entidadeId, obrigatoria: true, respondida: false, completa: false, texto: "P", valor: "", etapaId: "e", etapaTitulo: "E", etapaOrdem: 1,
  });

  it("navegação: câmera do comboio e andares do prédio ficam dentro do pai (subs)", () => {
    const comboio = ent.find((e) => e.tipo === "comboio")!;
    const cams = ent.filter((e) => e.tipo === "camera" && e.parent_id === comboio.id);
    const predio = ent.find((e) => e.tipo === "predio" && e.parent_id === null && e.ordem === 1)!;
    const andar = ent.find((e) => e.tipo === "andar" && e.parent_id === predio.id)!;
    const m = montarNavegacao(ent, [item("p1", cams[0].id), item("p2", andar.id)]);
    expect(m.comboios[0].subs.map((s) => s.entidade.tipo)).toEqual(["camera"]);
    expect(m.extras.map((g) => g.tipo)).toEqual(["predio"]);
    expect(m.extras[0].unidades[0].subs.map((s) => s.entidade.tipo)).toEqual(["andar"]);
  });

  it("documento: grupos na ordem pai → filho, com 'Dentro de' e rótulo completo", () => {
    const resp = (e: EntidadeEscopo, v: string) => ({ entidadeId: e.id, chave: null, valor: v, pergunta: "Área" });
    const andares = ent.filter((e) => e.tipo === "andar");
    const ctx = montarContextoLaudo({ entidades: ent, arvore: arvore(), respostas: andares.map((e, i) => resp(e, String(10 + i))), catalogo: cat });
    expect(ctx.extras!.map((g) => g.tipo).sort()).toEqual(["andar", "camera", "predio", "sala"]);
    const idx = (t: string) => ctx.extras!.findIndex((g) => g.tipo === t);
    expect(idx("predio")).toBeLessThan(idx("andar"));
    expect(idx("andar")).toBeLessThan(idx("sala"));
    const andar = ctx.extras![idx("andar")];
    expect(andar.itens.map((i) => i.pai)).toEqual(["Prédio 01 — A", "Prédio 01 — A", "Prédio 02"]);

    const blocos = blocosItensExtras({ contexto: ctx, id: (p) => p })!;
    const tabela = blocos.find((b: any) => b.chave === "extra:andar:tabela") as any;
    expect(tabela.colunas).toEqual(["Item", "Dentro de", "Área"]);
    expect(tabela.linhas[2].celulas).toEqual(["Andar 01", "Prédio 02", "12"]);
  });
});

describe("blocos padrão: 'Só quando o Escopo tiver' com tipos novos", () => {
  const ent2 = entidadesDaArvore(arvore());
  const ctx = montarContextoLaudo({ entidades: ent2, arvore: arvore(), respostas: [], catalogo: cat });
  const regra = (exige: string[]) => ({ automatico: true, solucao: [], nivel: [], exige, posicao: "antes_instrucoes" as const });

  it("opções incluem os tipos novos; ocultos só se já marcados", () => {
    const c = mesclarCatalogo([{ chave: "predio", rotulo: "Prédio" }, { chave: "oculto", rotulo: "Oculto", ativo: false }]);
    expect(opcoesExigencia(c).map((o) => o.valor)).toEqual(["pista", "comboio", "rfid", "tx", "frota", "predio"]);
    expect(opcoesExigencia(c, ["oculto"]).map((o) => o.valor)).toContain("oculto");
  });

  it("atende quando há item do tipo em qualquer nível; não atende sem ele", () => {
    expect(regraAtende(regra(["sala"]), { nivel: null, contexto: ctx })).toBe(true);
    expect(regraAtende(regra(["predio", "comboio"]), { nivel: null, contexto: ctx })).toBe(true);
    expect(regraAtende(regra(["produto"]), { nivel: null, contexto: ctx })).toBe(false);
    expect(regraAtende(regra(["sala"]), { nivel: null, contexto: null })).toBe(false);
  });

  it("lerRegra mantém tipo novo e resumo usa o nome do catálogo", () => {
    const r = lerRegra({ automatico: true, exige: ["predio", "tx", "Inválido!"] });
    expect(r.exige).toEqual(["predio", "tx"]);
    expect(resumoDaRegra(r, cat)).toContain("Prédio e Telemetria TX");
  });
});
