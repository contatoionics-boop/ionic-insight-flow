import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
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
import { Plus, Pencil, Trash2, ChevronRight, Search, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { consultarCnpj, maskCnpj } from "@/lib/cnpj";
import { consultarCep, maskCep } from "@/lib/cep";

export const Route = createFileRoute("/app/clients/")({
  component: ClientsPage,
});

type EmpresaRow = {
  id: string;
  nome: string;
  codigo_ionics: string | null;
  criado_em: string;
  matrizes: { id: string; cnpj: string | null; cidade: string | null; estado: string | null }[];
  unidades_count?: number;
};

type NovaForm = {
  nome: string;
  cnpj: string;
  razao_social: string;
  email: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
};

const emptyForm: NovaForm = {
  nome: "",
  cnpj: "",
  razao_social: "",
  email: "",
  telefone: "",
  cep: "",
  logradouro: "",
  numero: "",
  bairro: "",
  cidade: "",
  estado: "",
};

function ClientsPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { role, userId } = useAuth();
  const canWrite = role === "super_admin" || role === "admin";

  const [rows, setRows] = useState<EmpresaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<NovaForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjMsg, setCnpjMsg] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);

  const [renameOpen, setRenameOpen] = useState<EmpresaRow | null>(null);
  const [renameNome, setRenameNome] = useState("");
  const [toDelete, setToDelete] = useState<EmpresaRow | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("empresas")
      .select("id, nome, criado_em, codigo_ionics, matrizes(id, cnpj, cidade, estado, unidades(id))" as any)
      .order("criado_em", { ascending: false });
    if (error) setError(error.message);
    else {
      const norm = ((data ?? []) as any[]).map((e) => ({
        id: e.id,
        nome: e.nome,
        codigo_ionics: e.codigo_ionics ?? null,
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
    setForm(emptyForm);
    setCnpjMsg(null);
    setModalOpen(true);
  };

  const onConsultarCnpj = async () => {
    if (!form.cnpj) return;
    setCnpjLoading(true);
    setCnpjMsg(null);
    try {
      const d = await consultarCnpj(form.cnpj);
      setForm((f) => ({
        ...f,
        cnpj: d.cnpj,
        razao_social: d.razao_social || f.razao_social,
        nome: f.nome || d.nome_fantasia || d.razao_social || "",
        email: d.email || f.email,
        telefone: d.telefone || f.telefone,
        cep: d.cep || f.cep,
        logradouro: d.logradouro || f.logradouro,
        numero: d.numero || f.numero,
        bairro: d.bairro || f.bairro,
        cidade: d.cidade || f.cidade,
        estado: d.estado || f.estado,
      }));
      setCnpjMsg("✓ Dados preenchidos.");
    } catch (e: any) {
      setCnpjMsg(e?.message ?? "Falha ao consultar CNPJ.");
    } finally {
      setCnpjLoading(false);
    }
  };

  const onConsultarCep = async () => {
    if (!form.cep) return;
    setCepLoading(true);
    try {
      const d = await consultarCep(form.cep);
      setForm((f) => ({
        ...f,
        cep: d.cep,
        logradouro: d.logradouro || f.logradouro,
        bairro: d.bairro || f.bairro,
        cidade: d.cidade || f.cidade,
        estado: d.estado || f.estado,
      }));
    } catch {
      // silent
    } finally {
      setCepLoading(false);
    }
  };

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.nome.trim()) {
      setError("Informe o nome da empresa.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data: emp, error: empErr } = await supabase
        .from("empresas")
        .insert({ nome: form.nome.trim(), criado_por: userId })
        .select("id")
        .single();
      if (empErr) throw empErr;

      // Cria matriz se houver CNPJ ou algum dado de endereço
      const temDadosMatriz =
        form.cnpj || form.razao_social || form.cep || form.logradouro || form.cidade;
      if (temDadosMatriz) {
        const { error: mErr } = await supabase.from("matrizes").insert({
          empresa_id: emp.id,
          criado_por: userId,
          nome: form.nome.trim(),
          cnpj: form.cnpj || null,
          razao_social: form.razao_social || null,
          email: form.email || null,
          telefone: form.telefone || null,
          cep: form.cep || null,
          logradouro: form.logradouro || null,
          numero: form.numero || null,
          bairro: form.bairro || null,
          cidade: form.cidade || null,
          estado: form.estado || null,
        });
        if (mErr) throw mErr;
      }

      showToast("Empresa cadastrada ✓");
      setModalOpen(false);
      await refresh();
      await router.invalidate();
      navigate({ to: "/app/clients/$empresaId", params: { empresaId: emp.id } });
    } catch (e: any) {
      setError(e?.message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!renameOpen) return;
    const { error } = await supabase
      .from("empresas")
      .update({ nome: renameNome })
      .eq("id", renameOpen.id);
    if (error) setError(error.message);
    else {
      showToast("Empresa atualizada ✓");
      setRenameOpen(null);
      refresh();
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
                        onClick={() =>
                          navigate({ to: "/app/clients/$empresaId", params: { empresaId: e.id } })
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                      >
                        <Pencil className="h-3 w-3" /> Editar dados
                      </button>
                      <button
                        onClick={() => {
                          setRenameOpen(e);
                          setRenameNome(e.nome);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                      >
                        Renomear
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

      {/* Nova empresa (com matriz + endereço em um único passo) */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova empresa">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label>CNPJ da matriz</Label>
            <div className="flex gap-2">
              <Input
                value={form.cnpj}
                onChange={(e) => setForm((f) => ({ ...f, cnpj: maskCnpj(e.target.value) }))}
                placeholder="00.000.000/0000-00"
              />
              <Button
                type="button"
                variant="outline"
                onClick={onConsultarCnpj}
                disabled={cnpjLoading || !form.cnpj}
              >
                {cnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Consultar
              </Button>
            </div>
            {cnpjMsg && (
              <p className={`mt-1 text-xs ${cnpjMsg.startsWith("✓") ? "text-success" : "text-destructive"}`}>
                {cnpjMsg}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Opcional. Ao consultar, preenchemos nome, razão social e endereço automaticamente.
            </p>
          </div>

          <div>
            <Label>Nome da empresa *</Label>
            <Input
              required
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: BP Bio Energy"
            />
          </div>

          <div>
            <Label>Razão social</Label>
            <Input
              value={form.razao_social}
              onChange={(e) => setForm((f) => ({ ...f, razao_social: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label>CEP</Label>
            <div className="flex gap-2">
              <Input
                value={form.cep}
                onChange={(e) => setForm((f) => ({ ...f, cep: maskCep(e.target.value) }))}
                className="max-w-[160px]"
                placeholder="00000-000"
              />
              <Button
                type="button"
                variant="outline"
                onClick={onConsultarCep}
                disabled={cepLoading || !form.cep}
              >
                {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-[1fr,120px] gap-3">
            <div>
              <Label>Logradouro</Label>
              <Input
                value={form.logradouro}
                onChange={(e) => setForm((f) => ({ ...f, logradouro: e.target.value }))}
              />
            </div>
            <div>
              <Label>Número</Label>
              <Input
                value={form.numero}
                onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-[1fr,1fr,90px] gap-3">
            <div>
              <Label>Bairro</Label>
              <Input
                value={form.bairro}
                onChange={(e) => setForm((f) => ({ ...f, bairro: e.target.value }))}
              />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input
                value={form.cidade}
                onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))}
              />
            </div>
            <div>
              <Label>UF</Label>
              <Input
                value={form.estado}
                onChange={(e) =>
                  setForm((f) => ({ ...f, estado: e.target.value.toUpperCase().slice(0, 2) }))
                }
                maxLength={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Cadastrar"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Renomear */}
      <Modal open={!!renameOpen} onClose={() => setRenameOpen(null)} title="Renomear empresa">
        <form onSubmit={handleRename} className="space-y-4">
          <div>
            <Label>Nome da empresa</Label>
            <Input
              required
              value={renameNome}
              onChange={(e) => setRenameNome(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setRenameOpen(null)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
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
