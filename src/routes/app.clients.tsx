import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/clients")({
  component: ClientsPage,
});

type EmpresaRow = {
  id: string;
  nome: string;
  criado_em: string;
  matrizes: { id: string; cnpj: string | null; cidade: string | null; estado: string | null }[];
  unidades_count?: number;
};

function ClientsPage() {
  const navigate = useNavigate();
  const { role, userId } = useAuth();
  const canWrite = role === "super_admin" || role === "admin";

  const [rows, setRows] = useState<EmpresaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EmpresaRow | null>(null);
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<EmpresaRow | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("empresas")
      .select("id, nome, criado_em, matrizes(id, cnpj, cidade, estado, unidades(id))")
      .order("criado_em", { ascending: false });
    if (error) setError(error.message);
    else {
      const norm = ((data ?? []) as any[]).map((e) => ({
        id: e.id,
        nome: e.nome,
        criado_em: e.criado_em,
        matrizes: (e.matrizes ?? []).map((m: any) => ({
          id: m.id,
          cnpj: m.cnpj,
          cidade: m.cidade,
          estado: m.estado,
        })),
        unidades_count: (e.matrizes ?? []).reduce(
          (acc: number, m: any) => acc + (m.unidades?.length ?? 0),
          0,
        ),
      }));
      setRows(norm);
    }
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
    setModalOpen(true);
  };
  const openEdit = (e: EmpresaRow) => {
    setEditing(e);
    setNome(e.nome);
    setModalOpen(true);
  };

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        const { error } = await supabase.from("empresas").update({ nome }).eq("id", editing.id);
        if (error) throw error;
        showToast("Empresa atualizada ✓");
      } else {
        const { error } = await supabase.from("empresas").insert({ nome, criado_por: userId });
        if (error) throw error;
        showToast("Empresa cadastrada ✓ — adicione a matriz e as unidades.");
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
    const { error } = await supabase.from("empresas").delete().eq("id", toDelete.id);
    if (error) setError(error.message);
    else {
      showToast("Empresa excluída ✓");
      refresh();
    }
    setToDelete(null);
  };

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Empresas atendidas pela plataforma. Cada empresa pode ter múltiplas matrizes (CNPJs) e unidades."
        actions={
          canWrite ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Nova empresa
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
            <Th>Empresa</Th>
            <Th>Matrizes (CNPJ)</Th>
            <Th>Unidades</Th>
            <Th>Cadastro</Th>
            {canWrite && <Th>Ações</Th>}
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
                Nenhuma empresa cadastrada ainda.
              </td>
            </tr>
          ) : (
            rows.map((e) => (
              <tr
                key={e.id}
                onClick={() => navigate({ to: "/app/clients/$empresaId", params: { empresaId: e.id } })}
                className="cursor-pointer transition-colors hover:bg-muted/50"
              >
                <Td className="font-medium">
                  <div className="flex items-center gap-1">
                    {e.nome}
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                </Td>
                <Td>
                  {e.matrizes.length === 0 ? (
                    <span className="text-xs italic text-muted-foreground">Sem matriz</span>
                  ) : (
                    <span className="text-xs">
                      {e.matrizes.map((m) => m.cnpj || "sem CNPJ").join(", ")}
                    </span>
                  )}
                </Td>
                <Td>{e.unidades_count ?? 0}</Td>
                <Td>{new Date(e.criado_em).toLocaleDateString("pt-BR")}</Td>
                {canWrite && (
                  <Td>
                    <div className="flex gap-2" onClick={(ev) => ev.stopPropagation()}>
                      <button
                        onClick={() => openEdit(e)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                      >
                        <Pencil className="h-3 w-3" /> Renomear
                      </button>
                      <button
                        onClick={() => setToDelete(e)}
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
        title={editing ? "Renomear empresa" : "Nova empresa"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label>Nome da empresa</Label>
            <Input
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: BP Bio Energy"
            />
            {!editing && (
              <p className="mt-1 text-xs text-muted-foreground">
                Após criar a empresa, abra-a para cadastrar a matriz (CNPJ) e as unidades.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir empresa">
        <p className="text-sm text-foreground">
          Excluir <strong>{toDelete?.nome}</strong>? Esta ação remove também as matrizes e unidades vinculadas, e
          não pode ser desfeita.
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
