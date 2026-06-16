import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Notificacao = {
  id: string;
  caso_id: string | null;
  tipo: string;
  titulo: string;
  mensagem: string;
  lido: boolean;
  criado_em: string;
};

export const listarNotificacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Notificacao[]> => {
    const { data, error } = await context.supabase
      .from("notificacoes")
      .select("id, caso_id, tipo, titulo, mensagem, lido, criado_em")
      .order("criado_em", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []) as Notificacao[];
  });

export const marcarNotificacaoLida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notificacoes")
      .update({ lido: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const marcarTodasLidas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("notificacoes")
      .update({ lido: true })
      .eq("lido", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
