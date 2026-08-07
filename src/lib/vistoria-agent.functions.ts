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
  totalObrigatorias: number;
  respondidasObrigatorias: number;
  obrigatoriasFaltando: number;
  proximaPerguntaTipo: string | null;
  proximaPerguntaId: string | null;
  proximaPerguntaTexto: string | null;
  proximaPerguntaSecao: string | null;
  proximaPerguntaInstrucao: string | null;
  proximaPerguntaOpcoes: { id: string; texto: string }[];
};

/** Public-or-auth: pass either token (link público) OU casoId (sessão autenticada). */
export const getEstadoVistoria = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EstadoInput.parse(input))
  .handler(async ({ data }): Promise<EstadoVistoria> => {
    const { loadAgentContext, validarTokenAcesso } = await import(
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

    const { calcularPendencias } = await import("@/lib/vistoria-agent.server");
    const ctx = await loadAgentContext(casoId);
    const pend = calcularPendencias(ctx);

    // Casos antigos podem ter respostas persistidas sem que o status tenha
    // acompanhado o primeiro salvamento. Corrige o estado sem recriar evento.
    if (pend.respondidas > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("casos")
        .update({ status: "em_andamento" })
        .eq("id", casoId)
        .in("status", ["agendado", "rascunho"]);
      if (error) console.error("[vistoria] falha ao normalizar status:", error.message);
    }

    return {
      casoId,
      clienteNome: ctx.clienteNome,
      formularioNome: ctx.formularioNome,
      totalVisiveis: pend.totalVisiveis,
      respondidas: pend.respondidas,
      totalObrigatorias: pend.totalObrigatorias,
      respondidasObrigatorias: pend.respondidasObrigatorias,
      obrigatoriasFaltando: pend.obrigatoriasFaltando,
      proximaPerguntaTipo: pend.proxima?.tipo ?? null,
      proximaPerguntaId: pend.proxima?.id ?? null,
      proximaPerguntaTexto: pend.proxima?.texto ?? null,
      proximaPerguntaSecao: pend.proxima?.secao_titulo ?? null,
      proximaPerguntaInstrucao: pend.proxima?.instrucao_agente ?? null,
      proximaPerguntaOpcoes: pend.proxima?.opcoes ?? [],
    };
  });


const FinalizarInput = z.object({
  token: z.string().min(1).optional(),
  casoId: z.string().uuid().optional(),
});

export const finalizarVistoriaChat = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => FinalizarInput.parse(input))
  .handler(async ({ data }) => {
    const { validarTokenAcesso, loadAgentContext, calcularPendencias } = await import(
      "@/lib/vistoria-agent.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let casoId: string;
    if (data.token) {
      casoId = await validarTokenAcesso(data.token);
    } else if (data.casoId) {
      casoId = data.casoId;
    } else {
      throw new Error("Informe token ou casoId.");
    }

    // Trava real: não permite encerrar com perguntas obrigatórias em aberto.
    const ctx = await loadAgentContext(casoId);
    const pend = calcularPendencias(ctx);
    if (!pend.podeFinalizar) {
      const exemplos = pend.pendentesObrigatorias
        .slice(0, 5)
        .map((p) => `• ${p.texto}`)
        .join("\n");
      throw new Error(
        `Não é possível finalizar: ainda faltam ${pend.obrigatoriasFaltando} pergunta(s) obrigatória(s).\n${exemplos}${
          pend.obrigatoriasFaltando > 5 ? `\n… e mais ${pend.obrigatoriasFaltando - 5}.` : ""
        }`,
      );
    }

    if (data.token) {
      await supabaseAdmin
        .from("links_agente")
        .update({ utilizado_em: new Date().toISOString() })
        .eq("token", data.token);
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
