import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, Button, Card, Modal, Input, Label, Select } from "@/components/ui-bits";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/forms")({
  component: FormsPage,
});

type Cliente = { id: string; nome: string };
type Form = {
  id: string;
  nome: string;
  descricao: string | null;
  cliente_id: string;
  cliente: { nome: string } | null;
};

function FormsPage() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [forms, setForms] = useState<Form[]>([]);
  const [clients, setClients] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formModal, setFormModal] = useState(false);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [fNome, setFNome] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fCli, setFCli] = useState("");
  const [toDelForm, setToDelForm] = useState<Form | null>(null);

  const refreshForms = useCallback(async () => {
    const { data, error } = await supabase
      .from("formularios")
      .select("id, nome, descricao, cliente_id, cliente:clientes(nome)")
      .order("nome");
    if (error) setError(error.message);
    else setForms((data ?? []) as unknown as Form[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshForms();
    supabase
      .from("clientes")
      .select("id, nome")
      .order("nome")
      .then(({ data }) => setClients((data ?? []) as Cliente[]));
  }, [refreshForms]);

  const openCreateForm = () => {
    setEditingForm(null);
    setFNome("");
    setFDesc("");
    setFCli("");
    setFormModal(true);
  };
  const openEditForm = (f: Form) => {
    setEditingForm(f);
    setFNome(f.nome);
    setFDesc(f.descricao ?? "");
    setFCli(f.cliente_id);
    setFormModal(true);
  };

  const saveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingForm) {
      await supabase
        .from("formularios")
        .update({ nome: fNome, descricao: fDesc || null, cliente_id: fCli })
        .eq("id", editingForm.id);
    } else {
      await supabase
        .from("formularios")
        .insert({ nome: fNome, descricao: fDesc || null, cliente_id: fCli, criado_por: userId });
    }
    setFormModal(false);
    refreshForms();
  };

  const delForm = async () => {
    if (!toDelForm) return;
    await supabase.from("formularios").delete().eq("id", toDelForm.id);
    setToDelForm(null);
    refreshForms();
  };

  return (
    <div>
      <PageHeader
        title="Formulários"
        description="Roteiros de vistoria por cliente."
        actions={
          <Button onClick={openCreateForm}>
            <Plus className="h-4 w-4" /> Novo formulário
          </Button>
        }
      />
      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {loading ? (
        <Card><p className="text-sm text-muted-foreground">Carregando...</p></Card>
      ) : forms.length === 0 ? (
        <Card><p className="text-sm text-muted-foreground">Nenhum formulário cadastrado. Crie o primeiro.</p></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {forms.map((f) => (
            <div key={f.id} className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <button
                onClick={() => navigate({ to: "/app/forms/$id", params: { id: f.id } })}
                className="flex w-full items-center justify-between text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{f.nome}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{f.cliente?.nome ?? "—"}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="mt-3 flex gap-2 border-t border-border pt-3">
                <button
                  onClick={() => navigate({ to: "/app/forms/$id", params: { id: f.id } })}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                >
                  <Pencil className="h-3 w-3" /> Editar estrutura
                </button>
                <button
                  onClick={() => openEditForm(f)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                >
                  <Pencil className="h-3 w-3" /> Editar info
                </button>
                <button
                  onClick={() => setToDelForm(f)}
                  className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3 w-3" /> Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={formModal} onClose={() => setFormModal(false)} title={editingForm ? "Editar formulário" : "Novo formulário"}>
        <form onSubmit={saveForm} className="space-y-4">
          <div><Label>Nome</Label><Input required value={fNome} onChange={(e) => setFNome(e.target.value)} /></div>
          <div><Label>Descrição</Label><Input value={fDesc} onChange={(e) => setFDesc(e.target.value)} /></div>
          <div>
            <Label>Cliente</Label>
            <Select required value={fCli} onChange={(e) => setFCli(e.target.value)}>
              <option value="">Selecione</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setFormModal(false)}>Cancelar</Button>
            <Button type="submit">{editingForm ? "Salvar" : "Criar"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!toDelForm} onClose={() => setToDelForm(null)} title="Excluir formulário">
        <p className="text-sm">Excluir <strong>{toDelForm?.nome}</strong>? Esta ação também remove suas seções e perguntas.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setToDelForm(null)}>Cancelar</Button>
          <Button variant="destructive" onClick={delForm}>Excluir</Button>
        </div>
      </Modal>
    </div>
  );
}
