import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2, Mic, Send, Square, Check, X, FileText } from "lucide-react";

import { Button } from "@/components/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import { useGravacaoVoz } from "@/components/agent/use-gravacao-voz";
import { useConfiguracoesEmpresa } from "@/hooks/use-configuracoes-empresa";
import {
  getEstadoVistoria,
  finalizarVistoriaChat,
  type EstadoVistoria,
} from "@/lib/vistoria-agent.functions";

type Props = {
  /** Either token (public link) OR casoId (authenticated). */
  token?: string;
  casoId?: string;
  onFinalized?: () => void;
};

export function AgentChat({ token, casoId, onFinalized }: Props) {
  const { config } = useConfiguracoesEmpresa();
  const nomeEmpresa = config?.nome_empresa || "Ionics";

  const getEstado = useServerFn(getEstadoVistoria);
  const finalizar = useServerFn(finalizarVistoriaChat);

  const [estado, setEstado] = useState<EstadoVistoria | null>(null);
  const [estadoErro, setEstadoErro] = useState<string | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [finalizado, setFinalizado] = useState(false);

  const refreshEstado = async () => {
    try {
      const e = await getEstado({ data: { token, casoId } });
      setEstado(e);
    } catch (err: any) {
      setEstadoErro(err?.message ?? "Erro ao carregar vistoria.");
    }
  };

  useEffect(() => {
    refreshEstado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, casoId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/vistoria-chat",
        body: { token, casoId },
      }),
    [token, casoId],
  );

  const initialGreeting = useMemo<UIMessage[]>(() => {
    if (!estado) return [];
    return [
      {
        id: "greeting",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: `Olá. Sou o assistente técnico da ${nomeEmpresa}. Vamos conduzir o mapeamento técnico de **${estado.clienteNome}** utilizando o formulário **${estado.formularioNome}**.\n\nPor favor, responda às próximas perguntas por texto, voz (microfone) ou foto (câmera). Quando estiver pronto para começar, envie qualquer mensagem (por exemplo: "Pronto" ou "Vamos lá").`,
          },
        ],
      },
    ];
  }, [estado, nomeEmpresa]);

  const { messages, sendMessage, status, error } = useChat({
    id: estado?.casoId ?? "vistoria",
    transport,
    messages: initialGreeting,
    onFinish: () => {
      void refreshEstado();
    },
  });

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [status]);

  const busy = status === "submitted" || status === "streaming";

  const enviar = async (texto: string) => {
    const t = texto.trim();
    if (!t || busy) return;
    setInput("");
    await sendMessage({ text: t });
  };

  const onTranscricao = (txt: string) => {
    if (!txt) return;
    setInput((cur) => (cur ? `${cur} ${txt}`.trim() : txt));
  };

  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const onFotoSelecionada = async (file: File) => {
    if (!estado) return;
    setUploadingFoto(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `casos/${estado.casoId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("agente-uploads")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      await sendMessage({
        text: `[ANEXO_FOTO arquivo_path=${path} mime=${file.type}] Anexei uma foto para a pergunta atual.`,
      });
    } catch (e: any) {
      alert("Falha ao enviar foto: " + (e?.message ?? e));
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleFinalizar = async () => {
    if (!estado) return;
    if (estado.obrigatoriasFaltando > 0) {
      const ok = confirm(
        `Ainda há ${estado.obrigatoriasFaltando} pergunta(s) obrigatória(s) sem resposta. Finalizar mesmo assim?`,
      );
      if (!ok) return;
    }
    setFinalizando(true);
    try {
      await finalizar({ data: { token, casoId } });
      setFinalizado(true);
      onFinalized?.();
    } catch (e: any) {
      alert("Erro ao finalizar: " + (e?.message ?? e));
    } finally {
      setFinalizando(false);
    }
  };

  if (estadoErro && !estado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <div className="max-w-md rounded-lg border border-border bg-white p-6 text-center">
          <X className="mx-auto h-10 w-10 text-destructive" />
          <h2 className="mt-3 text-lg font-semibold text-foreground">Não foi possível abrir</h2>
          <p className="mt-1 text-sm text-muted-foreground">{estadoErro}</p>
        </div>
      </div>
    );
  }

  if (!estado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (finalizado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/15 text-success">
            <Check className="h-10 w-10" strokeWidth={3} />
          </div>
          <h2 className="mt-6 text-2xl font-semibold text-foreground">
            Mapeamento finalizado.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            As respostas foram enviadas para revisão técnica.
          </p>
        </div>
      </div>
    );
  }

  const progresso =
    estado.totalVisiveis > 0
      ? Math.round((estado.respondidas / estado.totalVisiveis) * 100)
      : 0;

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="sticky top-0 z-20 border-b border-border bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {config?.logo_url && (
              <img src={config.logo_url} alt={nomeEmpresa} className="h-7 w-auto object-contain" />
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-bold leading-tight text-primary">
                {nomeEmpresa}
              </p>
              <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                {estado.clienteNome} · {estado.formularioNome || "Mapeamento"}
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">
              {estado.respondidas}/{estado.totalVisiveis}
            </p>
            <p>respondidas</p>
          </div>
        </div>
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progresso}%` }}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-3 py-4 pb-48 sm:px-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}

        {status === "submitted" && <TypingIndicator />}

        {error && (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error.message || "Erro na conversa. Tente novamente."}
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-10 border-t border-border bg-white">
        <div className="mx-auto w-full max-w-2xl px-3 py-3 sm:px-4">
          <div className="flex items-end gap-2">
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFotoSelecionada(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fotoInputRef.current?.click()}
              disabled={busy || uploadingFoto}
              title="Anexar foto"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              {uploadingFoto ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </button>

            <VoiceButton
              token={token ?? "preview"}
              current={input}
              onText={onTranscricao}
              disabled={busy}
            />

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void enviar(input);
                }
              }}
              rows={1}
              placeholder="Responda por texto, voz ou foto…"
              disabled={busy}
              className="min-h-[44px] max-h-32 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
            />

            <button
              type="button"
              onClick={() => void enviar(input)}
              disabled={busy || !input.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {estado.obrigatoriasFaltando === 0
                ? "Todas as obrigatórias respondidas."
                : `${estado.obrigatoriasFaltando} obrigatória(s) pendente(s).`}
            </span>
            <Button
              variant="outline"
              onClick={handleFinalizar}
              disabled={finalizando}
              className="h-8 text-xs"
            >
              {finalizando ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <FileText className="h-3 w-3" /> Finalizar mapeamento
                </>
              )}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();

  // Strip internal anexo markers from user-visible text
  const display = isUser ? text.replace(/\[ANEXO_FOTO[^\]]+\]\s*/g, "📷 ").trim() : text;

  if (!display && !isUser) return null;

  if (isUser) {
    return (
      <div className="mb-3 flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {display || "…"}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3 flex items-start gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
        IA
      </div>
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm border border-border bg-white px-4 py-2.5 text-sm text-foreground">
        {display}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="mb-3 flex items-start gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
        IA
      </div>
      <div className="rounded-2xl rounded-tl-sm border border-border bg-white px-4 py-3">
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
        </div>
      </div>
    </div>
  );
}

function VoiceButton({
  token,
  current,
  onText,
  disabled,
}: {
  token: string;
  current: string;
  onText: (t: string) => void;
  disabled?: boolean;
}) {
  const { recording, transcrevendo, erro, start, stop, mmss } = useGravacaoVoz({
    token,
    onTranscricao: (txt) => {
      if (!txt) return;
      const base = (current ?? "").trim();
      onText(base ? `${base} ${txt}` : txt);
    },
  });
  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={disabled || transcrevendo}
        title={recording ? "Parar gravação" : "Gravar voz"}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md border transition ${
          recording
            ? "animate-pulse border-destructive bg-destructive/10 text-destructive"
            : "border-border bg-background text-muted-foreground hover:bg-muted"
        } disabled:opacity-50`}
      >
        {transcrevendo ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : recording ? (
          <Square className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>
      {recording && <span className="font-mono text-[10px] text-destructive">{mmss}</span>}
      {erro && <span className="max-w-[120px] truncate text-[10px] text-destructive">{erro}</span>}
    </div>
  );
}
