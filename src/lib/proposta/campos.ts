// Tipagem de edição dos campos do escopo preliminar (client-safe).

import type { CampoProposta, EscopoProposta } from "@/lib/proposta/tipos";

export type TipoCampo = "texto" | "numero" | "booleano" | "lista" | "comunicacao" | "acao";

const BOOLEANOS = new Set(["tem_pista", "tem_comboio", "rfid", "comboio"]);
const LISTAS = new Set([
  "ids_objetos",
  "itens_previstos",
  "itens_nao_inclusos",
  "infra_prevista",
  "observacoes_preliminares",
  "itens_inclusos",
]);

export function tipoDoCampo(chave: keyof EscopoProposta): TipoCampo {
  if (BOOLEANOS.has(chave)) return "booleano";
  if (LISTAS.has(chave)) return "lista";
  if (chave === "comunicacao_prevista" || chave === "comunicacao") return "comunicacao";
  if (chave === "tipo_acao") return "acao";
  if (
    chave === "fase_automacao" ||
    chave === "nivel_automacao" ||
    String(chave).startsWith("qtd_")
  )
    return "numero";
  return "texto";
}

/** Converte o texto digitado pelo usuário no valor tipado do campo. */
export function parseValorCampo(chave: keyof EscopoProposta, texto: string): any {
  const t = (texto ?? "").trim();
  if (!t) return null;
  switch (tipoDoCampo(chave)) {
    case "lista":
      return t
        .split(/;|\n/)
        .map((s) => s.trim())
        .filter(Boolean);
    case "booleano":
      return /^(sim|s|true|1|com)/i.test(t) ? true : /^(n[aã]o|n|false|0|sem)/i.test(t) ? false : null;
    case "comunicacao": {
      const l = t.toLowerCase();
      return /ambos|wi-?fi.*4g|4g.*wi-?fi/.test(l)
        ? "ambos"
        : /4g|gsm|gprs/.test(l)
          ? "4g"
          : /wi-?fi/.test(l)
            ? "wifi"
            : null;
    }
    case "acao": {
      const l = t.toLowerCase();
      return /upgrade|atualiza/.test(l) ? "upgrade" : /instala/.test(l) ? "instalacao" : null;
    }
    case "numero": {
      const n = Number(t.replace(/[^\d]/g, ""));
      return Number.isFinite(n) && t.match(/\d/) ? n : null;
    }
    default:
      // Preserva o espaço digitado enquanto o campo de texto é editado.
      // O trim a cada tecla impedia escrever valores compostos, como marca + modelo.
      return texto;
  }
}

/** Campo corrigido manualmente: prioridade sobre a extração, marcado confirmado. */
export function campoManual(chave: keyof EscopoProposta, texto: string): CampoProposta<any> {
  const valor = parseValorCampo(chave, texto);
  return {
    valor,
    confianca: valor === null ? 0 : 1,
    trecho: "ajuste manual",
    secao: "manual",
    origem: "manual",
    status: valor === null ? "nao_identificado" : "confirmado",
  };
}
