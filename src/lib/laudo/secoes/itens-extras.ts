// Seção automática dos tipos de item criados em Configurações › Tipos de item (Prédio, Produto…).
// Função pura. Um tipo com itens no Escopo = uma seção: título (plural do tipo), frase de resumo e as
// respostas de cada item (tabela quando são poucas perguntas, lista por item quando são muitas).
// Cada bloco tem chave estável pelo tipo/item (`extra:<tipo>:…`), então a edição manual do especialista
// sobrevive ao "Regerar rascunho". Resposta ausente aparece como "—": nunca vira [CONFIRMAR], porque as
// perguntas desses tipos são opcionais para o documento.

import type { ContextoLaudo, GrupoExtraCtx } from "@/lib/laudo/contexto";
import type { BlocoLaudo } from "@/lib/laudo/tipos";

/** Até quantas perguntas distintas cabem como colunas da tabela. */
const MAX_COLUNAS = 4;

const minusculas = (t: string) => t.toLocaleLowerCase("pt-BR");

/** "Prédio 01 › Andar 02" quando o item fica dentro de outro. */
const nomeCompleto = (i: GrupoExtraCtx["itens"][number]) => (i.pai ? `${i.pai} › ${i.rotulo}` : i.rotulo);

function frase(g: GrupoExtraCtx): string {
  const n = g.itens.length;
  const nomes = g.itens.map(nomeCompleto).join(", ");
  return n === 1 ? `Foi mapeado 1 ${minusculas(g.rotulo)}: ${nomes}.` : `Foram mapeados ${n} ${minusculas(g.plural)}: ${nomes}.`;
}

/**
 * Blocos das seções dos tipos novos; `null` quando o Escopo não tem nenhum item de tipo novo
 * (o documento fica idêntico ao de antes).
 */
export function blocosItensExtras(entrada: { contexto: ContextoLaudo | null; id: (prefixo: string) => string }): BlocoLaudo[] | null {
  const grupos = (entrada.contexto?.extras ?? []).filter((g) => g.itens.length > 0);
  if (!grupos.length) return null;
  const { id } = entrada;
  const meta = { origem: "dynamic", editavel: true, removivel: true } as const;
  const blocos: BlocoLaudo[] = [];

  for (const g of grupos) {
    const chave = (sufixo: string) => `extra:${g.tipo}:${sufixo}`;
    blocos.push({ id: id("h"), chave: chave("titulo"), tipo: "heading", numero: null, texto: g.plural, nivel: 2, ...meta } as BlocoLaudo);
    blocos.push({ id: id("p"), chave: chave("resumo"), tipo: "paragraph", texto: frase(g), ...meta } as BlocoLaudo);

    const perguntas = [...new Set(g.itens.flatMap((i) => i.respostas.map((r) => r.pergunta)))];
    if (!perguntas.length) continue;
    const valorDe = (i: GrupoExtraCtx["itens"][number], pergunta: string) => i.respostas.find((r) => r.pergunta === pergunta)?.valor ?? "—";

    if (g.itens.length > 1 && perguntas.length <= MAX_COLUNAS) {
      const comPai = g.itens.some((i) => i.pai);
      blocos.push({
        id: id("t"), chave: chave("tabela"), tipo: "table", titulo: null,
        colunas: ["Item", ...(comPai ? ["Dentro de"] : []), ...perguntas],
        linhas: g.itens.map((i) => ({ celulas: [i.rotulo, ...(comPai ? [i.pai ?? "—"] : []), ...perguntas.map((p) => valorDe(i, p))] })),
        ...meta,
      } as BlocoLaudo);
      continue;
    }
    // poucas colunas não cabem: um bloco por item, com "Pergunta: resposta"
    for (const i of g.itens) {
      if (g.itens.length > 1) blocos.push({ id: id("h"), chave: chave(`${i.id}:titulo`), tipo: "heading", numero: null, texto: nomeCompleto(i), nivel: 3, ...meta } as BlocoLaudo);
      if (i.respostas.length) blocos.push({ id: id("bl"), chave: chave(`${i.id}:respostas`), tipo: "bullets", itens: i.respostas.map((r) => `${r.pergunta}: ${r.valor}`), ...meta } as BlocoLaudo);
    }
  }
  return blocos;
}
