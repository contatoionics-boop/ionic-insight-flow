/**
 * Escolhas dos campos criados em Configurações › Opções do agendamento ({ campo: valor }), lidas à parte das
 * consultas principais: sem a coluna `agendamentos.campos_extras` (migration pendente) devolve vazio em vez de
 * derrubar a lista/agenda.
 */
export async function camposExtrasPorAgendamento(sb: any, ids: (string | null | undefined)[]): Promise<Map<string, Record<string, string>>> {
  const out = new Map<string, Record<string, string>>();
  const lista = [...new Set(ids.filter(Boolean) as string[])];
  if (!lista.length) return out;
  try {
    // em lotes: a lista de ids vai na URL
    for (let i = 0; i < lista.length; i += 100) {
      const { data, error } = await sb.from("agendamentos").select("id, campos_extras").in("id", lista.slice(i, i + 100));
      if (error) return new Map();
      for (const r of data ?? []) if (r.campos_extras && Object.keys(r.campos_extras).length) out.set(r.id, r.campos_extras);
    }
  } catch {
    return new Map();
  }
  return out;
}
