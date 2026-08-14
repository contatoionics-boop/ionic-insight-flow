// Converte achados técnicos em blocos do documento (parecer + recomendações).

import type { Achado } from "./achados";
import type { BlocoLaudo } from "@/lib/laudo/tipos";

let seq = 0;
const bid = (p: string) => `an-${p}-${++seq}`;

export function resetSequenciaRedacao() {
  seq = 0;
}

/** Um achado vira: parágrafo de conclusão + bullets de recomendação. */
export function blocosDoAchado(a: Achado): BlocoLaudo[] {
  const out: BlocoLaudo[] = [
    {
      id: bid("p"),
      tipo: "paragraph",
      texto: a.conclusao,
      origem: "dynamic",
      editavel: true,
      removivel: true,
    },
  ];
  if (a.recomendacoes.length) {
    out.push({
      id: bid("bl"),
      tipo: "bullets",
      itens: a.recomendacoes,
      origem: "dynamic",
      editavel: true,
      removivel: true,
    });
  }
  return out;
}

export function blocosDosAchados(achados: Achado[]): BlocoLaudo[] {
  return achados.flatMap(blocosDoAchado);
}
