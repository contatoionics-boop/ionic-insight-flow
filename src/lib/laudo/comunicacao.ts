// Semântica de comunicação do mapeamento (client-safe, puro).
//
// As perguntas do FR-29/FR-30 são booleanas ("dispõe de sinal Wi-Fi?") ou
// qualitativas ("potência do sinal GPRS"). Elas alimentam variáveis
// estruturadas (`wifi_disponivel`, `gsm_4g_disponivel`, `frequencia_wifi`,
// `qualidade_wifi`, `qualidade_sinal`) e NUNCA `comunicacao_tipos` diretamente.
// `comunicacao_tipos` é sempre derivada dessas variáveis.

import type { VariaveisLaudo } from "@/lib/laudo/tipos";

const ORIGENS_CAMPO = new Set(["formulario", "manual", "ia"]);

function norm(s: string | null | undefined): string {
  return (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** true/false/null a partir de textos como "sim", "não", "possui" */
export function booleanoTexto(s: string | null | undefined): boolean | null {
  const t = norm(s);
  if (!t) return null;
  if (/^(sim|s|true|1|possui|tem|disponivel)\b/.test(t)) return true;
  if (/^(nao|n|false|0|ausente|inexistente|sem)\b/.test(t)) return false;
  return null;
}

/** o texto é apenas um booleano (sim/não), sem informação semântica */
export function ehRespostaBooleana(s: string | null | undefined): boolean {
  const t = norm(s);
  return /^(sim|nao|s|n|true|false|1|0)$/.test(t);
}

function campo(vars: VariaveisLaudo, chave: string): string | null {
  const item = vars[chave];
  if (!item || !ORIGENS_CAMPO.has(String(item.origem))) return null;
  const s = (item.valor ?? "").toString().trim();
  return s.length ? s : null;
}

function qualidadeNegativa(s: string | null): boolean {
  const t = norm(s);
  return !!t && /(sem sinal|inexistente|nenhum|nao ha|indisponivel|ausente)/.test(t);
}

export type ComunicacaoCampo = {
  /** true = confirmado, false = explicitamente ausente, null = não informado */
  wifi: boolean | null;
  /** GSM / 4G */
  movel: boolean | null;
  /** rótulo derivado para `comunicacao_tipos` (null quando nada confirmado) */
  rotulo: string | null;
};

/** Lê as variáveis estruturadas e deriva a comunicação confirmada em campo. */
export function comunicacaoDoCampo(vars: VariaveisLaudo): ComunicacaoCampo {
  let wifi = booleanoTexto(campo(vars, "wifi_disponivel"));
  if (wifi === null) {
    const freq = campo(vars, "frequencia_wifi");
    const qualidade = campo(vars, "qualidade_wifi");
    if ((freq && !qualidadeNegativa(freq)) || (qualidade && !qualidadeNegativa(qualidade)))
      wifi = true;
    else if (qualidadeNegativa(freq) || qualidadeNegativa(qualidade)) wifi = false;
  }

  let movel = booleanoTexto(campo(vars, "gsm_4g_disponivel"));
  if (movel === null) {
    const sinal = campo(vars, "qualidade_sinal");
    if (sinal) movel = qualidadeNegativa(sinal) ? false : true;
  }

  const partes: string[] = [];
  if (wifi === true) partes.push("WiFi");
  if (movel === true) partes.push("4G/GSM");

  return { wifi, movel, rotulo: partes.length ? partes.join(", ") : null };
}

/**
 * Grava `comunicacao_tipos` derivado das variáveis estruturadas do campo.
 * Sobrescreve valores booleanos inválidos ("sim") e valores herdados da
 * proposta; preserva confirmações manuais do especialista.
 */
export function derivarComunicacaoTipos(vars: VariaveisLaudo): VariaveisLaudo {
  const atual = vars["comunicacao_tipos"];
  if (atual && ehRespostaBooleana(atual.valor)) delete vars["comunicacao_tipos"];

  const { rotulo } = comunicacaoDoCampo(vars);
  if (!rotulo) return vars;

  const existente = vars["comunicacao_tipos"];
  if (existente?.origem === "manual" && existente.valor) return vars;

  vars["comunicacao_tipos"] = {
    chave: "comunicacao_tipos",
    valor: rotulo,
    origem: "formulario",
    confianca: 0.95,
  };
  return vars;
}
