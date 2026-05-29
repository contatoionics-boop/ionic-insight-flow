import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, Button, Card, Badge, Modal, Input, Label, Select } from "@/components/ui-bits";
import { Plus, ChevronRight, ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/forms")({
  component: FormsPage,
});

type Cliente = { id: string; nome: string };
type Form = { id: string; nome: string; descricao: string | null; cliente_id: string; cliente: { nome: string } | null };
type Secao = { id: string; titulo: string; ordem: number };
type TipoPergunta =
  | "texto"
  | "numero"
  | "foto"
  | "audio"
  | "checkbox"
  | "data"
  | "selecao_unica"
  | "toggle";
type Pergunta = { id: string; secao_id: string; texto: string; tipo: TipoPergunta; obrigatoria: boolean; ordem: number };

const tipos: { value: TipoPergunta; label: string }[] = [
  { value: "texto", label: "Texto" },
  { value: "numero", label: "Número" },
  { value: "data", label: "Data" },
  { value: "selecao_unica", label: "Seleção única" },
  { value: "toggle", label: "Sim / Não" },
  { value: "checkbox", label: "Confirmação" },
  { value: "foto", label: "Foto (com IA)" },
  { value: "audio", label: "Áudio (com transcrição)" },
];

function FormsPage() {
  const { userId } = useAuth();
  const [forms, setForms] = useState<Form[]>([]);
  const [clients, setClients] = useState<Cliente[]>([]);
  const [selected, setSelected] = useState<Form | null>(null);
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formModal, setFormModal] = useState(false);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [fNome, setFNome] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fCli, setFCli] = useState("");
  const [toDelForm, setToDelForm] = useState<Form | null>(null);

  const [secModal, setSecModal] = useState(false);
  const [sTitulo, setSTitulo] = useState("");

  const [pergModal, setPergModal] = useState(false);
  const [pSecao, setPSecao] = useState("");
  const [pTexto, setPTexto] = useState("");
  const [pTipo, setPTipo] = useState<TipoPergunta>("texto");
  const [pObrig, setPObrig] = useState(true);
  const [pContexto, setPContexto] = useState("");
  const [pOpcoes, setPOpcoes] = useState("");

  const refreshForms = useCallback(async () => {
    const { data, error } = await supabase
      .from("formularios")
      .select("id, nome, descricao, cliente_id, cliente:clientes(nome)")
      .order("nome");
    if (error) setError(error.message);
    else setForms((data ?? []) as unknown as Form[]);
    setLoading(false);
  }, []);

  const refreshDetail = useCallback(async (formId: string) => {
    const { data: secs } = await supabase.from("secoes").select("id, titulo, ordem").eq("formulario_id", formId).order("ordem");
    setSecoes((secs ?? []) as Secao[]);
    const ids = (secs ?? []).map((s: any) => s.id);
    if (ids.length) {
      const { data: ps } = await supabase.from("perguntas").select("id, secao_id, texto, tipo, obrigatoria, ordem").in("secao_id", ids).order("ordem");
      setPerguntas((ps ?? []) as Pergunta[]);
    } else setPerguntas([]);
  }, []);

  useEffect(() => {
    refreshForms();
    supabase.from("clientes").select("id, nome").order("nome").then(({ data }) => setClients((data ?? []) as Cliente[]));
  }, [refreshForms]);

  useEffect(() => {
    if (selected) refreshDetail(selected.id);
  }, [selected, refreshDetail]);

  const openCreateForm = () => { setEditingForm(null); setFNome(""); setFDesc(""); setFCli(""); setFormModal(true); };
  const openEditForm = (f: Form) => { setEditingForm(f); setFNome(f.nome); setFDesc(f.descricao ?? ""); setFCli(f.cliente_id); setFormModal(true); };

  const saveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingForm) {
      await supabase.from("formularios").update({ nome: fNome, descricao: fDesc || null, cliente_id: fCli }).eq("id", editingForm.id);
    } else {
      await supabase.from("formularios").insert({ nome: fNome, descricao: fDesc || null, cliente_id: fCli, criado_por: userId });
    }
    setFormModal(false);
    refreshForms();
  };

  const delForm = async () => {
    if (!toDelForm) return;
    await supabase.from("formularios").delete().eq("id", toDelForm.id);
    setToDelForm(null);
    if (selected?.id === toDelForm.id) setSelected(null);
    refreshForms();
  };

  const addSecao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    await supabase.from("secoes").insert({ formulario_id: selected.id, titulo: sTitulo, ordem: secoes.length + 1 });
    setSTitulo(""); setSecModal(false);
    refreshDetail(selected.id);
  };

  const delSecao = async (id: string) => {
    await supabase.from("perguntas").delete().eq("secao_id", id);
    await supabase.from("secoes").delete().eq("id", id);
    if (selected) refreshDetail(selected.id);
  };

  const openAddPerg = (secaoId: string) => { setPSecao(secaoId); setPTexto(""); setPTipo("texto"); setPObrig(true); setPContexto(""); setPOpcoes(""); setPergModal(true); };

  const savePerg = async (e: React.FormEvent) => {
    e.preventDefault();
    const ord = perguntas.filter((p) => p.secao_id === pSecao).length + 1;
    const { data: nova, error } = await supabase
      .from("perguntas")
      .insert({ secao_id: pSecao, texto: pTexto, tipo: pTipo, obrigatoria: pObrig, ordem: ord, contexto_ia: pContexto || null })
      .select("id")
      .single();
    if (!error && nova && pTipo === "selecao_unica") {
      const opcoes = pOpcoes.split("\n").map((l) => l.trim()).filter(Boolean);
      if (opcoes.length) {
        await supabase.from("opcoes_pergunta").insert(
          opcoes.map((texto, i) => ({ pergunta_id: nova.id, texto, ordem: i + 1 })),
        );
      }
    }
    setPergModal(false);
    if (selected) refreshDetail(selected.id);
  };

  const delPerg = async (id: string) => {
    await supabase.from("opcoes_pergunta").delete().eq("pergunta_id", id);
    await supabase.from("perguntas").delete().eq("id", id);
    if (selected) refreshDetail(selected.id);
  };

  if (selected) {
    return (
      <div>
        <button onClick={() => setSelected(null)} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar para formulários
        </button>
        <PageHeader
          title={selected.nome}
          description={`Cliente: ${selected.cliente?.nome ?? "—"}`}
          actions={<Button onClick={() => setSecModal(true)}><Plus className="h-4 w-4" /> Nova seção</Button>}
        />
        <div className="space-y-4">
          {secoes.length === 0 && <Card><p className="text-sm text-muted-foreground">Nenhuma seção. Crie a primeira.</p></Card>}
          {secoes.map((s) => {
            const ps = perguntas.filter((p) => p.secao_id === s.id);
            return (
              <Card key={s.id}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{s.titulo}</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openAddPerg(s.id)}><Plus className="h-3.5 w-3.5" /> Pergunta</Button>
                    <button onClick={() => delSecao(s.id)} className="text-xs text-destructive hover:underline"><Trash2 className="h-3.5 w-3.5 inline" /> Seção</button>
                  </div>
                </div>
                <ul className="divide-y divide-border">
                  {ps.length === 0 && <li className="py-3 text-sm text-muted-foreground">Sem perguntas.</li>}
                  {ps.map((q) => (
                    <li key={q.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{q.texto}</p>
                        <div className="mt-1 flex gap-2">
                          <Badge className="bg-accent text-accent-foreground">{q.tipo}</Badge>
                          {q.obrigatoria && <Badge className="bg-warning/20 text-warning-foreground">Obrigatória</Badge>}
                        </div>
                      </div>
                      <button onClick={() => delPerg(q.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>

        <Modal open={secModal} onClose={() => setSecModal(false)} title="Nova seção">
          <form onSubmit={addSecao} className="space-y-4">
            <div><Label>Título</Label><Input required value={sTitulo} onChange={(e) => setSTitulo(e.target.value)} /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setSecModal(false)}>Cancelar</Button><Button type="submit">Adicionar</Button></div>
          </form>
        </Modal>

        <Modal open={pergModal} onClose={() => setPergModal(false)} title="Nova pergunta">
          <form onSubmit={savePerg} className="space-y-4">
            <div><Label>Texto da pergunta</Label><Input required value={pTexto} onChange={(e) => setPTexto(e.target.value)} /></div>
            <div><Label>Tipo</Label><Select value={pTipo} onChange={(e) => setPTipo(e.target.value as TipoPergunta)}>{tipos.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pObrig} onChange={(e) => setPObrig(e.target.checked)} /> Obrigatória</label>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setPergModal(false)}>Cancelar</Button><Button type="submit">Adicionar</Button></div>
          </form>
        </Modal>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Formulários" description="Roteiros de vistoria por cliente." actions={<Button onClick={openCreateForm}><Plus className="h-4 w-4" /> Novo formulário</Button>} />
      {error && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      {loading ? <Card><p className="text-sm text-muted-foreground">Carregando...</p></Card> : forms.length === 0 ? (
        <Card><p className="text-sm text-muted-foreground">Nenhum formulário cadastrado. Crie o primeiro.</p></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {forms.map((f) => (
            <div key={f.id} className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <button onClick={() => setSelected(f)} className="flex flex-1 items-center justify-between text-left">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{f.nome}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{f.cliente?.nome ?? "—"}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="mt-3 flex gap-2 border-t border-border pt-3">
                <button onClick={() => openEditForm(f)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"><Pencil className="h-3 w-3" /> Editar</button>
                <button onClick={() => setToDelForm(f)} className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /> Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={formModal} onClose={() => setFormModal(false)} title={editingForm ? "Editar formulário" : "Novo formulário"}>
        <form onSubmit={saveForm} className="space-y-4">
          <div><Label>Nome</Label><Input required value={fNome} onChange={(e) => setFNome(e.target.value)} /></div>
          <div><Label>Descrição</Label><Input value={fDesc} onChange={(e) => setFDesc(e.target.value)} /></div>
          <div><Label>Cliente</Label>
            <Select required value={fCli} onChange={(e) => setFCli(e.target.value)}>
              <option value="">Selecione</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          </div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setFormModal(false)}>Cancelar</Button><Button type="submit">{editingForm ? "Salvar" : "Criar"}</Button></div>
        </form>
      </Modal>

      <Modal open={!!toDelForm} onClose={() => setToDelForm(null)} title="Excluir formulário">
        <p className="text-sm">Excluir <strong>{toDelForm?.nome}</strong>? Esta ação também remove suas seções e perguntas.</p>
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setToDelForm(null)}>Cancelar</Button><Button variant="destructive" onClick={delForm}>Excluir</Button></div>
      </Modal>
    </div>
  );
}
