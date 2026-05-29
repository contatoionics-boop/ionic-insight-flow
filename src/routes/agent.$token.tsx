import { createFileRoute } from "@tanstack/react-router";
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
import { finalizarEnvio } from "@/lib/agent-ai.functions";
import { Check, Loader2, X } from "lucide-react";

type AgentSearch = { mode?: "chat" | "stepper" };

export const Route = createFileRoute("/agent/$token")({
  validateSearch: (search: Record<string, unknown>): AgentSearch => ({
    mode: search.mode === "chat" ? "chat" : "stepper",
  }),
  component: AgentPage,
});

function AgentPage() {
  const { token } = Route.useParams();
  const [ctx, setCtx] = useState<FormRunnerCtx | null>(null);
  const [state, setState] = useState<Record<string, Resposta>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: link, error: lErr } = await supabase
          .from("links_agente")
          .select("caso_id, expira_em")
          .eq("token", token)
          .maybeSingle();
        if (lErr) throw lErr;
        if (!link) throw new Error("Link inválido ou expirado.");
        if (link.expira_em && new Date(link.expira_em) < new Date())
          throw new Error("Link expirado.");

        const { data: caso, error: cErr } = await supabase
          .from("casos")
          .select("id, formulario_id, cliente:clientes(nome)")
          .eq("id", link.caso_id)
          .maybeSingle();
        if (cErr) throw cErr;
        if (!caso || !caso.formulario_id)
          throw new Error("Caso sem formulário associado.");

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
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar link.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

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

  const finalizarFn = useServerFn(finalizarEnvio);

  const submitAll = async () => {
    if (!ctx) return;
    setSubmitting(true);
    setError(null);
    try {
      const todas = Object.values(ctx.perguntasPorSecao).flat();
      await saveSection(todas);
      await finalizarFn({ data: { token } });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar respostas.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !ctx) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <Card className="max-w-md text-center">
          <X className="mx-auto h-10 w-10 text-destructive" />
          <h2 className="mt-3 text-lg font-semibold text-foreground">Não foi possível abrir o link</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </Card>
      </div>
    );
  }

  if (submitted) return <SuccessScreen />;

  if (!ctx || ctx.secoes.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <Card className="max-w-md text-center">
          <p className="text-sm text-muted-foreground">
            Este formulário ainda não possui seções configuradas.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <FormRunner
      ctx={ctx}
      token={token}
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

function SuccessScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-6">
      <div className="max-w-md text-center">
        <div className="success-check mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/15 text-success">
          <Check className="h-10 w-10" strokeWidth={3} />
        </div>
        <h2 className="mt-6 text-2xl font-semibold text-foreground">Informações enviadas com sucesso.</h2>
        <p className="mt-2 text-sm text-muted-foreground">Obrigado! Você já pode fechar esta página.</p>
      </div>
      <style>{`
        @keyframes pop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); } }
        .success-check { animation: pop 0.5s ease-out; }
      `}</style>
    </div>
  );
}
