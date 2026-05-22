import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import logo from "@/assets/ionics-logo.png";
import { agentScript } from "@/lib/mock-data";
import { Button, Input, Textarea, Badge, Card } from "@/components/ui-bits";
import { Camera, Mic, Type, Check } from "lucide-react";

export const Route = createFileRoute("/agent/$token")({
  component: AgentPage,
});

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  foto: Camera,
  audio: Mic,
  texto: Type,
  numero: Type,
  checkbox: Check,
};

const typeLabels: Record<string, string> = {
  foto: "Foto",
  audio: "Áudio",
  texto: "Texto",
  numero: "Número",
  checkbox: "Checkbox",
};

function AgentPage() {
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const allQuestions = agentScript.flatMap((s) => s.questions);
  const requiredIds = allQuestions.filter((q) => q.required).map((q) => q.id);
  const answeredCount = Object.values(answers).filter(Boolean).length;
  const totalCount = allQuestions.length;
  const progress = useMemo(
    () => Math.round((answeredCount / totalCount) * 100),
    [answeredCount, totalCount],
  );
  const canSubmit = requiredIds.every((id) => answers[id]);

  const mark = (id: string, v: boolean) => setAnswers((a) => ({ ...a, [id]: v }));

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
            <Check className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Suas informações foram enviadas com sucesso.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Obrigado! Você pode fechar esta página.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <img src={logo} alt="IONICS" className="h-7 w-auto" />
          <div className="text-right">
            <p className="text-xs text-sidebar-foreground/70">Cliente</p>
            <p className="text-sm font-semibold">TransLog Brasil</p>
          </div>
        </div>
        <div className="h-1 w-full bg-sidebar-border">
          <div
            className="h-full bg-sidebar-active transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mx-auto max-w-3xl px-4 py-2 text-xs text-sidebar-foreground/80">
          {progress}% preenchido · {answeredCount}/{totalCount} perguntas
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground">Roteiro de pós-vistoria</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preencha todas as etapas abaixo. Perguntas marcadas como obrigatórias precisam ser
            respondidas antes do envio.
          </p>
        </div>

        <div className="space-y-6">
          {agentScript.map((s, idx) => (
            <div key={s.id}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Seção {idx + 1} · {s.title}
              </h2>
              <div className="space-y-3">
                {s.questions.map((q) => {
                  const Icon = typeIcons[q.type] ?? Type;
                  const answered = !!answers[q.id];
                  return (
                    <Card key={q.id}>
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{q.text}</p>
                          <div className="mt-1.5 flex gap-2">
                            <Badge className="bg-accent text-accent-foreground gap-1">
                              <Icon className="h-3 w-3" /> {typeLabels[q.type]}
                            </Badge>
                            {q.required && (
                              <Badge className="bg-warning/20 text-warning-foreground">
                                Obrigatória
                              </Badge>
                            )}
                          </div>
                        </div>
                        {answered && (
                          <Badge className="bg-success/15 text-success gap-1">
                            <Check className="h-3 w-3" /> OK
                          </Badge>
                        )}
                      </div>

                      {q.type === "foto" && (
                        <button
                          onClick={() => mark(q.id, true)}
                          className="flex w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border bg-muted/40 py-6 text-sm text-muted-foreground transition-colors hover:bg-muted"
                        >
                          <Camera className="h-5 w-5" />
                          {answered ? "Foto enviada · tocar para refazer" : "Tocar para tirar/enviar foto"}
                        </button>
                      )}

                      {q.type === "audio" && (
                        <button
                          onClick={() => mark(q.id, true)}
                          className="flex w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border bg-muted/40 py-6 text-sm text-muted-foreground transition-colors hover:bg-muted"
                        >
                          <Mic className="h-5 w-5" />
                          {answered ? "Áudio gravado · tocar para regravar" : "Tocar para gravar áudio"}
                        </button>
                      )}

                      {(q.type === "texto" || q.type === "numero") && (
                        <Input
                          type={q.type === "numero" ? "number" : "text"}
                          placeholder="Digite sua resposta"
                          onChange={(e) => mark(q.id, e.target.value.length > 0)}
                        />
                      )}

                      {q.type === "checkbox" && (
                        <label className="flex items-center gap-2 text-sm text-foreground">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            onChange={(e) => mark(q.id, e.target.checked)}
                          />
                          Sim, confirmo
                        </label>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 mt-8 -mx-4 border-t border-border bg-card px-4 py-4">
          <Button
            onClick={() => setSubmitted(true)}
            disabled={!canSubmit}
            className="w-full"
          >
            Enviar informações
          </Button>
          {!canSubmit && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Responda todas as perguntas obrigatórias para habilitar o envio.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
