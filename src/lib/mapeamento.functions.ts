import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ObservacaoRow = {
  id: string;
  texto: string;
  criado_em: string;
  usuario_id: string;
  usuario_nome: string | null;
};

export const listarObservacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ casoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ObservacaoRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("mapeamento_observacoes")
      .select("id, texto, criado_em, usuario_id, usuario:profiles!usuario_id(nome)")
      .eq("caso_id", data.casoId)
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return ((rows ?? []) as any[]).map((r) => ({
      id: r.id,
      texto: r.texto,
      criado_em: r.criado_em,
      usuario_id: r.usuario_id,
      usuario_nome: r.usuario?.nome ?? null,
    }));
  });

export const adicionarObservacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ casoId: z.string().uuid(), texto: z.string().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("mapeamento_observacoes").insert({
      caso_id: data.casoId,
      texto: data.texto,
      usuario_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type MapeamentoComProgresso = {
  id: string;
  codigo: string;
  status: string;
  criado_em: string;
  agendado_em: string | null;
  data_execucao: string | null;
  data_entrega_agente: string | null;
  data_aprovacao_pablo: string | null;
  empresa_nome: string | null;
  unidade_nome: string | null;
  cliente_codigo_ionics: string | null;
  unidade_codigo_ionics: string | null;
  agente_id: string | null;
  agente_nome: string | null;
  aceite_status: "aguardando_aceite" | "confirmado" | "recusado_pelo_agente" | null;
  data_aceite: string | null;
  motivo_recusa_agente: string | null;
  respondidas_obrigatorias: number;
  total_obrigatorias: number;
  atrasado: boolean;
};

export const listarMapeamentosComProgresso = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MapeamentoComProgresso[]> => {
    const { supabase } = context;
    const { data: casos, error } = await supabase
      .from("casos")
      .select(
        "id, codigo, status, criado_em, agendado_em, data_execucao, data_entrega_agente, data_aprovacao_pablo, formulario_id, agente_id, agendamento:agendamentos!agendamento_id(aceite_status, data_aceite, motivo_recusa), unidade:unidades(nome, codigo_ionics, matriz:matrizes(nome, empresa:empresas(nome, codigo_ionics))), agente:profiles!agente_id(nome)" as any,
      )
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    const list = (casos ?? []) as any[];
    if (list.length === 0) return [];


    const formIds = Array.from(new Set(list.map((c) => c.formulario_id).filter(Boolean)));
    const secoesPorForm = new Map<string, string[]>();
    if (formIds.length > 0) {
      const { data: secoes } = await supabase
        .from("secoes")
        .select("id, formulario_id")
        .in("formulario_id", formIds);
      for (const s of secoes ?? []) {
        const arr = secoesPorForm.get((s as any).formulario_id) ?? [];
        arr.push((s as any).id);
        secoesPorForm.set((s as any).formulario_id, arr);
      }
    }

    const allSecaoIds = Array.from(secoesPorForm.values()).flat();
    const perguntasObrigPorForm = new Map<string, string[]>();
    if (allSecaoIds.length > 0) {
      const { data: perguntas } = await supabase
        .from("perguntas")
        .select("id, secao_id, obrigatoria")
        .in("secao_id", allSecaoIds)
        .eq("obrigatoria", true);
      const secaoParaForm = new Map<string, string>();
      for (const [form, secs] of secoesPorForm.entries()) {
        for (const s of secs) secaoParaForm.set(s, form);
      }
      for (const p of perguntas ?? []) {
        const form = secaoParaForm.get((p as any).secao_id);
        if (!form) continue;
        const arr = perguntasObrigPorForm.get(form) ?? [];
        arr.push((p as any).id);
        perguntasObrigPorForm.set(form, arr);
      }
    }

    const casoIds = list.map((c) => c.id);
    const respPorCaso = new Map<string, Set<string>>();
    if (casoIds.length > 0) {
      const { data: respostas } = await supabase
        .from("respostas_agente")
        .select("caso_id, pergunta_id, valor_texto, arquivo_path, transcricao")
        .in("caso_id", casoIds);
      for (const r of respostas ?? []) {
        const row = r as any;
        if (!row.valor_texto && !row.arquivo_path && !row.transcricao) continue;
        const set = respPorCaso.get(row.caso_id) ?? new Set<string>();
        set.add(row.pergunta_id);
        respPorCaso.set(row.caso_id, set);
      }
    }

    const agora = Date.now();
    return list.map((c) => {
      const obrig = c.formulario_id ? perguntasObrigPorForm.get(c.formulario_id) ?? [] : [];
      const respSet = respPorCaso.get(c.id) ?? new Set<string>();
      const respondidas = obrig.filter((id) => respSet.has(id)).length;
      const atrasado =
        !!c.data_execucao &&
        !c.data_entrega_agente &&
        agora - new Date(c.data_execucao).getTime() > 48 * 3600 * 1000;
      return {
        id: c.id,
        codigo: c.codigo,
        status: c.status,
        criado_em: c.criado_em,
        agendado_em: c.agendado_em,
        data_execucao: c.data_execucao,
        data_entrega_agente: c.data_entrega_agente,
        data_aprovacao_pablo: c.data_aprovacao_pablo,
        empresa_nome: c.unidade?.matriz?.empresa?.nome ?? null,
        unidade_nome: c.unidade?.nome ?? null,
        cliente_codigo_ionics: c.unidade?.matriz?.empresa?.codigo_ionics ?? null,
        unidade_codigo_ionics: c.unidade?.codigo_ionics ?? null,
        agente_id: c.agente_id ?? null,
        agente_nome: c.agente?.nome ?? null,
        aceite_status: c.agendamento?.aceite_status ?? null,
        data_aceite: c.agendamento?.data_aceite ?? null,
        motivo_recusa_agente: c.agendamento?.motivo_recusa ?? null,
        respondidas_obrigatorias: respondidas,
        total_obrigatorias: obrig.length,
        atrasado,
      };
    });
  });

async function notificarUsuarios(
  ctx: { supabase: any },
  usuarios: string[],
  payload: { caso_id: string; tipo: string; titulo: string; mensagem: string },
) {
  const rows = usuarios
    .filter((u, i, a) => !!u && a.indexOf(u) === i)
    .map((u) => ({ ...payload, usuario_id: u }));
  if (rows.length === 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("notificacoes").insert(rows);
}

export const aprovarMapeamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ casoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: caso, error: e1 } = await supabaseAdmin
      .from("casos")
      .select("id, codigo, criado_por, agente_id")
      .eq("id", data.casoId)
      .maybeSingle();
    if (e1 || !caso) throw new Error(e1?.message ?? "Mapeamento não encontrado");

    const { error } = await supabaseAdmin
      .from("casos")
      .update({ status: "aprovado", motivo_recusa: null })
      .eq("id", data.casoId);
    if (error) throw new Error(error.message);

    await notificarUsuarios(context, [caso.criado_por, caso.agente_id].filter(Boolean) as string[], {
      caso_id: caso.id,
      tipo: "aprovado",
      titulo: "Mapeamento aprovado",
      mensagem: `Mapeamento ${caso.codigo} foi aprovado e está liberado.`,
    });
    return { ok: true };
  });

export const solicitarCorrecao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ casoId: z.string().uuid(), motivo: z.string().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: caso, error: e1 } = await supabaseAdmin
      .from("casos")
      .select("id, codigo, criado_por, agente_id")
      .eq("id", data.casoId)
      .maybeSingle();
    if (e1 || !caso) throw new Error(e1?.message ?? "Mapeamento não encontrado");

    const { error } = await supabaseAdmin
      .from("casos")
      .update({ status: "em_analise", motivo_recusa: data.motivo })
      .eq("id", data.casoId);
    if (error) throw new Error(error.message);

    await notificarUsuarios(context, [caso.criado_por].filter(Boolean) as string[], {
      caso_id: caso.id,
      tipo: "correcao_solicitada",
      titulo: "Mapeamento bloqueado",
      mensagem: `Mapeamento ${caso.codigo} com entrega bloqueada — aguardando correção.`,
    });
    await notificarUsuarios(context, [caso.agente_id].filter(Boolean) as string[], {
      caso_id: caso.id,
      tipo: "recusado",
      titulo: "Correção solicitada",
      mensagem: `Mapeamento ${caso.codigo} precisa de correção: ${data.motivo}`,
    });
    return { ok: true };
  });
