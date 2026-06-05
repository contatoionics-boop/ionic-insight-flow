import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, X } from "lucide-react";

import { Button, Card } from "@/components/ui-bits";
import { FormRunner, type FormRunnerCtx, type FormRunnerSecao } from "@/components/agent/FormRunner";
import type { Pergunta, Resposta, TipoPergunta } from "@/components/agent/FormFields";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/preview/forms/$id")({
  component: FullscreenPreviewPage,
});

function FullscreenPreviewPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const auth = useAuth();

  const [ctx, setCtx] = useState<FormRunnerCtx | null>(null);
  const [state, setState] = useState<Record<string, Resposta>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status === "unauthenticated") {
      navigate({ to: "/" });
    }
  }, [auth.status, navigate]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    (async () => {
      try {
        const { data: f, error: fErr } = await supabase
          .from("formularios")
          .select("nome, validar_imagens_ia, empresa:empresas(nome)")
          .eq("id", id)
          .single();
        if (fErr) throw fErr;

        const { data: secs } = await supabase
          .from("secoes")
          .select("id, titulo, ordem, descricao")
          .eq("formulario_id", id)
          .order("ordem");
        const secoes = (secs ?? []) as FormRunnerSecao[];

        const perguntasPorSecao: Record<string, Pergunta[]> = {};
        if (secoes.length) {
          const { data: ps } = await supabase
            .from("perguntas")
            .select("id, secao_id, texto, tipo, obrigatoria, ordem, instrucao_agente, contexto_ia")
            .in("secao_id", secoes.map((s) => s.id))
            .order("ordem");
          const perguntasIds = (ps ?? []).map((p: any) => p.id);
          const { data: ops } = perguntasIds.length
            ? await supabase
                .from("opcoes_pergunta")
                .select("id, pergunta_id, texto, ordem")
                .in("pergunta_id", perguntasIds)
                .order("ordem")
            : { data: [] };
          const opcoesPorPergunta = new Map<string, { id: string; texto: string }[]>();
          for (const o of ops ?? []) {
            const arr = opcoesPorPergunta.get(o.pergunta_id) ?? [];
            arr.push({ id: o.id, texto: o.texto });
            opcoesPorPergunta.set(o.pergunta_id, arr);
          }
          for (const p of ps ?? []) {
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
        }

        setCtx({
          casoId: "preview",
          clienteNome: (f as any).empresa?.nome ?? "Preview",
          formularioNome: f.nome,
          secoes,
          perguntasPorSecao,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar formulário.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, auth.status]);

  if (auth.status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !ctx) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <Card className="max-w-md text-center">
          <X className="mx-auto h-10 w-10 text-destructive" />
          <p className="mt-2 text-sm text-destructive">{error ?? "Formulário não encontrado."}</p>
          <div className="mt-4">
            <Button variant="outline" onClick={() => window.close()}>Fechar</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (ctx.secoes.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white p-6">
        <Card className="max-w-md text-center">
          <p className="text-sm text-muted-foreground">
            Este formulário ainda não possui seções configuradas.
          </p>
        </Card>
        <Button variant="outline" onClick={() => navigate({ to: "/app/forms/$id", params: { id } })}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
      </div>
    );
  }

  return (
    <FormRunner
      ctx={ctx}
      token="preview"
      mode="preview"
      state={state}
      setState={setState}
      onSubmit={() => window.close()}
    />
  );
}
