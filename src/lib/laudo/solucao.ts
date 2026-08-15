// Detecção determinística da solução contratada (SAAF x SSG Frota).
// Puro e client-safe. Nunca assume SAAF por omissão: sem evidência retorna null.

import type { VariaveisLaudo } from "@/lib/laudo/tipos";

export type SolucaoContratada = "saaf" | "ssg_frota";

function texto(vars: VariaveisLaudo, chave: string): string {
  const v = vars?.[chave]?.valor;
  return typeof v === "string" ? v.toLowerCase() : "";
}

/**
 * @returns "saaf" | "ssg_frota" quando há evidência explícita; null quando a
 * solução não foi identificada ou o texto é ambíguo (cita as duas).
 */
export function solucaoContratada(vars: VariaveisLaudo): SolucaoContratada | null {
  const alvo = [texto(vars, "nome_solucao"), texto(vars, "objeto_escopo")].join(" ");
  const ssg = /\bssg\b|ssg\s*[- ]?frota/.test(alvo);
  const saaf = /\bsaaf\b/.test(alvo);
  if (ssg && saaf) return null; // ambíguo: revisão humana
  if (ssg) return "ssg_frota";
  if (saaf) return "saaf";
  return null;
}

/** Rótulo de exibição da solução, sem inventar valor quando ausente. */
export function rotuloSolucao(vars: VariaveisLaudo): string | null {
  const s = solucaoContratada(vars);
  return s === "saaf" ? "SAAF" : s === "ssg_frota" ? "SSG Frota" : null;
}
