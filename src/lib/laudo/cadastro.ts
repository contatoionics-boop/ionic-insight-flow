// Variáveis do laudo derivadas do cadastro/agendamento (client-safe, puro).

import type { VariaveisLaudo } from "@/lib/laudo/tipos";

function add(vars: VariaveisLaudo, chave: string, valor: string | null | undefined) {
  const v = (valor ?? "").toString().trim();
  if (!v) return;
  vars[chave] = { chave, valor: v, origem: "cadastro", confianca: 1 };
}

/** Recebe o caso já carregado com unidade/matriz/empresa. */
export function variaveisDoCadastro(caso: any): VariaveisLaudo {
  const vars: VariaveisLaudo = {};
  const u = caso?.unidade;
  const empresa = u?.matriz?.empresa?.nome ?? u?.matriz?.nome ?? null;

  add(vars, "nome_cliente", empresa);
  add(vars, "tipo_acao", caso?.tipo_solicitacao);
  add(vars, "modalidade", caso?.modalidade);
  add(vars, "nivel_servico", caso?.nivel);

  return vars;
}
