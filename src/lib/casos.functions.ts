import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registrarEvento, casosDoAgendamento } from "@/lib/eventos.server";

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
    agenteId: z.string().uuid().optional().nullable(),
    agenteNomeManual: z.string().max(200).optional().nullable(),
    tipoSolicitacao: z.enum(["instalacao", "upgrade"]),
    modalidade: z.enum(["presencial", "remoto"]),
    nivel: z.enum(["nivel_1", "nivel_2", "nivel_3"]),
    agendadoEm: z.string().min(1),
    duracaoMin: z.number().int().min(15).max(8 * 60).default(60),
    enderecoVistoria: z.string().max(500).optional().nullable(),
    observacoes: z.string().max(2000).optional().nullable(),
  })
  .refine((v) => !!v.unidadeId || !!v.matrizId, {
    message: "Informe unidade ou matriz.",
  })
  .refine((v) => v.modalidade === "remoto" || !!v.agenteId, {
    message: "Selecione o agente técnico para atendimento presencial.",
    path: ["agenteId"],
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
  agenteId: string | null;
  agenteNomeManual?: string | null;
  tipoSolicitacao?: "instalacao" | "upgrade";
  modalidade?: "presencial" | "remoto";
  nivel?: "nivel_1" | "nivel_2" | "nivel_3";
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
      agente_nome_manual: opts.agenteNomeManual ?? null,
      tipo_solicitacao: opts.tipoSolicitacao ?? "instalacao",
      modalidade: opts.modalidade ?? "presencial",
      nivel: opts.nivel ?? "nivel_1",
      criado_por: opts.criadoPor,
      status: "agendado",
      agendado_em: opts.agendadoEm,
      duracao_min: opts.duracaoMin,
      endereco_vistoria: opts.enderecoVistoria,
      observacoes_agendamento: opts.observacoes,
    } as any)
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
    const agenteId = data.agenteId ?? null;
    const agenteNomeManual = data.agenteNomeManual?.trim() || null;
    if (agenteId) {
      await checarConflito({
        agenteId,
        inicio: data.agendadoEm,
        duracaoMin: data.duracaoMin,
      });
    }

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
        agente_id: agenteId,
        agente_nome_manual: agenteNomeManual,
        tipo_solicitacao: data.tipoSolicitacao,
        modalidade: data.modalidade,
        nivel: data.nivel,
        criado_por: context.userId,
        agendado_em: data.agendadoEm,
        duracao_min: data.duracaoMin,
        endereco_vistoria: enderecoVistoria,
        observacoes_agendamento: data.observacoes ?? null,
      } as any)
      .select("id")
      .single();
    if (agErr || !ag) throw new Error(agErr?.message ?? "Erro ao criar agendamento.");

    const casos = [];
    for (const formId of data.formIds) {
      const c = await criarCaso({
        agendamentoId: ag.id,
        unidadeId,
        formId,
        agenteId,
        agenteNomeManual,
        tipoSolicitacao: data.tipoSolicitacao,
        modalidade: data.modalidade,
        nivel: data.nivel,
        criadoPor: context.userId,
        agendadoEm: data.agendadoEm,
        duracaoMin: data.duracaoMin,
        enderecoVistoria,
        observacoes: data.observacoes ?? null,
      });
      casos.push(c);
    }

    // Notifica o agente que tem um novo agendamento aguardando aceite
    if (agenteId) {
      try {
        const cliente = await supabaseAdmin
          .from("unidades")
          .select("nome, matriz:matrizes(empresa:empresas(nome))")
          .eq("id", unidadeId)
          .maybeSingle();
        const empNome = (cliente.data as any)?.matriz?.empresa?.nome ?? "cliente";
        const dataFmt = new Date(data.agendadoEm).toLocaleString("pt-BR");
        await supabaseAdmin.from("notificacoes").insert({
          usuario_id: agenteId,
          titulo: "Novo agendamento — confirmar?",
          mensagem: `Você tem um novo agendamento em ${dataFmt} — ${empNome}.`,
          tipo: "agendamento_novo",
          lido: false,
        } as any);
      } catch {
        // não bloqueia se notificação falhar
      }
    }

    const agentePerfil = agenteId
      ? (await supabaseAdmin.from("profiles").select("nome").eq("id", agenteId).maybeSingle()).data
      : null;
    const casoIds = casos.map((c) => c.id);
    await registrarEvento({
      casoIds, agendamentoId: ag.id, tipo: "mapeamento_criado",
      atorId: context.userId,
      metadata: { formulario_ids: data.formIds },
    });
    await registrarEvento({
      casoIds, agendamentoId: ag.id, tipo: "agendamento_criado",
      atorId: context.userId,
      metadata: {
        agendado_em: data.agendadoEm,
        duracao_min: data.duracaoMin,
        agente_id: agenteId,
        agente_nome: (agentePerfil as any)?.nome ?? agenteNomeManual,
        tipo_solicitacao: data.tipoSolicitacao,
        modalidade: data.modalidade,
        nivel: data.nivel,
      },
    });

    return { agendamentoId: ag.id, casos };
  });

