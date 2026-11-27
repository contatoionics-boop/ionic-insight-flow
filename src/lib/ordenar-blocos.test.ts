import { describe, expect, it } from "vitest";
import { aplicarOrdem, moverNaLista } from "./ordenar-blocos";

describe("ordem manual dos blocos", () => {
  it("move o último bloco para o início sem perder conteúdo", () => {
    const lista = [{ id: "a", texto: "Primeiro" }, { id: "b", texto: "Segundo" }, { id: "c", texto: "Terceiro" }];
    expect(moverNaLista(lista, 2, 0)).toEqual([lista[2], lista[0], lista[1]]);
    expect(lista.map((b) => b.id)).toEqual(["a", "b", "c"]);
  });
  it("salva posições distintas e preserva outros grupos da biblioteca", () => {
    const lista = [{ id: "a", ordem: 100 }, { id: "imagem", ordem: 80 }, { id: "b", ordem: 100 }];
    const resultado = aplicarOrdem(lista, ["b", "a"]);
    expect(resultado).toEqual([{ id: "b", ordem: 0 }, { id: "a", ordem: 1 }, { id: "imagem", ordem: 80 }]);
  });
  it("ignora um destino fora da lista", () => {
    expect(moverNaLista(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });
});