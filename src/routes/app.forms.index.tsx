import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, Button, Card, Modal, Input, Label, Select } from "@/components/ui-bits";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  Copy,
  ExternalLink,
  Sparkles,
  MoreHorizontal,
  LayoutGrid,
  List as ListIcon,
  Table as TableIcon,
  Search,
  FileText,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/forms/")({
  component: FormsPage,
});

type Empresa = { id: string; nome: string };
type Form = {
  id: string;
  nome: string;
  descricao: string | null;
  empresa_id: string | null;
  empresa: { nome: string } | null;
  ativo: boolean;
  criado_em: string;
  perguntas_count: number;
};

type ViewMode = "grid" | "list" | "table";
type StatusFilter = "todos" | "ativo" | "rascunho";
type SortKey = "nome" | "empresa" | "perguntas" | "criado_em" | "status";

const VIEW_KEY = "forms.viewMode";

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function StatusBadge({ ativo }: { ativo: boolean }) {
  return ativo ? (
    <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
      Ativo
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      Rascunho
    </span>
  );
}

function FormsPage() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [forms, setForms] = useState<Form[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "grid";
    const v = window.localStorage.getItem(VIEW_KEY);
    return v === "list" || v === "table" || v === "grid" ? (v as ViewMode) : "grid";
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_KEY, view);
    } catch {}
  }, [view]);

  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<StatusFilter>("todos");
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortAsc, setSortAsc] = useState(true);

  const [formModal, setFormModal] = useState(false);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [fNome, setFNome] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fEmp, setFEmp] = useState("");
  const [toDelForm, setToDelForm] = useState<Form | null>(null);

  const refreshForms = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("formularios")
      .select(
        "id, nome, descricao, empresa_id, ativo, criado_em, empresa:empresas(nome), secoes(perguntas(id))",
      )
      .order("nome");
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const mapped: Form[] = (data ?? []).map((r: any) => ({
      id: r.id,
      nome: r.nome,
      descricao: r.descricao,
      empresa_id: r.empresa_id,
      empresa: r.empresa,
      ativo: !!r.ativo,
      criado_em: r.criado_em,
      perguntas_count: (r.secoes ?? []).reduce(
        (acc: number, s: any) => acc + (s.perguntas?.length ?? 0),
        0,
      ),
    }));
    setForms(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshForms();
    supabase
      .from("empresas")
      .select("id, nome")
      .order("nome")
      .then(({ data }) => setEmpresas((data ?? []) as Empresa[]));
  }, [refreshForms]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let list = forms.filter((f) => {
      if (q && !f.nome.toLowerCase().includes(q)) return false;
      if (statusFiltro === "ativo" && !f.ativo) return false;
      if (statusFiltro === "rascunho" && f.ativo) return false;
      if (empresaFiltro && f.empresa_id !== empresaFiltro) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      switch (sortKey) {
        case "nome":
          return a.nome.localeCompare(b.nome) * dir;
        case "empresa":
          return (a.empresa?.nome ?? "").localeCompare(b.empresa?.nome ?? "") * dir;
        case "perguntas":
          return (a.perguntas_count - b.perguntas_count) * dir;
        case "criado_em":
          return (new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime()) * dir;
        case "status":
          return (Number(a.ativo) - Number(b.ativo)) * dir;
      }
    });
    return list;
  }, [forms, busca, statusFiltro, empresaFiltro, sortKey, sortAsc]);

  const openCreateForm = () => {
    setEditingForm(null);
    setFNome("");
    setFDesc("");
    setFEmp("");
    setFormModal(true);
  };
  const openEditForm = (f: Form) => {
    setEditingForm(f);
    setFNome(f.nome);
    setFDesc(f.descricao ?? "");
    setFEmp(f.empresa_id ?? "");
    setFormModal(true);
  };

  const saveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingForm) {
      await supabase
        .from("formularios")
        .update({ nome: fNome, descricao: fDesc || null, empresa_id: fEmp || null })
        .eq("id", editingForm.id);
    } else {
      await supabase
        .from("formularios")
        .insert({ nome: fNome, descricao: fDesc || null, empresa_id: fEmp || null, criado_por: userId });
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
    let novoId: string | null = null;
    try {
      // Cópia fiel: dados do documento, seções, blocos de layout, perguntas com
      // todas as colunas (chave do laudo, "aplica-se a", condicionais) e opções.
      const { data: orig, error: eo } = await supabase
        .from("formularios")
        .select("*")
        .eq("id", f.id)
        .single();
      if (eo || !orig) throw eo ?? new Error("Formulário de origem não encontrado");
      const o = orig as any;

      const { data: novo, error: e1 } = await supabase
        .from("formularios")
        .insert({
          nome: novoNome,
          descricao: o.descricao,
          empresa_id: null,
          criado_por: userId,
          ativo: o.ativo,
          codigo: o.codigo,
          revisao: o.revisao,
          data_revisao: o.data_revisao,
          elaborado_por: o.elaborado_por,
          aprovado_por: o.aprovado_por,
          validar_imagens_ia: o.validar_imagens_ia,
        } as any)
        .select("id")
        .single();
      if (e1 || !novo) throw e1 ?? new Error("Falha ao criar formulário");
      novoId = novo.id;

      const { data: secs, error: es } = await supabase
        .from("secoes")
        .select("*")
        .eq("formulario_id", f.id)
        .order("ordem");
      if (es) throw es;
      const secaoIdMap = new Map<string, string>();
      for (const s of (secs ?? []) as any[]) {
        const { data: ns, error } = await supabase
          .from("secoes")
          .insert({ formulario_id: novo.id, titulo: s.titulo, descricao: s.descricao, ordem: s.ordem })
          .select("id")
          .single();
        if (error || !ns) throw error ?? new Error("Falha ao copiar seção");
        secaoIdMap.set(s.id, ns.id);
      }

      if (secaoIdMap.size) {
        const secaoIdsOrig = Array.from(secaoIdMap.keys());

        const { data: blocos, error: eb } = await supabase
          .from("pergunta_blocos")
          .select("*")
          .in("secao_id", secaoIdsOrig);
        if (eb) throw eb;
        const blocoIdMap = new Map<string, string>();
        for (const b of (blocos ?? []) as any[]) {
          const { data: nb, error } = await supabase
            .from("pergunta_blocos")
            .insert({
              secao_id: secaoIdMap.get(b.secao_id)!,
              titulo: b.titulo,
              descricao: b.descricao,
              layout: b.layout,
              ordem: b.ordem,
            })
            .select("id")
            .single();
          if (error || !nb) throw error ?? new Error("Falha ao copiar bloco");
          blocoIdMap.set(b.id, nb.id);
        }

        const { data: ps, error: ep } = await supabase
          .from("perguntas")
          .select("*")
          .in("secao_id", secaoIdsOrig);
        if (ep) throw ep;
        const perguntaIdMap = new Map<string, string>();
        for (const p of (ps ?? []) as any[]) {
          // Colunas de identidade/relacionamento são refeitas; o restante é copiado como está.
          const { id: _id, criado_em: _c, secao_id, bloco_id, condicional_pergunta_id: _cond, ...resto } = p;
          const { data: np, error } = await supabase
            .from("perguntas")
            .insert({
              ...resto,
              secao_id: secaoIdMap.get(secao_id)!,
              bloco_id: bloco_id ? blocoIdMap.get(bloco_id) ?? null : null,
              condicional_pergunta_id: null,
            } as any)
            .select("id")
            .single();
          if (error || !np) throw error ?? new Error("Falha ao copiar pergunta");
          perguntaIdMap.set(p.id, np.id);
        }

        // Condicionais só podem ser ligadas depois que todas as perguntas existem.
        for (const p of (ps ?? []) as any[]) {
          if (!p.condicional_pergunta_id) continue;
          const alvo = perguntaIdMap.get(p.condicional_pergunta_id);
          if (!alvo) continue;
          const { error } = await supabase
            .from("perguntas")
            .update({ condicional_pergunta_id: alvo })
            .eq("id", perguntaIdMap.get(p.id)!);
          if (error) throw error;
        }

        if (perguntaIdMap.size) {
          const { data: ops, error: eop } = await supabase
            .from("opcoes_pergunta")
            .select("pergunta_id, texto, ordem")
            .in("pergunta_id", Array.from(perguntaIdMap.keys()));
          if (eop) throw eop;
          const opsParaInserir = (ops ?? [])
            .map((op) => ({
              pergunta_id: perguntaIdMap.get(op.pergunta_id)!,
              texto: op.texto,
              ordem: op.ordem,
            }))
            .filter((op) => op.pergunta_id);
          if (opsParaInserir.length) {
            const { error } = await supabase.from("opcoes_pergunta").insert(opsParaInserir);
            if (error) throw error;
          }
        }
      }

      await refreshForms();
    } catch (err: any) {
      // Não deixa uma cópia pela metade: remove o formulário novo (seções e perguntas caem em cascata).
      if (novoId) await supabase.from("formularios").delete().eq("id", novoId);
      setError(err?.message ?? "Erro ao duplicar formulário.");
    }
  };

  const goView = (id: string) => navigate({ to: "/app/forms/$id/preview", params: { id } });
  const goEditar = (id: string) => navigate({ to: "/app/forms/$id", params: { id } });

  const ActionsMenu = ({ f }: { f: Form }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Ações"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => goEditar(f.id)}>
          <Pencil className="mr-2 h-4 w-4" /> Editar formulário
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => goView(f.id)}>
          <Eye className="mr-2 h-4 w-4" /> Testar preenchimento
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`/preview/forms/${f.id}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" /> Testar em tela cheia
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openEditForm(f)}>
          <Pencil className="mr-2 h-4 w-4" /> Editar info
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => duplicarForm(f)}>
          <Copy className="mr-2 h-4 w-4" /> Duplicar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setToDelForm(f)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const ViewToggle = () => {
    const opts: { v: ViewMode; icon: any; label: string }[] = [
      { v: "grid", icon: LayoutGrid, label: "Cards" },
      { v: "list", icon: ListIcon, label: "Lista" },
      { v: "table", icon: TableIcon, label: "Detalhes" },
    ];
    return (
      <div className="inline-flex items-center rounded-md border border-border bg-card p-0.5">
        {opts.map((o) => {
          const Icon = o.icon;
          const active = view === o.v;
          return (
            <button
              key={o.v}
              onClick={() => setView(o.v)}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-sm transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={o.label}
              aria-label={o.label}
              aria-pressed={active}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    );
  };

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => {
    const active = sortKey === k;
    return (
      <button
        onClick={() => {
          if (active) setSortAsc((v) => !v);
          else {
            setSortKey(k);
            setSortAsc(true);
          }
        }}
        className={`inline-flex items-center gap-1 ${active ? "text-foreground" : ""}`}
      >
        {label}
        {active && (sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    );
  };

  return (
    <div>
      <PageHeader
        title="Formulários"
        description="Roteiros de mapeamento reutilizáveis. Um formulário pode servir como template para várias empresas."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate({ to: "/app/forms-assistant" })}>
              <Sparkles className="h-4 w-4" /> Criar com IA
            </Button>
            <Button onClick={openCreateForm}>
              <Plus className="h-4 w-4" /> Novo formulário
            </Button>
          </>
        }
      />

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome..."
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-1">
            {(
              [
                { v: "todos", l: "Todos" },
                { v: "ativo", l: "Ativo" },
                { v: "rascunho", l: "Rascunho" },
              ] as { v: StatusFilter; l: string }[]
            ).map((p) => {
              const active = statusFiltro === p.v;
              return (
                <button
                  key={p.v}
                  onClick={() => setStatusFiltro(p.v)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.l}
                </button>
              );
            })}
          </div>
          <Select
            value={empresaFiltro}
            onChange={(e) => setEmpresaFiltro(e.target.value)}
            className="sm:max-w-xs"
          >
            <option value="">Todas as empresas</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </Select>
        </div>
        <ViewToggle />
      </div>

      {loading ? (
        <Card>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">
            {forms.length === 0
              ? "Nenhum formulário cadastrado. Crie o primeiro."
              : "Nenhum formulário corresponde aos filtros."}
          </p>
        </Card>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((f) => (
            <div
              key={f.id}
              onClick={() => goEditar(f.id)}
              className="group relative cursor-pointer rounded-lg border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div className="absolute right-3 top-3">
                <ActionsMenu f={f} />
              </div>
              <div className="pr-8">
                <p className="truncate text-sm font-semibold text-foreground">{f.nome}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {f.empresa?.nome ?? "Template (sem empresa)"}
                </p>
                <div className="mt-3">
                  <StatusBadge ativo={f.ativo} />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
                <span>{f.perguntas_count} {f.perguntas_count === 1 ? "pergunta" : "perguntas"}</span>
                <span>Criado em {fmtData(f.criado_em)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : view === "list" ? (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {filtered.map((f) => (
              <li
                key={f.id}
                onClick={() => goEditar(f.id)}
                className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{f.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {f.empresa?.nome ?? "Template (sem empresa)"}
                  </p>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {f.perguntas_count} {f.perguntas_count === 1 ? "pergunta" : "perguntas"}
                </span>
                <span className="hidden text-xs text-muted-foreground md:inline">
                  {fmtData(f.criado_em)}
                </span>
                <StatusBadge ativo={f.ativo} />
                <ActionsMenu f={f} />
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium"><SortBtn k="nome" label="Nome" /></th>
                  <th className="px-3 py-2 text-left font-medium"><SortBtn k="empresa" label="Empresa" /></th>
                  <th className="px-3 py-2 text-left font-medium"><SortBtn k="perguntas" label="Perguntas" /></th>
                  <th className="px-3 py-2 text-left font-medium"><SortBtn k="criado_em" label="Criado em" /></th>
                  <th className="px-3 py-2 text-left font-medium">Última edição</th>
                  <th className="px-3 py-2 text-left font-medium"><SortBtn k="status" label="Status" /></th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f, i) => (
                  <tr
                    key={f.id}
                    onClick={() => goEditar(f.id)}
                    className="cursor-pointer border-t border-border odd:bg-card even:bg-muted/20 hover:bg-muted/40"
                  >
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-foreground">{f.nome}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {f.empresa?.nome ?? "Template (sem empresa)"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{f.perguntas_count}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtData(f.criado_em)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtData(f.criado_em)}</td>
                    <td className="px-3 py-2"><StatusBadge ativo={f.ativo} /></td>
                    <td className="px-3 py-2 text-right"><ActionsMenu f={f} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={formModal} onClose={() => setFormModal(false)} title={editingForm ? "Editar formulário" : "Novo formulário"}>
        <form onSubmit={saveForm} className="space-y-4">
          <div><Label>Nome</Label><Input required value={fNome} onChange={(e) => setFNome(e.target.value)} /></div>
          <div><Label>Descrição</Label><Input value={fDesc} onChange={(e) => setFDesc(e.target.value)} /></div>
          <div>
            <Label>Empresa (opcional)</Label>
            <Select value={fEmp} onChange={(e) => setFEmp(e.target.value)}>
              <option value="">Template (sem empresa)</option>
              {empresas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Deixe sem empresa para criar um template reutilizável.
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
