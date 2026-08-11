// Tipos compartilhados do laudo estruturado (client-safe).

export type OrigemVariavel = "formulario" | "ia" | "manual" | "ausente";

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

export type BlocoLaudo =
  | { id: string; tipo: "heading"; numero: string | null; texto: string; nivel: 1 | 2 | 3 }
  | { id: string; tipo: "paragraph"; texto: string }
  | { id: string; tipo: "bullets"; itens: string[] }
  | {
      id: string;
      tipo: "table";
      titulo: string | null;
      colunas: string[];
      linhas: BlocoTabelaLinha[];
    }
  | { id: string; tipo: "notes"; itens: string[] }
  | {
      id: string;
      tipo: "alert";
      severidade: "info" | "bloqueante";
      codigo: string;
      texto: string;
    }
  | {
      id: string;
      tipo: "image";
      url: string;
      alt: string;
      legenda: string | null;
      /** largura máxima em pt (PDF) / px (prévia) */
      larguraMax?: number;
    };

export type LaudoConteudo = {
  gerado_em: string;
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

export function blocosComPendencia(blocos: BlocoLaudo[]): number {
  let n = 0;
  for (const b of blocos) {
    if (b.tipo === "paragraph" && temPendencia(b.texto)) n++;
    if (b.tipo === "bullets" && b.itens.some(temPendencia)) n++;
    if (b.tipo === "heading" && temPendencia(b.texto)) n++;
    if (b.tipo === "table" && b.linhas.some((l) => l.celulas.some(temPendencia))) n++;
  }
  return n;
}

export function alertasBloqueantes(blocos: BlocoLaudo[]) {
  return blocos.filter(
    (b): b is Extract<BlocoLaudo, { tipo: "alert" }> =>
      b.tipo === "alert" && b.severidade === "bloqueante",
  );
}
