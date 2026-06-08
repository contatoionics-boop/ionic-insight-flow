import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2, Mic, Send, Square, Check, X, ChevronDown, Plus } from "lucide-react";

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
        headers: async (): Promise<Record<string, string>> => {
          if (token) return {};
          const { data } = await supabase.auth.getSession();
          const t = data.session?.access_token;
          return t ? { Authorization: `Bearer ${t}` } : {};
        },
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
            text: `Olá! Sou o assistente técnico da ${nomeEmpresa}.\n\nVamos iniciar o mapeamento técnico de ${estado.clienteNome}.\n\nEnvie qualquer mensagem para começar.`,
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

  useEffect(() => {
    inputRef.current?.focus();
  }, [status, messages.length]);

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
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <X className="mx-auto h-10 w-10 text-destructive" />
          <h2 className="mt-3 text-lg font-semibold text-foreground">Não foi possível abrir</h2>
          <p className="mt-1 text-sm text-muted-foreground">{estadoErro}</p>
        </div>
      </div>
    );
  }

  if (!estado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (finalizado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
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

  // Find last visible assistant message (ignore empty)
  const lastAssistant = [...messages]
    .reverse()
    .find(
      (m) =>
        m.role === "assistant" &&
        m.parts.some((p) => p.type === "text" && p.text.trim().length > 0),
    );
  const lastAssistantText = lastAssistant
    ? lastAssistant.parts
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("")
        .trim()
    : "";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-muted/60"
          >
            {config?.logo_url && (
              <img src={config.logo_url} alt={nomeEmpresa} className="h-6 w-auto object-contain" />
            )}
            <span className="truncate text-base font-semibold text-foreground">
              {nomeEmpresa}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>

          <div className="flex items-center gap-2">
            <span className="hidden max-w-[180px] truncate rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground sm:inline-block">
              {estado.clienteNome}
            </span>
            <Button
              variant="primary"
              onClick={handleFinalizar}
              disabled={finalizando}
              className="h-8 rounded-full px-4 text-xs"
            >
              {finalizando ? <Loader2 className="h-3 w-3 animate-spin" /> : "Finalizar"}
            </Button>
          </div>
        </div>
        <div className="h-0.5 w-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progresso}%` }}
          />
        </div>
      </header>

      {/* Main: only current question */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-6 pb-44 pt-8">
        <div className="w-full">
          {busy ? (
            <ShimmerText text="Pensando…" />
          ) : lastAssistantText ? (
            <div
              key={lastAssistant?.id}
              className="animate-fade-in whitespace-pre-wrap text-center text-2xl font-medium leading-relaxed text-foreground sm:text-3xl"
            >
              {lastAssistantText}
            </div>
          ) : null}

          {error && (
            <div className="mx-auto mt-6 max-w-md rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
              {error.message || "Erro na conversa. Tente novamente."}
            </div>
          )}
        </div>
      </main>

      {/* Composer */}
      <footer className="fixed bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-background via-background to-transparent pb-4 pt-6">
        <div className="mx-auto w-full max-w-3xl px-4">
          <div className="flex items-end gap-2 rounded-3xl border border-border bg-card px-2 py-2 shadow-lg shadow-black/5">
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
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              {uploadingFoto ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-5 w-5" />
              )}
            </button>

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
              placeholder="Responda à pergunta…"
              disabled={busy}
              className="min-h-[40px] max-h-32 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
            />

            {input.trim().length === 0 ? (
              <VoiceButton
                token={token ?? "preview"}
                current={input}
                onText={onTranscricao}
                disabled={busy}
              />
            ) : (
              <button
                type="button"
                onClick={() => void enviar(input)}
                disabled={busy}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            )}
          </div>

          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {estado.respondidas}/{estado.totalVisiveis} respondidas
            {estado.obrigatoriasFaltando > 0
              ? ` · ${estado.obrigatoriasFaltando} obrigatória(s) pendente(s)`
              : " · todas obrigatórias respondidas"}
          </p>
        </div>
      </footer>
    </div>
  );
}

function ShimmerText({ text }: { text: string }) {
  return (
    <div className="animate-fade-in text-center">
      <span className="bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_100%] bg-clip-text text-2xl font-medium text-transparent [animation:shimmer_2s_linear_infinite] sm:text-3xl">
        {text}
      </span>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
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
  const { recording, transcrevendo, start, stop } = useGravacaoVoz({
    token,
    onTranscricao: (txt) => {
      if (!txt) return;
      const base = (current ?? "").trim();
      onText(base ? `${base} ${txt}` : txt);
    },
  });
  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      disabled={disabled || transcrevendo}
      title={recording ? "Parar gravação" : "Gravar voz"}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
        recording
          ? "animate-pulse bg-destructive/10 text-destructive"
          : "text-muted-foreground hover:bg-muted"
      } disabled:opacity-50`}
    >
      {transcrevendo ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : recording ? (
        <Square className="h-4 w-4" />
      ) : (
        <Mic className="h-5 w-5" />
      )}
    </button>
  );
}
