import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button, Textarea, Card } from "@/components/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import { validarFoto, transcreverAudio, finalizarEnvio } from "@/lib/agent-ai.functions";
import {
  Camera,
  Mic,
  Square,
  Check,
  X,
  ArrowRight,
  ArrowLeft,
  Send,
  Loader2,
  AlertTriangle,
  Pencil,
} from "lucide-react";

export const Route = createFileRoute("/agent/$token")({
  component: AgentPage,
});

type TipoPergunta =
  | "texto"
  | "numero"
  | "foto"
  | "audio"
  | "checkbox"
  | "data"
  | "selecao_unica"
  | "toggle";

type Pergunta = {
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

type Secao = { id: string; titulo: string; ordem: number; descricao: string | null };

type Contexto = {
  casoId: string;
  clienteNome: string;
  formularioNome: string;
  secoes: Secao[];
  perguntasPorSecao: Record<string, Pergunta[]>;
};

type IaResultado = {
  status: "aprovada" | "parcial" | "incorreta";
  descricao_encontrada: string;
  problemas: string[];
  orientacao: string;
};

type Resposta = {
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

function AgentPage() {
  const { token } = Route.useParams();
  const [ctx, setCtx] = useState<Contexto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0); // 0..(secoes.length-1) seções, último = revisão
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

        // Hidratar rascunho existente
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

  const totalSteps = (ctx?.secoes.length ?? 0) + 1; // +1 revisão
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

  const submitAll = async () => {
    if (!ctx) return;
    setSubmitting(true);
    setError(null);
    try {
      // Salva tudo de novo por garantia
      const todas = Object.values(ctx.perguntasPorSecao).flat();
      await saveSection(todas);
      await supabase
        .from("links_agente")
        .update({ utilizado_em: new Date().toISOString() })
        .eq("token", token);
      await supabase.from("casos").update({ status: "aguardando_revisao" }).eq("id", ctx.casoId);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar respostas.");
    } finally {
      setSubmitting(false);
    }
  };

  const sectionComplete = useMemo(() => {
    return perguntasAtuais.every((p) => isComplete(p, state[p.id] ?? {}));
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

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-20 border-b border-border bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <span className="text-lg font-bold tracking-tight text-primary">IONIX</span>
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

function isComplete(p: Pergunta, r: Resposta): boolean {
  if (!p.obrigatoria) return true;
  switch (p.tipo) {
    case "foto":
      if (!r.filePath || !r.ia) return false;
      if (r.ia.status === "incorreta") return false;
      if (r.ia.status === "parcial" && !r.iaConfirmada) return false;
      return true;
    case "audio":
      return !!r.audioPath && !!r.transcription?.trim() && !!r.transcriptionConfirmed;
    case "checkbox":
    case "toggle":
    case "selecao_unica":
    case "data":
    case "numero":
    case "texto":
    default:
      return !!r.text?.trim();
  }
}

function PerguntaBloco({
  pergunta,
  casoId,
  token,
  resposta,
  update,
}: {
  pergunta: Pergunta;
  casoId: string;
  token: string;
  resposta: Resposta;
  update: (patch: Partial<Resposta>) => void;
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
        <CampoFoto pergunta={pergunta} casoId={casoId} token={token} resposta={resposta} update={update} />
      )}

      {pergunta.tipo === "audio" && (
        <CampoAudio casoId={casoId} token={token} resposta={resposta} update={update} />
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
}: {
  pergunta: Pergunta;
  casoId: string;
  token: string;
  resposta: Resposta;
  update: (patch: Partial<Resposta>) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const validarFn = useServerFn(validarFoto);

  const enviar = async (file: File) => {
    setErr(null);
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
}: {
  casoId: string;
  token: string;
  resposta: Resposta;
  update: (patch: Partial<Resposta>) => void;
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
