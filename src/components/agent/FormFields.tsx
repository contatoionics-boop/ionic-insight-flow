import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Camera,
  Check,
  Loader2,
  Mic,
  Pencil,
  Square,
  X,
} from "lucide-react";

import { Button, Card, Textarea } from "@/components/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import { transcreverAudio, validarFoto } from "@/lib/agent-ai.functions";

export type TipoPergunta =
  | "texto"
  | "numero"
  | "foto"
  | "audio"
  | "checkbox"
  | "data"
  | "selecao_unica"
  | "toggle"
  | "cep"
  | "cnpj";

export type Pergunta = {
  id: string;
  secao_id: string;
  texto: string;
  tipo: TipoPergunta;
  obrigatoria: boolean;
  ordem: number;
  instrucao_agente: string | null;
  contexto_ia: string | null;
  opcoes?: { id: string; texto: string }[];
};

export type IaResultado = {
  status: "aprovada" | "parcial" | "incorreta";
  descricao_encontrada: string;
  problemas: string[];
  orientacao: string;
};

export type Resposta = {
  text?: string;
  filePath?: string;
  fileName?: string;
  filePreview?: string;
  ia?: IaResultado;
  iaConfirmada?: boolean;
  audioPath?: string;
  transcription?: string;
  transcriptionConfirmed?: boolean;
};

export type RendererMode = "live" | "preview";

