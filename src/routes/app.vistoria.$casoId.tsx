import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";

import { Card } from "@/components/ui-bits";
import {
  FormRunner,
  type FormRunnerCtx,
  type FormRunnerSecao,
} from "@/components/agent/FormRunner";
import { FormChat } from "@/components/agent/FormChat";
import type { Pergunta, Resposta, TipoPergunta } from "@/components/agent/FormFields";
import { supabase } from "@/integrations/supabase/client";
import { finalizarVistoria, iniciarVistoria } from "@/lib/casos.functions";
import { Check, Loader2, X } from "lucide-react";

type VSearch = { mode?: "chat" | "stepper" };

export const Route = createFileRoute("/app/vistoria/$casoId")({
  validateSearch: (search: Record<string, unknown>): VSearch => ({
    mode: search.mode === "chat" ? "chat" : "stepper",
  }),
  component: VistoriaPage,
});

function VistoriaPage() {
  const { casoId } = Route.useParams();
  const { mode: chatMode } = Route.useSearch();
  const iniciar = useServerFn(iniciarVistoria);
  const finalizar = useServerFn(finalizarVistoria);

  const [ctx, setCtx] = useState<FormRunnerCtx | null>(null);
  const [state, setState] = useState<Record<string, Resposta>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: caso, error: cErr } = await supabase
          .from("casos")
          .select("id, formulario_id, cliente:clientes(nome)")
          .eq("id", casoId)
          .maybeSingle();
        if (cErr) throw cErr;
        if (!caso) throw new Error("Mapeamento não encontrado ou sem permissão.");
        if (!caso.formulario_id) throw new Error("Caso sem formulário associado.");

        const { data: formulario } = await supabase
          .from("formularios")
          .select("nome")
          .eq("id", caso.formulario_id)
          .maybeSingle();

        const { data: secoesData, error: sErr } = await supabase
          .from("secoes")
          .select("id, titulo, ordem, descricao")
          .eq("formulario_id", caso.formulario_id)
          .order("ordem");
        if (sErr) throw sErr;
        const secoes = (secoesData ?? []) as FormRunnerSecao[];

        const secoesIds = secoes.map((s) => s.id);
        const { data: perguntas } = secoesIds.length
          ? await supabase
              .from("perguntas")
              .select("id, secao_id, texto, tipo, obrigatoria, ordem, instrucao_agente, contexto_ia")
              .in("secao_id", secoesIds)
              .order("ordem")
          : { data: [] };

        const perguntasIds = (perguntas ?? []).map((p: any) => p.id);
        const { data: opcoes } = perguntasIds.length
          ? await supabase
              .from("opcoes_pergunta")
              .select("id, pergunta_id, texto, ordem")
              .in("pergunta_id", perguntasIds)
              .order("ordem")
          : { data: [] };

        const opcoesPorPergunta = new Map<string, { id: string; texto: string }[]>();
        for (const o of opcoes ?? []) {
          const arr = opcoesPorPergunta.get(o.pergunta_id) ?? [];
          arr.push({ id: o.id, texto: o.texto });
          opcoesPorPergunta.set(o.pergunta_id, arr);
        }

        const perguntasPorSecao: Record<string, Pergunta[]> = {};
        for (const p of perguntas ?? []) {
          const item: Pergunta = {
            id: p.id,
            secao_id: p.secao_id,
            texto: p.texto,
            tipo: p.tipo as TipoPergunta,
            obrigatoria: p.obrigatoria,
            ordem: p.ordem,
            instrucao_agente: p.instrucao_agente,
            contexto_ia: p.contexto_ia,
            opcoes: opcoesPorPergunta.get(p.id),
          };
          (perguntasPorSecao[p.secao_id] ??= []).push(item);
        }

        const { data: rascunho } = await supabase
          .from("respostas_agente")
          .select("pergunta_id, valor_texto, arquivo_path, transcricao, ia_aprovado, ia_motivo")
          .eq("caso_id", caso.id);
        const hidrato: Record<string, Resposta> = {};
        for (const r of rascunho ?? []) {
          hidrato[r.pergunta_id] = {
            text: r.valor_texto ?? undefined,
            filePath: r.arquivo_path ?? undefined,
            transcription: r.transcricao ?? undefined,
            transcriptionConfirmed: !!r.transcricao,
            audioPath: r.arquivo_path ?? undefined,
          };
        }
        setState(hidrato);

        setCtx({
          casoId: caso.id,
          clienteNome: caso.cliente?.nome ?? "",
          formularioNome: formulario?.nome ?? "",
          secoes,
          perguntasPorSecao,
        });

        // marca como em andamento
        try {
          await iniciar({ data: { casoId: caso.id } });
        } catch {
          // ignora — pode já estar em andamento
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar mapeamento.");
      } finally {
        setLoading(false);
      }
    })();
  }, [casoId, iniciar]);

  const saveSection = useCallback(
    async (perguntas: Pergunta[]) => {
      if (!ctx) return;
      const rows = perguntas.map((p) => {
        const r = state[p.id] ?? {};
        const arquivo_path =
          p.tipo === "foto" ? r.filePath ?? null : p.tipo === "audio" ? r.audioPath ?? null : null;
        return {
          caso_id: ctx.casoId,
          pergunta_id: p.id,
          tipo: p.tipo,
          valor_texto: r.text ?? null,
          arquivo_path,
          transcricao: p.tipo === "audio" ? r.transcription ?? null : null,
          ia_aprovado:
            p.tipo === "foto" && r.ia
              ? r.ia.status === "aprovada" || (r.ia.status === "parcial" && !!r.iaConfirmada)
              : null,
          ia_motivo: p.tipo === "foto" && r.ia ? r.ia.orientacao : null,
        };
      });
      const { error } = await supabase
        .from("respostas_agente")
        .upsert(rows, { onConflict: "caso_id,pergunta_id" });
      if (error) console.warn("Auto-save falhou:", error.message);
    },
    [ctx, state],
  );

  const submitAll = async () => {
    if (!ctx) return;
    setSubmitting(true);
    setError(null);
    try {
      const todas = Object.values(ctx.perguntasPorSecao).flat();
      await saveSection(todas);
      await finalizar({ data: { casoId: ctx.casoId } });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar respostas.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !ctx) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="max-w-md text-center">
          <X className="mx-auto h-10 w-10 text-destructive" />
          <h2 className="mt-3 text-lg font-semibold text-foreground">Não foi possível abrir o mapeamento</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/15 text-success">
            <Check className="h-10 w-10" strokeWidth={3} />
          </div>
          <h2 className="mt-6 text-2xl font-semibold text-foreground">Mapeamento enviado com sucesso.</h2>
          <Link to="/app/minhas-vistorias" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            Voltar para meus mapeamentos
          </Link>
        </div>
      </div>
    );
  }

  if (!ctx || ctx.secoes.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="max-w-md text-center">
          <p className="text-sm text-muted-foreground">Este formulário ainda não possui seções configuradas.</p>
        </Card>
      </div>
    );
  }

  if (chatMode === "chat") {
    return (
      <FormChat
        ctx={ctx}
        token="preview"
        state={state}
        setState={setState}
        onAdvanceSection={saveSection}
        onSubmit={submitAll}
        submitting={submitting}
        errorMessage={error}
      />
    );
  }

  return (
    <FormRunner
      ctx={ctx}
      token="preview"
      mode="live"
      state={state}
      setState={setState}
      onAdvanceSection={saveSection}
      onSubmit={submitAll}
      submitting={submitting}
      errorMessage={error}
    />
  );
}
