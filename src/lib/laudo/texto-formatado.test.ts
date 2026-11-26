import { describe, expect, it } from "vitest";
import {
  alternarMarca,
  escaparMarcas,
  palavrasDe,
  parseTexto,
  posicionarLinha,
  quebrarRico,
  semMarcas,
  usaTextoRico,
  type Medidor,
} from "./texto-formatado";

describe("marcas inline", () => {
  it("negrito, itálico e sublinhado, inclusive combinados", () => {
    expect(parseTexto("a **b** c")).toEqual([{ texto: "a " }, { texto: "b", negrito: true }, { texto: " c" }]);
    expect(parseTexto("*itálico* e ++sub++")).toEqual([{ texto: "itálico", italico: true }, { texto: " e " }, { texto: "sub", sublinhado: true }]);
    expect(parseTexto("***tudo***")).toEqual([{ texto: "tudo", negrito: true, italico: true }]);
    expect(parseTexto("**negrito com *itálico* dentro**")).toEqual([
      { texto: "negrito com ", negrito: true },
      { texto: "itálico", negrito: true, italico: true },
      { texto: " dentro", negrito: true },
    ]);
  });
  it("marca sem par e marca escapada ficam como texto; campos e pendências passam intactos", () => {
    expect(semMarcas("preço 5 * 3 = 15")).toBe("preço 5 * 3 = 15");
    expect(semMarcas("**aberto sem fechar")).toBe("**aberto sem fechar");
    expect(semMarcas("literal \\*asterisco\\*")).toBe("literal *asterisco*");
    expect(parseTexto("Para **{{cliente}}** — [CONFIRMAR: objeto do escopo]")).toEqual([
      { texto: "Para " },
      { texto: "{{cliente}}", negrito: true },
      { texto: " — [CONFIRMAR: objeto do escopo]" },
    ]);
    expect(escaparMarcas("2*3+4")).toBe("2\\*3\\+4");
    expect(semMarcas(escaparMarcas("**x** ++y++"))).toBe("**x** ++y++");
  });
  it("texto sem marcas não vira estilo; vazio é vazio", () => {
    expect(parseTexto("simples")).toEqual([{ texto: "simples" }]);
    expect(parseTexto("")).toEqual([]);
  });
});

describe("botões da barra: alternar marca na seleção", () => {
  it("envolve a seleção, devolve a seleção no mesmo texto e desfaz ao repetir", () => {
    const a = alternarMarca("um texto importante aqui", 3, 8, "negrito");
    expect(a.texto).toBe("um **texto** importante aqui");
    expect(a.texto.slice(a.ini, a.fim)).toBe("texto");
    const b = alternarMarca(a.texto, a.ini, a.fim, "negrito");
    expect(b.texto).toBe("um texto importante aqui");
    expect(b.texto.slice(b.ini, b.fim)).toBe("texto");
  });
  it("itálico e sublinhado; itálico dentro de negrito não confunde com a marca do negrito", () => {
    expect(alternarMarca("ab cd", 0, 2, "italico").texto).toBe("*ab* cd");
    expect(alternarMarca("ab cd", 3, 5, "sublinhado").texto).toBe("ab ++cd++");
    const n = alternarMarca("**ab**", 2, 4, "italico");
    expect(n.texto).toBe("***ab***");
    expect(parseTexto(n.texto)).toEqual([{ texto: "ab", negrito: true, italico: true }]);
    expect(alternarMarca(n.texto, n.ini, n.fim, "italico").texto).toBe("**ab**");
  });
  it("seleção vazia insere o par com o cursor no meio; seleção que já traz as marcas as tira", () => {
    const v = alternarMarca("ab", 1, 1, "negrito");
    expect(v.texto).toBe("a****b");
    expect(v.ini).toBe(3);
    expect(alternarMarca("x **ab** y", 2, 8, "negrito").texto).toBe("x ab y");
  });
});

// medidor de teste: cada letra mede 1; negrito mede 1,5 (para provar que a fonte do trecho conta)
const medir: Medidor = (t, f) => t.length * (f === "negrito" || f === "negritoItalico" ? 1.5 : 1);

