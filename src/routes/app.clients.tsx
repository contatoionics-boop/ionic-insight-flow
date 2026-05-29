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
import { Plus, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { consultarCep, maskCep } from "@/lib/cep";
import { consultarCnpj, maskCnpj } from "@/lib/cnpj";

export const Route = createFileRoute("/app/clients")({
  component: ClientsPage,
});

type Cliente = {
  id: string;
  nome: string;
  cnpj: string | null;
  nome_fantasia: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
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

  // form state
  const [nome, setNome] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

  const [saving, setSaving] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjMsg, setCnpjMsg] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMsg, setCepMsg] = useState<string | null>(null);

  const [toDelete, setToDelete] = useState<Cliente | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clientes")
      .select(
        "id, nome, cnpj, nome_fantasia, email, telefone, cep, logradouro, numero, bairro, cidade, estado, criado_em",
      )
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

  const resetForm = () => {
    setNome("");
    setNomeFantasia("");
    setCnpj("");
    setEmail("");
    setTelefone("");
    setCep("");
    setLogradouro("");
    setNumero("");
    setBairro("");
    setCidade("");
    setEstado("");
    setCnpjMsg(null);
    setCepMsg(null);
  };

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setModalOpen(true);
  };
  const openEdit = (c: Cliente) => {
    setEditing(c);
    setNome(c.nome);
    setNomeFantasia(c.nome_fantasia ?? "");
    setCnpj(c.cnpj ?? "");
    setEmail(c.email ?? "");
    setTelefone(c.telefone ?? "");
    setCep(c.cep ?? "");
    setLogradouro(c.logradouro ?? "");
    setNumero(c.numero ?? "");
    setBairro(c.bairro ?? "");
    setCidade(c.cidade ?? "");
    setEstado(c.estado ?? "");
    setCnpjMsg(null);
    setCepMsg(null);
    setModalOpen(true);
  };

  const handleConsultarCnpj = async () => {
    setCnpjLoading(true);
    setCnpjMsg(null);
    try {
      const d = await consultarCnpj(cnpj);
      setCnpj(d.cnpj);
      if (d.razao_social) setNome(d.razao_social);
      if (d.nome_fantasia) setNomeFantasia(d.nome_fantasia);
      if (d.email) setEmail(d.email);
      if (d.telefone) setTelefone(d.telefone);
      if (d.cep) setCep(d.cep);
      if (d.logradouro) setLogradouro(d.logradouro);
      if (d.numero) setNumero(d.numero);
      if (d.bairro) setBairro(d.bairro);
      if (d.cidade) setCidade(d.cidade);
      if (d.estado) setEstado(d.estado);
      setCnpjMsg("✓ Dados preenchidos. Edite o que precisar.");
    } catch (e: any) {
      setCnpjMsg(e?.message ?? "Falha ao consultar CNPJ.");
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleConsultarCep = async () => {
    setCepLoading(true);
    setCepMsg(null);
    try {
      const d = await consultarCep(cep);
      setCep(d.cep);
      setLogradouro(d.logradouro);
      setBairro(d.bairro);
      setCidade(d.cidade);
      setEstado(d.estado);
      setCepMsg("✓ Endereço encontrado.");
    } catch (e: any) {
      setCepMsg(e?.message ?? "Falha ao consultar CEP.");
    } finally {
      setCepLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        nome,
        nome_fantasia: nomeFantasia || null,
        cnpj: cnpj || null,
        email: email || null,
        telefone: telefone || null,
        cep: cep || null,
        logradouro: logradouro || null,
        numero: numero || null,
        bairro: bairro || null,
        cidade: cidade || null,
        estado: estado || null,
      };
      if (editing) {
        const { error } = await supabase.from("clientes").update(payload).eq("id", editing.id);
        if (error) throw error;
        showToast("Cliente atualizado ✓");
      } else {
        const { error } = await supabase
          .from("clientes")
          .insert({ ...payload, criado_por: userId });
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
            <Th>Cidade/UF</Th>
            <Th>Cadastro</Th>
            {canWrite && <Th>Ações</Th>}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                Carregando...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
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
                <Td>{[c.cidade, c.estado].filter(Boolean).join("/") || "—"}</Td>
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
            <Label>CNPJ</Label>
            <div className="flex gap-2">
              <Input
                value={cnpj}
                onChange={(e) => setCnpj(maskCnpj(e.target.value))}
                placeholder="00.000.000/0000-00"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleConsultarCnpj}
                disabled={cnpjLoading || !cnpj}
              >
                {cnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Consultar
              </Button>
            </div>
            {cnpjMsg && (
              <p
                className={`mt-1 text-xs ${cnpjMsg.startsWith("✓") ? "text-success" : "text-destructive"}`}
              >
                {cnpjMsg}
              </p>
            )}
          </div>

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
            <Label>Nome fantasia</Label>
            <Input
              value={nomeFantasia}
              onChange={(e) => setNomeFantasia(e.target.value)}
              placeholder="Nome fantasia"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
              <Input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div>
            <Label>CEP</Label>
            <div className="flex gap-2">
              <Input
                value={cep}
                onChange={(e) => setCep(maskCep(e.target.value))}
                placeholder="00000-000"
                className="max-w-[160px]"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleConsultarCep}
                disabled={cepLoading || !cep}
              >
                {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar endereço
              </Button>
            </div>
            {cepMsg && (
              <p
                className={`mt-1 text-xs ${cepMsg.startsWith("✓") ? "text-success" : "text-destructive"}`}
              >
                {cepMsg}
              </p>
            )}
          </div>

          <div className="grid grid-cols-[1fr,120px] gap-3">
            <div>
              <Label>Logradouro</Label>
              <Input value={logradouro} onChange={(e) => setLogradouro(e.target.value)} />
            </div>
            <div>
              <Label>Número</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-[1fr,1fr,90px] gap-3">
            <div>
              <Label>Bairro</Label>
              <Input value={bairro} onChange={(e) => setBairro(e.target.value)} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </div>
            <div>
              <Label>UF</Label>
              <Input
                value={estado}
                onChange={(e) => setEstado(e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
              />
            </div>
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

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir cliente">
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
