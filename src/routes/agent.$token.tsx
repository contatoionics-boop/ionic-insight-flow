import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import logo from "@/assets/ionics-logo.png";
import { Button, Textarea, Card } from "@/components/ui-bits";
import { supabase } from "@/integrations/supabase/client";
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
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/agent/$token")({
  component: AgentPage,
});

type TipoPergunta = "texto" | "numero" | "foto" | "audio" | "checkbox";

type Pergunta = {
  id: string;
  texto: string;
  tipo: TipoPergunta;
  obrigatoria: boolean;
  ordem: number;
  instrucao_agente: string | null;
  contexto_ia: string | null;
  secao_titulo: string;
};

type Contexto = {
  casoId: string;
  clienteNome: string;
  formularioNome: string;
  perguntas: Pergunta[];
};

type Resposta = {
  text?: string;
  files?: { id: string; path: string; name: string }[];
  audioPath?: string;
  transcription?: string;
  transcriptionConfirmed?: boolean;
};

function AgentPage() {
  const { token } = Route.useParams();
  const [ctx, setCtx] = useState<Contexto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
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
          .select("id, formulario_id, cliente:clientes(nome), formulario:formularios(nome)")
          .eq("id", link.caso_id)
          .maybeSingle();
        if (cErr) throw cErr;
        if (!caso || !caso.formulario_id)
          throw new Error("Caso sem formulário associado.");

        const { data: secoes, error: sErr } = await supabase
          .from("secoes")
          .select("id, titulo, ordem")
          .eq("formulario_id", caso.formulario_id)
          .order("ordem");
        if (sErr) throw sErr;

        const secoesIds = (secoes ?? []).map((s) => s.id);
        const { data: perguntas, error: pErr } = secoesIds.length
          ? await supabase
              .from("perguntas")
              .select("id, secao_id, texto, tipo, obrigatoria, ordem, instrucao_agente, contexto_ia")
              .in("secao_id", secoesIds)
              .order("ordem")
          : { data: [], error: null };
        if (pErr) throw pErr;

        const tituloPorSecao = new Map((secoes ?? []).map((s) => [s.id, s.titulo]));
        const lista: Pergunta[] = (perguntas ?? []).map((p) => ({
          id: p.id,
          texto: p.texto,
          tipo: p.tipo as TipoPergunta,
          obrigatoria: p.obrigatoria,
          ordem: p.ordem,
          instrucao_agente: p.instrucao_agente,
          contexto_ia: p.contexto_ia,
          secao_titulo: tituloPorSecao.get(p.secao_id) ?? "",
        }));

        setCtx({
          casoId: caso.id,
          clienteNome: caso.cliente?.nome ?? "",
          formularioNome: caso.formulario?.nome ?? "",
          perguntas: lista,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar link.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const total = ctx?.perguntas.length ?? 0;
  const pergunta = ctx?.perguntas[current];
  const respostaAtual = pergunta ? state[pergunta.id] ?? {} : {};
  const canAdvance = pergunta ? isComplete(pergunta, respostaAtual) : false;
  const isLast = current === total - 1;
  const progress = total === 0 ? 0 : Math.round(((current + (canAdvance ? 1 : 0)) / total) * 100);

  const update = (patch: Resposta) => {
    if (!pergunta) return;
    setState((s) => ({ ...s, [pergunta.id]: { ...s[pergunta.id], ...patch } }));
  };

  const next = async () => {
    if (isLast) {
      await submitAll();
    } else {
      setCurrent((c) => c + 1);
    }
  };

  const submitAll = async () => {
    if (!ctx) return;
    setSubmitting(true);
    try {
      const rows = ctx.perguntas.map((p) => {
        const r = state[p.id] ?? {};
        const arquivo_path =
          p.tipo === "foto" ? r.files?.[0]?.path ?? null : p.tipo === "audio" ? r.audioPath ?? null : null;
        return {
          caso_id: ctx.casoId,
          pergunta_id: p.id,
          tipo: p.tipo,
          valor_texto: r.text ?? null,
          arquivo_path,
          transcricao: p.tipo === "audio" ? r.transcription ?? null : null,
          ia_aprovado: null,
          ia_motivo: null,
        };
      });
      const { error: insErr } = await supabase.from("respostas_agente").insert(rows);
      if (insErr) throw insErr;
      await supabase.from("links_agente").update({ utilizado_em: new Date().toISOString() }).eq("token", token);
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

  if (!ctx || !pergunta) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <Card className="max-w-md text-center">
          <p className="text-sm text-muted-foreground">Este formulário ainda não possui perguntas configuradas.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-20 border-b border-border bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <img src={logo} alt="IONICS" className="h-7 w-auto" />
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
            Etapa {current + 1} de {total}
          </span>
          <span className="text-muted-foreground">{progress}% concluído</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 pb-32">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">{pergunta.secao_titulo}</p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">{pergunta.texto}</h1>
        {pergunta.instrucao_agente && (
          <p className="mt-2 text-sm text-muted-foreground">{pergunta.instrucao_agente}</p>
        )}

        <div className="mt-6">
          {pergunta.tipo === "foto" && (
            <PhotoStep casoId={ctx.casoId} resposta={respostaAtual} update={update} />
          )}
          {pergunta.tipo === "audio" && (
            <AudioStep casoId={ctx.casoId} resposta={respostaAtual} update={update} />
          )}
          {(pergunta.tipo === "texto" || pergunta.tipo === "numero" || pergunta.tipo === "checkbox") && (
            <TextStep tipo={pergunta.tipo} resposta={respostaAtual} update={update} />
          )}
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 border-t border-border bg-white">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <Button onClick={next} disabled={!canAdvance || submitting} className="h-12 w-full text-base">
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isLast ? (
              <>
                <Send className="h-4 w-4" /> Enviar informações
              </>
            ) : (
              <>
                Próxima etapa <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
}

function isComplete(p: Pergunta, r: Resposta): boolean {
  if (!p.obrigatoria) return true;
  if (p.tipo === "foto") return !!r.files && r.files.length > 0;
  if (p.tipo === "audio") return !!r.audioPath && !!r.transcriptionConfirmed && !!r.transcription?.trim();
  return !!r.text?.trim();
}

function PhotoStep({
  casoId,
  resposta,
  update,
}: {
  casoId: string;
  resposta: Resposta;
  update: (p: Resposta) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const files = resposta.files ?? [];

  const onFiles = async (list: FileList | null) => {
    if (!list || !list.length) return;
    setUploading(true);
    setErr(null);
    try {
      const novos: { id: string; path: string; name: string }[] = [];
      for (const f of Array.from(list)) {
        const ext = f.name.split(".").pop() || "jpg";
        const path = `${casoId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("agente-uploads").upload(path, f, { upsert: false });
        if (error) throw error;
        novos.push({ id: path, path, name: f.name });
      }
      update({ files: [...files, ...novos] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao enviar foto.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = (path: string) => update({ files: files.filter((f) => f.path !== path) });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Camera className="h-8 w-8" />
        </div>
        <p className="mt-3 text-center text-sm text-muted-foreground">Capture ou importe uma foto</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        <Button
          onClick={() => inputRef.current?.click()}
          className="mt-5 h-11 w-full"
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Camera className="h-4 w-4" /> Adicionar foto</>}
        </Button>
        {err && <p className="mt-2 text-center text-xs text-destructive">{err}</p>}
      </div>

      {files.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Fotos enviadas ({files.length})
          </p>
          {files.map((f, i) => (
            <div key={f.path} className="flex gap-3 rounded-lg border border-border bg-card p-3">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <ImageIcon className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">Foto #{i + 1}</p>
                  <button
                    onClick={() => remove(f.path)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-1 flex items-center gap-1 text-xs text-success">
                  <Check className="h-3.5 w-3.5" /> Enviada
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AudioStep({
  casoId,
  resposta,
  update,
}: {
  casoId: string;
  resposta: Resposta;
  update: (p: Resposta) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const uploadBlob = async (blob: Blob, ext: string) => {
    setUploading(true);
    try {
      const path = `${casoId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("agente-uploads").upload(path, blob, { upsert: false });
      if (error) throw error;
      update({ audioPath: path, transcription: "", transcriptionConfirmed: false });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao enviar áudio.");
    } finally {
      setUploading(false);
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
        await uploadBlob(blob, "webm");
      };
      recorderRef.current = rec;
      setSeconds(0);
      rec.start();
      setRecording(true);
    } catch (e) {
      setErr("Permissão de microfone negada ou indisponível.");
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const onFile = async (list: FileList | null) => {
    if (!list || !list[0]) return;
    const f = list[0];
    const ext = f.name.split(".").pop() || "m4a";
    await uploadBlob(f, ext);
    if (inputRef.current) inputRef.current.value = "";
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  if (!resposta.audioPath) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-8">
        {recording ? (
          <>
            <div className="mx-auto flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Mic className="h-8 w-8" />
            </div>
            <p className="mt-3 text-center font-mono text-2xl font-semibold text-foreground">{mmss}</p>
            <p className="text-center text-xs text-muted-foreground">Gravando…</p>
            <Button onClick={stop} variant="destructive" className="mt-5 h-11 w-full">
              <Square className="h-4 w-4" /> Parar gravação
            </Button>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Mic className="h-8 w-8" />
            </div>
            <p className="mt-3 text-center text-sm text-muted-foreground">Grave um áudio ou importe um arquivo</p>
            <input
              ref={inputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => onFile(e.target.files)}
            />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button onClick={start} className="h-11" disabled={uploading}>
                <Mic className="h-4 w-4" /> Gravar
              </Button>
              <Button
                onClick={() => inputRef.current?.click()}
                variant="outline"
                className="h-11"
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ImageIcon className="h-4 w-4" /> Importar</>}
              </Button>
            </div>
          </>
        )}
        {err && <p className="mt-2 text-center text-xs text-destructive">{err}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 p-3">
        <Check className="h-4 w-4 text-success" />
        <p className="text-sm font-medium text-success">Áudio enviado com sucesso.</p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Transcrição (digite ou cole)
        </label>
        <Textarea
          rows={5}
          placeholder="Descreva por escrito o conteúdo do áudio…"
          value={resposta.transcription ?? ""}
          onChange={(e) => update({ transcription: e.target.value, transcriptionConfirmed: false })}
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={!!resposta.transcriptionConfirmed}
          onChange={(e) => update({ transcriptionConfirmed: e.target.checked })}
          className="mt-0.5 h-4 w-4"
        />
        <span>Confirmo que a transcrição acima está correta.</span>
      </label>

      <button
        onClick={() => update({ audioPath: undefined, transcription: "", transcriptionConfirmed: false })}
        className="text-xs font-medium text-primary hover:underline"
      >
        Regravar áudio
      </button>
    </div>
  );
}

function TextStep({
  tipo,
  resposta,
  update,
}: {
  tipo: TipoPergunta;
  resposta: Resposta;
  update: (p: Resposta) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-muted-foreground">
        <TypeIcon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wider">
          {tipo === "numero" ? "Resposta numérica" : tipo === "checkbox" ? "Confirmação" : "Resposta em texto"}
        </span>
      </div>
      <Textarea
        rows={4}
        placeholder="Digite sua resposta aqui…"
        value={resposta.text ?? ""}
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
