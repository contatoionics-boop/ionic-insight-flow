import { Loader2, Mic, Square } from "lucide-react";
import { useGravacaoVoz } from "@/components/agent/use-gravacao-voz";

/**
 * Botão de microfone para preencher um campo via gravação de voz.
 * - Clique para iniciar/parar a gravação.
 * - O texto transcrito é repassado via onTranscricao (append por padrão).
 */
export function MicButton({
  onTranscricao,
  currentValue,
  mode = "append",
  className = "",
  title = "Preencher por voz",
}: {
  onTranscricao: (texto: string) => void;
  currentValue?: string | null;
  mode?: "append" | "replace";
  className?: string;
  title?: string;
}) {
  const { recording, transcrevendo, erro, start, stop, mmss } = useGravacaoVoz({
    token: "preview",
    onTranscricao: (texto) => {
      if (!texto) return;
      if (mode === "replace") {
        onTranscricao(texto);
      } else {
        const base = (currentValue ?? "").trim();
        onTranscricao(base ? `${base} ${texto}` : texto);
      }
    },
  });

  const disabled = transcrevendo;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={disabled}
        title={recording ? "Parar gravação" : title}
        className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs transition ${
          recording
            ? "border-destructive bg-destructive/10 text-destructive"
            : "border-input bg-card text-foreground hover:bg-muted"
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {transcrevendo ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Transcrevendo...
          </>
        ) : recording ? (
          <>
            <Square className="h-3.5 w-3.5 fill-current" />
            Parar • {mmss}
          </>
        ) : (
          <>
            <Mic className="h-3.5 w-3.5" />
            Voz
          </>
        )}
      </button>
      {erro && <span className="text-[11px] text-destructive">{erro}</span>}
    </div>
  );
}
