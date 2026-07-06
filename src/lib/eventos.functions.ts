import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EventoTipo, AtorPapel } from "@/lib/eventos.server";

export type EventoRow = {
  id: string;
  caso_id: string;
  agendamento_id: string | null;
  tipo: EventoTipo;
  ocorrido_em: string;
  ator_id: string | null;
  ator_nome: string | null;
  ator_papel: AtorPapel;
  metadata: Record<string, any>;
};

export const listarEventosDoMapeamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ casoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<EventoRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("mapeamento_eventos")
      .select("id, caso_id, agendamento_id, tipo, ocorrido_em, ator_id, ator_nome, ator_papel, metadata")
      .eq("caso_id", data.casoId)
      .order("ocorrido_em", { ascending: true });
    if (error) throw new Error(error.message);
    return ((rows ?? []) as any[]) as EventoRow[];
  });
