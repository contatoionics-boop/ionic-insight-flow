import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, useEffect } from "react";
import logo from "@/assets/ionics-logo.png";
import { Button, Textarea, Card } from "@/components/ui-bits";
import {
  Camera,
  Image as ImageIcon,
  Mic,
  Square,
  Type as TypeIcon,
  Check,
  X,
  ArrowRight,
  Send,
  Trash2,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/agent/$token")({
  component: AgentPage,
});

type StepType = "foto" | "audio" | "texto";

type Step = {
  id: string;
  section: string;
  type: StepType;
  title: string;
  instruction: string;
  aiGuidance?: string;
  // mock IA: sequência alternada de aprovações para fotos
  photoVerdicts?: ("ok" | "fail")[];
  failReason?: string;
  mockTranscription?: string;
};

const steps: Step[] = [
  {
    id: "s1",
    section: "Identificação do veículo",
    type: "foto",
    title: "Foto frontal do veículo",
    instruction:
      "Posicione-se a aproximadamente 2 metros da frente do veículo. Capture a placa de forma legível e o veículo inteiro no enquadramento.",
    photoVerdicts: ["fail", "ok"],
    failReason: "Foto desfocada. Tente novamente com melhor iluminação e mantenha a câmera firme.",
  },
  {
    id: "s2",
    section: "Identificação do veículo",
    type: "texto",
    title: "Placa do veículo",
    instruction: "Digite a placa exatamente como aparece no veículo (ex: ABC1D23).",
  },
  {
    id: "s3",
    section: "Equipamento instalado",
    type: "foto",
    title: "Foto do equipamento instalado",
    instruction:
      "Mostre o equipamento de rastreamento já instalado, com a fiação visível.",
    photoVerdicts: ["ok"],
  },
  {
    id: "s4",
    section: "Equipamento instalado",
    type: "audio",
    title: "Áudio descritivo da instalação",
    instruction: "Grave um áudio explicando como o equipamento foi instalado.",
    aiGuidance:
      "Descreva a localização exata do equipamento e o estado da fiação (organizada, isolada, etc.).",
    mockTranscription:
      "O equipamento foi instalado atrás do painel, próximo à coluna do motorista. A fiação está organizada com abraçadeiras e isolada com fita autofusão.",
  },
  {
    id: "s5",
    section: "Equipamento instalado",
    type: "foto",
    title: "Foto do chicote elétrico",
    instruction: "Capture uma foto aproximada do chicote conectado ao equipamento.",
    photoVerdicts: ["fail", "fail", "ok"],
    failReason: "Não foi possível identificar o chicote. Aproxime mais a câmera do ponto de conexão.",
  },
  {
    id: "s6",
    section: "Condições do local",
    type: "foto",
    title: "Foto geral do local de instalação",
    instruction: "Tire uma foto ampla mostrando o ambiente onde a instalação foi feita.",
    photoVerdicts: ["ok"],
  },
  {
    id: "s7",
    section: "Condições do local",
    type: "audio",
    title: "Observações do ambiente",
    instruction: "Grave suas observações sobre o local.",
    aiGuidance:
      "Comente sobre iluminação, organização do local e qualquer condição que possa ter afetado a instalação.",
    mockTranscription:
      "O local está bem iluminado e organizado. Não houve obstruções durante a instalação e o cliente acompanhou todo o processo.",
  },
  {
    id: "s8",
    section: "Condições do local",
    type: "texto",
    title: "Observações finais",
    instruction:
      "Descreva qualquer observação adicional relevante sobre a vistoria. Deixe em branco apenas se não houver nada a relatar.",
  },
];

type Photo = { id: string; verdict: "ok" | "fail"; reason?: string };

type StepState = {
  photos?: Photo[];
  audioRecorded?: boolean;
  transcription?: string;
  transcriptionConfirmed?: boolean;
  text?: string;
};

