// Client-safe enums/labels for knowledge_base.

export const KNOWLEDGE_CATEGORIAS = [
  "estrutura_documento",
  "catalogo_produtos",
  "catalogo_materiais",
  "regras_tecnicas",
  "exemplos_laudos",
  "textos_padrao",
  "glossario_tecnico",
] as const;
export type KnowledgeCategoria = (typeof KNOWLEDGE_CATEGORIAS)[number];

export const CATEGORIA_LABEL: Record<KnowledgeCategoria, string> = {
  estrutura_documento: "Estrutura de documento",
  catalogo_produtos: "Catálogo de produtos",
  catalogo_materiais: "Catálogo de materiais",
  regras_tecnicas: "Regras técnicas",
  exemplos_laudos: "Exemplos de laudos",
  textos_padrao: "Textos padrão",
  glossario_tecnico: "Glossário técnico",
};

export const KNOWLEDGE_CLASSIFICACOES = ["OK", "ATENCAO", "BLOQUEIO"] as const;
export type KnowledgeClassificacao = (typeof KNOWLEDGE_CLASSIFICACOES)[number];

export const CLASSIFICACAO_LABEL: Record<KnowledgeClassificacao, string> = {
  OK: "OK",
  ATENCAO: "ATENÇÃO",
  BLOQUEIO: "BLOQUEIO",
};

export const CLASSIFICACAO_BADGE: Record<KnowledgeClassificacao, string> = {
  OK: "bg-success/10 text-success",
  ATENCAO: "bg-warning/10 text-warning",
  BLOQUEIO: "bg-destructive/10 text-destructive",
};

export function normalizeClassificacao(v: unknown): KnowledgeClassificacao | null {
  if (typeof v !== "string") return null;
  const up = v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  if (up === "OK") return "OK";
  if (up === "ATENCAO" || up === "ATENÇÃO" || up === "ATENTION") return "ATENCAO";
  if (up === "BLOQUEIO" || up === "BLOCK") return "BLOQUEIO";
  return null;
}

export function normalizeTags(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string")
    return v
      .split(/[,;]/)
      .map((x) => x.trim())
      .filter(Boolean);
  return [];
}

export type KnowledgeRegistro = {
  id: string;
  categoria: KnowledgeCategoria;
  titulo: string;
  conteudo: string;
  tags: string[];
  classificacao: KnowledgeClassificacao;
  fonte: string | null;
  importacao_id: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeImportacao = {
  id: string;
  nome_arquivo: string;
  tipo: "json" | "csv" | "xlsx";
  total_registros: number;
  total_inseridos: number;
  status: "processando" | "pronto" | "erro";
  erro_mensagem: string | null;
  created_at: string;
};
