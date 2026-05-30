import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Card, Toggle, Input, Label, Button, Badge } from "@/components/ui-bits";
import { ConfiguracoesNav } from "@/components/ConfiguracoesNav";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/outputs")({
  component: OutputsPage,
});

type Saida = { id: string; chave: string; ativo: boolean; destinatarios: string[] };

function OutputsPage() {
  const [items, setItems] = useState<Saida[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const { data, error } = await supabase
      .from("configuracoes_saida")
      .select("id, chave, ativo, destinatarios")
      .order("chave");
    if (error) setError(error.message);
    else setItems((data ?? []) as Saida[]);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const labels: Record<string, string> = { email: "E-mail", asana: "Asana", tiflux: "Tiflux" };

  const toggle = async (item: Saida, ativo: boolean) => {
    setItems((s) => s.map((i) => i.id === item.id ? { ...i, ativo } : i));
    await supabase.from("configuracoes_saida").update({ ativo }).eq("id", item.id);
  };

  const updateEmails = async (item: Saida, destinatarios: string[]) => {
    setItems((s) => s.map((i) => i.id === item.id ? { ...i, destinatarios } : i));
    await supabase.from("configuracoes_saida").update({ destinatarios }).eq("id", item.id);
  };

  const email = items.find((i) => i.chave === "email");

  return (
    <div>
      <ConfiguracoesNav />
      <PageHeader title="Configuração de saída" description="Defina onde os relatórios finais serão entregues." />
      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      )}
      {loading ? (
        <Card><p className="text-sm text-muted-foreground">Carregando...</p></Card>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((it) => (
              <Toggle key={it.id} label={labels[it.chave] ?? it.chave} checked={it.ativo} onChange={(v) => toggle(it, v)} />
            ))}
          </div>

          {email?.ativo && (
            <Card className="mt-6">
              <Label>Destinatários de e-mail</Label>
              <div className="mb-3 flex flex-wrap gap-2">
                {email.destinatarios.map((r) => (
                  <Badge key={r} className="bg-accent text-accent-foreground gap-1.5">
                    {r}
                    <button onClick={() => updateEmails(email, email.destinatarios.filter((x) => x !== r))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {email.destinatarios.length === 0 && (
                  <span className="text-xs text-muted-foreground">Nenhum destinatário cadastrado.</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="novo@email.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (newEmail && !email.destinatarios.includes(newEmail)) {
                        updateEmails(email, [...email.destinatarios, newEmail]);
                        setNewEmail("");
                      }
                    }
                  }}
                />
                <Button onClick={() => {
                  if (newEmail && !email.destinatarios.includes(newEmail)) {
                    updateEmails(email, [...email.destinatarios, newEmail]);
                    setNewEmail("");
                  }
                }}>Adicionar</Button>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
