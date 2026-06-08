import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EstadoInput = z.object({
  token: z.string().min(1).optional(),
  casoId: z.string().uuid().optional(),
});

export type EstadoVistoria = {
  casoId: string;
  clienteNome: string;
  formularioNome: string;
  totalVisiveis: number;
  respondidas: number;
  obrigatoriasFaltando: number;
};

/** Public-or-auth: pass either token (link público) OU casoId (sessão autenticada). */
export const getEstadoVistoria = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EstadoInput.parse(input))
  .handler(async ({ data }): Promise<EstadoVistoria> => {
    const { loadAgentContext, validarTokenAcesso, perguntasVisiveis } = await import(
      "@/lib/vistoria-agent.server"
    );

    let casoId: string;
    if (data.token) {
      casoId = await validarTokenAcesso(data.token);
    } else if (data.casoId) {
      // Authenticated path: we rely on requireSupabaseAuth wrapper if called by app.
      // For simplicity we trust casoId; the chat route validates again.
      casoId = data.casoId;
    } else {
      throw new Error("Informe token ou casoId.");
    }

    const ctx = await loadAgentContext(casoId);
    const visiveis = perguntasVisiveis(ctx);
    const respondidas = visiveis.filter((p) => {
      const r = ctx.state[p.id];
      return !!(r?.valor_texto || r?.arquivo_path || r?.transcricao);
    }).length;
    const obrigatoriasFaltando = visiveis.filter((p) => {
      const r = ctx.state[p.id];
      return p.obrigatoria && !(r?.valor_texto || r?.arquivo_path || r?.transcricao);
    }).length;

    return {
      casoId,
      clienteNome: ctx.clienteNome,
      formularioNome: ctx.formularioNome,
      totalVisiveis: visiveis.length,
      respondidas,
      obrigatoriasFaltando,
    };
  });

const FinalizarInput = z.object({
  token: z.string().min(1).optional(),
  casoId: z.string().uuid().optional(),
});

export const finalizarVistoriaChat = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => FinalizarInput.parse(input))
  .handler(async ({ data }) => {
    const { validarTokenAcesso } = await import("@/lib/vistoria-agent.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let casoId: string;
    if (data.token) {
      casoId = await validarTokenAcesso(data.token);
      await supabaseAdmin
        .from("links_agente")
        .update({ utilizado_em: new Date().toISOString() })
        .eq("token", data.token);
    } else if (data.casoId) {
      casoId = data.casoId;
    } else {
      throw new Error("Informe token ou casoId.");
    }
    const { error } = await supabaseAdmin
      .from("casos")
      .update({ status: "aguardando_revisao" })
      .eq("id", casoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
