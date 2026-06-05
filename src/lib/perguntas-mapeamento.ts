import type { Pergunta, Resposta } from "@/components/agent/FormFields";

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
  const n = normalizar(pergunta.texto);
  if (/\bcnpj\b/.test(n)) return "cnpj";
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
