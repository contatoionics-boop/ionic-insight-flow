// Numeração automática e hierárquica dos títulos do laudo (client-safe).

import { type BlocoLaudo } from "./tipos";

/**
 * Recalcula `numero` de todos os headings numerados na ordem final dos blocos,
 * incluindo os criados manualmente. Headings com `numero === null` continuam
 * sem numeração (títulos de apoio, como o de alertas técnicos).
 */
export function renumerar(blocos: BlocoLaudo[]): BlocoLaudo[] {
  const contadores = [0, 0, 0, 0];
  return blocos.map((b) => {
    if (b.tipo !== "heading" || b.oculto || b.numero === null) return b;
    const nivel = Math.min(Math.max(b.nivel ?? 1, 1), 4);
    contadores[nivel - 1] += 1;
    for (let i = nivel; i < contadores.length; i++) contadores[i] = 0;
    const numero = contadores.slice(0, nivel).join(".");
    return numero === b.numero ? b : { ...b, numero };
  });
}

export type NoArvore = {
  id: string;
  numero: string | null;
  texto: string;
  nivel: number;
};

/** Árvore de navegação do documento (somente headings visíveis). */
export function arvoreDocumento(blocos: BlocoLaudo[]): NoArvore[] {
  return blocos
    .filter((b): b is Extract<BlocoLaudo, { tipo: "heading" }> => b.tipo === "heading" && !b.oculto)
    .map((b) => ({ id: b.id, numero: b.numero, texto: b.texto, nivel: b.nivel ?? 1 }));
}

/**
 * Índice final (exclusivo) do "bloco filho" de um heading: tudo até o próximo
 * heading de nível igual ou superior. Usado para mover uma seção com seus filhos.
 */
export function fimDaSecao(blocos: BlocoLaudo[], indice: number): number {
  const atual = blocos[indice];
  if (!atual || atual.tipo !== "heading") return indice + 1;
  const nivel = atual.nivel ?? 1;
  for (let i = indice + 1; i < blocos.length; i++) {
    const b = blocos[i];
    if (b.tipo === "heading" && (b.nivel ?? 1) <= nivel) return i;
  }
  return blocos.length;
}
