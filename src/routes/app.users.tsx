import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Button, Table, Th, Td, Badge, Modal, Input, Select, Label } from "@/components/ui-bits";
import { Plus, KeyRound } from "lucide-react";
import { adminCreateUser, adminListUsers, adminToggleActive } from "@/lib/admin-users.functions";
import { supabase } from "@/integrations/supabase/client";
import { roleLabels, type Role } from "@/lib/auth";

export const Route = createFileRoute("/app/users")({
  component: UsersPage,
});

type Row = {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  role: string | null;
  criado_em: string;
};

function UsersPage() {
  const listUsers = useServerFn(adminListUsers);
  const createUser = useServerFn(adminCreateUser);
  const toggleActive = useServerFn(adminToggleActive);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("admin");
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listUsers();
      setRows(data as Row[]);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Erro ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  }, [listUsers]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createUser({ data: { nome, email, role } });
      setOpen(false);
      setNome("");
      setEmail("");
      setRole("admin");
      showToast("Usuário criado. E-mail de primeiro acesso enviado ✓");
      refresh();
    } catch (e: any) {
      setError(e?.message ?? "Erro ao criar usuário.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (userEmail: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setError(error.message);
      return;
    }
    showToast("E-mail de redefinição enviado ✓");
  };

  const handleToggle = async (row: Row) => {
    await toggleActive({ data: { userId: row.id, ativo: !row.ativo } });
    refresh();
  };

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Gerencie todos os usuários e perfis da plataforma."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Novo usuário
          </Button>
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
            <Th>E-mail</Th>
            <Th>Perfil</Th>
            <Th>Status</Th>
            <Th>Ações</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                Carregando...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhum usuário cadastrado. Clique em "Novo usuário".
              </td>
            </tr>
          ) : (
            rows.map((u) => (
              <tr key={u.id}>
                <Td className="font-medium">{u.nome || "—"}</Td>
                <Td>{u.email}</Td>
                <Td>{u.role ? roleLabels[u.role as Role] : "—"}</Td>
                <Td>
                  <Badge className={u.ativo ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}>
                    {u.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReset(u.email)}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                    >
                      <KeyRound className="h-3 w-3" /> Resetar senha
                    </button>
                    <button
                      onClick={() => handleToggle(u)}
                      className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                    >
                      {u.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </Table>

      <Modal open={open} onClose={() => setOpen(false)} title="Novo usuário">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@ionics.com.br"
            />
          </div>
          <div>
            <Label>Perfil</Label>
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin Comercial</option>
              <option value="especialista">Especialista</option>
              <option value="agente_tecnico">Agente Técnico</option>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              O usuário receberá um e-mail para definir a senha de primeiro acesso.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Criando..." : "Criar e enviar convite"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
