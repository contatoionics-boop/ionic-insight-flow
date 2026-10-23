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
    // Cada contexto faz várias consultas: processa em paralelo, poucos por vez.
    const ids = (data as { id: string }[]).map((r) => r.id);
    let proximo = 0;
    const trabalhador = async () => {
      while (proximo < ids.length) {
        const id = ids[proximo++];
        try {
          const ctx = await loadAgentContext(id);
          const p = calcularPendencias(ctx);
          out.set(id, {
            respondidas: p.respondidas,
            total: p.totalVisiveis,
            respondidasObrigatorias: p.respondidasObrigatorias,
            totalObrigatorias: p.totalObrigatorias,
          });
        } catch {
          /* mantém o cálculo legado para este caso */
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, ids.length) }, trabalhador));
  } catch {
    /* migration ainda não aplicada */
  }
  return out;
}
