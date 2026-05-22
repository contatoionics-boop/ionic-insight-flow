import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Card, Label, Select, Button } from "@/components/ui-bits";
import { clients, forms, agents } from "@/lib/mock-data";
import { Copy, Check } from "lucide-react";

export const Route = createFileRoute("/app/new-case")({
  component: NewCasePage,
});

function NewCasePage() {
  const [clientId, setClientId] = useState("");
  const [formId, setFormId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const availableForms = forms.filter((f) => !clientId || f.clientId === clientId);

  const generate = (e: React.FormEvent) => {
    e.preventDefault();
    const token = Math.random().toString(36).slice(2, 10);
    setLink(`${window.location.origin}/agent/${token}`);
  };

  const copy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <PageHeader
        title="Novo caso"
        description="Crie um caso e gere o link único para o agente técnico."
      />

      <Card>
        <form onSubmit={generate} className="space-y-4">
          <div>
            <Label>Cliente</Label>
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              <option value="">Selecione o cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Formulário</Label>
            <Select value={formId} onChange={(e) => setFormId(e.target.value)} required>
              <option value="">Selecione o formulário</option>
              {availableForms.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Agente técnico</Label>
            <Select value={agentId} onChange={(e) => setAgentId(e.target.value)} required>
              <option value="">Selecione o agente</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end">
            <Button type="submit">Gerar link de acesso</Button>
          </div>
        </form>
      </Card>

      {link && (
        <Card className="mt-6 border-success/30 bg-success/5">
          <p className="text-sm font-semibold text-foreground">Link gerado com sucesso</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Compartilhe com o agente técnico responsável.
          </p>
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