function AgentPage() {
  const [current, setCurrent] = useState(0);
  const [state, setState] = useState<Record<string, StepState>>({});
  const [submitted, setSubmitted] = useState(false);

  const step = steps[current];
  const total = steps.length;
  const progress = Math.round(((current + (isStepComplete(step, state[step.id]) ? 1 : 0)) / total) * 100);

  const stepState = state[step.id] ?? {};
  const canAdvance = isStepComplete(step, stepState);
  const isLast = current === total - 1;

  const update = (patch: StepState) =>
    setState((s) => ({ ...s, [step.id]: { ...s[step.id], ...patch } }));

  const next = () => {
    if (isLast) setSubmitted(true);
    else setCurrent((c) => c + 1);
  };

  if (submitted) return <SuccessScreen />;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-20 border-b border-border bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <img src={logo} alt="IONICS" className="h-7 w-auto" />
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cliente</p>
            <p className="text-sm font-semibold text-foreground">TransLog Brasil</p>
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
            Etapa {current + 1} de {total}
          </span>
          <span className="text-muted-foreground">{progress}% concluído</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 pb-32">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {step.section}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">{step.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{step.instruction}</p>

        {step.aiGuidance && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm text-foreground">
              <span className="font-medium">Orientação da IA: </span>
              {step.aiGuidance}
            </p>
          </div>
        )}

        <div className="mt-6">
          {step.type === "foto" && (
            <PhotoStep step={step} stepState={stepState} update={update} />
          )}
          {step.type === "audio" && <AudioStep step={step} stepState={stepState} update={update} />}
          {step.type === "texto" && <TextStep stepState={stepState} update={update} />}
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 border-t border-border bg-white">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <Button
            onClick={next}
            disabled={!canAdvance}
            className="h-12 w-full text-base"
          >
            {isLast ? (
              <>
                <Send className="h-4 w-4" /> Enviar informações
              </>
            ) : (
              <>
                Próxima etapa <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
          {!canAdvance && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {step.type === "foto" && "Envie pelo menos uma foto aprovada para continuar."}
              {step.type === "audio" && "Grave o áudio e confirme a transcrição para continuar."}
              {step.type === "texto" && "Preencha o campo para continuar."}
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}

function isStepComplete(step: Step, s: StepState | undefined): boolean {
  if (!s) return false;
  if (step.type === "foto") return !!s.photos?.some((p) => p.verdict === "ok");
  if (step.type === "audio")
    return !!s.audioRecorded && !!s.transcriptionConfirmed && !!s.transcription?.trim();
  if (step.type === "texto") return !!s.text?.trim();
  return false;
}

function PhotoStep({
  step,
  stepState,
  update,
}: {
  step: Step;
  stepState: StepState;
  update: (p: StepState) => void;
}) {
  const photos = stepState.photos ?? [];
  const verdicts = step.photoVerdicts ?? ["ok"];

  const addPhoto = () => {
    const verdict = verdicts[photos.length % verdicts.length];
    const newPhoto: Photo = {
      id: `p-${Date.now()}`,
      verdict,
      reason: verdict === "fail" ? step.failReason : undefined,
    };
    update({ photos: [...photos, newPhoto] });
  };

  const removePhoto = (id: string) =>
    update({ photos: photos.filter((p) => p.id !== id) });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Camera className="h-8 w-8" />
        </div>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Capture ou importe uma foto para esta etapa
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button onClick={addPhoto} className="h-11">
            <Camera className="h-4 w-4" /> Tirar foto
          </Button>
          <Button onClick={addPhoto} variant="outline" className="h-11">
            <ImageIcon className="h-4 w-4" /> Galeria
          </Button>
        </div>
      </div>

      {photos.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Fotos enviadas ({photos.length})
          </p>
          {photos.map((p, i) => (
            <div
              key={p.id}
              className="flex gap-3 rounded-lg border border-border bg-card p-3"
            >
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <ImageIcon className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    Foto #{i + 1}
                  </p>
                  <button
                    onClick={() => removePhoto(p.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {p.verdict === "ok" ? (
                  <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-success/10 px-2 py-1.5 text-xs text-success">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="font-medium">Aprovada pela IA</span>
                  </div>
                ) : (
                  <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{p.reason ?? "Foto reprovada pela IA."}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AudioStep({
  step,
  stepState,
  update,
}: {
  step: Step;
  stepState: StepState;
  update: (p: StepState) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (recording) {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recording]);

  const startRecording = () => {
    setSeconds(0);
    setRecording(true);
  };

  const stopRecording = () => {
    setRecording(false);
    update({
      audioRecorded: true,
      transcription: step.mockTranscription ?? "",
      transcriptionConfirmed: false,
    });
  };

  const importAudio = () => {
    update({
      audioRecorded: true,
      transcription: step.mockTranscription ?? "",
      transcriptionConfirmed: false,
    });
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  if (!stepState.audioRecorded) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-8">
        {recording ? (
          <>
            <div className="mx-auto flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Mic className="h-8 w-8" />
            </div>
            <p className="mt-3 text-center font-mono text-2xl font-semibold text-foreground">
              {mmss}
            </p>
            <p className="text-center text-xs text-muted-foreground">Gravando…</p>
            <Button
              onClick={stopRecording}
              variant="destructive"
              className="mt-5 h-11 w-full"
            >
              <Square className="h-4 w-4" /> Parar gravação
            </Button>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Mic className="h-8 w-8" />
            </div>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Grave um áudio ou importe um arquivo
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button onClick={startRecording} className="h-11">
                <Mic className="h-4 w-4" /> Gravar agora
              </Button>
              <Button onClick={importAudio} variant="outline" className="h-11">
                <ImageIcon className="h-4 w-4" /> Importar
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 p-3">
        <Check className="h-4 w-4 text-success" />
        <p className="text-sm font-medium text-success">Áudio recebido com sucesso.</p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Transcrição automática (revise se necessário)
        </label>
        <Textarea
          rows={5}
          value={stepState.transcription ?? ""}
          onChange={(e) =>
            update({ transcription: e.target.value, transcriptionConfirmed: false })
          }
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={!!stepState.transcriptionConfirmed}
          onChange={(e) => update({ transcriptionConfirmed: e.target.checked })}
          className="mt-0.5 h-4 w-4"
        />
        <span>Confirmo que a transcrição acima está correta.</span>
      </label>

      <button
        onClick={() => update({ audioRecorded: false, transcription: "", transcriptionConfirmed: false })}
        className="text-xs font-medium text-primary hover:underline"
      >
        Regravar áudio
      </button>
    </div>
  );
}

function TextStep({
  stepState,
  update,
}: {
  stepState: StepState;
  update: (p: StepState) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-muted-foreground">
        <TypeIcon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wider">Resposta em texto</span>
      </div>
      <Textarea
        rows={4}
        placeholder="Digite sua resposta aqui…"
        value={stepState.text ?? ""}
        onChange={(e) => update({ text: e.target.value })}
      />
    </div>
  );
}

function SuccessScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-6">
      <div className="max-w-md text-center">
        <div className="success-check mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/15 text-success">
          <Check className="h-10 w-10" strokeWidth={3} />
        </div>
        <h2 className="mt-6 text-2xl font-semibold text-foreground">
          Informações enviadas com sucesso.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Obrigado! Você já pode fechar esta página.
        </p>
      </div>
      <style>{`
        @keyframes pop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); } }
        .success-check { animation: pop 0.5s ease-out; }
      `}</style>
    </div>
  );
}
