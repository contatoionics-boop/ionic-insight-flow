// Repetição estrutural: transforma uma pergunta (template) em N instâncias, uma
// por entidade do Escopo. A pergunta continua sendo um único cadastro; a
// instância ganha um id virtual `${perguntaId}::${entidadeId}` usado como chave
// de estado (checklist, rascunho local, fila offline) e decodificado ao gravar.
import { tipoEntidadeDaAplicacao, type EntidadeEscopo, type TipoEntidade } from "./tipos";

const SEP = "::";

export function idInstancia(perguntaId: string, entidadeId: string | null | undefined) {
  return entidadeId ? `${perguntaId}${SEP}${entidadeId}` : perguntaId;
}

export function decodificarIdInstancia(id: string): { perguntaId: string; entidadeId: string | null } {
  const i = id.indexOf(SEP);
  if (i < 0) return { perguntaId: id, entidadeId: null };
  return { perguntaId: id.slice(0, i), entidadeId: id.slice(i + SEP.length) };
}

export type CamposInstancia = {
  base_id: string;
  entidade_id: string | null;
  entidade_rotulo: string | null;
  entidade_tipo: TipoEntidade | null;
};

type PerguntaBase = { id: string; condicional_pergunta_id: string | null };

/**
 * Expande as perguntas por entidade. Sem estrutura (`entidades` vazio e sem
 * escopo) devolve as perguntas intactas, preservando o fluxo legado.
 * Pergunta aplicável a um tipo sem nenhuma entidade (ex.: 0 comboios) não aparece.
 */
export function expandirPerguntas<P extends PerguntaBase>(
  perguntas: P[],
  aplicaA: Map<string, string>,
  entidades: EntidadeEscopo[],
  temEscopo: boolean,
): (P & Partial<CamposInstancia>)[] {
  if (!temEscopo) return perguntas;

  const porId = new Map(entidades.map((e) => [e.id, e]));
  const caminho = (e: EntidadeEscopo): EntidadeEscopo[] => {
    const out: EntidadeEscopo[] = [];
    let cur: EntidadeEscopo | undefined = e;
    while (cur) {
      out.unshift(cur);
      cur = cur.parent_id ? porId.get(cur.parent_id) : undefined;
    }
    return out;
  };
  const rotuloCaminho = (e: EntidadeEscopo) => caminho(e).map((x) => x.rotulo).join(" › ");
  const chaveOrdem = (e: EntidadeEscopo) =>
    caminho(e)
      .map((x) => String(x.ordem).padStart(4, "0"))
      .join(".");

  const porTipo = new Map<TipoEntidade, EntidadeEscopo[]>();
  for (const e of entidades) {
    const arr = porTipo.get(e.tipo) ?? [];
    arr.push(e);
    porTipo.set(e.tipo, arr);
  }
  for (const arr of porTipo.values()) arr.sort((a, b) => chaveOrdem(a).localeCompare(chaveOrdem(b)));

  const resultado: (P & Partial<CamposInstancia>)[] = [];
  for (const p of perguntas) {
    const tipo = tipoEntidadeDaAplicacao(aplicaA.get(p.id));
    if (!tipo) {
      resultado.push(p);
      continue;
    }
    for (const e of porTipo.get(tipo) ?? []) {
      // Gatilho condicional: resolve para a instância da mesma entidade (ou de um ancestral).
      let condId = p.condicional_pergunta_id;
      if (condId) {
        const tipoGatilho = tipoEntidadeDaAplicacao(aplicaA.get(condId));
        if (tipoGatilho) {
          const alvo = caminho(e).find((x) => x.tipo === tipoGatilho);
          if (alvo) condId = idInstancia(condId, alvo.id);
        }
      }
      resultado.push({
        ...p,
        id: idInstancia(p.id, e.id),
        condicional_pergunta_id: condId,
        base_id: p.id,
        entidade_id: e.id,
        entidade_rotulo: rotuloCaminho(e),
        entidade_tipo: tipo,
      });
    }
  }
  return resultado;
}
