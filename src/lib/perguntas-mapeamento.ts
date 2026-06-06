import type { Pergunta, Resposta } from "@/components/agent/FormFields";

/**
 * Avalia a condicional de exibição de uma pergunta.
 * Retorna true quando a pergunta deve aparecer (sem condicional, ou condição satisfeita).
 */
export function avaliarCondicional(
  pergunta: Pick<
    Pergunta,
    "condicional_pergunta_id" | "condicional_operador" | "condicional_valor"
  >,
  state: Record<string, Resposta>,
): boolean {
  const refId = pergunta.condicional_pergunta_id;
  if (!refId) return true;
  const operador = pergunta.condicional_operador || "igual";
  const esperado = (pergunta.condicional_valor ?? "").trim();
  const refResp = state[refId] ?? {};
  // Valor da resposta-gatilho: texto direto, ou presença de arquivo/transcricao
  const valor = (refResp.text ?? refResp.transcription ?? "").trim();
  const norm = (s: string) =>
    s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  const v = norm(valor);
  const e = norm(esperado);
  if (operador === "diferente") return v !== e;
  if (operador === "contem") return e.length > 0 && v.includes(e);
  return v === e; // igual (default)
}


export type CampoMapeado =
  | "cnpj"
  | "razao_social"
  | "unidade"
  | "cep"
  | "estado"
  | "cidade"
  | "bairro"
  | "logradouro"
  | "numero"
  | "responsavel"
  | "contato"
  | "data_vistoria"
  | "cidade_estado"
  | null;

function normalizar(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function detectarCampo(pergunta: Pick<Pergunta, "texto" | "tipo">): CampoMapeado {
  if (pergunta.tipo === "cnpj") return "cnpj";
  if (pergunta.tipo === "cep") return "cep";
  if (pergunta.tipo === "data") return "data_vistoria";
  const n = normalizar(pergunta.texto);
  if (/\bcnpj\b/.test(n)) return "cnpj";
  if (/(responsavel|vistoriador|t[eé]cnico|agente)/.test(n)) return "responsavel";
  if (/(contato|telefone|celular|whatsapp|e[-\s]?mail|email)/.test(n)) return "contato";
  if (/(data\s+(da\s+)?vistoria|data\s+do\s+mapeamento)/.test(n)) return "data_vistoria";
  if (/(razao\s*social|nome\s*(do\s*)?cliente|nome\s*fantasia|empresa)/.test(n)) return "razao_social";
  if (/\bunidade\b|filial|estabelecimento/.test(n)) return "unidade";
  if (/\bcep\b/.test(n)) return "cep";
  if (/(cidade.*estado|cidade\s*\/\s*estado|cidade\s*e\s*estado|municipio.*uf)/.test(n)) return "cidade_estado";
  if (/\bnumero\b|\bn[º°.]\b|\bnro\b/.test(n)) return "numero";
  if (/\bbairro\b/.test(n)) return "bairro";
  if (/\bcidade\b|\bmunicipio\b/.test(n)) return "cidade";
  if (/\b(estado|uf)\b/.test(n)) return "estado";
  if (/\b(logradouro|endereco|rua|avenida|av\.?)\b/.test(n)) return "logradouro";
  return null;
}

export type DadosUnidade = {
  empresa_nome?: string | null;
  matriz_nome?: string | null;
  cnpj?: string | null;
  razao_social?: string | null;
  unidade_nome?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  responsavel_nome?: string | null;
  contato?: string | null;
  data_vistoria?: string | null;
};

export function valorParaCampo(campo: CampoMapeado, d: DadosUnidade): string | null {
  if (!campo) return null;
  const pick = (v?: string | null) => (v && v.trim() ? v.trim() : null);
  switch (campo) {
    case "cnpj":
      return pick(d.cnpj);
    case "razao_social":
      return pick(d.razao_social) ?? pick(d.matriz_nome) ?? pick(d.empresa_nome);
    case "unidade":
      return pick(d.unidade_nome);
    case "cep":
      return pick(d.cep);
    case "estado":
      return pick(d.estado);
    case "cidade":
      return pick(d.cidade);
    case "bairro":
      return pick(d.bairro);
    case "logradouro":
      return pick(d.logradouro);
    case "numero":
      return pick(d.numero);
    case "cidade_estado":
      if (d.cidade && d.estado) return `${d.cidade}/${d.estado}`;
      return pick(d.cidade);
    case "responsavel":
      return pick(d.responsavel_nome);
    case "contato":
      return pick(d.contato);
    case "data_vistoria":
      return pick(d.data_vistoria);
  }
  return null;
}

/**
 * Aplica auto-preenchimento da seção em cima de `state` (mutação por novo objeto).
 * Só preenche perguntas que ainda não têm resposta. Retorna número de campos preenchidos.
 */
export function hidratarSecao(
  perguntas: Pergunta[],
  dados: DadosUnidade,
  state: Record<string, Resposta>,
): { state: Record<string, Resposta>; preenchidos: number; total: number } {
  const next = { ...state };
  let preenchidos = 0;
  for (const p of perguntas) {
    const existente = next[p.id]?.text?.trim();
    if (existente) {
      preenchidos++;
      continue;
    }
    const campo = detectarCampo(p);
    const v = valorParaCampo(campo, dados);
    if (v) {
      next[p.id] = { ...next[p.id], text: v };
      preenchidos++;
    }
  }
  return { state: next, preenchidos, total: perguntas.length };
}
