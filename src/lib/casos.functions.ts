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

const AgendarInput = z
  .object({
    unidadeId: z.string().uuid().optional().nullable(),
    matrizId: z.string().uuid().optional().nullable(),
    formIds: z.array(z.string().uuid()).min(1, "Selecione ao menos um formulário."),
    agenteId: z.string().uuid(),
    agendadoEm: z.string().min(1),
    duracaoMin: z.number().int().min(15).max(8 * 60).default(60),
    enderecoVistoria: z.string().max(500).optional().nullable(),
    observacoes: z.string().max(2000).optional().nullable(),
  })
  .refine((v) => !!v.unidadeId || !!v.matrizId, {
    message: "Informe unidade ou matriz.",
  });

async function resolveUnidadeId(input: { unidadeId?: string | null; matrizId?: string | null; userId: string }) {
  if (input.unidadeId) return input.unidadeId;
  if (!input.matrizId) throw new Error("Sem unidade nem matriz.");
  const { data: existing, error: exErr } = await supabaseAdmin
    .from("unidades")
    .select("id")
    .eq("matriz_id", input.matrizId)
    .order("criado_em", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);
  if (existing?.id) return existing.id;

  const { data: m, error: mErr } = await supabaseAdmin
    .from("matrizes")
    .select("cep, logradouro, numero, bairro, cidade, estado, email, telefone")
    .eq("id", input.matrizId)
    .maybeSingle();
  if (mErr || !m) throw new Error(mErr?.message ?? "Matriz não encontrada.");
  const { data: nova, error: nErr } = await supabaseAdmin
    .from("unidades")
    .insert({
      matriz_id: input.matrizId,
      nome: "Sede",
      criado_por: input.userId,
      cep: m.cep,
      logradouro: m.logradouro,
      numero: m.numero,
      bairro: m.bairro,
      cidade: m.cidade,
      estado: m.estado,
      email: m.email,
      telefone: m.telefone,
    })
    .select("id")
    .single();
  if (nErr || !nova) throw new Error(nErr?.message ?? "Erro ao criar unidade Sede.");
  return nova.id;
}

type EnderecoRow = {
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
};

function formatEndereco(row?: EnderecoRow | null) {
  if (!row) return null;
  const endereco = [
    [row.logradouro, row.numero].filter(Boolean).join(", "),
    row.bairro,
    [row.cidade, row.estado].filter(Boolean).join("/"),
  ]
    .filter(Boolean)
    .join(" - ");
  return endereco || null;
}

async function getEnderecoVistoria(unidadeId: string) {
  const { data, error } = await supabaseAdmin
    .from("unidades")
    .select("logradouro, numero, bairro, cidade, estado, matriz:matrizes(logradouro, numero, bairro, cidade, estado)")
    .eq("id", unidadeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return formatEndereco(data) ?? formatEndereco((data?.matriz as EnderecoRow | null) ?? null);
}

async function criarCaso(opts: {
  agendamentoId: string;
  unidadeId: string;
  formId: string;
  agenteId: string;
  criadoPor: string;
  agendadoEm: string;
  duracaoMin: number;
  enderecoVistoria: string | null;
  observacoes: string | null;
}) {
  const { data, error } = await supabaseAdmin
    .from("casos")
    .insert({
      agendamento_id: opts.agendamentoId,
      unidade_id: opts.unidadeId,
      formulario_id: opts.formId,
      agente_id: opts.agenteId,
      criado_por: opts.criadoPor,
      status: "agendado",
      agendado_em: opts.agendadoEm,
      duracao_min: opts.duracaoMin,
      endereco_vistoria: opts.enderecoVistoria,
      observacoes_agendamento: opts.observacoes,
    })
    .select("id, codigo")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Erro ao criar caso.");
  return data;
}

export const agendarMapeamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AgendarInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminOrSuper(context.supabase, context.userId);
    await checarConflito({
      agenteId: data.agenteId,
      inicio: data.agendadoEm,
      duracaoMin: data.duracaoMin,
    });

    const unidadeId = await resolveUnidadeId({
      unidadeId: data.unidadeId,
      matrizId: data.matrizId,
      userId: context.userId,
    });

    const enderecoVistoria = data.enderecoVistoria?.trim() || (await getEnderecoVistoria(unidadeId));

    let matrizId = data.matrizId ?? null;
    if (!matrizId) {
      const { data: u } = await supabaseAdmin
        .from("unidades")
        .select("matriz_id")
        .eq("id", unidadeId)
        .maybeSingle();
      matrizId = u?.matriz_id ?? null;
    }

    const { data: ag, error: agErr } = await supabaseAdmin
      .from("agendamentos")
      .insert({
        unidade_id: unidadeId,
        matriz_id: matrizId,
        agente_id: data.agenteId,
        criado_por: context.userId,
        agendado_em: data.agendadoEm,
        duracao_min: data.duracaoMin,
        endereco_vistoria: enderecoVistoria,
        observacoes_agendamento: data.observacoes ?? null,
      })
      .select("id")
      .single();
    if (agErr || !ag) throw new Error(agErr?.message ?? "Erro ao criar agendamento.");

    const casos = [];
    for (const formId of data.formIds) {
      const c = await criarCaso({
        agendamentoId: ag.id,
        unidadeId,
        formId,
        agenteId: data.agenteId,
        criadoPor: context.userId,
        agendadoEm: data.agendadoEm,
        duracaoMin: data.duracaoMin,
        enderecoVistoria,
        observacoes: data.observacoes ?? null,
      });
      casos.push(c);
    }

    return { agendamentoId: ag.id, casos };
  });

