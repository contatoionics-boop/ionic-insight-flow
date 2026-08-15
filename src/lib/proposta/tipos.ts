// Tipos compartilhados da proposta comercial (client-safe).
//
// A proposta é a camada COMERCIAL/PRÉ-TÉCNICA: tudo aqui é "previsto", nunca
// "confirmado". A confirmação vem do formulário de mapeamento (campo) e a
// validação final vem do especialista.

export type OrigemCampoProposta = "proposta" | "manual";
export type StatusCampoProposta = "previsto" | "confirmado" | "nao_identificado";

export type CampoProposta<T> = {
  valor: T | null;
  /** 0..1 */
  confianca: number;
  /** trecho do PDF que originou o valor */
  trecho?: string | null;
  /** seção da proposta de onde veio (cabecalho | escopo | observacoes | manual) */
  secao?: string | null;
  /** proposta (extraído) ou manual (corrigido pelo solicitante) */
  origem?: OrigemCampoProposta;
  /** previsto (padrão), confirmado (corrigido manualmente) ou não identificado */
  status?: StatusCampoProposta;
};

export type EscopoProposta = {
  // --- identificação (cabeçalho) ---
  nome_cliente: CampoProposta<string>;
  cnpj: CampoProposta<string>;
  unidade: CampoProposta<string>;
  cidade_uf: CampoProposta<string>;
  cep: CampoProposta<string>;
  endereco: CampoProposta<string>;
  contato: CampoProposta<string>;
  responsavel_proposta: CampoProposta<string>;
  numero_proposta: CampoProposta<string>;
  data_proposta: CampoProposta<string>;

  // --- escopo específico do cliente ---
  nome_solucao: CampoProposta<string>;
  fase_automacao: CampoProposta<1 | 2 | 3 | 4>;
  nivel_automacao: CampoProposta<1 | 2 | 3>;
  tem_pista: CampoProposta<boolean>;
  tem_comboio: CampoProposta<boolean>;
  qtd_postos: CampoProposta<number>;
  qtd_comboios: CampoProposta<number>;
  qtd_bombas: CampoProposta<number>;
  tipo_bomba_previsto: CampoProposta<string>;
  qtd_bicos: CampoProposta<number>;
  qtd_pistas: CampoProposta<number>;
  modalidade_nldiv: CampoProposta<string>;
  tipo_acao: CampoProposta<"instalacao" | "upgrade">;
  objeto_escopo: CampoProposta<string>;
  tipo_objeto: CampoProposta<string>;
  ids_objetos: CampoProposta<string[]>;
  terminal: CampoProposta<string>;
  rfid: CampoProposta<boolean>;
  bitola_bico: CampoProposta<string>;
  tensao: CampoProposta<string>;

  // --- observações / condições preliminares ---
  comunicacao_prevista: CampoProposta<"wifi" | "4g" | "ambos">;
  regime_contratacao: CampoProposta<string>;
  itens_previstos: CampoProposta<string[]>;
  infra_prevista: CampoProposta<string[]>;
  itens_nao_inclusos: CampoProposta<string[]>;
  observacoes_preliminares: CampoProposta<string[]>;

  // --- compatibilidade com propostas extraídas pela lógica anterior ---
  /** @deprecated use `tem_comboio` */
  comboio: CampoProposta<boolean>;
  /** @deprecated use `comunicacao_prevista` */
  comunicacao: CampoProposta<"wifi" | "4g" | "ambos">;
  /** @deprecated use `itens_previstos` */
  itens_inclusos: CampoProposta<string[]>;
};

const vazio = { valor: null, confianca: 0, status: "nao_identificado" as StatusCampoProposta };