describe("palavras e quebra de linha com estilos", () => {
  it("palavras do texto, com o estilo de cada pedaço (palavra pode ter pedaços de estilos diferentes)", () => {
    const p = palavrasDe(parseTexto("ab **cd**ef gh"));
    expect(p.map((w) => w.segmentos.map((s) => `${s.texto}:${s.fonte}`))).toEqual([["ab:normal"], ["cd:negrito", "ef:normal"], ["gh:normal"]]);
  });
  it("caixa alta em pt-BR e sublinhado marcado no segmento", () => {
    const p = palavrasDe(parseTexto("ação ++só++"), { caixaAlta: true });
    expect(p.map((w) => w.segmentos[0].texto)).toEqual(["AÇÃO", "SÓ"]);
    expect(p[1].segmentos[0].sublinhado).toBe(true);
  });
  it("quebra pela largura real de cada fonte e respeita a largura menor da primeira linha", () => {
    const palavras = palavrasDe(parseTexto("aaaa bbbb **cccc** dddd"));
    // aaaa(4) + 1 + bbbb(4) = 9 ; + 1 + cccc negrito(6) = 16 > 12 → quebra
    const linhas = quebrarRico(palavras, medir, 12, 12);
    expect(linhas.map((l) => l.palavras.length)).toEqual([2, 2]);
    expect(linhas[0].largura).toBe(9);
    expect(linhas[1].largura).toBe(6 + 1 + 4);
    expect(linhas.map((l) => l.ultima)).toEqual([false, true]);
    const menor = quebrarRico(palavras, medir, 8, 20);
    expect(menor[0].palavras.length).toBe(1);
  });
  it("palavra maior que a linha fica sozinha; sem palavras não há linhas", () => {
    expect(quebrarRico(palavrasDe(parseTexto("enorme")), medir, 3, 3).length).toBe(1);
    expect(quebrarRico([], medir, 10, 10)).toEqual([]);
  });
});

describe("alinhamento", () => {
  const linha = (largura: number, n: number, ultima = false) => ({ palavras: Array.from({ length: n }, () => ({ segmentos: [] })), largura, ultima });
  it("esquerda, centro e direita", () => {
    expect(posicionarLinha(linha(40, 3), "esquerda", 10, 100, 1)).toEqual({ x: 10, espaco: 1 });
    expect(posicionarLinha(linha(40, 3), "centro", 10, 100, 1)).toEqual({ x: 40, espaco: 1 });
    expect(posicionarLinha(linha(40, 3), "direita", 10, 100, 1)).toEqual({ x: 70, espaco: 1 });
  });
  it("justificado distribui a sobra entre as palavras, menos na última linha ou com uma palavra só", () => {
    // largura 40 com 3 palavras e 2 espaços de 1 → palavras somam 38; sobra para 100: (100-38)/2
    expect(posicionarLinha(linha(40, 3), "justificado", 0, 100, 1)).toEqual({ x: 0, espaco: 31 });
    expect(posicionarLinha(linha(40, 3, true), "justificado", 0, 100, 1)).toEqual({ x: 0, espaco: 1 });
    expect(posicionarLinha(linha(40, 1), "justificado", 0, 100, 1)).toEqual({ x: 0, espaco: 1 });
  });
});

describe("quando usar o desenho com formatação", () => {
  it("só com formatação pedida; o parágrafo comum segue o desenho de sempre", () => {
    expect(usaTextoRico({})).toBe(false);
    expect(usaTextoRico({ alinhamento: "justificado" })).toBe(false);
    expect(usaTextoRico({ rico: true })).toBe(true);
    expect(usaTextoRico({ caixaAlta: true })).toBe(true);
    expect(usaTextoRico({ alinhamento: "centro" })).toBe(true);
  });
});

import { aplicarMarcaNoTexto, classeAlinhamento } from "./texto-formatado";

describe("formatar um texto que ainda não era rico", () => {
  it("escapa os símbolos que já existiam e aplica a marca na seleção certa", () => {
    const r = aplicarMarcaNoTexto("2*3 = 6 e importante", false, 8, 20, "negrito");
    expect(r.texto).toBe("2\\*3 = 6 **e importante**");
    expect(semMarcas(r.texto)).toBe("2*3 = 6 e importante");
    expect(r.texto.slice(r.ini, r.fim)).toBe("e importante");
  });
  it("texto já rico usa a seleção como está; classes de alinhamento", () => {
    expect(aplicarMarcaNoTexto("a b", true, 0, 1, "italico").texto).toBe("*a* b");
    expect(classeAlinhamento(undefined)).toBe("indent-8 text-justify");
    expect(classeAlinhamento("centro")).toBe("text-center");
    expect(classeAlinhamento("direita")).toBe("text-right");
    expect(classeAlinhamento("esquerda")).toBe("indent-8 text-left");
  });
});
