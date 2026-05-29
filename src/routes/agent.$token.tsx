import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, Card } from "@/components/ui-bits";
import {
  PerguntaBloco,
  isComplete,
  type Pergunta,
  type Resposta,
  type TipoPergunta,
} from "@/components/agent/FormFields";
import { useConfiguracoesEmpresa } from "@/hooks/use-configuracoes-empresa";
import { supabase } from "@/integrations/supabase/client";
import { finalizarEnvio } from "@/lib/agent-ai.functions";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Pencil,
  Send,
  X,
} from "lucide-react";

export const Route = createFileRoute("/agent/$token")({
  component: AgentPage,
});

type Secao = { id: string; titulo: string; ordem: number; descricao: string | null };

type Contexto = {
  casoId: string;
  clienteNome: string;
  formularioNome: string;
  secoes: Secao[];
  perguntasPorSecao: Record<string, Pergunta[]>;
};

function AgentPage() {
  const { token } = Route.useParams();
  const { config } = useConfiguracoesEmpresa();
  const [ctx, setCtx] = useState<Contexto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [state, setState] = useState<Record<string, Resposta>>({});
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
        const secoes = (secoesData ?? []) as Secao[];

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

  const totalSteps = (ctx?.secoes.length ?? 0) + 1;
  const isReview = ctx ? step >= ctx.secoes.length : false;
  const secaoAtual = ctx && !isReview ? ctx.secoes[step] : null;
  const perguntasAtuais = secaoAtual ? ctx?.perguntasPorSecao[secaoAtual.id] ?? [] : [];
  const progress = Math.round(((step + 1) / Math.max(totalSteps, 1)) * 100);

  const update = useCallback(
    (perguntaId: string, patch: Partial<Resposta>) => {
      setState((s) => ({ ...s, [perguntaId]: { ...s[perguntaId], ...patch } }));
    },
    [],
  );

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

  const advance = async () => {
    if (!ctx) return;
    if (isReview) {
      await submitAll();
      return;
    }
    await saveSection(perguntasAtuais);
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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

  const sectionComplete = useMemo(() => {
    return perguntasAtuais.every((p) => isComplete(p, state[p.id] ?? {}, "live"));
  }, [perguntasAtuais, state]);

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
          <p className="text-sm text-muted-foreground">Este formulário ainda não possui seções configuradas.</p>
        </Card>
      </div>
    );
  }

  const nomeEmpresa = config?.nome_empresa || "Ionics";

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-20 border-b border-border bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {config?.logo_url && (
              <img src={config.logo_url} alt={nomeEmpresa} className="h-7 w-auto object-contain" />
            )}
            <span className="text-lg font-bold tracking-tight text-primary">{nomeEmpresa}</span>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cliente</p>
            <p className="text-sm font-semibold text-foreground">{ctx.clienteNome || "—"}</p>
          </div>
        </div>
        <div className="h-1.5 w-full bg-muted">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2 text-xs">
          <span className="font-medium text-foreground">
            {isReview ? "Revisão final" : `Seção ${step + 1} de ${ctx.secoes.length}`}
          </span>
          <span className="text-muted-foreground">{progress}%</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 pb-32">
        {isReview ? (
          <ReviewStep
            ctx={ctx}
            state={state}
            onEditar={(idx) => setStep(idx)}
          />
        ) : (
          secaoAtual && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Seção {step + 1}
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-foreground">{secaoAtual.titulo}</h1>
              {secaoAtual.descricao && (
                <p className="mt-2 text-sm text-muted-foreground">{secaoAtual.descricao}</p>
              )}

              <div className="mt-6 space-y-6">
                {perguntasAtuais.map((p) => (
                  <PerguntaBloco
                    key={p.id}
                    pergunta={p}
                    casoId={ctx.casoId}
                    token={token}
                    resposta={state[p.id] ?? {}}
                    update={(patch) => update(p.id, patch)}
                    mode="live"
                  />
                ))}
              </div>
            </>
          )
        )}

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 border-t border-border bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          {step > 0 && (
            <Button
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              disabled={submitting}
              className="h-12"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
          )}
          <Button
            onClick={advance}
            disabled={(!isReview && !sectionComplete) || submitting}
            className="h-12 flex-1 text-base"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isReview ? (
              <>
                <Send className="h-4 w-4" /> Enviar ao especialista
              </>
            ) : step === ctx.secoes.length - 1 ? (
              <>
                Revisar respostas <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              <>
                Próxima seção <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
}

function ReviewStep({
  ctx,
  state,
  onEditar,
}: {
  ctx: Contexto;
  state: Record<string, Resposta>;
  onEditar: (idx: number) => void;
}) {
  return (
    <>
      <h1 className="text-2xl font-semibold text-foreground">Revisão final</h1>
      <p className="mt-1 text-sm text-muted-foreground">Confira tudo antes de enviar ao especialista.</p>

      <div className="mt-6 space-y-4">
        {ctx.secoes.map((s, i) => {
          const perguntas = ctx.perguntasPorSecao[s.id] ?? [];
          return (
            <Card key={s.id}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">{s.titulo}</h3>
                <button
                  onClick={() => onEditar(i)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Pencil className="h-3 w-3" /> Editar
                </button>
              </div>
              <ul className="divide-y divide-border">
                {perguntas.map((p) => {
                  const r = state[p.id] ?? {};
                  return (
                    <li key={p.id} className="py-3">
                      <p className="text-xs font-medium text-muted-foreground">{p.texto}</p>
                      <div className="mt-1">{renderResumo(p, r)}</div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function renderResumo(p: Pergunta, r: Resposta) {
  if (p.tipo === "foto") {
    return r.filePath ? (
      <div className="flex items-center gap-2 text-sm">
        {r.filePreview && <img src={r.filePreview} alt="" className="h-12 w-12 rounded object-cover" />}
        {r.ia && (
          <span
            className={`rounded px-2 py-0.5 text-xs ${
              r.ia.status === "aprovada"
                ? "bg-success/15 text-success"
                : r.ia.status === "parcial"
                ? "bg-warning/15 text-warning-foreground"
                : "bg-destructive/15 text-destructive"
            }`}
          >
            {r.ia.status === "aprovada" ? "Aprovada" : r.ia.status === "parcial" ? "Parcial" : "Incorreta"}
          </span>
        )}
      </div>
    ) : (
      <span className="text-xs text-muted-foreground">Sem foto.</span>
    );
  }
  if (p.tipo === "audio") {
    return r.transcription ? (
      <p className="text-sm text-foreground">{r.transcription}</p>
    ) : (
      <span className="text-xs text-muted-foreground">Sem áudio.</span>
    );
  }
  if (p.tipo === "toggle") {
    return <p className="text-sm text-foreground">{r.text === "sim" ? "Sim" : r.text === "nao" ? "Não" : "—"}</p>;
  }
  return <p className="text-sm text-foreground">{r.text?.trim() || "—"}</p>;
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
