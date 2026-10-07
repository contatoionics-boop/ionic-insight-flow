// Progresso correto para casos com Escopo estruturado: cada instância (ex.:
// Bomba 02) conta como uma pergunta própria, como no checklist do agente.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ProgressoEscopo = {
  respondidas: number;
  total: number;
  respondidasObrigatorias: number;
  totalObrigatorias: number;
};

/** Só devolve entradas para casos que têm estrutura; os demais seguem o cálculo legado. */
export async function progressoCasosComEscopo(casoIds: string[]): Promise<Map<string, ProgressoEscopo>> {
  const out = new Map<string, ProgressoEscopo>();
  if (!casoIds.length) return out;
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from("casos")
      .select("id")
      .in("id", casoIds)
      .not("escopo_versao_id", "is", null);
    if (error || !data?.length) return out;
    const { loadAgentContext, calcularPendencias } = await import("@/lib/vistoria-agent.server");
    for (const row of data as { id: string }[]) {
      try {
        const ctx = await loadAgentContext(row.id);
        const p = calcularPendencias(ctx);
        out.set(row.id, {
          respondidas: p.respondidas,
          total: p.totalVisiveis,
          respondidasObrigatorias: p.respondidasObrigatorias,
          totalObrigatorias: p.totalObrigatorias,
        });
      } catch {
        /* mantém o cálculo legado para este caso */
      }
    }
  } catch {
    /* migration ainda não aplicada */
  }
  return out;
}
