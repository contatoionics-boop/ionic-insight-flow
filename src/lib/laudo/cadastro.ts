// Variáveis do laudo derivadas do cadastro/agendamento (client-safe, puro).

import type { VariaveisLaudo } from "@/lib/laudo/tipos";
import { limparTexto, rotuloModalidade, rotuloTipoAcao } from "@/lib/texto";

function add(vars: VariaveisLaudo, chave: string, valor: string | null | undefined) {
  const v = limparTexto(valor);
  if (!v) return;
  vars[chave] = { chave, valor: v, origem: "cadastro", confianca: 1 };
}

/**
 * Identidade do atendimento — sempre vence a proposta comercial, para o
 * documento nunca citar um cliente/modalidade diferente do que foi agendado.
 */
export function variaveisIdentidadeCadastro(caso: any): VariaveisLaudo {
  const vars: VariaveisLaudo = {};
  const u = caso?.unidade;
  const empresa = u?.matriz?.empresa?.nome ?? u?.matriz?.nome ?? null;

  add(vars, "nome_cliente", empresa);
  add(vars, "unidade", u?.nome ?? null);
  add(vars, "modalidade", rotuloModalidade(caso?.modalidade));
  add(vars, "tipo_acao", rotuloTipoAcao(caso?.tipo_solicitacao));
  add(vars, "nivel_servico", caso?.nivel);

  return vars;
}

/** Campos complementares do cadastro (usados só se ninguém mais preencher). */
export function variaveisComplementaresCadastro(caso: any): VariaveisLaudo {
  const vars: VariaveisLaudo = {};
  add(vars, "agente_tecnico", caso?.agente?.nome || caso?.agente?.email || caso?.agente_nome_manual);
  add(vars, "endereco_vistoria", caso?.endereco_vistoria);
  return vars;
}

/** @deprecated mantido por compatibilidade — use as duas funções acima. */
export function variaveisDoCadastro(caso: any): VariaveisLaudo {
  return { ...variaveisIdentidadeCadastro(caso), ...variaveisComplementaresCadastro(caso) };
}
