import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, RefreshCw, Send, Sparkles, User2 } from "lucide-react";
import { PageHeader, Button, Card } from "@/components/ui-bits";

export const Route = createFileRoute("/app/agente-ia")({
  ssr: false,
  component: AgenteIaPage,
});

const STORAGE_KEY = "app.agente-ia.messages.v1";
const CHAT_ID = "agente-ia-single";

type FonteUsada = {
  numero: number;
  id: string;
  titulo: string;
  categoria: string;
  classificacao: string;
  fonte: string | null;
  trecho: string;
  similarity: number | null;
  origem: string;
};

function loadMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
  } catch {
    return [];
  }
}

function AgenteIaPage() {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/agente-ia" }), []);
  const initial = useMemo(loadMessages, []);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: CHAT_ID,
    messages: initial,
    transport,
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Persiste no localStorage a cada mudança
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  // Foco
  useEffect(() => {
    if (!isLoading) textareaRef.current?.focus();
  }, [isLoading, messages.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage({ text });
  };

  const handleClear = () => {
    if (!confirm("Limpar a conversa? Esta ação não pode ser desfeita.")) return;
    setMessages([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  return (
    <div>
      <PageHeader
        title="Agente de IA"
        description="Teste sua base de conhecimento conversando com o agente. As respostas usam os documentos e registros cadastrados."
        actions={
          <Button variant="ghost" onClick={handleClear} disabled={messages.length === 0}>
            <RefreshCw className="h-4 w-4" /> Nova conversa
          </Button>
        }
      />

      <Card className="flex h-[calc(100vh-220px)] min-h-[480px] flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <Sparkles className="mb-3 h-10 w-10 text-primary" />
              <p className="max-w-md text-base font-medium text-foreground">
                Olá! Pergunte algo sobre a sua base de conhecimento.
              </p>
              <p className="mt-1 max-w-md text-xs">
                Ex.: "Quais são as regras técnicas para inspeção elétrica?" ou "Liste os
                materiais do catálogo aprovados para fachada."
              </p>
            </div>
          )}

          {messages.map((m) => {
            const text = m.parts
              .map((p: any) => (p.type === "text" ? p.text : ""))
              .join("");
            const isUser = m.role === "user";
            const fontes = ((m as any).metadata?.fontes ?? []) as FonteUsada[];
            return (
              <div key={m.id} className={`mb-4 flex gap-3 ${isUser ? "justify-end" : ""}`}>
                {!isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                    isUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {text || (isUser ? "" : <span className="opacity-60">…</span>)}
                  {!isUser && fontes.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-border pt-3 whitespace-normal">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Registros consultados
                      </p>
                      {fontes.map((fonte) => (
                        <div key={fonte.id} className="rounded-md border border-border bg-background/70 p-2">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-semibold text-foreground">[{fonte.numero}] {fonte.titulo}</span>
                            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{fonte.categoria}</span>
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">{fonte.classificacao}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">“{fonte.trecho}”</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                    <User2 className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Pensando...
            </div>
          )}

          {error && (
            <div className="mt-2 rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              {error.message}
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-2 border-t border-border pt-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Pergunte algo ao agente..."
            rows={2}
            className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={isLoading}
            autoFocus
          />
          <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
