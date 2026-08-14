// Normaliza uma resposta do formulário para um texto confiável, qualquer que
// seja o tipo da pergunta (texto, número, data, toggle, seleção, múltipla
// escolha, JSON de blocos, transcrição de áudio). Puro e client-safe.
//
// Regra: nunca inventar valor — o que não puder ser convertido vira null.

export type RespostaBrutaDb = {
  tipo?: string | null;
  valor_texto?: string | null;
  transcricao?: string | null;
};

function limpar(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || s === "—" || s === "-" || s === "null" || s === "undefined") return null;
  return s;
}

function achatar(valor: unknown): string | null {
  if (Array.isArray(valor)) {
    const itens = valor.map((x) => achatar(x)).filter((x): x is string => !!x);
    return itens.length ? itens.join(", ") : null;
  }
  if (valor && typeof valor === "object") {
    const partes = Object.entries(valor as Record<string, unknown>)
      .map(([k, val]) => {
        const t = achatar(val);
        return t ? `${k}: ${t}` : null;
      })
      .filter((x): x is string => !!x);
    return partes.length ? partes.join("; ") : null;
  }
  if (typeof valor === "boolean") return valor ? "sim" : "nao";
  return limpar(valor);
}

/** ISO (yyyy-mm-dd / timestamp) → dd/mm/aaaa; demais formatos ficam intactos. */
function formatarData(s: string): string {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

const TIPOS_ARQUIVO = new Set(["foto", "video"]);

/** Texto utilizável de uma resposta, considerando o tipo da pergunta. */
export function valorDaResposta(r: RespostaBrutaDb): string | null {
  const tipo = (r.tipo ?? "").toLowerCase();
  const bruto = limpar(r.valor_texto) ?? limpar(r.transcricao);
  if (!bruto) return null;
  if (TIPOS_ARQUIVO.has(tipo)) return null; // caminho de arquivo não é valor textual

  let texto = bruto;
  // respostas gravadas como JSON (blocos multi-campo, múltipla escolha, checkbox)
  if (/^[[{]/.test(texto)) {
    try {
      const achatado = achatar(JSON.parse(texto));
      if (achatado) texto = achatado;
    } catch {
      // não era JSON válido: mantém o texto original
    }
  }

  if (tipo === "data") texto = formatarData(texto);
  else if (/^\d{4}-\d{2}-\d{2}([T ]|$)/.test(texto)) texto = formatarData(texto);

  if (tipo === "toggle" || tipo === "checkbox") {
    const t = texto.toLowerCase();
    if (["true", "sim", "s", "1", "yes"].includes(t)) return "sim";
    if (["false", "nao", "não", "n", "0", "no"].includes(t)) return "nao";
  }

  return limpar(texto);
}
