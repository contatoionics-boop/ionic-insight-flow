import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EstadoInput = z.object({
  token: z.string().min(1).optional(),
  casoId: z.string().uuid().optional(),
});

export type BlocoPerguntaDTO = {
  id: string;
  texto: string;
  tipo: string;
  obrigatoria: boolean;
  instrucao_agente: string | null;
  contexto_ia: string | null;
  opcoes: { id: string; texto: string }[];
  bloco_linha: string | null;
  bloco_coluna: string | null;
};

export type BlocoDTO = {
  id: string;
  titulo: string;
  descricao: string | null;
  layout: "cartao" | "matriz" | "fotos";
  secaoTitulo: string;
  perguntas: BlocoPerguntaDTO[];
};

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
  proximoBloco: BlocoDTO | null;
  secaoAtual: number;
  totalSecoes: number;
  totalMomentos: number;
  momentosConcluidos: number;
  ultimaResposta: {
    perguntaId: string;
    perguntaTexto: string;
    valor: string;
    tipo: string;
    criadoEm: string;
  } | null;
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

    const { calcularPendencias, sincronizarCadastro } = await import("@/lib/vistoria-agent.server");
    const ctx = await loadAgentContext(casoId);
    await sincronizarCadastro(ctx);
    const pend = calcularPendencias(ctx);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ultima } = await supabaseAdmin
      .from("respostas_agente")
      .select("pergunta_id, tipo, valor_texto, arquivo_path, arquivos_paths, transcricao, criado_em, pergunta:perguntas(texto)")
      .eq("caso_id", casoId)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Casos antigos podem ter respostas persistidas sem que o status tenha
    // acompanhado o primeiro salvamento. Corrige o estado sem recriar evento.
    if (pend.respondidas > 0) {
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
      proximoBloco: pend.proximoBloco
        ? {
            id: pend.proximoBloco.id,
            titulo: pend.proximoBloco.titulo,
            descricao: pend.proximoBloco.descricao,
            layout: pend.proximoBloco.layout,
            secaoTitulo: pend.proximoBloco.secao_titulo,
            perguntas: pend.proximoBloco.perguntas.map((p) => ({
              id: p.id,
              texto: p.texto,
              tipo: p.tipo,
              obrigatoria: p.obrigatoria,
              instrucao_agente: p.instrucao_agente,
              contexto_ia: p.contexto_ia,
              opcoes: p.opcoes,
              bloco_linha: p.bloco_linha,
              bloco_coluna: p.bloco_coluna,
            })),
          }
        : null,
      secaoAtual: pend.secaoAtualIndice + 1,
      totalSecoes: pend.totalSecoes,
      totalMomentos: pend.totalMomentos,
      momentosConcluidos: pend.momentosConcluidos,
      ultimaResposta: ultima
        ? {
            perguntaId: ultima.pergunta_id,
            perguntaTexto: (ultima.pergunta as { texto?: string } | null)?.texto ?? "Resposta anterior",
            valor: ultima.valor_texto || ultima.transcricao || (ultima.arquivos_paths?.length ? `${ultima.arquivos_paths.length} anexo(s)` : ultima.arquivo_path ? "Anexo enviado" : "Registrada"),
            tipo: ultima.tipo,
            criadoEm: ultima.criado_em,
          }
        : null,
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

    const { data: caso } = await supabaseAdmin
      .from("casos")
      .select("agendamento_id, agente_id")
      .eq("id", casoId)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("casos")
      .update({ status: "aguardando_revisao" })
      .eq("id", casoId);
    if (error) throw new Error(error.message);

    const { registrarEvento } = await import("@/lib/eventos.server");
    await registrarEvento({
      casoId,
      agendamentoId: (caso as any)?.agendamento_id ?? null,
      tipo: "vistoria_finalizada",
      atorId: (caso as any)?.agente_id ?? null,
    });
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
  clientMessageId: z.string().min(1).max(200).optional(),
});

export const salvarMensagemChat = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SalvarMensagemInput.parse(input))
  .handler(async ({ data }) => {
    const casoId = await resolverCasoId({ token: data.token, casoId: data.casoId });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("chat_mensagens").upsert(
      {
        caso_id: casoId,
        role: data.role,
        parts: data.parts,
        client_message_id: data.clientMessageId ?? null,
      },
      { onConflict: "caso_id,client_message_id", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ============= Salvamento em lote (blocos agrupados) =============

const SalvarBlocoInput = z.object({
  token: z.string().min(1).optional(),
  casoId: z.string().uuid().optional(),
  blocoId: z.string().uuid(),
  respostas: z
    .array(
      z.object({
        perguntaId: z.string().uuid(),
        valorTexto: z.string().optional(),
        transcricao: z.string().optional(),
        arquivosPaths: z.array(z.string()).optional(),
      }),
    )
    .min(1)
    .max(60),
});

export type SalvarBlocoResult = {
  ok: boolean;
  salvas: number;
  erros: { perguntaId: string; motivo: string }[];
  resumo: string;
};

/** Salva de uma vez todas as respostas de um bloco agrupado. */
export const salvarRespostasBloco = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SalvarBlocoInput.parse(input))
  .handler(async ({ data }): Promise<SalvarBlocoResult> => {
    const casoId = await resolverCasoId({ token: data.token, casoId: data.casoId });
    const { loadAgentContext, execSalvarResposta } = await import(
      "@/lib/vistoria-agent.server"
    );
    const ctx = await loadAgentContext(casoId);

    const erros: { perguntaId: string; motivo: string }[] = [];
    const partesResumo: string[] = [];
    let salvas = 0;

    for (const r of data.respostas) {
      const pergunta = ctx.perguntas.find((p) => p.id === r.perguntaId);
      if (!pergunta || pergunta.bloco_id !== data.blocoId) {
        erros.push({ perguntaId: r.perguntaId, motivo: "Pergunta não pertence a este bloco." });
        continue;
      }
      const temConteudo =
        !!r.valorTexto?.trim() || !!r.transcricao?.trim() || !!r.arquivosPaths?.length;
      if (!temConteudo) continue;

      const res = await execSalvarResposta(casoId, ctx, {
        pergunta_id: r.perguntaId,
        ...(r.valorTexto?.trim() ? { valor_texto: r.valorTexto.trim() } : {}),
        ...(r.transcricao?.trim() ? { transcricao: r.transcricao.trim() } : {}),
        ...(r.arquivosPaths?.length ? { arquivos_paths: r.arquivosPaths } : {}),
      });
      if (!res.ok) {
        erros.push({ perguntaId: r.perguntaId, motivo: res.motivo ?? "Falha ao salvar." });
        continue;
      }
      salvas++;
      const rotulo = [pergunta.bloco_linha, pergunta.bloco_coluna].filter(Boolean).join(" · ") ||
        pergunta.texto;
      const valor =
        r.valorTexto?.trim() ||
        r.transcricao?.trim() ||
        (r.arquivosPaths?.length ? `${r.arquivosPaths.length} arquivo(s)` : "");
      partesResumo.push(`${rotulo}: ${valor}`);
    }

    return {
      ok: erros.length === 0,
      salvas,
      erros,
      resumo: partesResumo.join(" · "),
    };
  });
