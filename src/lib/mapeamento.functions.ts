import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { registrarEvento } from "@/lib/eventos.server";
import { avaliarCondicional } from "@/lib/perguntas-mapeamento";


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
      .select("id, texto, criado_em, usuario_id")
      .eq("caso_id", data.casoId)
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((row) => row.usuario_id)));
    const { data: profiles, error: profilesError } = ids.length
      ? await context.supabase.from("profiles").select("id, nome").in("id", ids)
      : { data: [], error: null };
    if (profilesError) throw new Error(profilesError.message);
    const nomes = new Map((profiles ?? []).map((profile) => [profile.id, profile.nome]));
    return ((rows ?? []) as any[]).map((r) => ({
      id: r.id,
      texto: r.texto,
      criado_em: r.criado_em,
      usuario_id: r.usuario_id,
      usuario_nome: nomes.get(r.usuario_id) ?? null,
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
    await registrarEvento({
      casoId: data.casoId,
      tipo: "observacao_adicionada",
      atorId: context.userId,
      metadata: { texto: data.texto.slice(0, 500) },
    });
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
  agente_nome_manual: string | null;
  tipo_solicitacao: string | null;
  modalidade: string | null;
  nivel: string | null;
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
        "id, codigo, status, criado_em, agendado_em, data_execucao, data_entrega_agente, data_aprovacao_pablo, formulario_id, agente_id, agendamento:agendamentos!agendamento_id(aceite_status, data_aceite, motivo_recusa, agente_nome_manual, tipo_solicitacao, modalidade, nivel), unidade:unidades(nome, codigo_ionics, matriz:matrizes(nome, empresa:empresas(nome, codigo_ionics))), agente:profiles!agente_id(nome)" as any,
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

    // Todas as perguntas de todos os formulários envolvidos, com dados de condicional
    const allSecaoIds = Array.from(secoesPorForm.values()).flat();
    type PerguntaMeta = {
      id: string;
      obrigatoria: boolean;
      condicional_pergunta_id: string | null;
      condicional_operador: string | null;
      condicional_valor: string | null;
    };
    const perguntasPorForm = new Map<string, PerguntaMeta[]>();
    if (allSecaoIds.length > 0) {
      const { data: perguntas } = await supabase
        .from("perguntas")
        .select(
          "id, secao_id, obrigatoria, condicional_pergunta_id, condicional_operador, condicional_valor",
        )
        .in("secao_id", allSecaoIds);
      const secaoParaForm = new Map<string, string>();
      for (const [form, secs] of secoesPorForm.entries()) {
        for (const s of secs) secaoParaForm.set(s, form);
      }
      for (const p of perguntas ?? []) {
        const form = secaoParaForm.get((p as any).secao_id);
        if (!form) continue;
        const arr = perguntasPorForm.get(form) ?? [];
        arr.push({
          id: (p as any).id,
          obrigatoria: !!(p as any).obrigatoria,
          condicional_pergunta_id: (p as any).condicional_pergunta_id ?? null,
          condicional_operador: (p as any).condicional_operador ?? null,
          condicional_valor: (p as any).condicional_valor ?? null,
        });
        perguntasPorForm.set(form, arr);
      }
    }

    const casoIds = list.map((c) => c.id);
    // Estado por caso: { perguntaId -> { text, transcription } } para avaliar condicional
    const respPorCaso = new Map<string, Set<string>>();
    const statePorCaso = new Map<string, Record<string, { text?: string; transcription?: string }>>();
    if (casoIds.length > 0) {
      const { data: respostas } = await supabase
        .from("respostas_agente")
        .select("caso_id, pergunta_id, valor_texto, arquivo_path, transcricao, arquivos_paths")
        .in("caso_id", casoIds);
      for (const r of respostas ?? []) {
        const row = r as any;
        const temValor =
          (row.valor_texto && String(row.valor_texto).trim() !== "") ||
          !!row.arquivo_path ||
          (row.transcricao && String(row.transcricao).trim() !== "") ||
          (Array.isArray(row.arquivos_paths) && row.arquivos_paths.length > 0);
        if (!temValor) continue;
        const set = respPorCaso.get(row.caso_id) ?? new Set<string>();
        set.add(row.pergunta_id);
        respPorCaso.set(row.caso_id, set);
        const st = statePorCaso.get(row.caso_id) ?? {};
        st[row.pergunta_id] = {
          text: row.valor_texto ?? undefined,
          transcription: row.transcricao ?? undefined,
        };
        statePorCaso.set(row.caso_id, st);
      }
    }

    const agora = Date.now();
    return list.map((c) => {
      const perguntas = c.formulario_id ? perguntasPorForm.get(c.formulario_id) ?? [] : [];
      const state = statePorCaso.get(c.id) ?? {};
      const visiveis = perguntas.filter((p) => avaliarCondicional(p, state as any));
      const obrig = visiveis.filter((p) => p.obrigatoria);
      const respSet = respPorCaso.get(c.id) ?? new Set<string>();
      const respondidas = obrig.filter((p) => respSet.has(p.id)).length;
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
        agente_nome_manual: c.agendamento?.agente_nome_manual ?? null,
        tipo_solicitacao: c.agendamento?.tipo_solicitacao ?? null,
        modalidade: c.agendamento?.modalidade ?? null,
        nivel: c.agendamento?.nivel ?? null,
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
    await registrarEvento({
      casoId: caso.id, tipo: "revisao_aprovada", atorId: context.userId,
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
    await registrarEvento({
      casoId: caso.id, tipo: "revisao_reprovada", atorId: context.userId,
      metadata: { motivo: data.motivo },
    });
    return { ok: true };
  });