export const atribuirAgenteAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        agendamentoId: z.string().uuid(),
        agenteId: z.string().uuid().optional().nullable(),
        agenteNomeManual: z.string().max(200).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrSuper(context.supabase, context.userId);
    const agenteId = data.agenteId ?? null;
    const agenteNomeManual = data.agenteNomeManual?.trim() || null;
    if (!agenteId && !agenteNomeManual) throw new Error("Informe um agente ou um nome.");

    const { data: ag, error } = await supabaseAdmin
      .from("agendamentos")
      .select("id, agendado_em, duracao_min, unidade_id")
      .eq("id", data.agendamentoId)
      .maybeSingle();
    if (error || !ag) throw new Error("Agendamento não encontrado.");

    if (agenteId) {
      await checarConflito({
        agenteId,
        inicio: ag.agendado_em,
        duracaoMin: ag.duracao_min ?? 60,
      });
    }

    const patch: Record<string, unknown> = {
      agente_id: agenteId,
      agente_nome_manual: agenteNomeManual,
    };
    if (agenteId) {
      patch["aceite_status"] = "pendente";
      patch["aceite_agente"] = null;
      patch["data_aceite"] = null;
      patch["motivo_recusa"] = null;
    }
    const { error: upErr } = await supabaseAdmin
      .from("agendamentos")
      .update(patch as any)
      .eq("id", ag.id);
    if (upErr) throw new Error(upErr.message);

    const { error: casosErr } = await supabaseAdmin
      .from("casos")
      .update({ agente_id: agenteId, agente_nome_manual: agenteNomeManual } as any)
      .eq("agendamento_id", ag.id);
    if (casosErr) throw new Error(casosErr.message);

    if (agenteId) {
      try {
        const dataFmt = new Date(ag.agendado_em).toLocaleString("pt-BR");
        await supabaseAdmin.from("notificacoes").insert({
          usuario_id: agenteId,
          titulo: "Novo agendamento — confirmar?",
          mensagem: `Você foi atribuído a um agendamento em ${dataFmt}.`,
          tipo: "agendamento_novo",
          lido: false,
        } as any);
      } catch {
        // ignora
      }
    }

    const casoIds = await casosDoAgendamento(ag.id);
    await registrarEvento({
      casoIds,
      agendamentoId: ag.id,
      tipo: "agente_atribuido",
      atorId: context.userId,
      metadata: { agente_id: agenteId, agente_nome: agenteNomeManual },
    });

    return { ok: true };
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
      .select("id, unidade_id, agente_id, agente_nome_manual, tipo_solicitacao, modalidade, nivel, criado_por, agendado_em, duracao_min, endereco_vistoria, observacoes_agendamento")
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
      agenteNomeManual: (ag as any).agente_nome_manual ?? null,
      tipoSolicitacao: (ag as any).tipo_solicitacao ?? "instalacao",
      modalidade: (ag as any).modalidade ?? "presencial",
      nivel: (ag as any).nivel ?? "nivel_1",
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
      .select("agente_id, status, agendado_em, agendamento_id")
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

    await registrarEvento({
      casoId: data.casoId,
      agendamentoId: (caso as any).agendamento_id ?? null,
      tipo: "reagendado",
      atorId: context.userId,
      metadata: {
        agendado_em_anterior: (caso as any).agendado_em ?? null,
        agendado_em_novo: data.agendadoEm,
        duracao_min: data.duracaoMin,
      },
    });
    return { ok: true };
  });

