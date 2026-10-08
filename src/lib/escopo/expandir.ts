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

/** Chave de ordenação (ex.: "0001.0002.0001") por entidade: posto › ilha › bomba › bico. */
export function chaveOrdemEntidades(entidades: EntidadeEscopo[]): Map<string, string> {
  const porId = new Map(entidades.map((e) => [e.id, e]));
  // O tipo entra na chave da raiz: posto 1, tanque 1 e sonda 1 não podem empatar.
  const RANK: Record<string, number> = { posto: 0, ilha: 0, bomba: 0, bico: 0, tanque: 1, sonda: 2, comboio: 3, frota: 4 };
  const chave = (e: EntidadeEscopo): string => {
    const pai = e.parent_id ? porId.get(e.parent_id) : undefined;
    const seg = String(e.ordem).padStart(4, "0");
    return pai ? chave(pai) + "." + seg : String(RANK[e.tipo] ?? 9) + "-" + seg;
  };
  return new Map(entidades.map((e) => [e.id, chave(e)]));
}

export type CamposInstancia = {
  base_id: string;
  entidade_id: string | null;
  entidade_rotulo: string | null;
  entidade_tipo: TipoEntidade | null;
  /** Condição que não pôde ser resolvida pela hierarquia: a pergunta aparece sem condição. */
  condicao_aviso: string | null;
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
    const tipoGatilhoGeral = p.condicional_pergunta_id
      ? tipoEntidadeDaAplicacao(aplicaA.get(p.condicional_pergunta_id))
      : null;
    if (!tipo) {
      if (tipoGatilhoGeral) {
        // Pergunta geral que depende de uma resposta repetida por entidade. Só há
        // resposta única sem ambiguidade para a frota (singleton); nos demais casos
        // não se escolhe uma bomba/bico arbitrária: a condição é ignorada e sinalizada.
        const unico = tipoGatilhoGeral === "frota" ? porTipo.get("frota") : undefined;
        if (unico && unico.length === 1) {
          resultado.push({ ...p, condicional_pergunta_id: idInstancia(p.condicional_pergunta_id!, unico[0].id) });
        } else {
          resultado.push({
            ...p,
            condicional_pergunta_id: null,
            condicao_aviso:
              "Esta pergunta geral dependia de uma resposta repetida por " +
              tipoGatilhoGeral +
              ". A condição foi ignorada porque não há uma única resposta para usar.",
          });
        }
        continue;
      }
      resultado.push(p);
      continue;
    }
    for (const e of porTipo.get(tipo) ?? []) {
      // Gatilho condicional: resolve para a instância da mesma entidade (ou de um ancestral).
      // Gatilho: a própria entidade primeiro, depois os ancestrais (nunca um irmão).
      let condId = p.condicional_pergunta_id;
      let aviso: string | null = null;
      if (condId) {
        const tipoGatilho = tipoEntidadeDaAplicacao(aplicaA.get(condId));
        if (tipoGatilho) {
          const alvo = caminho(e).find((x) => x.tipo === tipoGatilho);
          if (alvo) condId = idInstancia(condId, alvo.id);
          else {
            // gatilho em outro nível (ex.: descendente ou ramo diferente)
            condId = null;
            aviso =
              "A condição desta pergunta depende de uma resposta de outro nível (" +
              tipoGatilho +
              ") que não é desta entidade nem de um ancestral. Ela foi ignorada.";
          }
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
        condicao_aviso: aviso,
      });
    }
  }
  return resultado;
}
