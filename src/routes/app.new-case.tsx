import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Card, Label, Select, Button } from "@/components/ui-bits";
import { Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/new-case")({
  component: NewCasePage,
});

type Cliente = { id: string; nome: string };
type Form = { id: string; nome: string };
type Agente = { id: string; nome: string; user_id: string };

function NewCasePage() {
  const { userId } = useAuth();
  const [clients, setClients] = useState<Cliente[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [agents, setAgents] = useState<Agente[]>([]);

  const [clientId, setClientId] = useState("");
  const [formId, setFormId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [linkMode, setLinkMode] = useState<"stepper" | "chat">("stepper");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    (async () => {
      const [c, f, ag] = await Promise.all([
        supabase.from("clientes").select("id, nome").order("nome"),
        supabase.from("formularios").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("user_roles").select("user_id, profile:profiles!user_id(id, nome)").eq("role", "agente_tecnico"),
      ]);
      setClients((c.data ?? []) as Cliente[]);
      setForms((f.data ?? []) as Form[]);
      setAgents(((ag.data ?? []) as any[]).map((r) => ({ id: r.profile?.id, nome: r.profile?.nome, user_id: r.user_id })).filter((a) => a.id));
    })();
  }, []);

  const availableForms = forms;

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorking(true);
    setError(null);
    try {
      const { data: caso, error: casoErr } = await supabase.from("casos").insert({
        cliente_id: clientId,
        formulario_id: formId,
        agente_id: agentId,
        criado_por: userId,
        status: "rascunho",
      }).select("id").single();
      if (casoErr) throw casoErr;

      const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      const { error: linkErr } = await supabase.from("links_agente").insert({
        token,
        caso_id: caso.id,
      });
      if (linkErr) throw linkErr;

      const qs = linkMode === "chat" ? "?mode=chat" : "";
      setLink(`${window.location.origin}/agent/${token}${qs}`);
    } catch (err: any) {
      setError(err?.message ?? "Erro ao gerar link.");
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
      <PageHeader title="Novo caso" description="Crie um caso e gere o link único para o agente técnico." />

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <form onSubmit={generate} className="space-y-4">
          <div>
            <Label>Cliente</Label>
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              <option value="">Selecione o cliente</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
            {clients.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Nenhum cliente cadastrado ainda.</p>}
          </div>
          <div>
            <Label>Formulário</Label>
            <Select value={formId} onChange={(e) => setFormId(e.target.value)} required>
              <option value="">Selecione o formulário</option>
              {availableForms.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </Select>
            {availableForms.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Nenhum formulário disponível.</p>}
          </div>
          <div>
            <Label>Agente técnico</Label>
            <Select value={agentId} onChange={(e) => setAgentId(e.target.value)} required>
              <option value="">Selecione o agente</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.nome || "(sem nome)"}</option>)}
            </Select>
            {agents.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Nenhum agente técnico cadastrado ainda.</p>}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={working}>{working ? "Gerando..." : "Gerar link de acesso"}</Button>
          </div>
        </form>
      </Card>

      {link && (
        <Card className="mt-6 border-success/30 bg-success/5">
          <p className="text-sm font-semibold text-foreground">Link gerado com sucesso</p>
          <p className="mt-1 text-xs text-muted-foreground">Compartilhe com o agente técnico responsável.</p>
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
