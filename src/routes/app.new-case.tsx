import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Card, Label, Input, Select, Button } from "@/components/ui-bits";
import { Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listTechnicalAgents } from "@/lib/admin-users.functions";
import { agendarVistoria } from "@/lib/casos.functions";

export const Route = createFileRoute("/app/new-case")({
  component: NewCasePage,
});

type Cliente = { id: string; nome: string; logradouro?: string | null; numero?: string | null; bairro?: string | null; cidade?: string | null; estado?: string | null };
type Form = { id: string; nome: string };
type Agente = { id: string; nome: string; user_id: string };

function formatEndereco(c?: Cliente | null) {
  if (!c) return "";
  const parts = [
    [c.logradouro, c.numero].filter(Boolean).join(", "),
    c.bairro,
    [c.cidade, c.estado].filter(Boolean).join("/"),
  ].filter(Boolean);
  return parts.join(" - ");
}

function NewCasePage() {
  const navigate = useNavigate();
  const loadAgents = useServerFn(listTechnicalAgents);
  const agendar = useServerFn(agendarVistoria);
  const [clients, setClients] = useState<Cliente[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [agents, setAgents] = useState<Agente[]>([]);

  const [clientId, setClientId] = useState("");
  const [formId, setFormId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("09:00");
  const [duracao, setDuracao] = useState(60);
  const [endereco, setEndereco] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [gerarLink, setGerarLink] = useState(false);
  const [linkMode, setLinkMode] = useState<"stepper" | "chat">("stepper");

  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    (async () => {
      const [c, f, ag] = await Promise.all([
        supabase.from("clientes").select("id, nome, logradouro, numero, bairro, cidade, estado").order("nome"),
        supabase.from("formularios").select("id, nome").eq("ativo", true).order("nome"),
        loadAgents(),
      ]);
      setClients((c.data ?? []) as Cliente[]);
      setForms((f.data ?? []) as Form[]);
      setAgents((ag ?? []) as Agente[]);
    })();
  }, [loadAgents]);

  useEffect(() => {
    const c = clients.find((x) => x.id === clientId);
    if (c && !endereco) setEndereco(formatEndereco(c));
  }, [clientId, clients, endereco]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorking(true);
    setError(null);
    setLink(null);
    try {
      const agendadoEm = new Date(`${data}T${hora}:00`).toISOString();
      const res = await agendar({
        data: {
          clienteId: clientId,
          formId,
          agenteId: agentId,
          agendadoEm,
          duracaoMin: duracao,
          enderecoVistoria: endereco || null,
          observacoes: observacoes || null,
          gerarLink,
          mode: linkMode,
        },
      });
      if (res.casoId && gerarLink) {
        const qs = linkMode === "chat" ? "?mode=chat" : "";
        setLink(`${window.location.origin}/app/vistoria/${res.casoId}${qs}`);
      } else {
        navigate({ to: "/app/agenda" });
      }
    } catch (err: any) {
      setError(err?.message ?? "Erro ao agendar vistoria.");
    } finally {
      setWorking(false);
    }
  };

  const copy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <PageHeader title="Agendar vistoria" description="Cadastre um caso, escolha o vistoriador e agende a data." />

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Cliente</Label>
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                <option value="">Selecione o cliente</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </div>
            <div>
              <Label>Formulário</Label>
              <Select value={formId} onChange={(e) => setFormId(e.target.value)} required>
                <option value="">Selecione o formulário</option>
                {forms.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </Select>
            </div>
            <div>
              <Label>Vistoriador</Label>
              <Select value={agentId} onChange={(e) => setAgentId(e.target.value)} required>
                <option value="">Selecione o vistoriador</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.nome || "(sem nome)"}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label>Data</Label>
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
              </div>
              <div>
                <Label>Hora</Label>
                <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} required />
              </div>
            </div>
            <div>
              <Label>Duração (min)</Label>
              <Input type="number" min={15} step={15} value={duracao} onChange={(e) => setDuracao(Number(e.target.value))} required />
            </div>
            <div className="md:col-span-2">
              <Label>Endereço da vistoria</Label>
              <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Auto-preenchido pelo cliente" />
            </div>
            <div className="md:col-span-2">
              <Label>Observações para o vistoriador</Label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="Instruções, ponto de referência, contato no local..."
              />
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={gerarLink} onChange={(e) => setGerarLink(e.target.checked)} />
              Também gerar link da vistoria (o vistoriador precisa fazer login)
            </label>
            {gerarLink && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {([
                  { v: "stepper", t: "Stepper", d: "Etapas" },
                  { v: "chat", t: "Chat", d: "Pergunta a pergunta" },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setLinkMode(opt.v)}
                    className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                      linkMode === opt.v
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <div className="font-semibold text-foreground">{opt.t}</div>
                    <div className="text-xs text-muted-foreground">{opt.d}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={working}>{working ? "Agendando..." : "Agendar vistoria"}</Button>
          </div>
        </form>
      </Card>

      {link && (
        <Card className="mt-6 border-success/30 bg-success/5">
          <p className="text-sm font-semibold text-foreground">Vistoria agendada e link gerado</p>
          <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 font-mono text-xs text-foreground">
            <span className="flex-1 truncate">{link}</span>
            <button onClick={copy} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar link"}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
