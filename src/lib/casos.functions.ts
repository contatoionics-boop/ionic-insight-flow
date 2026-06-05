import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdminOrSuper(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["super_admin", "admin"]);
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Apenas admins podem agendar vistorias.");
}

async function assertVistoriador(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "agente_tecnico")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a vistoriadores.");
}

async function checarConflito(opts: {
  agenteId: string;
  inicio: string;
  duracaoMin: number;
  ignorarCasoId?: string;
}) {
  const inicio = new Date(opts.inicio);
  const fim = new Date(inicio.getTime() + opts.duracaoMin * 60_000);
  // Busca casos agendados do mesmo agente no dia
  const diaInicio = new Date(inicio);
  diaInicio.setHours(0, 0, 0, 0);
  const diaFim = new Date(inicio);
  diaFim.setHours(23, 59, 59, 999);

  const { data, error } = await supabaseAdmin
    .from("casos")
    .select("id, agendado_em, duracao_min, status")
    .eq("agente_id", opts.agenteId)
    .not("agendado_em", "is", null)
    .gte("agendado_em", diaInicio.toISOString())
    .lte("agendado_em", diaFim.toISOString())
    .in("status", ["agendado", "em_andamento"]);
  if (error) throw new Error(error.message);

  for (const c of data ?? []) {
    if (opts.ignorarCasoId && c.id === opts.ignorarCasoId) continue;
    if (!c.agendado_em) continue;
    const ini = new Date(c.agendado_em);
    const fimC = new Date(ini.getTime() + (c.duracao_min ?? 60) * 60_000);
    if (inicio < fimC && fim > ini) {
      throw new Error("Vistoriador já tem outra vistoria neste horário.");
    }
  }
}

const AgendarInput = z.object({
  unidadeId: z.string().uuid(),
  formId: z.string().uuid(),
  agenteId: z.string().uuid(),
  agendadoEm: z.string().min(1),
  duracaoMin: z.number().int().min(15).max(8 * 60).default(60),
  enderecoVistoria: z.string().max(500).optional().nullable(),
  observacoes: z.string().max(2000).optional().nullable(),
  gerarLink: z.boolean().default(false),
  mode: z.enum(["stepper", "chat"]).default("stepper"),
});

export const agendarVistoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AgendarInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminOrSuper(context.supabase, context.userId);
    await checarConflito({
      agenteId: data.agenteId,
      inicio: data.agendadoEm,
      duracaoMin: data.duracaoMin,
    });

    const { data: caso, error } = await supabaseAdmin
      .from("casos")
      .insert({
        unidade_id: data.unidadeId,
        formulario_id: data.formId,
        agente_id: data.agenteId,
        criado_por: context.userId,
        status: "agendado",
        agendado_em: data.agendadoEm,
        duracao_min: data.duracaoMin,
        endereco_vistoria: data.enderecoVistoria ?? null,
        observacoes_agendamento: data.observacoes ?? null,
      })
      .select("id, codigo")
      .single();
    if (error || !caso) throw new Error(error?.message ?? "Erro ao agendar.");

    let token: string | null = null;
    if (data.gerarLink) {
      token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      const { error: lErr } = await supabaseAdmin
        .from("links_agente")
        .insert({ token, caso_id: caso.id });
      if (lErr) throw new Error(lErr.message);
    }

    return { casoId: caso.id, codigo: caso.codigo, token, mode: data.mode };
  });

const ReagendarInput = z.object({
  casoId: z.string().uuid(),
  agendadoEm: z.string().min(1),
  duracaoMin: z.number().int().min(15).max(8 * 60),
  enderecoVistoria: z.string().max(500).optional().nullable(),
  observacoes: z.string().max(2000).optional().nullable(),
});

export const reagendarVistoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReagendarInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminOrSuper(context.supabase, context.userId);
    const { data: caso, error: cErr } = await supabaseAdmin
      .from("casos")
      .select("agente_id, status")
      .eq("id", data.casoId)
      .maybeSingle();
    if (cErr || !caso) throw new Error("Caso não encontrado.");
    if (!caso.agente_id) throw new Error("Caso sem vistoriador.");

    await checarConflito({
      agenteId: caso.agente_id,
      inicio: data.agendadoEm,
      duracaoMin: data.duracaoMin,
      ignorarCasoId: data.casoId,
    });

    const { error } = await supabaseAdmin
      .from("casos")
      .update({
        agendado_em: data.agendadoEm,
        duracao_min: data.duracaoMin,
        endereco_vistoria: data.enderecoVistoria ?? null,
        observacoes_agendamento: data.observacoes ?? null,
        status: caso.status === "cancelado" ? "agendado" : caso.status,
      })
      .eq("id", data.casoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelarVistoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ casoId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrSuper(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("casos")
      .update({ status: "cancelado" })
      .eq("id", data.casoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletarVistoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ casoId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrSuper(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("casos")
      .delete()
      .eq("id", data.casoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listarMinhasVistorias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertVistoriador(context.supabase, context.userId);
    const { supabase } = context;
    const { data, error } = await supabase
      .from("casos")
      .select(
        "id, codigo, status, agendado_em, duracao_min, endereco_vistoria, observacoes_agendamento, unidade:unidades(nome, matriz:matrizes(nome, empresa:empresas(nome))), formulario:formularios(nome)",
      )
      .eq("agente_id", context.userId)
      .order("agendado_em", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const iniciarVistoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ casoId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertVistoriador(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("casos")
      .update({ status: "em_andamento" })
      .eq("id", data.casoId)
      .eq("agente_id", context.userId)
      .in("status", ["agendado", "rascunho", "em_andamento"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const finalizarVistoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ casoId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertVistoriador(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("casos")
      .update({ status: "aguardando_revisao" })
      .eq("id", data.casoId)
      .eq("agente_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listarAgendaAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        inicio: z.string().min(1),
        fim: z.string().min(1),
        agenteId: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrSuper(context.supabase, context.userId);
    let q = supabaseAdmin
      .from("casos")
      .select(
        "id, codigo, status, agendado_em, duracao_min, endereco_vistoria, observacoes_agendamento, agente_id, unidade:unidades(nome, matriz:matrizes(nome, empresa:empresas(nome))), agente:profiles!agente_id(nome), formulario:formularios(nome)",
      )
      .not("agendado_em", "is", null)
      .gte("agendado_em", data.inicio)
      .lte("agendado_em", data.fim)
      .order("agendado_em", { ascending: true });
    if (data.agenteId) q = q.eq("agente_id", data.agenteId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
