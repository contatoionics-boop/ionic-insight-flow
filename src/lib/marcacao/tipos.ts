// Modelo do desenho técnico sobre foto. Todas as medidas são frações (0–1) da foto, para o
// desenho poder ser reaberto e reexportado em qualquer tamanho.

/** Peça da biblioteca carimbada na foto. */
export type ItemPeca = {
  id: string;
  tipo: "peca";
  pecaId: string;
  /** centro da peça, em fração da largura/altura da foto */
  cx: number;
  cy: number;
  /** tamanho da peça, em fração da largura/altura da foto */
  w: number;
  h: number;
  /** giro em graus (−179 a 179) */
  rot: number;
  /** "o que fazer aqui" (vai na legenda, ou no balão quando `modo` = "balao") */
  nota: string;
  /** "numero" (padrão): número na foto + linha na legenda · "balao": só um balão escrito na foto */
  modo?: "numero" | "balao";
  /** posição do balão (fração da foto) quando `modo` = "balao"; sem ela fica acima da peça */
  bal?: { x: number; y: number };
  /** ordem de empilhamento: maior fica na frente (padrão 0, desempate pela ordem da lista) */
  z?: number;
};

/** Itens numerados do desenho (entram na legenda). */
export type ItemDesenho = ItemPeca;

export type TipoAnotacao = "balao" | "cota" | "caixa" | "seta" | "linha" | "texto";

/**
 * Anotação desenhada sobre a foto (fica na própria imagem, sem entrar na legenda).
 * `pts` são frações (0–1) da foto: balão = [alvo, posição do balão]; cota/caixa/seta/linha = [início, fim];
 * texto = [posição].
 */
export type Anotacao = {
  id: string;
  tipo: TipoAnotacao;
  pts: { x: number; y: number }[];
  texto: string;
};

export type DesenhoProjeto = {
  versao: 1;
  foto: {
    /** foto do mapeamento (armazenamento do agente): a URL assinada é renovada ao reabrir */
    path?: string;
    /** foto enviada pelo especialista (URL pública) */
    url?: string;
    largura: number;
    altura: number;
  };
  itens: ItemDesenho[];
  /** anotações da fase 2; ausente em desenhos antigos */
  anotacoes?: Anotacao[];
};
