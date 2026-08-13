// Tipos compartilhados da proposta comercial (client-safe).

export type CampoProposta<T> = {
  valor: T | null;
  /** 0..1 */
  confianca: number;
  /** trecho do PDF que originou o valor */
  trecho?: string | null;
};

export type EscopoProposta = {
  nivel_automacao: CampoProposta<1 | 2 | 3>;
  qtd_bicos: CampoProposta<number>;
  comboio: CampoProposta<boolean>;
  qtd_comboios: CampoProposta<number>;
  comunicacao: CampoProposta<"wifi" | "4g" | "ambos">;
  fase_automacao: CampoProposta<1 | 2 | 3 | 4>;
  itens_inclusos: CampoProposta<string[]>;
  itens_nao_inclusos: CampoProposta<string[]>;
};

export const ESCOPO_VAZIO: EscopoProposta = {
  nivel_automacao: { valor: null, confianca: 0 },
  qtd_bicos: { valor: null, confianca: 0 },
  comboio: { valor: null, confianca: 0 },
  qtd_comboios: { valor: null, confianca: 0 },
  comunicacao: { valor: null, confianca: 0 },
  fase_automacao: { valor: null, confianca: 0 },
  itens_inclusos: { valor: null, confianca: 0 },
  itens_nao_inclusos: { valor: null, confianca: 0 },
};

export const ROTULOS_ESCOPO: Record<keyof EscopoProposta, string> = {
  nivel_automacao: "Nível de automação contratado",
  qtd_bicos: "Quantidade de bicos/pistas",
  comboio: "Inclui caminhão comboio",
  qtd_comboios: "Quantidade de comboios",
  comunicacao: "Módulo de comunicação",
  fase_automacao: "Fase de automação",
  itens_inclusos: "Itens inclusos",
  itens_nao_inclusos: "Itens não inclusos",
};

export type SeveridadeDivergencia = "atencao" | "alta";

export type Divergencia = {
  codigo: string;
  titulo: string;
  proposta: string;
  campo: string;
  severidade: SeveridadeDivergencia;
  recomendacao: string;
};

export type ResultadoComparacao = {
  calculado_em: string;
  divergencias: Divergencia[];
  /** chaves sem informação suficiente para comparar */
  pendencias: string[];
};

export type StatusProposta = "pendente" | "processando" | "pronto" | "erro";

export type PropostaResumo = {
  id: string;
  caso_id: string;
  arquivo_nome: string;
  arquivo_path: string;
  tamanho_bytes: number | null;
  status: StatusProposta;
  erro_mensagem: string | null;
  escopo: EscopoProposta;
  criado_em: string;
};

export function formatarValorEscopo(chave: keyof EscopoProposta, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "não identificado";
  if (Array.isArray(valor)) return valor.length ? valor.join("; ") : "não identificado";
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  if (chave === "nivel_automacao") return `Nível ${valor}`;
  if (chave === "fase_automacao") return `Fase ${valor}`;
  if (chave === "comunicacao") {
    const m: Record<string, string> = { wifi: "Wi-Fi (comodato)", "4g": "4G (adicional)", ambos: "Wi-Fi + 4G" };
    return m[String(valor)] ?? String(valor);
  }
  return String(valor);
}
