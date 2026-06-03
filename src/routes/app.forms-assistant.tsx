import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Send, Sparkles, Paperclip, X, Loader2 } from "lucide-react";
import { PageHeader, Button, Card, Select, Label } from "@/components/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import { createFormFromDraft } from "@/lib/form-assistant.functions";
import { draftSchema, type FormDraft } from "@/lib/form-assistant-schema";

export const Route = createFileRoute("/app/forms-assistant")({
  ssr: false,
  component: FormAssistantPage,
});

type Cliente = { id: string; nome: string };

type Attachment = {
  id: string;
  name: string;
  mediaType: string;
  url: string; // data URL
};

const TIPO_LABEL: Record<string, string> = {
  texto: "Texto",
  numero: "Número",
  data: "Data",
  selecao_unica: "Seleção única",
  toggle: "Sim/Não",
  checkbox: "Confirmação",
  foto: "Foto (IA)",
  audio: "Áudio",
};

function extractLatestDraft(messages: UIMessage[]): FormDraft | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    for (let j = m.parts.length - 1; j >= 0; j--) {
      const part = m.parts[j] as any;
      if (
        part?.type === "tool-propose_form" ||
        (part?.type?.startsWith?.("tool-") && part?.toolName === "propose_form")
      ) {
        const input = part.input ?? part.args;
        if (!input) continue;
        const parsed = draftSchema.safeParse(input);
        if (parsed.success) return parsed.data;
      }
    }
  }
  return null;
}

function FormAssistantPage() {
  const navigate = useNavigate();
  const createForm = useServerFn(createFormFromDraft);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState<string>("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/forms-assistant" }), []);
  const { messages, sendMessage, status, error } = useChat({ transport });

  useEffect(() => {
    supabase
      .from("clientes")
      .select("id, nome")
      .order("nome")
      .then(({ data }) => setClientes((data ?? []) as Cliente[]));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const draft = useMemo(() => extractLatestDraft(messages), [messages]);
  const isLoading = status === "submitted" || status === "streaming";

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const next: Attachment[] = [];
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name}: arquivo maior que 5MB`);
        continue;
      }
      const url = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      next.push({ id: crypto.randomUUID(), name: file.name, mediaType: file.type, url });
    }
    setAttachments((a) => [...a, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;
    const text = input.trim();
    const files = attachments;
    setInput("");
    setAttachments([]);
    await sendMessage({
      text: text || "(arquivos anexados)",
      files: files.map((f) => ({ type: "file", mediaType: f.mediaType, url: f.url, filename: f.name })),
    } as any);
  };

  const handleCreate = async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await createForm({
        data: { draft, cliente_id: clienteId || null },
      });
      navigate({ to: "/app/forms/$id", params: { id: res.id } });
    } catch (e: any) {
      setSaveError(e?.message ?? "Erro ao criar formulário");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Assistente de IA"
        description="Descreva seu mapeamento ou anexe formulários existentes. A IA monta o rascunho e você revisa antes de salvar."
        actions={
          <Button variant="ghost" onClick={() => navigate({ to: "/app/forms" })}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Chat */}
        <Card className="flex h-[70vh] flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
                <Sparkles className="mb-2 h-8 w-8 text-primary" />
                <p className="max-w-sm">
                  Comece descrevendo o tipo de mapeamento que precisa, ou anexe imagens/PDFs de formulários existentes.
                </p>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`mb-3 ${m.role === "user" ? "text-right" : ""}`}>
                <div
                  className={`inline-block max-w-[90%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {m.parts.map((p, i) => {
                    if (p.type === "text") return <span key={i}>{p.text}</span>;
                    if ((p as any).type?.startsWith("tool-")) {
                      return (
                        <span key={i} className="block text-xs italic opacity-80">
                          ✨ Rascunho atualizado no painel ao lado.
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="text-sm text-muted-foreground">
                <Loader2 className="inline h-3 w-3 animate-spin" /> Pensando...
              </div>
            )}
            {error && (
              <div className="mt-2 rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                {error.message}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="mt-3 border-t border-border pt-3">
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {attachments.map((a) => (
                  <span key={a.id} className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs">
                    {a.name}
                    <button onClick={() => setAttachments((arr) => arr.filter((x) => x.id !== a.id))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleAttach}
              />
              <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={isLoading}>
                <Paperclip className="h-4 w-4" />
              </Button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Descreva seu mapeamento..."
                rows={2}
                className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={isLoading}
              />
              <Button onClick={handleSend} disabled={isLoading || (!input.trim() && attachments.length === 0)}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Draft preview */}
        <Card className="flex h-[70vh] flex-col">
          <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-sm font-semibold">Rascunho</h3>
            {draft && (
              <span className="text-xs text-muted-foreground">
                {draft.secoes.length} seções ·{" "}
                {draft.secoes.reduce((acc, s) => acc + s.perguntas.length, 0)} perguntas
              </span>
            )}
          </div>

          {!draft ? (
            <div className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
              <p className="max-w-xs">
                Quando a IA propuser um formulário, ele aparece aqui pra você revisar.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="mb-3">
                <p className="text-base font-semibold text-foreground">{draft.nome}</p>
                {draft.descricao && (
                  <p className="mt-1 text-xs text-muted-foreground">{draft.descricao}</p>
                )}
              </div>
              {draft.secoes.map((s, si) => (
                <div key={si} className="mb-4 rounded-md border border-border p-3">
                  <p className="mb-2 text-sm font-semibold">
                    {si + 1}. {s.titulo}
                  </p>
                  <ol className="space-y-1.5">
                    {s.perguntas.map((p, pi) => (
                      <li key={pi} className="text-xs">
                        <span className="text-foreground">{p.texto}</span>
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {TIPO_LABEL[p.tipo] ?? p.tipo}
                        </span>
                        {p.obrigatoria && (
                          <span className="ml-1 text-[10px] text-destructive">*</span>
                        )}
                        {p.opcoes && p.opcoes.length > 0 && (
                          <ul className="ml-4 mt-0.5 list-disc text-[11px] text-muted-foreground">
                            {p.opcoes.map((o, oi) => (
                              <li key={oi}>{o.texto}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 border-t border-border pt-3">
            <Label htmlFor="cliente">Cliente (opcional)</Label>
            <Select
              id="cliente"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              disabled={!draft || saving}
            >
              <option value="">Template (sem cliente)</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
            {saveError && (
              <div className="mt-2 text-xs text-destructive">{saveError}</div>
            )}
            <Button
              className="mt-3 w-full"
              onClick={handleCreate}
              disabled={!draft || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Criando...
                </>
              ) : (
                "Criar formulário"
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