export const adicionarFormularioAoAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      agendamentoId: z.string().uuid(),
      formId: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrSuper(context.supabase, context.userId);
    const { data: ag, error } = await supabaseAdmin
      .from("agendamentos")
      .select("id, unidade_id, agente_id, criado_por, agendado_em, duracao_min, endereco_vistoria, observacoes_agendamento")
      .eq("id", data.agendamentoId)
      .maybeSingle();
    if (error || !ag) throw new Error("Agendamento não encontrado.");

    const { data: existente } = await supabaseAdmin
      .from("casos")
      .select("id")
      .eq("agendamento_id", ag.id)
      .eq("formulario_id", data.formId)
      .maybeSingle();
    if (existente) throw new Error("Este formulário já está neste agendamento.");

    const caso = await criarCaso({
      agendamentoId: ag.id,
      unidadeId: ag.unidade_id,
      formId: data.formId,
      agenteId: ag.agente_id,
      criadoPor: ag.criado_por,
      agendadoEm: ag.agendado_em,
      duracaoMin: ag.duracao_min,
      enderecoVistoria: ag.endereco_vistoria,
      observacoes: ag.observacoes_agendamento,
    });
    return caso;
  });

export const removerCasoDoAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ casoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminOrSuper(context.supabase, context.userId);
    const { data: caso } = await supabaseAdmin
      .from("casos")
      .select("status")
      .eq("id", data.casoId)
      .maybeSingle();
    if (!caso) throw new Error("Caso não encontrado.");
    if (!["agendado", "rascunho"].includes(caso.status)) {
      throw new Error("Só é possível remover formulários que ainda não foram iniciados.");
    }
    const { error } = await supabaseAdmin.from("casos").delete().eq("id", data.casoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const obterAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ agendamentoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: ag, error } = await supabase
      .from("agendamentos")
      .select(
        "id, agendado_em, duracao_min, endereco_vistoria, observacoes_agendamento, agente_id, criado_por, unidade:unidades(id, nome, matriz:matrizes(id, nome, empresa:empresas(id, nome))), casos(id, codigo, status, formulario:formularios(id, nome))",
      )
      .eq("id", data.agendamentoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ag) throw new Error("Agendamento não encontrado.");
    return ag;
  });

// Compat antigo (1 formulário). Usado por código legado.
export const agendarVistoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        unidadeId: z.string().uuid().optional().nullable(),
        matrizId: z.string().uuid().optional().nullable(),
        formId: z.string().uuid(),
        agenteId: z.string().uuid(),
        agendadoEm: z.string().min(1),
        duracaoMin: z.number().int().min(15).max(8 * 60).default(60),
        enderecoVistoria: z.string().max(500).optional().nullable(),
        observacoes: z.string().max(2000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrSuper(context.supabase, context.userId);
    await checarConflito({ agenteId: data.agenteId, inicio: data.agendadoEm, duracaoMin: data.duracaoMin });
    const unidadeId = await resolveUnidadeId({ unidadeId: data.unidadeId, matrizId: data.matrizId, userId: context.userId });
    const enderecoVistoria = data.enderecoVistoria?.trim() || (await getEnderecoVistoria(unidadeId));
    let matrizId = data.matrizId ?? null;
    if (!matrizId) {
      const { data: u } = await supabaseAdmin.from("unidades").select("matriz_id").eq("id", unidadeId).maybeSingle();
      matrizId = u?.matriz_id ?? null;
    }
    const { data: ag, error: agErr } = await supabaseAdmin
      .from("agendamentos")
      .insert({
        unidade_id: unidadeId,
        matriz_id: matrizId,
        agente_id: data.agenteId,
        criado_por: context.userId,
        agendado_em: data.agendadoEm,
        duracao_min: data.duracaoMin,
        endereco_vistoria: enderecoVistoria,
        observacoes_agendamento: data.observacoes ?? null,
      })
      .select("id")
      .single();
    if (agErr || !ag) throw new Error(agErr?.message ?? "Erro ao criar agendamento.");
    const caso = await criarCaso({
      agendamentoId: ag.id,
      unidadeId,
      formId: data.formId,
      agenteId: data.agenteId,
      criadoPor: context.userId,
      agendadoEm: data.agendadoEm,
      duracaoMin: data.duracaoMin,
      enderecoVistoria,
      observacoes: data.observacoes ?? null,
    });
    return { casoId: caso.id, codigo: caso.codigo, agendamentoId: ag.id };
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
