import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ============================================================
// Conflitos de agenda
// ============================================================
const ConflitoInput = z.object({
  agenteId: z.string().uuid(),
  data: z.string().min(1), // ISO; usa o dia
  duracaoMin: z.number().int().min(15).max(8 * 60).default(60),
  ignorarAgendamentoId: z.string().uuid().optional().nullable(),
});

export type ConflitoResult = {
  conflito: boolean;
  agenteNome?: string | null;
  clienteNome?: string | null;
  dataConflito?: string | null;
};

export const verificarConflitoAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConflitoInput.parse(d))
  .handler(async ({ data }): Promise<ConflitoResult> => {
    const ini = new Date(data.data);
    if (Number.isNaN(ini.getTime())) return { conflito: false };
    const diaIni = new Date(ini); diaIni.setHours(0, 0, 0, 0);
    const diaFim = new Date(ini); diaFim.setHours(23, 59, 59, 999);

    let q = supabaseAdmin
      .from("agendamentos")
      .select("id, agendado_em, agente_id, agente:profiles!agente_id(nome), unidade:unidades(matriz:matrizes(empresa:empresas(nome)))")
      .eq("agente_id", data.agenteId)
      .gte("agendado_em", diaIni.toISOString())
      .lte("agendado_em", diaFim.toISOString());
    if (data.ignorarAgendamentoId) q = q.neq("id", data.ignorarAgendamentoId);
    const { data: rows, error } = await q.limit(1);
    if (error) throw new Error(error.message);
    const row: any = rows?.[0];
    if (!row) return { conflito: false };
    return {
      conflito: true,
      agenteNome: row.agente?.nome ?? null,
      clienteNome: row.unidade?.matriz?.empresa?.nome ?? null,
      dataConflito: row.agendado_em,
    };
  });

export const listarDiasOcupadosAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      agenteId: z.string().uuid(),
      inicio: z.string().min(1),
      fim: z.string().min(1),
    }).parse(d),
  )
  .handler(async ({ data }): Promise<string[]> => {
    const { data: rows, error } = await supabaseAdmin
      .from("agendamentos")
      .select("agendado_em")
      .eq("agente_id", data.agenteId)
      .gte("agendado_em", data.inicio)
      .lte("agendado_em", data.fim);
    if (error) throw new Error(error.message);
    const dias = new Set<string>();
    for (const r of rows ?? []) {
      const d = new Date((r as any).agendado_em);
      dias.add(d.toDateString());
    }
    return [...dias];
  });

// ============================================================
// Aceite do agente
// ============================================================
async function notificar(usuarioId: string, titulo: string, mensagem: string, tipo: string, casoId: string | null = null) {
  await supabaseAdmin.from("notificacoes").insert({
    usuario_id: usuarioId,
    titulo,
    mensagem,
    tipo,
    caso_id: casoId,
    lido: false,
  } as any);
}

async function notificarAdmins(titulo: string, mensagem: string, tipo: string, casoId: string | null = null) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "super_admin"]);
  const ids = Array.from(new Set(((data ?? []) as any[]).map((r) => r.user_id).filter(Boolean)));
  if (ids.length === 0) return;
  await supabaseAdmin.from("notificacoes").insert(
    ids.map((uid) => ({ usuario_id: uid, titulo, mensagem, tipo, caso_id: casoId, lido: false })) as any,
  );
}


export const confirmarAgendamentoAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ agendamentoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ag, error: agErr } = await supabaseAdmin
      .from("agendamentos")
      .select("id, agente_id, criado_por, agendado_em, unidade:unidades(matriz:matrizes(empresa:empresas(nome)))")
      .eq("id", data.agendamentoId)
      .maybeSingle();
    if (agErr || !ag) throw new Error("Agendamento não encontrado.");
    if ((ag as any).agente_id !== context.userId) throw new Error("Apenas o agente atribuído pode confirmar.");

    const { error } = await supabaseAdmin
      .from("agendamentos")
      .update({
        aceite_agente: true,
        aceite_status: "confirmado",
        data_aceite: new Date().toISOString(),
        motivo_recusa: null,
      } as any)
      .eq("id", data.agendamentoId);
    if (error) throw new Error(error.message);

    const cliente = (ag as any).unidade?.matriz?.empresa?.nome ?? "cliente";
    const dataFmt = new Date((ag as any).agendado_em).toLocaleString("pt-BR");
    if ((ag as any).criado_por) {
      await notificar(
        (ag as any).criado_por,
        "Agendamento confirmado",
        `O agente confirmou o agendamento de ${cliente} em ${dataFmt}.`,
        "agendamento_confirmado",
      );
    }
    return { ok: true };
  });

export const recusarAgendamentoAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ agendamentoId: z.string().uuid(), motivo: z.string().min(3).max(1000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: ag, error: agErr } = await supabaseAdmin
      .from("agendamentos")
      .select("id, agente_id, criado_por, agendado_em, unidade:unidades(matriz:matrizes(empresa:empresas(nome)))")
      .eq("id", data.agendamentoId)
      .maybeSingle();
    if (agErr || !ag) throw new Error("Agendamento não encontrado.");
    if ((ag as any).agente_id !== context.userId) throw new Error("Apenas o agente atribuído pode recusar.");

    const { error } = await supabaseAdmin
      .from("agendamentos")
      .update({
        aceite_agente: false,
        aceite_status: "recusado_pelo_agente",
        data_aceite: new Date().toISOString(),
        motivo_recusa: data.motivo,
      } as any)
      .eq("id", data.agendamentoId);
    if (error) throw new Error(error.message);

    const cliente = (ag as any).unidade?.matriz?.empresa?.nome ?? "cliente";
    const dataFmt = new Date((ag as any).agendado_em).toLocaleString("pt-BR");
    if ((ag as any).criado_por) {
      await notificar(
        (ag as any).criado_por,
        "Agendamento recusado pelo agente",
        `Cliente ${cliente} em ${dataFmt}. Motivo: ${data.motivo}`,
        "agendamento_recusado",
      );
    }
    return { ok: true };
  });

export type AceiteAgendamento = {
  id: string;
  agendado_em: string;
  endereco_vistoria: string | null;
  observacoes_agendamento: string | null;
  aceite_status: "aguardando_aceite" | "confirmado" | "recusado_pelo_agente";
  motivo_recusa: string | null;
  cliente_nome: string | null;
  unidade_nome: string | null;
};

export const listarAgendamentosDoAgente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AceiteAgendamento[]> => {
    const { data, error } = await supabaseAdmin
      .from("agendamentos")
      .select("id, agendado_em, endereco_vistoria, observacoes_agendamento, aceite_status, motivo_recusa, unidade:unidades(nome, matriz:matrizes(empresa:empresas(nome)))")
      .eq("agente_id", context.userId)
      .order("agendado_em", { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      agendado_em: r.agendado_em,
      endereco_vistoria: r.endereco_vistoria,
      observacoes_agendamento: r.observacoes_agendamento,
      aceite_status: r.aceite_status ?? "aguardando_aceite",
      motivo_recusa: r.motivo_recusa,
      cliente_nome: r.unidade?.matriz?.empresa?.nome ?? null,
      unidade_nome: r.unidade?.nome ?? null,
    }));
  });
