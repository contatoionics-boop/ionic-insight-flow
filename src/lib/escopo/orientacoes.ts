// Rascunho determinístico (sem IA) das orientações ao agente a partir do que o
// agendador já informou. Código puro (client-safe).

import type { EscopoProposta } from "@/lib/proposta/tipos";
import { resumoArvore, type ArvoreEscopo } from "@/lib/escopo/tipos";

const COMUNICACAO: Record<string, string> = { wifi: "Wi-Fi", "4g": "4G", ambos: "Wi-Fi e 4G" };

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

export function montarOrientacoes(
  escopo: EscopoProposta | null,
  arvore: ArvoreEscopo,
  textoManual?: string,
): string {
  const linhas: string[] = [];

  const solucao = arvore.config?.solucao || escopo?.nome_solucao?.valor;
  if (solucao) linhas.push(`Solução: ${solucao}`);
  const comunicacao = arvore.config?.comunicacao || escopo?.comunicacao_prevista?.valor;
  if (comunicacao) linhas.push(`Comunicação prevista: ${COMUNICACAO[comunicacao] ?? comunicacao}`);

  const r = resumoArvore(arvore);
  const estrutura: string[] = [];
  if (r.postos) estrutura.push(plural(r.postos, "posto", "postos"));
  if (r.ilhas) estrutura.push(plural(r.ilhas, "ilha", "ilhas"));
  if (r.bombas) estrutura.push(plural(r.bombas, "bomba", "bombas"));
  if (r.bicos) estrutura.push(plural(r.bicos, "bico", "bicos"));
  if (r.tanques) estrutura.push(plural(r.tanques, "tanque", "tanques"));
  if (r.sondas) estrutura.push(plural(r.sondas, "sonda", "sondas"));
  if (r.comboios) estrutura.push(plural(r.comboios, "comboio", "comboios"));
  if (r.frota) estrutura.push("Frota/DIV");
  if (estrutura.length) linhas.push(`Estrutura a mapear: ${estrutura.join(", ")}.`);

  const naoInclusos = escopo?.itens_nao_inclusos?.valor;
  if (naoInclusos?.length) linhas.push(`Não incluso no escopo: ${naoInclusos.join("; ")}.`);
  const obs = escopo?.observacoes_preliminares?.valor;
  if (obs?.length) linhas.push(`Observações da proposta: ${obs.join("; ")}.`);

  const manual = textoManual?.trim();
  if (manual) linhas.push(`Descrição do escopo: ${manual}`);

  return linhas.join("\n");
}
