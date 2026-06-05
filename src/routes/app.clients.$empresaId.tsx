import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  PageHeader,
  Button,
  Card,
  Modal,
  Input,
  Label,
} from "@/components/ui-bits";
import { ArrowLeft, Plus, Pencil, Trash2, Building2, MapPin, Search, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { consultarCep, maskCep } from "@/lib/cep";
import { consultarCnpj, maskCnpj } from "@/lib/cnpj";

export const Route = createFileRoute("/app/clients/$empresaId")({
  component: EmpresaDetailPage,
});

type Empresa = { id: string; nome: string };
type Matriz = {
  id: string;
  empresa_id: string;
  nome: string;
  cnpj: string | null;
  razao_social: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
};
type Unidade = {
  id: string;
  matriz_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
};

function EmpresaDetailPage() {
  const { empresaId } = Route.useParams();
  const { role, userId } = useAuth();
  const canWrite = role === "super_admin" || role === "admin";

  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [matrizes, setMatrizes] = useState<Matriz[]>([]);
  const [unidadesPorMatriz, setUnidadesPorMatriz] = useState<Record<string, Unidade[]>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Matriz modal
  const [mModal, setMModal] = useState(false);
  const [editingM, setEditingM] = useState<Matriz | null>(null);
  const [mForm, setMForm] = useState<Partial<Matriz>>({});
  const [mSaving, setMSaving] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjMsg, setCnpjMsg] = useState<string | null>(null);
  const [mCepLoading, setMCepLoading] = useState(false);
  const [toDelM, setToDelM] = useState<Matriz | null>(null);

  // Unidade modal
  const [uModal, setUModal] = useState<{ matrizId: string } | null>(null);
  const [editingU, setEditingU] = useState<Unidade | null>(null);
  const [uForm, setUForm] = useState<Partial<Unidade>>({});
  const [uSaving, setUSaving] = useState(false);
  const [uCepLoading, setUCepLoading] = useState(false);
  const [toDelU, setToDelU] = useState<Unidade | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [{ data: emp }, { data: mats }] = await Promise.all([
      supabase.from("empresas").select("id, nome").eq("id", empresaId).maybeSingle(),
      supabase
        .from("matrizes")
        .select("id, empresa_id, nome, cnpj, razao_social, email, telefone, cep, logradouro, numero, bairro, cidade, estado")
        .eq("empresa_id", empresaId)
        .order("criado_em"),
    ]);
    setEmpresa((emp as Empresa) ?? null);
    const matsList = (mats ?? []) as Matriz[];
    setMatrizes(matsList);

    if (matsList.length > 0) {
      const { data: unis } = await supabase
        .from("unidades")
        .select("id, matriz_id, nome, email, telefone, cep, logradouro, numero, bairro, cidade, estado")
        .in("matriz_id", matsList.map((m) => m.id))
        .order("criado_em");
      const map: Record<string, Unidade[]> = {};
      for (const u of (unis ?? []) as Unidade[]) {
        (map[u.matriz_id] ??= []).push(u);
      }
      setUnidadesPorMatriz(map);
    } else {
      setUnidadesPorMatriz({});
    }
    setLoading(false);
  }, [empresaId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Quando a empresa ainda não tem matriz, abre automaticamente o modal de cadastro
  // para que o usuário possa complementar os dados (CNPJ, endereço etc.).
  useEffect(() => {
    if (!loading && canWrite && matrizes.length === 0 && !mModal) {
      setEditingM(null);
      setMForm({ nome: empresa?.nome ?? "" });
      setCnpjMsg(null);
      setMModal(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, matrizes.length, canWrite]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // --- Matriz handlers ---
  const openCreateMatriz = () => {
    setEditingM(null);
    setMForm({ nome: "" });
    setCnpjMsg(null);
    setMModal(true);
  };
  const openEditMatriz = (m: Matriz) => {
    setEditingM(m);
    setMForm({ ...m });
    setCnpjMsg(null);
    setMModal(true);
  };

  const consultarCnpjMatriz = async () => {
    if (!mForm.cnpj) return;
    setCnpjLoading(true);
    setCnpjMsg(null);
    try {
      const d = await consultarCnpj(mForm.cnpj);
      setMForm((f) => ({
        ...f,
        cnpj: d.cnpj,
        razao_social: d.razao_social ?? f.razao_social,
        nome: f.nome || d.nome_fantasia || d.razao_social || f.nome,
        email: d.email ?? f.email,
        telefone: d.telefone ?? f.telefone,
        cep: d.cep ?? f.cep,
        logradouro: d.logradouro ?? f.logradouro,
        numero: d.numero ?? f.numero,
        bairro: d.bairro ?? f.bairro,
        cidade: d.cidade ?? f.cidade,
        estado: d.estado ?? f.estado,
      }));
      setCnpjMsg("✓ Dados preenchidos.");
    } catch (e: any) {
      setCnpjMsg(e?.message ?? "Falha ao consultar CNPJ.");
    } finally {
      setCnpjLoading(false);
    }
  };

  const consultarCepMatriz = async () => {
    if (!mForm.cep) return;
    setMCepLoading(true);
    try {
      const d = await consultarCep(mForm.cep);
      setMForm((f) => ({ ...f, cep: d.cep, logradouro: d.logradouro, bairro: d.bairro, cidade: d.cidade, estado: d.estado }));
    } catch {
      // silent
    } finally {
      setMCepLoading(false);
    }
  };

  const saveMatriz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mForm.nome || !mForm.cnpj) {
      setError("Nome e CNPJ da matriz são obrigatórios.");
      return;
    }
    setMSaving(true);
    setError(null);
    try {
      const payload = {
        nome: mForm.nome,
        cnpj: mForm.cnpj || null,
        razao_social: mForm.razao_social || null,
        email: mForm.email || null,
        telefone: mForm.telefone || null,
        cep: mForm.cep || null,
        logradouro: mForm.logradouro || null,
        numero: mForm.numero || null,
        bairro: mForm.bairro || null,
        cidade: mForm.cidade || null,
        estado: mForm.estado || null,
      };
      if (editingM) {
        const { error } = await supabase.from("matrizes").update(payload).eq("id", editingM.id);
        if (error) throw error;
        showToast("Matriz atualizada ✓");
      } else {
        const { error } = await supabase
          .from("matrizes")
          .insert({ ...payload, empresa_id: empresaId, criado_por: userId });
        if (error) throw error;
        showToast("Matriz cadastrada ✓");
      }
      setMModal(false);
      refresh();
    } catch (e: any) {
      setError(e?.message ?? "Erro ao salvar matriz.");
    } finally {
      setMSaving(false);
    }
  };

  const deleteMatriz = async () => {
    if (!toDelM) return;
    const { error } = await supabase.from("matrizes").delete().eq("id", toDelM.id);
    if (error) setError(error.message);
    else {
      showToast("Matriz excluída ✓");
      refresh();
    }
    setToDelM(null);
  };

  // --- Unidade handlers ---
  const openCreateUnidade = (matrizId: string) => {
    setEditingU(null);
    setUForm({ nome: "" });
    setUModal({ matrizId });
  };
  const openEditUnidade = (u: Unidade) => {
    setEditingU(u);
    setUForm({ ...u });
    setUModal({ matrizId: u.matriz_id });
  };

  const consultarCepUnidade = async () => {
    if (!uForm.cep) return;
    setUCepLoading(true);
    try {
      const d = await consultarCep(uForm.cep);
      setUForm((f) => ({ ...f, cep: d.cep, logradouro: d.logradouro, bairro: d.bairro, cidade: d.cidade, estado: d.estado }));
    } catch {
      // silent
    } finally {
      setUCepLoading(false);
    }
  };

  const saveUnidade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uModal || !uForm.nome) {
      setError("Nome da unidade é obrigatório.");
      return;
    }
    setUSaving(true);
    setError(null);
    try {
      const payload = {
        nome: uForm.nome,
        email: uForm.email || null,
        telefone: uForm.telefone || null,
        cep: uForm.cep || null,
        logradouro: uForm.logradouro || null,
        numero: uForm.numero || null,
        bairro: uForm.bairro || null,
        cidade: uForm.cidade || null,
        estado: uForm.estado || null,
      };
      if (editingU) {
        const { error } = await supabase.from("unidades").update(payload).eq("id", editingU.id);
        if (error) throw error;
        showToast("Unidade atualizada ✓");
      } else {
        const { error } = await supabase
          .from("unidades")
          .insert({ ...payload, matriz_id: uModal.matrizId, criado_por: userId });
        if (error) throw error;
        showToast("Unidade cadastrada ✓");
      }
      setUModal(null);
      refresh();
    } catch (e: any) {
      setError(e?.message ?? "Erro ao salvar unidade.");
    } finally {
      setUSaving(false);
    }
  };

  const deleteUnidade = async () => {
    if (!toDelU) return;
    const { error } = await supabase.from("unidades").delete().eq("id", toDelU.id);
    if (error) setError(error.message);
    else {
      showToast("Unidade excluída ✓");
      refresh();
    }
    setToDelU(null);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!empresa) {
    return (
      <div>
        <Link to="/app/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <p className="mt-4 text-sm text-muted-foreground">Empresa não encontrada.</p>
      </div>
    );
  }

  return (
    <div>
      <Link to="/app/clients" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar para clientes
      </Link>

      <PageHeader
        title={empresa.nome}
        description="Gerencie as matrizes (CNPJs) e as unidades atendidas."
        actions={
          canWrite ? (
            <Button onClick={openCreateMatriz}>
              <Plus className="h-4 w-4" /> Nova matriz
            </Button>
          ) : undefined
        }
      />

      {toast && (
        <div className="mb-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{toast}</div>
      )}
      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      )}

      {matrizes.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">
            Esta empresa ainda não tem matriz cadastrada. Adicione a matriz (CNPJ + endereço fiscal) para começar.
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {matrizes.map((m) => {
            const unidades = unidadesPorMatriz[m.id] ?? [];
            return (
              <Card key={m.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-base font-semibold text-foreground">{m.nome}</h3>
                    </div>
                    {m.razao_social && <p className="text-xs text-muted-foreground">{m.razao_social}</p>}
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      {m.cnpj && <span>CNPJ {m.cnpj}</span>}
                      {m.email && <span>{m.email}</span>}
                      {m.telefone && <span>{m.telefone}</span>}
                    </div>
                    {(m.logradouro || m.cidade) && (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {[
                          [m.logradouro, m.numero].filter(Boolean).join(", "),
                          m.bairro,
                          [m.cidade, m.estado].filter(Boolean).join("/"),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  {canWrite && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditMatriz(m)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                      >
                        <Pencil className="h-3 w-3" /> Editar
                      </button>
                      <button
                        onClick={() => setToDelM(m)}
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" /> Excluir
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 border-t border-border pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">Unidades ({unidades.length})</h4>
                    {canWrite && (
                      <button
                        onClick={() => openCreateUnidade(m.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2 py-1 text-xs text-primary hover:bg-primary/10"
                      >
                        <Plus className="h-3 w-3" /> Nova unidade
                      </button>
                    )}
                  </div>
                  {unidades.length === 0 ? (
                    <p className="text-xs italic text-muted-foreground">
                      Nenhuma unidade cadastrada. Adicione a primeira para poder agendar mapeamentos.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {unidades.map((u) => (
                        <li key={u.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{u.nome}</p>
                            <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                              {u.email && <span>{u.email}</span>}
                              {u.telefone && <span>{u.telefone}</span>}
                              {(u.logradouro || u.cidade) && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {[
                                    [u.logradouro, u.numero].filter(Boolean).join(", "),
                                    u.bairro,
                                    [u.cidade, u.estado].filter(Boolean).join("/"),
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              )}
                            </div>
                          </div>
                          {canWrite && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => openEditUnidade(u)}
                                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                              >
                                <Pencil className="h-3 w-3" /> Editar
                              </button>
                              <button
                                onClick={() => setToDelU(u)}
                                className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3 w-3" /> Excluir
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Matriz modal */}
      <Modal open={mModal} onClose={() => setMModal(false)} title={editingM ? "Editar matriz" : "Nova matriz"}>
        <form onSubmit={saveMatriz} className="space-y-4">
          <div>
            <Label>CNPJ *</Label>
            <div className="flex gap-2">
              <Input
                required
                value={mForm.cnpj ?? ""}
                onChange={(e) => setMForm((f) => ({ ...f, cnpj: maskCnpj(e.target.value) }))}
                placeholder="00.000.000/0000-00"
              />
              <Button type="button" variant="outline" onClick={consultarCnpjMatriz} disabled={cnpjLoading || !mForm.cnpj}>
                {cnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Consultar
              </Button>
            </div>
            {cnpjMsg && (
              <p className={`mt-1 text-xs ${cnpjMsg.startsWith("✓") ? "text-success" : "text-destructive"}`}>{cnpjMsg}</p>
            )}
          </div>
          <div>
            <Label>Nome da matriz *</Label>
            <Input
              required
              value={mForm.nome ?? ""}
              onChange={(e) => setMForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: BP Bio Energy Matriz"
            />
          </div>
          <div>
            <Label>Razão social</Label>
            <Input
              value={mForm.razao_social ?? ""}
              onChange={(e) => setMForm((f) => ({ ...f, razao_social: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={mForm.email ?? ""}
                onChange={(e) => setMForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={mForm.telefone ?? ""}
                onChange={(e) => setMForm((f) => ({ ...f, telefone: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>Endereço fiscal — CEP</Label>
            <div className="flex gap-2">
              <Input
                value={mForm.cep ?? ""}
                onChange={(e) => setMForm((f) => ({ ...f, cep: maskCep(e.target.value) }))}
                className="max-w-[160px]"
                placeholder="00000-000"
              />
              <Button type="button" variant="outline" onClick={consultarCepMatriz} disabled={mCepLoading || !mForm.cep}>
                {mCepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-[1fr,120px] gap-3">
            <div>
              <Label>Logradouro</Label>
              <Input value={mForm.logradouro ?? ""} onChange={(e) => setMForm((f) => ({ ...f, logradouro: e.target.value }))} />
            </div>
            <div>
              <Label>Número</Label>
              <Input value={mForm.numero ?? ""} onChange={(e) => setMForm((f) => ({ ...f, numero: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-[1fr,1fr,90px] gap-3">
            <div>
              <Label>Bairro</Label>
              <Input value={mForm.bairro ?? ""} onChange={(e) => setMForm((f) => ({ ...f, bairro: e.target.value }))} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={mForm.cidade ?? ""} onChange={(e) => setMForm((f) => ({ ...f, cidade: e.target.value }))} />
            </div>
            <div>
              <Label>UF</Label>
              <Input
                value={mForm.estado ?? ""}
                onChange={(e) => setMForm((f) => ({ ...f, estado: e.target.value.toUpperCase().slice(0, 2) }))}
                maxLength={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setMModal(false)} disabled={mSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mSaving}>
              {mSaving ? "Salvando..." : editingM ? "Salvar" : "Cadastrar matriz"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Unidade modal */}
      <Modal open={!!uModal} onClose={() => setUModal(null)} title={editingU ? "Editar unidade" : "Nova unidade"}>
        <form onSubmit={saveUnidade} className="space-y-4">
          <div>
            <Label>Nome da unidade *</Label>
            <Input
              required
              value={uForm.nome ?? ""}
              onChange={(e) => setUForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Pedro Afonso, Sul da Ilha"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={uForm.email ?? ""}
                onChange={(e) => setUForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={uForm.telefone ?? ""}
                onChange={(e) => setUForm((f) => ({ ...f, telefone: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>Endereço operacional — CEP</Label>
            <div className="flex gap-2">
              <Input
                value={uForm.cep ?? ""}
                onChange={(e) => setUForm((f) => ({ ...f, cep: maskCep(e.target.value) }))}
                className="max-w-[160px]"
                placeholder="00000-000"
              />
              <Button type="button" variant="outline" onClick={consultarCepUnidade} disabled={uCepLoading || !uForm.cep}>
                {uCepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-[1fr,120px] gap-3">
            <div>
              <Label>Logradouro</Label>
              <Input value={uForm.logradouro ?? ""} onChange={(e) => setUForm((f) => ({ ...f, logradouro: e.target.value }))} />
            </div>
            <div>
              <Label>Número</Label>
              <Input value={uForm.numero ?? ""} onChange={(e) => setUForm((f) => ({ ...f, numero: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-[1fr,1fr,90px] gap-3">
            <div>
              <Label>Bairro</Label>
              <Input value={uForm.bairro ?? ""} onChange={(e) => setUForm((f) => ({ ...f, bairro: e.target.value }))} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={uForm.cidade ?? ""} onChange={(e) => setUForm((f) => ({ ...f, cidade: e.target.value }))} />
            </div>
            <div>
              <Label>UF</Label>
              <Input
                value={uForm.estado ?? ""}
                onChange={(e) => setUForm((f) => ({ ...f, estado: e.target.value.toUpperCase().slice(0, 2) }))}
                maxLength={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setUModal(null)} disabled={uSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={uSaving}>
              {uSaving ? "Salvando..." : editingU ? "Salvar" : "Cadastrar unidade"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!toDelM} onClose={() => setToDelM(null)} title="Excluir matriz">
        <p className="text-sm">
          Excluir a matriz <strong>{toDelM?.nome}</strong>? Todas as unidades vinculadas serão removidas também.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setToDelM(null)}>Cancelar</Button>
          <Button variant="destructive" onClick={deleteMatriz}>Excluir</Button>
        </div>
      </Modal>

      <Modal open={!!toDelU} onClose={() => setToDelU(null)} title="Excluir unidade">
        <p className="text-sm">
          Excluir a unidade <strong>{toDelU?.nome}</strong>?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setToDelU(null)}>Cancelar</Button>
          <Button variant="destructive" onClick={deleteUnidade}>Excluir</Button>
        </div>
      </Modal>
    </div>
  );
}