export const cancelarVistoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ casoId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrSuper(context.supabase, context.userId);
    const { data: caso } = await supabaseAdmin
      .from("casos").select("agendamento_id").eq("id", data.casoId).maybeSingle();
    const { error } = await supabaseAdmin
      .from("casos")
      .update({ status: "cancelado" })
      .eq("id", data.casoId);
    if (error) throw new Error(error.message);
    await registrarEvento({
      casoId: data.casoId,
      agendamentoId: (caso as any)?.agendamento_id ?? null,
      tipo: "agendamento_cancelado",
      atorId: context.userId,
    });
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
        "id, codigo, status, agendado_em, duracao_min, endereco_vistoria, observacoes_agendamento, agendamento_id, unidade:unidades(nome, matriz:matrizes(nome, empresa:empresas(nome))), formulario:formularios(nome)",
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
    // Bloqueia se outro caso do mesmo agendamento já estiver em andamento
    const { data: alvo } = await supabaseAdmin
      .from("casos")
      .select("agendamento_id, status, agendamento:agendamentos!agendamento_id(aceite_status)")
      .eq("id", data.casoId)
      .maybeSingle();
    if (!alvo) throw new Error("Caso não encontrado.");
    if ((alvo as any).agendamento?.aceite_status === "recusado_pelo_agente") {
      throw new Error("Este mapeamento foi recusado e precisa ser reagendado antes de avançar.");
    }

    if (alvo.status !== "em_andamento") {
      const { data: emAndamento } = await supabaseAdmin
        .from("casos")
        .select("id")
        .eq("agendamento_id", alvo.agendamento_id)
        .eq("status", "em_andamento")
        .neq("id", data.casoId)
        .maybeSingle();
      if (emAndamento) {
        throw new Error("Termine o formulário em andamento deste agendamento antes de abrir outro.");
      }
    }
    const wasNotStarted = alvo.status !== "em_andamento";
    const { error } = await context.supabase
      .from("casos")
      .update({ status: "em_andamento" })
      .eq("id", data.casoId)
      .eq("agente_id", context.userId)
      .in("status", ["agendado", "rascunho", "em_andamento"]);
    if (error) throw new Error(error.message);
    if (wasNotStarted) {
      await registrarEvento({
        casoId: data.casoId,
        agendamentoId: alvo.agendamento_id ?? null,
        tipo: "vistoria_iniciada",
        atorId: context.userId,
      });
    }
    return { ok: true };
  });

export const finalizarVistoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ casoId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertVistoriador(context.supabase, context.userId);
    const { data: alvo } = await supabaseAdmin
      .from("casos")
      .select("agendamento_id, agendamento:agendamentos!agendamento_id(aceite_status)")
      .eq("id", data.casoId)
      .maybeSingle();
    if ((alvo as any)?.agendamento?.aceite_status === "recusado_pelo_agente") {
      throw new Error("Este mapeamento foi recusado e precisa ser reagendado antes de ser entregue.");
    }
    const { error } = await supabaseAdmin
      .from("casos")
      .update({ status: "aguardando_revisao" })
      .eq("id", data.casoId)
      .eq("agente_id", context.userId);
    if (error) throw new Error(error.message);
    await registrarEvento({
      casoId: data.casoId,
      agendamentoId: (alvo as any)?.agendamento_id ?? null,
      tipo: "vistoria_finalizada",
      atorId: context.userId,
    });
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
        "id, codigo, status, agendado_em, duracao_min, endereco_vistoria, observacoes_agendamento, agente_id, data_execucao, data_entrega_agente, data_aprovacao_pablo, unidade:unidades(nome, matriz:matrizes(nome, empresa:empresas(nome))), agente:profiles!agente_id(nome), formulario:formularios(nome), agendamento:agendamentos!agendamento_id(aceite_status, data_aceite, motivo_recusa)",
      )
      .not("agendado_em", "is", null)
      .gte("agendado_em", data.inicio)
      .lte("agendado_em", data.fim)
      .neq("status", "cancelado")
      .order("agendado_em", { ascending: true });
    if (data.agenteId) q = q.eq("agente_id", data.agenteId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).filter((r: any) => r.agendamento?.aceite_status === "confirmado");
  });
