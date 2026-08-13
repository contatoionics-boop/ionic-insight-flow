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
  // campos comerciais que alimentam o laudo estruturado
  nome_cliente: CampoProposta<string>;
  nome_solucao: CampoProposta<string>;
  tipo_acao: CampoProposta<"instalacao" | "upgrade">;
  objeto_escopo: CampoProposta<string>;
  tipo_objeto: CampoProposta<string>;
  ids_objetos: CampoProposta<string[]>;
  terminal: CampoProposta<string>;
  rfid: CampoProposta<boolean>;
  bitola_bico: CampoProposta<string>;
  tensao: CampoProposta<string>;
  qtd_pistas: CampoProposta<number>;
};

const vazio = { valor: null, confianca: 0 };

export const ESCOPO_VAZIO: EscopoProposta = {
  nivel_automacao: { ...vazio },
  qtd_bicos: { ...vazio },
  comboio: { ...vazio },
  qtd_comboios: { ...vazio },
  comunicacao: { ...vazio },
  fase_automacao: { ...vazio },
  itens_inclusos: { ...vazio },
  itens_nao_inclusos: { ...vazio },
  nome_cliente: { ...vazio },
  nome_solucao: { ...vazio },
  tipo_acao: { ...vazio },
  objeto_escopo: { ...vazio },
  tipo_objeto: { ...vazio },
  ids_objetos: { ...vazio },
  terminal: { ...vazio },
  rfid: { ...vazio },
  bitola_bico: { ...vazio },
  tensao: { ...vazio },
  qtd_pistas: { ...vazio },
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
  nome_cliente: "Nome do cliente",
  nome_solucao: "Solução contratada",
  tipo_acao: "Tipo de ação",
  objeto_escopo: "Objeto do escopo",
  tipo_objeto: "Tipo do objeto",
  ids_objetos: "Identificação dos objetos",
  terminal: "Terminal previsto",
  rfid: "Usa RFID",
  bitola_bico: "Bitola do bico",
  tensao: "Tensão",
  qtd_pistas: "Quantidade de pistas",
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
