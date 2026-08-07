import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { avaliarCondicional } from "@/lib/perguntas-mapeamento";

export type ProgressoCaso = {
  casoId: string;
  respondidas: number;
  total: number;
  respondidasObrigatorias: number;
  totalObrigatorias: number;
};

/** Progresso (perguntas visíveis respondidas) dos casos atribuídos ao agente logado. */
export const listarProgressoMeusCasos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProgressoCaso[]> => {
    const { supabase, userId } = context;
    const { data: casos, error } = await supabase
      .from("casos")
      .select("id, formulario_id")
      .eq("agente_id", userId);
    if (error) throw new Error(error.message);
    const list = (casos ?? []) as { id: string; formulario_id: string | null }[];
    if (list.length === 0) return [];

    const formIds = Array.from(new Set(list.map((c) => c.formulario_id).filter(Boolean) as string[]));
    const secaoParaForm = new Map<string, string>();
    if (formIds.length > 0) {
      const { data: secoes } = await supabase
        .from("secoes")
        .select("id, formulario_id")
        .in("formulario_id", formIds);
      for (const s of secoes ?? []) secaoParaForm.set((s as any).id, (s as any).formulario_id);
    }

    type Meta = {
      id: string;
      obrigatoria: boolean;
      condicional_pergunta_id: string | null;
      condicional_operador: string | null;
      condicional_valor: string | null;
    };
    const perguntasPorForm = new Map<string, Meta[]>();
    const secaoIds = [...secaoParaForm.keys()];
    if (secaoIds.length > 0) {
      const { data: perguntas } = await supabase
        .from("perguntas")
        .select("id, secao_id, obrigatoria, condicional_pergunta_id, condicional_operador, condicional_valor")
        .in("secao_id", secaoIds);
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
    const respPorCaso = new Map<string, Set<string>>();
    const statePorCaso = new Map<string, Record<string, { text?: string; transcription?: string }>>();
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

    return list.map((c) => {
      const perguntas = c.formulario_id ? perguntasPorForm.get(c.formulario_id) ?? [] : [];
      const state = statePorCaso.get(c.id) ?? {};
      const visiveis = perguntas.filter((p) => avaliarCondicional(p as any, state as any));
      const respSet = respPorCaso.get(c.id) ?? new Set<string>();
      const obrig = visiveis.filter((p) => p.obrigatoria);
      return {
        casoId: c.id,
        respondidas: visiveis.filter((p) => respSet.has(p.id)).length,
        total: visiveis.length,
        respondidasObrigatorias: obrig.filter((p) => respSet.has(p.id)).length,
        totalObrigatorias: obrig.length,
      };
    });
  });

export type ResumoItem = {
  perguntaId: string;
  secao: string;
  pergunta: string;
  tipo: string;
  obrigatoria: boolean;
  resposta: string | null;
  arquivos: number;
};


export type ResumoRespostas = {
  casoId: string;
  clienteNome: string;
  formularioNome: string;
  itens: ResumoItem[];
};

/** Resumo "campo → resposta" das perguntas visíveis do caso (agente, criador ou admin). */
export const getResumoRespostas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ casoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ResumoRespostas> => {
    const { loadAgentContext, perguntasVisiveis, validarUsuarioCaso } = await import(
      "@/lib/vistoria-agent.server"
    );
    await validarUsuarioCaso(data.casoId, context.userId);
    const ctx = await loadAgentContext(data.casoId);
    const visiveis = perguntasVisiveis(ctx);
    const itens: ResumoItem[] = visiveis.map((p) => {
      const r = ctx.state[p.id];
      const arquivos =
        (r?.arquivos_paths?.length ?? 0) || (r?.arquivo_path ? 1 : 0);
      const texto =
        (r?.valor_texto && r.valor_texto.trim()) ||
        (r?.transcricao && r.transcricao.trim()) ||
        (arquivos > 0 ? `${arquivos} arquivo(s) enviado(s)` : null);
      return {
        perguntaId: p.id,
        secao: p.secao_titulo,
        pergunta: p.texto,
        tipo: p.tipo,
        obrigatoria: !!p.obrigatoria,
        resposta: texto || null,
        arquivos,
      };
    });

    return {
      casoId: ctx.casoId,
      clienteNome: ctx.clienteNome,
      formularioNome: ctx.formularioNome,
      itens,
    };
  });