export const ESCOPO_VAZIO: EscopoProposta = {
  nome_cliente: { ...vazio },
  cnpj: { ...vazio },
  unidade: { ...vazio },
  cidade_uf: { ...vazio },
  cep: { ...vazio },
  endereco: { ...vazio },
  contato: { ...vazio },
  responsavel_proposta: { ...vazio },
  numero_proposta: { ...vazio },
  data_proposta: { ...vazio },

  nome_solucao: { ...vazio },
  fase_automacao: { ...vazio },
  nivel_automacao: { ...vazio },
  tem_pista: { ...vazio },
  tem_comboio: { ...vazio },
  qtd_postos: { ...vazio },
  qtd_comboios: { ...vazio },
  qtd_bombas: { ...vazio },
  tipo_bomba_previsto: { ...vazio },
  qtd_bicos: { ...vazio },
  qtd_pistas: { ...vazio },
  modalidade_nldiv: { ...vazio },
  tipo_acao: { ...vazio },
  objeto_escopo: { ...vazio },
  tipo_objeto: { ...vazio },
  ids_objetos: { ...vazio },
  terminal: { ...vazio },
  rfid: { ...vazio },
  bitola_bico: { ...vazio },
  tensao: { ...vazio },

  comunicacao_prevista: { ...vazio },
  regime_contratacao: { ...vazio },
  itens_previstos: { ...vazio },
  infra_prevista: { ...vazio },
  itens_nao_inclusos: { ...vazio },
  observacoes_preliminares: { ...vazio },

  comboio: { ...vazio },
  comunicacao: { ...vazio },
  itens_inclusos: { ...vazio },
};

export const ROTULOS_ESCOPO: Record<keyof EscopoProposta, string> = {
  nome_cliente: "Cliente",
  cnpj: "CNPJ",
  unidade: "Unidade",
  cidade_uf: "Cidade/UF",
  cep: "CEP",
  endereco: "Endereço",
  contato: "Contato do cliente",
  responsavel_proposta: "Responsável pela proposta (IONICS)",
  numero_proposta: "Nº da proposta",
  data_proposta: "Data da proposta",

  nome_solucao: "Solução contratada",
  fase_automacao: "Fase de automação",
  nivel_automacao: "Nível de automação",
  tem_pista: "Pista / posto fixo",
  tem_comboio: "Caminhão comboio",
  qtd_postos: "Quantidade de postos",
  qtd_comboios: "Quantidade de comboios",
  qtd_bombas: "Quantidade de bombas",
  tipo_bomba_previsto: "Tipo de bomba previsto",
  qtd_bicos: "Quantidade de bicos",
  qtd_pistas: "Quantidade de pistas",
  modalidade_nldiv: "Modalidade NLDIV",
  tipo_acao: "Tipo de ação",
  objeto_escopo: "Objeto do escopo",
  tipo_objeto: "Tipo do objeto",
  ids_objetos: "Identificação dos objetos",
  terminal: "Terminal previsto",
  rfid: "Usa RFID",
  bitola_bico: "Bitola do bico",
  tensao: "Tensão",

  comunicacao_prevista: "Comunicação prevista",
  regime_contratacao: "Regime de contratação",
  itens_previstos: "Itens previstos",
  infra_prevista: "Infraestrutura prevista",
  itens_nao_inclusos: "Itens não inclusos",
  observacoes_preliminares: "Observações preliminares",

  comboio: "Caminhão comboio (legado)",
  comunicacao: "Comunicação (legado)",
  itens_inclusos: "Itens inclusos (legado)",
};

/** Chaves legadas escondidas da UI (mantidas só para compatibilidade de dados). */
export const CHAVES_LEGADAS: (keyof EscopoProposta)[] = [
  "comboio",
  "comunicacao",
  "itens_inclusos",
];

/** Ordem de exibição do resumo "Escopo identificado". */
export const CHAVES_RESUMO: (keyof EscopoProposta)[] = [
  "nome_cliente",
  "cnpj",
  "unidade",
  "cidade_uf",
  "endereco",
  "contato",
  "responsavel_proposta",
  "numero_proposta",
  "data_proposta",
  "nome_solucao",
  "fase_automacao",
  "nivel_automacao",
  "tem_pista",
  "tem_comboio",
  "qtd_postos",
  "qtd_comboios",
  "qtd_bombas",
  "tipo_bomba_previsto",
  "qtd_bicos",
  "comunicacao_prevista",
  "regime_contratacao",
];

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

