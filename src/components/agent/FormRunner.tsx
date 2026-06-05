import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, Loader2, Pencil, Send } from "lucide-react";

import { Button, Card } from "@/components/ui-bits";
import {
  PerguntaBloco,
  isComplete,
  type Pergunta,
  type RendererMode,
  type Resposta,
} from "@/components/agent/FormFields";
import { useConfiguracoesEmpresa } from "@/hooks/use-configuracoes-empresa";

export type FormRunnerSecao = {
  id: string;
  titulo: string;
  ordem: number;
  descricao: string | null;
};

export type FormRunnerCtx = {
  casoId: string;
  clienteNome: string;
  formularioNome: string;
  secoes: FormRunnerSecao[];
  perguntasPorSecao: Record<string, Pergunta[]>;
};

export function FormRunner({
  ctx,
  token,
  mode,
  state,
  setState,
  onAdvanceSection,
  onSubmit,
  submitting,
  errorMessage,
  initialStep = 0,
}: {
  ctx: FormRunnerCtx;
  token: string;
  mode: RendererMode;
  state: Record<string, Resposta>;
  setState: (updater: (s: Record<string, Resposta>) => Record<string, Resposta>) => void;
  /** Called after the user advances a section. In live mode used for autosave. */
  onAdvanceSection?: (perguntas: Pergunta[]) => Promise<void> | void;
  /** Called when the user clicks "Enviar". In preview mode left undefined to no-op. */
  onSubmit?: () => Promise<void> | void;
  submitting?: boolean;
  errorMessage?: string | null;
  initialStep?: number;
}) {
  const { config } = useConfiguracoesEmpresa();
  const [step, setStep] = useState(initialStep);

  const totalSteps = ctx.secoes.length + 1;
  const isReview = step >= ctx.secoes.length;
  const secaoAtual = isReview ? null : ctx.secoes[step];
  const perguntasAtuais = secaoAtual ? ctx.perguntasPorSecao[secaoAtual.id] ?? [] : [];
  const progress = Math.round(((step + 1) / Math.max(totalSteps, 1)) * 100);

  const update = useCallback(
    (perguntaId: string, patch: Partial<Resposta>) => {
      setState((s) => ({ ...s, [perguntaId]: { ...s[perguntaId], ...patch } }));
    },
    [setState],
  );

  const sectionComplete = useMemo(
    () => perguntasAtuais.every((p) => isComplete(p, state[p.id] ?? {}, mode)),
    [perguntasAtuais, state, mode],
  );

  const advance = async () => {
    if (isReview) {
      await onSubmit?.();
      return;
    }
    await onAdvanceSection?.(perguntasAtuais);
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const nomeEmpresa = config?.nome_empresa || "Ionics";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">

        {mode === "preview" && (
          <div className="bg-warning/10 px-4 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-warning-foreground">
            <Eye className="mr-1 inline h-3 w-3" /> Preview — nenhum dado será salvo
          </div>
        )}
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
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
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
          <ReviewStep ctx={ctx} state={state} onEditar={(idx) => setStep(idx)} />
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
                    mode={mode}
                    siblings={{
                      perguntas: perguntasAtuais,
                      state,
                      updateById: (id, patch) => update(id, patch),
                    }}
                  />
                ))}
              </div>
            </>
          )
        )}

        {errorMessage && <p className="mt-4 text-sm text-destructive">{errorMessage}</p>}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
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
                <Send className="h-4 w-4" />{" "}
                {mode === "preview" ? "Simular envio" : "Enviar ao especialista"}
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
  ctx: FormRunnerCtx;
  state: Record<string, Resposta>;
  onEditar: (idx: number) => void;
}) {
  return (
    <>
      <h1 className="text-2xl font-semibold text-foreground">Revisão final</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Confira tudo antes de enviar ao especialista.
      </p>

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
        {r.filePreview && (
          <img src={r.filePreview} alt="" className="h-12 w-12 rounded object-cover" />
        )}
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
            {r.ia.status === "aprovada"
              ? "Aprovada"
              : r.ia.status === "parcial"
              ? "Parcial"
              : "Incorreta"}
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
    return (
      <p className="text-sm text-foreground">
        {r.text === "sim" ? "Sim" : r.text === "nao" ? "Não" : "—"}
      </p>
    );
  }
  return <p className="text-sm text-foreground">{r.text?.trim() || "—"}</p>;
}
