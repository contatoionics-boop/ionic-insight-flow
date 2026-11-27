import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { definirOpcoes, opcoesAtuais, type OpcaoAgendamento } from "@/lib/opcoes-agendamento";

/**
 * Carrega as opções do agendamento (nomes configurados) para a cópia em memória usada pelos rótulos do
 * documento e do checklist. Sem a tabela (migration pendente) ou em falha, valem os nomes padrão.
 */
export async function carregarOpcoesAgendamento(): Promise<OpcaoAgendamento[]> {
  try {
    const { data, error } = await (supabaseAdmin as any).from("opcoes_agendamento").select("campo, valor, rotulo, ativo, ordem, sistema");
    if (error) return opcoesAtuais();
    return definirOpcoes(data);
  } catch {
    return opcoesAtuais();
  }
}
