import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EstadoInput = z.object({
  token: z.string().min(1).optional(),
  casoId: z.string().uuid().optional(),
});

async function usuarioAutenticado(): Promise<string> {
  const { getUsuarioAutenticadoId } = await import("@/lib/vistoria-auth.server");
  return getUsuarioAutenticadoId();
}

async function validarCasoDaSessao(casoId: string): Promise<string> {
  const userId = await usuarioAutenticado();
  const { validarExecutorCaso } = await import("@/lib/vistoria-agent.server");
  await validarExecutorCaso(casoId, userId);
  return userId;
}

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
  /** Dados vindos do cadastro/agendamento aguardando confirmação do agente. */
  cadastroPendente: {
    perguntaId: string;
    perguntaTexto: string;
    secaoTitulo: string;
    tipo: string;
    valor: string;
    obrigatoria: boolean;
    opcoes: { id: string; texto: string }[];
  }[];
  /** Resumo do agendamento (cliente, endereço, agente, data, nível...). */
  resumoCadastro: { label: string; valor: string }[];
  /** true quando o agente já respondeu algo por conta própria. */
  iniciado: boolean;
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
      casoId = data.casoId;
      await validarCasoDaSessao(casoId);
    } else {
      throw new Error("Informe token ou casoId.");
    }

    const { calcularPendencias, sincronizarCadastro } = await import("@/lib/vistoria-agent.server");
    const ctx = await loadAgentContext(casoId);
    const cadastroPendente = await sincronizarCadastro(ctx);
    const pend = calcularPendencias(ctx);

    const iniciado = Object.values(ctx.state).some(
      (r) =>
        !r.origem_cadastro &&
        !!(r.valor_texto || r.arquivo_path || r.transcricao || r.arquivos_paths?.length),
    );

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
    if (iniciado) {
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
      cadastroPendente,
      resumoCadastro: ctx.cadastro.map((f) => ({ label: f.label, valor: f.valor })),
      iniciado,
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
    let atorId: string | null = null;
    if (data.token) {
      casoId = await validarTokenAcesso(data.token);
    } else if (data.casoId) {
      casoId = data.casoId;
      atorId = await validarCasoDaSessao(casoId);
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
      .update({ status: "aguardando_revisao", data_entrega_agente: new Date().toISOString() })
      .eq("id", casoId);
    if (error) throw new Error(error.message);

    const { registrarEvento } = await import("@/lib/eventos.server");
    await registrarEvento({
      casoId,
      agendamentoId: (caso as any)?.agendamento_id ?? null,
      tipo: "vistoria_finalizada",
      atorId: atorId ?? (caso as any)?.agente_id ?? null,
    });

    // Gera o laudo estruturado já na entrega — falha aqui não bloqueia a finalização.
    let laudoGerado = false;
    try {
      const { montarESalvarLaudo } = await import("@/lib/laudo/montar.server");
      await montarESalvarLaudo(supabaseAdmin, casoId);
      laudoGerado = true;
    } catch (e) {
      console.error("[finalizarVistoriaChat] falha ao gerar laudo:", e);
    }

    return { ok: true, laudoGerado };
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
  if (data.casoId) {
    await validarCasoDaSessao(data.casoId);
    return data.casoId;
  }
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
        perguntaId: z.string().min(1).max(100),
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

const ConfirmarCadastroInput = z.object({
  token: z.string().min(1).optional(),
  casoId: z.string().uuid().optional(),
  correcoes: z
    .array(z.object({ perguntaId: z.string().min(1).max(100), valor: z.string() }))
    .default([]),
});

/** Confirma os dados vindos do cadastro/agendamento e inicia o mapeamento. */
export const confirmarCadastroVistoria = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ConfirmarCadastroInput.parse(input))
  .handler(async ({ data }) => {
    const { loadAgentContext, validarTokenAcesso, confirmarCadastro } = await import(
      "@/lib/vistoria-agent.server"
    );
    let casoId: string;
    let atorId: string | null = null;
    if (data.token) casoId = await validarTokenAcesso(data.token);
    else if (data.casoId) {
      casoId = data.casoId;
      atorId = await validarCasoDaSessao(casoId);
    }
    else throw new Error("Informe token ou casoId.");

    const ctx = await loadAgentContext(casoId);
    await confirmarCadastro(ctx, data.correcoes);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { registrarEvento } = await import("@/lib/eventos.server");
    const { data: caso } = await supabaseAdmin
      .from("casos")
      .select("status, agente_id, agendamento_id")
      .eq("id", casoId)
      .maybeSingle();
    if (caso && (caso.status === "agendado" || caso.status === "rascunho")) {
      const { error } = await supabaseAdmin
        .from("casos")
        .update({ status: "em_andamento" })
        .eq("id", casoId)
        .in("status", ["agendado", "rascunho"]);
      if (!error) {
        await registrarEvento({
          casoId,
          agendamentoId: caso.agendamento_id ?? null,
          tipo: "vistoria_iniciada",
          atorId: atorId ?? caso.agente_id ?? null,
        });
      }
    }
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Modo Checklist Guiado
// ---------------------------------------------------------------------------

export type ChecklistRespostaDTO = {
  texto: string | null;
  arquivos: string[];
  transcricao: string | null;
  origemCadastro: boolean;
};

export type ChecklistPerguntaDTO = {
  id: string;
  texto: string;
  tipo: string;
  obrigatoria: boolean;
  ordem: number;
  instrucao_agente: string | null;
  contexto_ia: string | null;
  opcoes: { id: string; texto: string }[];
  condicional_pergunta_id: string | null;
  condicional_operador: string | null;
  condicional_valor: string | null;
  blocoId: string | null;
  bloco_linha: string | null;
  bloco_coluna: string | null;
  /** Instância do Escopo (ex.: "Posto 01 › Ilha 01 › Bomba 02"). */
  entidadeId: string | null;
  entidadeRotulo: string | null;
  entidadeTipo: string | null;
  /** Condição que não pôde ser resolvida pela hierarquia (a pergunta aparece sem condição). */
  condicaoAviso: string | null;
  resposta: ChecklistRespostaDTO | null;
};

export type ChecklistEtapaDTO = {
  id: string;
  titulo: string;
  ordem: number;
  blocos: { id: string; titulo: string; descricao: string | null; layout: BlocoDTO["layout"]; ordem: number }[];
  perguntas: ChecklistPerguntaDTO[];
};

export type ChecklistVistoriaDTO = {
  casoId: string;
  clienteNome: string;
  formularioNome: string;
  iniciado: boolean;
  resumoCadastro: { label: string; valor: string }[];
  /** Hierarquia do Escopo (para montar a árvore posto › ilha › bomba › bico). */
  entidades: { id: string; tipo: string; parentId: string | null; ordem: number; rotulo: string }[];
  /** Orientações escritas por quem agendou (observações do agendamento). */
  orientacoes: string | null;
  etapas: ChecklistEtapaDTO[];
};

/** Carrega o formulário inteiro (seções, blocos, perguntas e respostas) para o checklist. */
export const getChecklistVistoria = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EstadoInput.parse(input))
  .handler(async ({ data }): Promise<ChecklistVistoriaDTO> => {
    const casoId = await resolverCasoId(data);
    const { loadAgentContext, sincronizarCadastro, estaRespondida } = await import(
      "@/lib/vistoria-agent.server"
    );
    const ctx = await loadAgentContext(casoId);
    await sincronizarCadastro(ctx);
    const ctxAtual = await loadAgentContext(casoId);

    const etapas: ChecklistEtapaDTO[] = ctxAtual.secoes.map((s) => ({
      id: s.id,
      titulo: s.titulo,
      ordem: s.ordem,
      blocos: ctxAtual.blocos
        .filter((b) => b.secao_id === s.id)
        .map((b) => ({
          id: b.id,
          titulo: b.titulo,
          descricao: b.descricao,
          layout: b.layout,
          ordem: b.ordem,
        })),
      perguntas: ctxAtual.perguntas
        .filter((p) => p.secao_id === s.id)
        .map((p) => {
          const r = ctxAtual.state[p.id];
          return {
            id: p.id,
            texto: p.texto,
            tipo: p.tipo,
            obrigatoria: p.obrigatoria,
            ordem: p.ordem,
            instrucao_agente: p.instrucao_agente,
            contexto_ia: p.contexto_ia,
            opcoes: p.opcoes,
            condicional_pergunta_id: p.condicional_pergunta_id,
            condicional_operador: p.condicional_operador,
            condicional_valor: p.condicional_valor,
            blocoId: p.bloco_id,
            bloco_linha: p.bloco_linha,
            bloco_coluna: p.bloco_coluna,
            entidadeId: p.entidade_id ?? null,
            entidadeRotulo: p.entidade_rotulo ?? null,
            entidadeTipo: p.entidade_tipo ?? null,
            condicaoAviso: p.condicao_aviso ?? null,
            resposta: r
              ? {
                  texto: r.valor_texto,
                  arquivos: r.arquivos_paths?.length
                    ? r.arquivos_paths
                    : r.arquivo_path
                      ? [r.arquivo_path]
                      : [],
                  transcricao: r.transcricao,
                  origemCadastro: !!r.origem_cadastro,
                }
              : null,
          };
        }),
    }));

    const iniciado = Object.values(ctxAtual.state).some(
      (r) => !r.origem_cadastro && estaRespondida(r),
    );

    return {
      casoId,
      clienteNome: ctxAtual.clienteNome,
      formularioNome: ctxAtual.formularioNome,
      iniciado,
      resumoCadastro: ctxAtual.cadastro.map((f) => ({ label: f.label, valor: f.valor })),
      orientacoes: ctxAtual.cadastro.find((f) => f.label === "Observações do agendamento")?.valor ?? null,
      entidades: ctxAtual.entidades.map((e) => ({
        id: e.id,
        tipo: e.tipo,
        parentId: e.parent_id,
        ordem: e.ordem,
        rotulo: e.rotulo,
      })),
      etapas,
    };
  });

const SalvarEtapaInput = z.object({
  token: z.string().min(1).optional(),
  casoId: z.string().uuid().optional(),
  respostas: z
    .array(
      z.object({
        perguntaId: z.string().min(1).max(100),
        valorTexto: z.string().optional(),
        transcricao: z.string().optional(),
        arquivosPaths: z.array(z.string()).optional(),
      }),
    )
    .min(1)
    .max(120),
});

/** Salva um conjunto arbitrário de respostas (usado pelo checklist guiado). */
export const salvarRespostasEtapa = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SalvarEtapaInput.parse(input))
  .handler(async ({ data }): Promise<SalvarBlocoResult> => {
    const casoId = await resolverCasoId({ token: data.token, casoId: data.casoId });
    const { loadAgentContext, execSalvarResposta } = await import(
      "@/lib/vistoria-agent.server"
    );
    const ctx = await loadAgentContext(casoId);

    const erros: { perguntaId: string; motivo: string }[] = [];
    let salvas = 0;
    let ignoradas = 0;

    for (const r of data.respostas) {
      const pergunta = ctx.perguntas.find((p) => p.id === r.perguntaId);
      if (!pergunta) {
        // O formulário pode ter sido atualizado enquanto este caso ainda estava
        // em andamento. Respostas locais de perguntas removidas não devem
        // impedir o salvamento nem a entrega das perguntas atuais.
        ignoradas++;
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
    }

    return {
      ok: erros.length === 0,
      salvas,
      erros,
      resumo: `${salvas} resposta(s) salva(s)${ignoradas ? ` · ${ignoradas} antiga(s) ignorada(s)` : ""}`,
    };
  });

const UrlsInput = z.object({
  token: z.string().min(1).optional(),
  casoId: z.string().uuid().optional(),
  paths: z.array(z.string().min(1)).min(1).max(50),
});

/** Gera URLs assinadas das mídias já enviadas, para exibir após recarregar a página. */
export const urlsArquivosVistoria = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UrlsInput.parse(input))
  .handler(async ({ data }): Promise<Record<string, string>> => {
    const casoId = await resolverCasoId({ token: data.token, casoId: data.casoId });
    const paths = data.paths.filter((p) => p.startsWith(`casos/${casoId}/`) && !p.includes(".."));
    if (!paths.length) return {};
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage
      .from("agente-uploads")
      .createSignedUrls(paths, 60 * 60);
    const mapa: Record<string, string> = {};
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) mapa[s.path] = s.signedUrl;
    }
    return mapa;
  });