/**
 * Normaliza escopos antigos (extraídos pela lógica anterior) para o esquema
 * atual, sem perder dados: `comboio` -> `tem_comboio`, `comunicacao` ->
 * `comunicacao_prevista`, `itens_inclusos` -> `itens_previstos`.
 */
export function normalizarEscopo(bruto: any): EscopoProposta {
  const escopo: EscopoProposta = { ...ESCOPO_VAZIO, ...((bruto ?? {}) as EscopoProposta) };
  const herdar = (destino: keyof EscopoProposta, legado: keyof EscopoProposta) => {
    const d = escopo[destino] as CampoProposta<any> | undefined;
    const l = escopo[legado] as CampoProposta<any> | undefined;
    if ((d?.valor === null || d?.valor === undefined) && l?.valor !== null && l?.valor !== undefined) {
      (escopo[destino] as any) = { ...l };
    }
  };
  herdar("tem_comboio", "comboio");
  herdar("comunicacao_prevista", "comunicacao");
  herdar("itens_previstos", "itens_inclusos");

  for (const chave of Object.keys(escopo) as (keyof EscopoProposta)[]) {
    const campo = escopo[chave] as CampoProposta<any>;
    if (!campo) {
      (escopo[chave] as any) = { ...vazio };
      continue;
    }
    if (!campo.status) {
      campo.status =
        campo.valor === null || campo.valor === undefined
          ? "nao_identificado"
          : campo.origem === "manual"
            ? "confirmado"
            : "previsto";
    }
    if (!campo.origem && campo.valor !== null && campo.valor !== undefined) {
      campo.origem = "proposta";
    }
  }
  return escopo;
}

export function formatarValorEscopo(chave: keyof EscopoProposta, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "não identificado";
  if (Array.isArray(valor)) return valor.length ? valor.join("; ") : "não identificado";
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  if (chave === "nivel_automacao") return `Nível ${valor}`;
  if (chave === "fase_automacao") return `Fase ${valor}`;
  if (chave === "comunicacao" || chave === "comunicacao_prevista") {
    const m: Record<string, string> = {
      wifi: "Wi-Fi (comodato)",
      "4g": "4G (adicional)",
      ambos: "Wi-Fi + 4G",
    };
    return m[String(valor)] ?? String(valor);
  }
  return String(valor);
}

/** Frase curta do escopo, ex.: "SSG Frota · Nível 2 · Pista · 1 bico · sem Comboio · Wi-Fi". */
export function resumoEscopo(escopo: EscopoProposta): string {
  const partes: string[] = [];
  const v = <T,>(k: keyof EscopoProposta) => (escopo[k]?.valor ?? null) as T | null;

  const sol = v<string>("nome_solucao");
  if (sol) partes.push(sol);
  const nivel = v<number>("nivel_automacao");
  if (nivel) partes.push(`Nível ${nivel}`);
  else {
    const fase = v<number>("fase_automacao");
    if (fase) partes.push(`Fase ${fase}`);
  }
  if (v<boolean>("tem_pista")) partes.push("Pista/Posto fixo");
  const bombas = v<number>("qtd_bombas");
  const tipoBomba = v<string>("tipo_bomba_previsto");
  if (bombas) partes.push(`${bombas} bomba${bombas > 1 ? "s" : ""}${tipoBomba ? ` ${tipoBomba}` : ""}`);
  const bicos = v<number>("qtd_bicos");
  if (bicos) partes.push(`${bicos} bico${bicos > 1 ? "s" : ""}`);
  const comboio = v<boolean>("tem_comboio");
  if (comboio === true) {
    const qtd = v<number>("qtd_comboios");
    partes.push(qtd ? `${qtd} Comboio${qtd > 1 ? "s" : ""}` : "com Comboio");
  } else if (comboio === false) partes.push("sem Comboio");
  const com = v<string>("comunicacao_prevista");
  if (com) partes.push(`${com === "wifi" ? "Wi-Fi" : com === "4g" ? "4G" : "Wi-Fi + 4G"} previsto`);

  return partes.length ? partes.join(" · ") : "Escopo não identificado";
}
