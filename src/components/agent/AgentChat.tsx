import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2, Mic, Send, Square, Check, X, ChevronDown, Paperclip, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui-bits";
import { LumaSpin } from "@/components/ui/luma-spin";
import { supabase } from "@/integrations/supabase/client";
import { useGravacaoVoz } from "@/components/agent/use-gravacao-voz";
import { useConfiguracoesEmpresa } from "@/hooks/use-configuracoes-empresa";
import {
  getEstadoVistoria,
  finalizarVistoriaChat,
  listarMensagensChat,
  salvarMensagemChat,
  type EstadoVistoria,
} from "@/lib/vistoria-agent.functions";

// When rendered inside the authenticated app (with sidebar), offset the
// fixed composer so it centers within the main content area, not viewport.
const SIDEBAR_OFFSET_CLASS = "md:left-64";

type Props = {
  token?: string;
  casoId?: string;
  onFinalized?: () => void;
};

async function getCurrentAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function AgentChat({ token, casoId, onFinalized }: Props) {
  const { config } = useConfiguracoesEmpresa();
  const nomeEmpresa = config?.nome_empresa || "Ionics";

  const getEstado = useServerFn(getEstadoVistoria);
  const finalizar = useServerFn(finalizarVistoriaChat);
  const listarHistorico = useServerFn(listarMensagensChat);
  const salvarMensagem = useServerFn(salvarMensagemChat);

  const [estado, setEstado] = useState<EstadoVistoria | null>(null);
  const [estadoErro, setEstadoErro] = useState<string | null>(null);
  const [authErro, setAuthErro] = useState<string | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [finalizado, setFinalizado] = useState(false);
  const [historico, setHistorico] = useState<UIMessage[] | null>(null);
  const persistedIdsRef = useRef<Set<string>>(new Set());

  const refreshEstado = async () => {
    try {
      const e = await getEstado({ data: { token, casoId } });
      setEstado(e);
    } catch (err: any) {
      setEstadoErro(err?.message ?? "Erro ao carregar mapeamento.");
    }
  };

  useEffect(() => {
    refreshEstado();
    // Carregar histórico de mensagens do Supabase
    (async () => {
      try {
        const rows = await listarHistorico({ data: { token, casoId } });
        const msgs: UIMessage[] = rows.map((r) => {
          persistedIdsRef.current.add(r.id);
          return {
            id: r.id,
            role: r.role as UIMessage["role"],
            parts: Array.isArray(r.parts) ? r.parts : [],
          } as UIMessage;
        });
        setHistorico(msgs);
      } catch {
        setHistorico([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, casoId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/vistoria-chat",
        body: async () => {
          const accessToken = token ? null : await getCurrentAccessToken();
          return {
            ...(token ? { token } : {}),
            ...(casoId ? { casoId } : {}),
            ...(accessToken ? { accessToken } : {}),
          };
        },
        headers: async (): Promise<Record<string, string>> => {
          if (token) return {};
          const t = await getCurrentAccessToken();
          return t ? { Authorization: `Bearer ${t}` } : {};
        },
      }),
    [token, casoId],
  );

  // Mensagens iniciais: histórico persistido (se houver) ou saudação curta.
  const initialMessages = useMemo<UIMessage[]>(() => {
    if (!estado || historico === null) return [];
    if (historico.length > 0) return historico;
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
  }, [estado, historico, nomeEmpresa]);

  const { messages, sendMessage, status, error } = useChat({
    id: estado?.casoId ?? "vistoria",
    transport,
    messages: initialMessages,
    onFinish: ({ message }) => {
      // Persistir mensagem final do assistente
      if (message?.id && !persistedIdsRef.current.has(message.id)) {
        persistedIdsRef.current.add(message.id);
        void salvarMensagem({
          data: {
            token,
            casoId,
            role: "assistant",
            parts: message.parts as any,
          },
        }).catch(() => persistedIdsRef.current.delete(message.id));
      }
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
    if (historico === null) return;
    if (!token && casoId) {
      const accessToken = await getCurrentAccessToken();
      if (!accessToken) {
        setAuthErro("Sua sessão expirou. Entre novamente para continuar o mapeamento.");
        return;
      }
    }
    setAuthErro(null);
    setInput("");
    // Persistir mensagem do usuário no Supabase (não bloqueia o envio)
    void salvarMensagem({
      data: {
        token,
        casoId,
        role: "user",
        parts: [{ type: "text", text: t }],
      },
    }).catch(() => undefined);
    await sendMessage({ text: t });
  };

  const onTranscricao = (txt: string) => {
    if (!txt) return;
    setInput((cur) => (cur ? `${cur} ${txt}`.trim() : txt));
  };

  const fotoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  // Buffer de fotos para a pergunta atual (multi-foto). Permanece local até o
  // usuário clicar em "Não, continuar" — só então enviamos ao agente.
  const [fotosBuffer, setFotosBuffer] = useState<string[]>([]);
  const isFotoPergunta = estado?.proximaPerguntaTipo === "foto";
  const aguardandoMaisFotos = isFotoPergunta && fotosBuffer.length > 0;

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

      // Para perguntas de foto, acumulamos no buffer e mostramos os botões
      // de resposta rápida — não enviamos ao agente ainda.
      if (isFotoPergunta) {
        setFotosBuffer((prev) => [...prev, path]);
        return;
      }

      // Outros tipos (raro): comportamento antigo de envio imediato
      const fotoText = `[ANEXO_FOTO arquivo_path=${path} mime=${file.type}] Anexei uma foto para a pergunta atual.`;
      void salvarMensagem({
        data: { token, casoId, role: "user", parts: [{ type: "text", text: fotoText }] },
      }).catch(() => undefined);
      await sendMessage({ text: fotoText });
    } catch (e: any) {
      alert("Falha ao enviar foto: " + (e?.message ?? e));
    } finally {
      setUploadingFoto(false);
    }
  };

  const enviarFotosBuffer = async () => {
    if (fotosBuffer.length === 0 || !estado) return;
    const paths = fotosBuffer;
    setFotosBuffer([]);
    const fotoText =
      paths.length === 1
        ? `[ANEXO_FOTO arquivo_path=${paths[0]}] Anexei 1 foto para a pergunta atual. Salve com salvar_resposta e avance para a próxima pergunta.`
        : `[ANEXO_FOTOS arquivos_paths=${paths.join(",")}] Anexei ${paths.length} fotos para a pergunta atual. Salve TODAS no mesmo item chamando salvar_resposta uma única vez com arquivos_paths=[${paths.map((p) => `"${p}"`).join(",")}], confirme brevemente ("Fotos salvas. Vamos continuar.") e avance para a próxima pergunta.`;
    void salvarMensagem({
      data: { token, casoId, role: "user", parts: [{ type: "text", text: fotoText }] },
    }).catch(() => undefined);
    await sendMessage({ text: fotoText });
  };

  const descartarFotosBuffer = () => setFotosBuffer([]);

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

  if (!estado || historico === null) {
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
          <div className="flex min-w-0 items-center gap-2">
            {casoId && (
              <Link
                to="/app/minhas-vistorias"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Voltar ao agendamento"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            )}
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
          </div>

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
            <div className="flex flex-col items-center justify-center gap-4">
              <LumaSpin size={65} />
              <span className="text-sm text-muted-foreground">Pensando…</span>
            </div>
          ) : lastAssistantText ? (
            <div
              key={lastAssistant?.id}
              className="mx-auto max-w-2xl animate-fade-in whitespace-pre-wrap text-balance text-center text-2xl font-medium leading-relaxed text-foreground sm:text-3xl"
            >
              {lastAssistantText}
            </div>
          ) : null}

          {!busy && aguardandoMaisFotos && (
            <div className="mx-auto mt-8 max-w-md animate-fade-in">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="text-center text-sm font-medium text-foreground">
                  {fotosBuffer.length} foto{fotosBuffer.length > 1 ? "s" : ""} pronta{fotosBuffer.length > 1 ? "s" : ""} para envio.
                </p>
                <p className="mt-1 text-center text-sm text-muted-foreground">
                  Deseja anexar mais fotos para este item?
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={uploadingFoto}
                    className="min-h-[48px] flex-1 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {uploadingFoto ? "Enviando…" : "Sim, adicionar mais"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void enviarFotosBuffer()}
                    disabled={uploadingFoto}
                    className="min-h-[48px] flex-1 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    Não, continuar
                  </button>
                </div>
                <button
                  type="button"
                  onClick={descartarFotosBuffer}
                  className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-destructive"
                >
                  Descartar fotos
                </button>
              </div>
            </div>
          )}

          {(authErro || error) && (
            <div className="mx-auto mt-6 max-w-md rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
              {authErro || friendlyChatError(error?.message)}
            </div>
          )}
        </div>
      </main>

      {/* Composer */}
      <footer
        className={`fixed bottom-0 right-0 left-0 ${casoId ? SIDEBAR_OFFSET_CLASS : ""} z-10 bg-gradient-to-t from-background via-background to-transparent pb-4 pt-6`}
      >

        <div className="mx-auto w-full max-w-3xl px-4">
          <div className="flex items-end gap-1.5 rounded-3xl border border-border bg-card px-2 py-2 shadow-lg shadow-black/5">
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFotoSelecionada(f);
                e.target.value = "";
              }}
            />
            <input
              ref={cameraInputRef}
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
              title="Anexar arquivo"
              aria-label="Anexar arquivo da galeria"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              {uploadingFoto ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-5 w-5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={busy || uploadingFoto}
              title="Tirar foto"
              aria-label="Abrir câmera para tirar foto"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              <Camera className="h-5 w-5" />
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
              className="min-h-[44px] max-h-32 flex-1 resize-none bg-transparent px-1 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 sm:text-sm"
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
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
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

function friendlyChatError(message?: string) {
  if (!message) return "Não foi possível enviar sua resposta. Tente novamente.";
  if (message.includes("Não autenticado") || message.includes("Sessão inválida")) {
    return "Sua sessão expirou. Entre novamente para continuar a vistoria.";
  }
  return message;
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
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition ${
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
