import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, Button, Card, Modal, Input, Label, Select } from "@/components/ui-bits";
import { Plus, Pencil, Trash2, ChevronRight, Eye, Copy, ExternalLink, Link2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { criarCasoELink, type LinkMode } from "@/lib/agent-link";

export const Route = createFileRoute("/app/forms/")({
  component: FormsPage,
});

type Cliente = { id: string; nome: string };
type Form = {
  id: string;
  nome: string;
  descricao: string | null;
  cliente_id: string | null;
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

  // "Gerar link" modal
  const [linkFormTarget, setLinkFormTarget] = useState<Form | null>(null);
  const [linkClienteId, setLinkClienteId] = useState("");
  const [linkAgenteId, setLinkAgenteId] = useState("");
  const [linkMode, setLinkMode] = useState<LinkMode>("stepper");
  const [agentes, setAgentes] = useState<{ id: string; nome: string }[]>([]);
  const [linkWorking, setLinkWorking] = useState(false);
  const [linkResult, setLinkResult] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

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
    supabase
      .from("user_roles")
      .select("user_id, profile:profiles!user_id(id, nome)")
      .eq("role", "agente_tecnico")
      .then(({ data }) =>
        setAgentes(
          ((data ?? []) as any[])
            .map((r) => ({ id: r.profile?.id, nome: r.profile?.nome ?? "(sem nome)" }))
            .filter((a) => a.id),
        ),
      );
  }, [refreshForms]);

  const openLinkModal = (f: Form) => {
    setLinkFormTarget(f);
    setLinkClienteId(f.cliente_id ?? "");
    setLinkAgenteId("");
    setLinkMode("stepper");
    setLinkResult(null);
    setLinkError(null);
    setLinkCopied(false);
  };

  const handleGerarLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkFormTarget || !userId) return;
    setLinkWorking(true);
    setLinkError(null);
    try {
      const url = await criarCasoELink({
        clienteId: linkClienteId,
        formId: linkFormTarget.id,
        agenteId: linkAgenteId,
        userId,
        mode: linkMode,
      });
      setLinkResult(url);
    } catch (err: any) {
      setLinkError(err?.message ?? "Erro ao gerar link.");
    } finally {
      setLinkWorking(false);
    }
  };

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
    setFCli(f.cliente_id ?? "");
    setFormModal(true);
  };

  const saveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingForm) {
      await supabase
        .from("formularios")
        .update({ nome: fNome, descricao: fDesc || null, cliente_id: fCli || null })
        .eq("id", editingForm.id);
    } else {
      await supabase
        .from("formularios")
        .insert({ nome: fNome, descricao: fDesc || null, cliente_id: fCli || null, criado_por: userId });
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

  const duplicarForm = async (f: Form) => {
    const novoNome = prompt("Nome do novo formulário:", `${f.nome} (cópia)`);
    if (!novoNome) return;
    try {
      // 1. cria novo formulário (sem cliente — template)
      const { data: novo, error: e1 } = await supabase
        .from("formularios")
        .insert({
          nome: novoNome,
          descricao: f.descricao,
          cliente_id: null,
          criado_por: userId,
        })
        .select("id")
        .single();
      if (e1 || !novo) throw e1 ?? new Error("Falha ao criar formulário");

      // 2. busca seções originais
      const { data: secs } = await supabase
        .from("secoes")
        .select("id, titulo, descricao, ordem")
        .eq("formulario_id", f.id)
        .order("ordem");
      const secaoIdMap = new Map<string, string>();
      for (const s of secs ?? []) {
        const { data: ns } = await supabase
          .from("secoes")
          .insert({ formulario_id: novo.id, titulo: s.titulo, descricao: s.descricao, ordem: s.ordem })
          .select("id")
          .single();
        if (ns) secaoIdMap.set(s.id, ns.id);
      }

      // 3. perguntas
      if (secaoIdMap.size) {
        const { data: ps } = await supabase
          .from("perguntas")
          .select("id, secao_id, texto, tipo, obrigatoria, ordem, instrucao_agente, contexto_ia")
          .in("secao_id", Array.from(secaoIdMap.keys()));
        const perguntaIdMap = new Map<string, string>();
        for (const p of ps ?? []) {
          const novaSecaoId = secaoIdMap.get(p.secao_id);
          if (!novaSecaoId) continue;
          const { data: np } = await supabase
            .from("perguntas")
            .insert({
              secao_id: novaSecaoId,
              texto: p.texto,
              tipo: p.tipo,
              obrigatoria: p.obrigatoria,
              ordem: p.ordem,
              instrucao_agente: p.instrucao_agente,
              contexto_ia: p.contexto_ia,
            })
            .select("id")
            .single();
          if (np) perguntaIdMap.set(p.id, np.id);
        }

        // 4. opções
        if (perguntaIdMap.size) {
          const { data: ops } = await supabase
            .from("opcoes_pergunta")
            .select("pergunta_id, texto, ordem")
            .in("pergunta_id", Array.from(perguntaIdMap.keys()));
          const opsParaInserir = (ops ?? [])
            .map((o) => ({
              pergunta_id: perguntaIdMap.get(o.pergunta_id)!,
              texto: o.texto,
              ordem: o.ordem,
            }))
            .filter((o) => o.pergunta_id);
          if (opsParaInserir.length) {
            await supabase.from("opcoes_pergunta").insert(opsParaInserir);
          }
        }
      }

      await refreshForms();
    } catch (err: any) {
      setError(err?.message ?? "Erro ao duplicar formulário.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Formulários"
        description="Roteiros de vistoria reutilizáveis. Um formulário pode servir como template para várias empresas."
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    {f.cliente?.nome ?? "Template (sem cliente)"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                <button
                  onClick={() => navigate({ to: "/app/forms/$id/preview", params: { id: f.id } })}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                >
                  <Eye className="h-3 w-3" /> Visualizar
                </button>
                <a
                  href={`/preview/forms/${f.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                >
                  <ExternalLink className="h-3 w-3" /> Tela cheia
                </a>
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
                  onClick={() => duplicarForm(f)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                >
                  <Copy className="h-3 w-3" /> Duplicar
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
            <Label>Cliente (opcional)</Label>
            <Select value={fCli} onChange={(e) => setFCli(e.target.value)}>
              <option value="">Template (sem cliente)</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Deixe sem cliente para criar um template reutilizável.
            </p>
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
