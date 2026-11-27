import { arrayMove } from "@dnd-kit/sortable";

/** Moves only the selected item; unrelated library groups keep their positions. */
export function moverNaLista<T>(itens: T[], origem: number, destino: number): T[] {
  if (origem < 0 || destino < 0 || origem >= itens.length || destino >= itens.length || origem === destino) return itens;
  return arrayMove(itens, origem, destino);
}

export function aplicarOrdem<T extends { id: string; ordem: number }>(itens: T[], ids: string[]): T[] {
  const posicoes = new Map(ids.map((id, i) => [id, i]));
  return itens.map((item) => {
    const ordem = posicoes.get(item.id);
    return ordem === undefined ? item : { ...item, ordem };
  }).sort((a, b) => a.ordem - b.ordem);
}