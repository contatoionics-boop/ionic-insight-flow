import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  PageHeader,
  Button,
  Table,
  Th,
  Td,
  Modal,
  Input,
  Label,
} from "@/components/ui-bits";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/clients")({
  component: ClientsPage,
});

type Cliente = {
  id: string;
  nome: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  criado_em: string;
};

function ClientsPage() {
  const { role, userId } = useAuth();
  const canWrite = role === "super_admin" || role === "admin";

  const [rows, setRows] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<Cliente | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clientes")
      .select("id, nome, cnpj, email, telefone, criado_em")
      .order("criado_em", { ascending: false });
    if (error) setError(error.message);
    else setRows((data ?? []) as Cliente[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const openCreate = () => {
    setEditing(null);
    setNome("");
    setCnpj("");
    setEmail("");
    setTelefone("");
    setModalOpen(true);
  };
  const openEdit = (c: Cliente) => {
    setEditing(c);
    setNome(c.nome);
    setCnpj(c.cnpj ?? "");
    setEmail(c.email ?? "");
    setTelefone(c.telefone ?? "");
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        const { error } = await supabase
          .from("clientes")
          .update({
            nome,
            cnpj: cnpj || null,
            email: email || null,
            telefone: telefone || null,
          })
          .eq("id", editing.id);
        if (error) throw error;
        showToast("Cliente atualizado ✓");
      } else {
        const { error } = await supabase.from("clientes").insert({
          nome,
          cnpj: cnpj || null,
          email: email || null,
          telefone: telefone || null,
          criado_por: userId,
        });
        if (error) throw error;
        showToast("Cliente cadastrado ✓");
      }
      setModalOpen(false);
      refresh();
    } catch (e: any) {
      setError(e?.message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("clientes").delete().eq("id", toDelete.id);
    if (error) setError(error.message);
    else {
      showToast("Cliente excluído ✓");
      refresh();
    }
    setToDelete(null);
  };

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Empresas atendidas pela plataforma."
        actions={
          canWrite ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Novo cliente
            </Button>
          ) : undefined
        }
      />

      {toast && (
        <div className="mb-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {toast}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Table>
        <thead>
          <tr>
            <Th>Nome</Th>
            <Th>CNPJ</Th>
            <Th>E-mail</Th>
            <Th>Telefone</Th>
            <Th>Cadastro</Th>
            {canWrite && <Th>Ações</Th>}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                Carregando...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhum cliente cadastrado ainda.
              </td>
            </tr>
          ) : (
            rows.map((c) => (
              <tr key={c.id}>
                <Td className="font-medium">{c.nome}</Td>
                <Td>{c.cnpj ?? "—"}</Td>
                <Td>{c.email ?? "—"}</Td>
                <Td>{c.telefone ?? "—"}</Td>
                <Td>{new Date(c.criado_em).toLocaleDateString("pt-BR")}</Td>
                {canWrite && (
                  <Td>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(c)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                      >
                        <Pencil className="h-3 w-3" /> Editar
                      </button>
                      <button
                        onClick={() => setToDelete(c)}
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" /> Excluir
                      </button>
                    </div>
                  </Td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </Table>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar cliente" : "Novo cliente"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label>Razão social</Label>
            <Input
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome da empresa"
            />
          </div>
          <div>
            <Label>CNPJ</Label>
            <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
          </div>
          <div>
            <Label>E-mail de contato</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@empresa.com"
            />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Excluir cliente"
      >
        <p className="text-sm text-foreground">
          Tem certeza que deseja excluir <strong>{toDelete?.nome}</strong>? Esta ação não pode ser desfeita.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setToDelete(null)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Excluir
          </Button>
        </div>
      </Modal>
    </div>
  );
}
