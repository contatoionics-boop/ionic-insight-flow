import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  PageHeader,
  Button,
  Table,
  Th,
  Td,
  Badge,
  Modal,
  Input,
  Select,
  Label,
} from "@/components/ui-bits";
import { ConfiguracoesNav } from "@/components/ConfiguracoesNav";
import { Plus, KeyRound, Lock, Pencil, Trash2 } from "lucide-react";
import {
  adminCreateUser,
  adminListUsers,
  adminGenerateRecoveryLink,
  adminSetPassword,
  adminToggleActive,
  adminUpdateUser,
  adminDeleteUser,
} from "@/lib/admin-users.functions";
import { roleLabels, type Role } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";

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
  const { userId: currentUserId } = useAuth();
  const listUsers = useServerFn(adminListUsers);
  const createUser = useServerFn(adminCreateUser);
  const generateRecoveryLink = useServerFn(adminGenerateRecoveryLink);
  const setPasswordFn = useServerFn(adminSetPassword);
  const toggleActive = useServerFn(adminToggleActive);
  const updateUser = useServerFn(adminUpdateUser);
  const deleteUser = useServerFn(adminDeleteUser);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [recoveryLink, setRecoveryLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("admin");
  const [submitting, setSubmitting] = useState(false);

  const [toDelete, setToDelete] = useState<Row | null>(null);

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

  const openCreate = () => {
    setEditing(null);
    setNome("");
    setEmail("");
    setRole("admin");
    setModalOpen(true);
  };

  const openEdit = (u: Row) => {
    setEditing(u);
    setNome(u.nome ?? "");
    setEmail(u.email);
    setRole((u.role as Role) ?? "admin");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (editing) {
        await updateUser({ data: { userId: editing.id, nome, role } });
        showToast("Usuário atualizado ✓");
      } else {
        const res = await createUser({
          data: {
            nome,
            email,
            role,
            redirectTo: `${window.location.origin}/reset-password`,
          },
        });
        showToast("Usuário criado ✓");
        setRecoveryLink((res as any)?.recoveryLink ?? null);
      }
      setModalOpen(false);
      refresh();
    } catch (e: any) {
      setError(e?.message ?? "Erro ao salvar usuário.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (userId: string) => {
    try {
      const res = await generateRecoveryLink({
        data: { userId, redirectTo: `${window.location.origin}/reset-password` },
      });
      setRecoveryLink((res as any)?.recoveryLink ?? null);
      showToast("Novo link gerado ✓");
    } catch (e: any) {
      setError(e?.message ?? "Erro ao gerar link.");
    }
  };

  const handleToggle = async (row: Row) => {
    await toggleActive({ data: { userId: row.id, ativo: !row.ativo } });
    refresh();
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteUser({ data: { userId: toDelete.id } });
      showToast("Usuário excluído ✓");
      refresh();
    } catch (e: any) {
      setError(e?.message ?? "Erro ao excluir.");
    }
    setToDelete(null);
  };

  return (
    <div>
      <ConfiguracoesNav />
      <PageHeader
        title="Usuários"
        description="Gerencie todos os usuários e perfis da plataforma."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Novo usuário
          </Button>
        }
      />

      {toast && (
        <div className="mb-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {toast}
        </div>
      )}
      {recoveryLink && (
        <div className="mb-4 rounded-md border border-primary/30 bg-primary/5 px-3 py-3 text-sm">
          <p className="font-semibold text-foreground">Link de primeiro acesso</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Envie este link ao novo usuário para que ele defina a senha. Ele expira em pouco tempo.
          </p>
          <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 font-mono text-xs">
            <span className="flex-1 truncate">{recoveryLink}</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(recoveryLink);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 1500);
              }}
              className="text-xs font-medium text-primary hover:underline"
            >
              {linkCopied ? "Copiado" : "Copiar"}
            </button>
            <button
              type="button"
              onClick={() => setRecoveryLink(null)}
              className="text-xs text-muted-foreground hover:underline"
            >
              Fechar
            </button>
          </div>
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
                  <Badge
                    className={
                      u.ativo ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    }
                  >
                    {u.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => openEdit(u)}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                    >
                      <Pencil className="h-3 w-3" /> Editar
                    </button>
                    <button
                      onClick={() => handleReset(u.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                    >
                      <KeyRound className="h-3 w-3" /> Gerar link
                    </button>
                    <button
                      onClick={() => handleToggle(u)}
                      className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                    >
                      {u.ativo ? "Desativar" : "Ativar"}
                    </button>
                    {u.id !== currentUserId && (
                      <button
                        onClick={() => setToDelete(u)}
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" /> Excluir
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </Table>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar usuário" : "Novo usuário"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
            />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@ionics.com.br"
              disabled={!!editing}
            />
            {editing && (
              <p className="mt-1 text-xs text-muted-foreground">
                O e-mail não pode ser alterado. Crie um novo usuário se precisar.
              </p>
            )}
          </div>
          <div>
            <Label>Perfil</Label>
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin Comercial</option>
              <option value="especialista">Especialista</option>
              <option value="agente_tecnico">Agente Técnico</option>
            </Select>
            {!editing && (
              <p className="mt-1 text-xs text-muted-foreground">
                O usuário receberá um e-mail para definir a senha de primeiro acesso.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? "Salvando..."
                : editing
                  ? "Salvar alterações"
                  : "Criar e enviar convite"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir usuário">
        <p className="text-sm text-foreground">
          Tem certeza que deseja excluir <strong>{toDelete?.nome || toDelete?.email}</strong>?
          Esta ação remove o usuário definitivamente e não pode ser desfeita.
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
