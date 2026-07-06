import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registrarEvento, casosDoAgendamento } from "@/lib/eventos.server";

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

    const casos = await casosDoAgendamento(data.agendamentoId);
    await registrarEvento({
      casoIds: casos,
      agendamentoId: data.agendamentoId,
      tipo: "aceite_confirmado",
      atorId: context.userId,
      metadata: { agendado_em: (ag as any).agendado_em },
    });

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
      .select("id, agente_id, criado_por, agendado_em, unidade:unidades(matriz:matrizes(empresa:empresas(nome))), agente:profiles!agente_id(nome)")
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
    const agenteNome = (ag as any).agente?.nome ?? "agente";
    const dataFmt = new Date((ag as any).agendado_em).toLocaleString("pt-BR");

    // Busca os casos deste agendamento para citar códigos e registrar observação
    const { data: casos } = await supabaseAdmin
      .from("casos")
      .select("id, codigo")
      .eq("agendamento_id", data.agendamentoId);
    const casosList = (casos ?? []) as { id: string; codigo: string }[];
    const codigos = casosList.map((c) => c.codigo).join(", ") || "—";

    // Registra observação automática em cada caso
    if (casosList.length > 0) {
      await supabaseAdmin.from("mapeamento_observacoes").insert(
        casosList.map((c) => ({
          caso_id: c.id,
          usuario_id: context.userId,
          texto: `Agendamento recusado pelo agente ${agenteNome} em ${new Date().toLocaleString("pt-BR")}. Data original: ${dataFmt}. Motivo: ${data.motivo}`,
        })) as any,
      );
    }

    const primeiroCasoId = casosList[0]?.id ?? null;
    const tituloAdmin = "Reagendamento necessário";
    const mensagemAdmin = `O agente ${agenteNome} recusou o mapeamento ${codigos} — ${cliente}. É necessário reagendar. Motivo: ${data.motivo}`;

    // Notifica criador e admins/gestores
    if ((ag as any).criado_por) {
      await notificar((ag as any).criado_por, tituloAdmin, mensagemAdmin, "agendamento_recusado", primeiroCasoId);
    }
    await notificarAdmins(tituloAdmin, mensagemAdmin, "agendamento_recusado", primeiroCasoId);

    await registrarEvento({
      casoIds: casosList.map((c) => c.id),
      agendamentoId: data.agendamentoId,
      tipo: "aceite_recusado",
      atorId: context.userId,
      metadata: { motivo: data.motivo, agendado_em: (ag as any).agendado_em },
    });

    return { ok: true };
  });

// ============================================================
// Reagendar após recusa
// ============================================================
const ReagendarInput = z.object({
  casoId: z.string().uuid(),
  agenteId: z.string().uuid(),
  agendadoEm: z.string().min(1),
  duracaoMin: z.number().int().min(15).max(8 * 60).default(60),
});

export const reagendarAposRecusa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReagendarInput.parse(d))
  .handler(async ({ data, context }) => {
    // valida role admin
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["admin", "super_admin"]);
    if (!roles?.length) throw new Error("Apenas admins podem reagendar.");

    const { data: caso, error: cErr } = await supabaseAdmin
      .from("casos")
      .select("id, agendamento_id, unidade:unidades(matriz:matrizes(empresa:empresas(nome)))")
      .eq("id", data.casoId)
      .maybeSingle();
    if (cErr || !caso) throw new Error("Mapeamento não encontrado.");
    const agendamentoId = (caso as any).agendamento_id;
    if (!agendamentoId) throw new Error("Mapeamento sem agendamento.");

    // Captura dados anteriores para o histórico
    const { data: agAntes } = await supabaseAdmin
      .from("agendamentos")
      .select("agente_id, agendado_em, agente:profiles!agente_id(nome)")
      .eq("id", agendamentoId)
      .maybeSingle();
    const { data: novoAgentePerfil } = await supabaseAdmin
      .from("profiles").select("nome").eq("id", data.agenteId).maybeSingle();

    // Verifica conflito para o novo agente/data
    const ini = new Date(data.agendadoEm);
    const diaIni = new Date(ini); diaIni.setHours(0, 0, 0, 0);
    const diaFim = new Date(ini); diaFim.setHours(23, 59, 59, 999);
    const { data: conflitos } = await supabaseAdmin
      .from("agendamentos")
      .select("id")
      .eq("agente_id", data.agenteId)
      .neq("id", agendamentoId)
      .gte("agendado_em", diaIni.toISOString())
      .lte("agendado_em", diaFim.toISOString())
      .limit(1);
    if ((conflitos ?? []).length > 0) {
      throw new Error("Este agente já tem outro agendamento no mesmo dia. Escolha outra data ou outro agente.");
    }

    // Atualiza agendamento
    const { error: uErr } = await supabaseAdmin
      .from("agendamentos")
      .update({
        agente_id: data.agenteId,
        agendado_em: data.agendadoEm,
        duracao_min: data.duracaoMin,
        aceite_agente: null,
        aceite_status: "aguardando_aceite",
        data_aceite: null,
        motivo_recusa: null,
      } as any)
      .eq("id", agendamentoId);
    if (uErr) throw new Error(uErr.message);

    // Atualiza todos os casos vinculados
    const { data: casosLista } = await supabaseAdmin
      .from("casos")
      .select("id, codigo")
      .eq("agendamento_id", agendamentoId);
    const casos = (casosLista ?? []) as { id: string; codigo: string }[];

    await supabaseAdmin
      .from("casos")
      .update({
        agente_id: data.agenteId,
        agendado_em: data.agendadoEm,
        duracao_min: data.duracaoMin,
        status: "agendado",
      } as any)
      .eq("agendamento_id", agendamentoId);

    // Observação em cada caso
    if (casos.length > 0) {
      await supabaseAdmin.from("mapeamento_observacoes").insert(
        casos.map((c) => ({
          caso_id: c.id,
          usuario_id: context.userId,
          texto: `Reagendado em ${new Date().toLocaleString("pt-BR")} — novo agente e nova data enviados. Aguardando aceite.`,
        })) as any,
      );
    }

    // Notifica novo agente
    const cliente = (caso as any).unidade?.matriz?.empresa?.nome ?? "cliente";
    const dataFmt = new Date(data.agendadoEm).toLocaleString("pt-BR");
    await notificar(
      data.agenteId,
      "Novo agendamento — confirmar?",
      `Você tem um novo agendamento em ${dataFmt} — ${cliente}.`,
      "agendamento_novo",
      casos[0]?.id ?? null,
    );

    await registrarEvento({
      casoIds: casos.map((c) => c.id),
      agendamentoId,
      tipo: "reagendado",
      atorId: context.userId,
      metadata: {
        agente_anterior_id: (agAntes as any)?.agente_id ?? null,
        agente_anterior_nome: (agAntes as any)?.agente?.nome ?? null,
        agente_novo_id: data.agenteId,
        agente_novo_nome: (novoAgentePerfil as any)?.nome ?? null,
        agendado_em_anterior: (agAntes as any)?.agendado_em ?? null,
        agendado_em_novo: data.agendadoEm,
        duracao_min: data.duracaoMin,
      },
    });

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
