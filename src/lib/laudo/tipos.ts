// Tipos compartilhados do laudo estruturado (client-safe).

export type OrigemVariavel =
  | "formulario"
  | "proposta"
  | "cadastro"
  | "ia"
  | "manual"
  | "ausente";

export type VariavelLaudo = {
  chave: string;
  valor: string | null;
  origem: OrigemVariavel;
  /** 0..1 — 1 quando veio direto do formulário */
  confianca: number;
  /** sugestão da IA descartada por baixa confiança */
  sugestao?: string | null;
};

export type VariaveisLaudo = Record<string, VariavelLaudo>;

export type BlocoTabelaLinha = {
  celulas: string[];
  nota?: string | null;
};

/** origem do bloco dentro do documento */
export type OrigemBloco = "automatic" | "dynamic" | "manual";

/** metadados de edição — opcionais para manter compatibilidade com laudos antigos */
export type MetaBloco = {
  /** identidade estável entre gerações (derivada do conteúdo gerado) */
  chave?: string;
  origem?: OrigemBloco;
  editado_manualmente?: boolean;
  /** conteúdo produzido pelo gerador antes da edição manual */
  conteudo_original?: Record<string, any> | null;
  /** conflito detectado: o gerador passou a produzir algo diferente da edição */
  conflito?: Record<string, any> | null;
  editavel?: boolean;
  removivel?: boolean;
  /** bloco removido pelo especialista — não renderiza nem ressuscita */
  oculto?: boolean;
};

type Heading = {
  id: string;
  tipo: "heading";
  numero: string | null;
  texto: string;
  nivel: 1 | 2 | 3 | 4;
};
type Paragraph = { id: string; tipo: "paragraph"; texto: string };
type Bullets = { id: string; tipo: "bullets"; itens: string[] };
type Tabela = {
  id: string;
  tipo: "table";
  titulo: string | null;
  colunas: string[];
  linhas: BlocoTabelaLinha[];
};
type Notes = { id: string; tipo: "notes"; itens: string[] };
type Alerta = {
  id: string;
  tipo: "alert";
  severidade: "info" | "bloqueante";
  codigo: string;
  texto: string;
};
type Imagem = {
  id: string;
  tipo: "image";
  url: string;
  alt: string;
  legenda: string | null;
  /** largura máxima em pt (PDF) / px (prévia) */
  larguraMax?: number;
};
/** caixa padronizada "OBSERVAÇÃO TÉCNICA" */
type Observacao = { id: string; tipo: "observacao"; titulo?: string | null; texto: string };
type QuebraPagina = { id: string; tipo: "pagebreak" };

export type BlocoLaudo =
  | (Heading & MetaBloco)
  | (Paragraph & MetaBloco)
  | (Bullets & MetaBloco)
  | (Tabela & MetaBloco)
  | (Notes & MetaBloco)
  | (Alerta & MetaBloco)
  | (Imagem & MetaBloco)
  | (Observacao & MetaBloco)
  | (QuebraPagina & MetaBloco);

export type TipoBloco = BlocoLaudo["tipo"];

export type LaudoConteudo = {
  gerado_em: string;
  /** data da última edição manual do documento */
  editado_em?: string | null;
  blocos: BlocoLaudo[];
};

export type ConfirmacaoAlerta = {
  codigo: string;
  decisao: "corrigido" | "ciente_do_risco";
  justificativa: string;
  confirmado_por: string;
  confirmado_por_nome: string | null;
  confirmado_em: string;
};

export const LIMIAR_CONFIANCA = 0.8;

export function pendencia(chave: string, rotulo?: string): string {
  return `[CONFIRMAR: ${rotulo ?? chave}]`;
}

/** true quando o texto do bloco ainda contém pendências */
export function temPendencia(texto: string): boolean {
  return texto.includes("[CONFIRMAR:");
}

/** blocos efetivamente renderizados (exclui os removidos pelo especialista) */
export function blocosVisiveis(blocos: BlocoLaudo[]): BlocoLaudo[] {
  return (blocos ?? []).filter((b) => !b.oculto);
}

/** conta blocos visíveis com qualquer ocorrência de [CONFIRMAR: ...] */
export function blocosComPendencia(blocos: BlocoLaudo[]): number {
  let n = 0;
  for (const b of blocosVisiveis(blocos)) {
    // varre todo o conteúdo do bloco (texto, itens, células, notas, legendas)
    const { conteudo_original: _o, conflito: _c, ...visivel } = b as Record<string, unknown>;
    if (temPendencia(JSON.stringify(visivel))) n++;
  }
  return n;
}

export function alertasBloqueantes(blocos: BlocoLaudo[]) {
  return blocosVisiveis(blocos).filter(
    (b): b is Extract<BlocoLaudo, { tipo: "alert" }> =>
      b.tipo === "alert" && b.severidade === "bloqueante",
  );
}
