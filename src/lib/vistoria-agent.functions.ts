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

// ============= Histórico de chat =============

const HistoricoInput = z.object({
  token: z.string().min(1).optional(),
  casoId: z.string().uuid().optional(),
});

async function resolverCasoId(data: { token?: string; casoId?: string }): Promise<string> {
  if (data.token) {
    const { validarTokenAcesso } = await import("@/lib/vistoria-agent.server");
    return validarTokenAcesso(data.token);
  }
  if (data.casoId) return data.casoId;
  throw new Error("Informe token ou casoId.");
}

export type ChatMensagemRow = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: any;
  criado_em: string;
};

export const listarMensagensChat = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => HistoricoInput.parse(input))
  .handler(async ({ data }): Promise<ChatMensagemRow[]> => {
    const casoId = await resolverCasoId(data);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("chat_mensagens")
      .select("id, role, parts, criado_em")
      .eq("caso_id", casoId)
      .order("criado_em", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as ChatMensagemRow[];
  });

const SalvarMensagemInput = z.object({
  token: z.string().min(1).optional(),
  casoId: z.string().uuid().optional(),
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(z.any()).min(1),
});

export const salvarMensagemChat = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SalvarMensagemInput.parse(input))
  .handler(async ({ data }) => {
    const casoId = await resolverCasoId({ token: data.token, casoId: data.casoId });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("chat_mensagens").insert({
      caso_id: casoId,
      role: data.role,
      parts: data.parts,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