async function fileToBase64(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function isComplete(p: Pergunta, r: Resposta, mode: RendererMode = "live"): boolean {
  if (!p.obrigatoria) return true;
  switch (p.tipo) {
    case "foto":
      if (mode === "preview") return !!r.filePreview;
      if (!r.filePath || !r.ia) return false;
      if (r.ia.status === "incorreta") return false;
      if (r.ia.status === "parcial" && !r.iaConfirmada) return false;
      return true;
    case "audio":
      if (mode === "preview") return !!r.transcription?.trim() || !!r.audioPath;
      return !!r.audioPath && !!r.transcription?.trim() && !!r.transcriptionConfirmed;
    default:
      return !!r.text?.trim();
  }
}

export function PerguntaBloco({
  pergunta,
  casoId,
  token,
  resposta,
  update,
  mode,
}: {
  pergunta: Pergunta;
  casoId: string;
  token: string;
  resposta: Resposta;
  update: (patch: Partial<Resposta>) => void;
  mode: RendererMode;
}) {
  return (
    <Card>
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">
          {pergunta.texto}
          {pergunta.obrigatoria && <span className="ml-1 text-destructive">*</span>}
        </h3>
      </div>
      {pergunta.instrucao_agente && (
        <p className="mb-3 text-xs text-muted-foreground">{pergunta.instrucao_agente}</p>
      )}
      {mode === "preview" && pergunta.contexto_ia && (pergunta.tipo === "foto" || pergunta.tipo === "audio") && (
        <p className="mb-3 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Contexto IA:</span> {pergunta.contexto_ia}
        </p>
      )}

      {pergunta.tipo === "texto" && (
        <Textarea
          rows={3}
          placeholder="Digite sua resposta…"
          value={resposta.text ?? ""}
          onChange={(e) => update({ text: e.target.value })}
        />
      )}

      {pergunta.tipo === "numero" && (
        <input
          type="number"
          inputMode="decimal"
          className="w-full rounded-md border border-border bg-background px-3 py-3 text-base"
          placeholder="0"
          value={resposta.text ?? ""}
          onChange={(e) => update({ text: e.target.value })}
        />
      )}

      {pergunta.tipo === "data" && (
        <input
          type="date"
          className="w-full rounded-md border border-border bg-background px-3 py-3 text-base"
          value={resposta.text ?? ""}
          onChange={(e) => update({ text: e.target.value })}
        />
      )}

      {pergunta.tipo === "toggle" && (
        <div className="grid grid-cols-2 gap-3">
          {(["sim", "nao"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => update({ text: v })}
              className={`h-12 rounded-md border text-sm font-semibold transition ${
                resposta.text === v
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {v === "sim" ? "Sim" : "Não"}
            </button>
          ))}
        </div>
      )}

      {pergunta.tipo === "selecao_unica" && (
        <div className="space-y-2">
          {(pergunta.opcoes ?? []).map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => update({ text: o.texto })}
              className={`block w-full rounded-md border px-4 py-3 text-left text-sm transition ${
                resposta.text === o.texto
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              {o.texto}
            </button>
          ))}
        </div>
      )}

      {pergunta.tipo === "checkbox" && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={resposta.text === "sim"}
            onChange={(e) => update({ text: e.target.checked ? "sim" : "" })}
            className="mt-0.5 h-4 w-4"
          />
          <span>Confirmo</span>
        </label>
      )}

      {pergunta.tipo === "foto" && (
        <CampoFoto pergunta={pergunta} casoId={casoId} token={token} resposta={resposta} update={update} mode={mode} />
      )}

      {pergunta.tipo === "audio" && (
        <CampoAudio casoId={casoId} token={token} resposta={resposta} update={update} mode={mode} />
      )}
    </Card>
  );
}

function CampoFoto({
  pergunta,
  casoId,
  token,
  resposta,
  update,
  mode,
}: {
  pergunta: Pergunta;
  casoId: string;
  token: string;
  resposta: Resposta;
  update: (patch: Partial<Resposta>) => void;
  mode: RendererMode;
}) {
  const [uploading, setUploading] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const validarFn = useServerFn(validarFoto);

  const enviar = async (file: File) => {
    setErr(null);
    if (mode === "preview") {
      const preview = URL.createObjectURL(file);
      update({ filePath: "preview", fileName: file.name, filePreview: preview, ia: undefined, iaConfirmada: true });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${casoId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("agente-uploads").upload(path, file, { upsert: false });
      if (error) throw error;
      const preview = URL.createObjectURL(file);
      update({ filePath: path, fileName: file.name, filePreview: preview, ia: undefined, iaConfirmada: false });
      setUploading(false);

      setAnalisando(true);
      const base64 = await fileToBase64(file);
      const ia = (await validarFn({
        data: { token, perguntaId: pergunta.id, imagemBase64: base64, mime: file.type || "image/jpeg" },
      })) as IaResultado;
      update({ ia, iaConfirmada: ia.status === "aprovada" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao processar foto.");
    } finally {
      setUploading(false);
      setAnalisando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const ia = resposta.ia;
  const badge =
    ia?.status === "aprovada"
      ? { color: "bg-success/15 text-success border-success/30", icon: <Check className="h-4 w-4" />, label: "Foto aprovada pela IA" }
      : ia?.status === "parcial"
      ? { color: "bg-warning/15 text-warning-foreground border-warning/30", icon: <AlertTriangle className="h-4 w-4" />, label: "Atenção — revisar" }
      : ia?.status === "incorreta"
      ? { color: "bg-destructive/15 text-destructive border-destructive/30", icon: <X className="h-4 w-4" />, label: "Foto não atende" }
      : null;

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && enviar(e.target.files[0])}
      />

      {!resposta.filePath ? (
        <Button onClick={() => inputRef.current?.click()} className="h-12 w-full" disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Camera className="h-4 w-4" /> Tirar / enviar foto</>}
        </Button>
      ) : (
        <>
          {resposta.filePreview && (
            <img src={resposta.filePreview} alt="Foto enviada" className="w-full rounded-md border border-border object-cover" />
          )}
          {analisando && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Analisando imagem com IA…
            </div>
          )}
          {badge && (
            <div className={`rounded-md border px-3 py-2 text-sm ${badge.color}`}>
              <div className="flex items-center gap-2 font-medium">
                {badge.icon} {badge.label}
              </div>
              {ia && ia.orientacao && <p className="mt-1 text-xs">{ia.orientacao}</p>}
              {ia && ia.problemas.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-xs">
                  {ia.problemas.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              )}
              {ia?.status === "parcial" && !resposta.iaConfirmada && (
                <button
                  onClick={() => update({ iaConfirmada: true })}
                  className="mt-2 text-xs font-semibold underline"
                >
                  Avançar mesmo assim
                </button>
              )}
            </div>
          )}
          {mode === "preview" && (
            <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Modo preview — IA não é executada.
            </div>
          )}
          <Button variant="outline" onClick={() => inputRef.current?.click()} className="h-10 w-full" disabled={uploading || analisando}>
            <Camera className="h-4 w-4" /> Reenviar foto
          </Button>
        </>
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

function CampoAudio({
  casoId,
  token,
  resposta,
  update,
  mode,
}: {
  casoId: string;
  token: string;
  resposta: Resposta;
  update: (patch: Partial<Resposta>) => void;
  mode: RendererMode;
}) {
  const [modo, setModo] = useState<"gravar" | "texto">(resposta.transcription && !resposta.audioPath ? "texto" : "gravar");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transcreverFn = useServerFn(transcreverAudio);

  useEffect(() => {
    if (recording) timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recording]);

  const enviarBlob = async (blob: Blob, ext: string) => {
    if (mode === "preview") {
      update({ audioPath: "preview", transcription: "(modo preview — sem transcrição)", transcriptionConfirmed: true });
      return;
    }
    setUploading(true);
    setErr(null);
    try {
      const path = `${casoId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("agente-uploads").upload(path, blob, { upsert: false });
      if (error) throw error;
      update({ audioPath: path, transcription: "", transcriptionConfirmed: false });
      setUploading(false);

      setTranscrevendo(true);
      const base64 = await fileToBase64(blob);
      try {
        const r = (await transcreverFn({
          data: { token, audioBase64: base64, mime: blob.type || `audio/${ext}` },
        })) as { transcricao: string };
        update({ transcription: r.transcricao });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Falha na transcrição. Você pode digitar manualmente.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao enviar áudio.");
    } finally {
      setUploading(false);
      setTranscrevendo(false);
    }
  };

  const start = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await enviarBlob(blob, "webm");
      };
      recorderRef.current = rec;
      setSeconds(0);
      rec.start();
      setRecording(true);
    } catch {
      setErr("Permissão de microfone negada ou indisponível.");
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setModo("gravar")}
          className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium ${
            modo === "gravar" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"
          }`}
        >
          <Mic className="mr-1 inline h-3.5 w-3.5" /> Gravar áudio
        </button>
        <button
          type="button"
          onClick={() => setModo("texto")}
          className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium ${
            modo === "texto" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"
          }`}
        >
          <Pencil className="mr-1 inline h-3.5 w-3.5" /> Prefiro digitar
        </button>
      </div>

      {modo === "gravar" ? (
        <>
          {!resposta.audioPath && !recording && (
            <Button onClick={start} className="h-12 w-full" disabled={uploading}>
              <Mic className="h-4 w-4" /> Iniciar gravação
            </Button>
          )}
          {recording && (
            <div className="rounded-md border-2 border-destructive/30 bg-destructive/5 p-4 text-center">
              <div className="mx-auto flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-destructive/20 text-destructive">
                <Mic className="h-6 w-6" />
              </div>
              <p className="mt-2 font-mono text-xl font-semibold">{mmss}</p>
              <p className="text-xs text-muted-foreground">Gravando…</p>
              <Button onClick={stop} variant="destructive" className="mt-3 h-10 w-full">
                <Square className="h-4 w-4" /> Parar
              </Button>
            </div>
          )}
          {resposta.audioPath && !recording && (
            <>
              {transcrevendo && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Transcrevendo com IA…
                </div>
              )}
              <Textarea
                rows={4}
                placeholder="Transcrição (edite se necessário)…"
                value={resposta.transcription ?? ""}
                onChange={(e) => update({ transcription: e.target.value, transcriptionConfirmed: false })}
              />
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!resposta.transcriptionConfirmed}
                  onChange={(e) => update({ transcriptionConfirmed: e.target.checked })}
                  className="mt-0.5 h-4 w-4"
                />
                <span>Confirmo que a transcrição está correta.</span>
              </label>
              <button
                onClick={() => update({ audioPath: undefined, transcription: "", transcriptionConfirmed: false })}
                className="text-xs font-medium text-primary hover:underline"
              >
                Regravar
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <Textarea
            rows={4}
            placeholder="Digite a descrição…"
            value={resposta.transcription ?? ""}
            onChange={(e) => update({ transcription: e.target.value, audioPath: undefined, transcriptionConfirmed: true })}
          />
        </>
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
