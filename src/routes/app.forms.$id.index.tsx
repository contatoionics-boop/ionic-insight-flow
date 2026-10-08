import { CHAVES_LAUDO } from "@/lib/laudo/chaves";
import { APLICA_A_OPCOES } from "@/lib/escopo/tipos";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  ExternalLink,
  Eye,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  X,
  Layers,
} from "lucide-react";
import { Badge, Button, Card, Input, Label, Modal, Select } from "@/components/ui-bits";
import { BlocosModal } from "@/components/forms/BlocosModal";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/forms/$id/")({
  component: FormBuilderPage,
});

type TipoPergunta =
  | "texto"
  | "numero"
  | "foto"
  | "video"
  | "audio"
  | "checkbox"
  | "multipla_escolha"
  | "data"
  | "selecao_unica"
  | "toggle";

const TIPOS: { value: TipoPergunta; label: string }[] = [
  { value: "texto", label: "Texto" },
  { value: "numero", label: "Número" },
  { value: "data", label: "Data" },
  { value: "selecao_unica", label: "Seleção única" },
  { value: "multipla_escolha", label: "Múltipla escolha" },
  { value: "toggle", label: "Sim / Não" },
  { value: "checkbox", label: "Confirmação" },
  { value: "foto", label: "Foto (com IA)" },
  { value: "video", label: "Vídeo" },
  { value: "audio", label: "Áudio (transcrição)" },
];

type Form = {
  id: string;
  nome: string;
  descricao: string | null;
  empresa_id: string | null;
  empresa: { nome: string } | null;
  codigo: string | null;
  revisao: string | null;
  data_revisao: string | null;
  elaborado_por: string | null;
  aprovado_por: string | null;
  validar_imagens_ia: boolean;
};
type Empresa = { id: string; nome: string };
type Secao = { id: string; titulo: string; ordem: number };
type Pergunta = {
  id: string;
  secao_id: string;
  texto: string;
  tipo: TipoPergunta;
  obrigatoria: boolean;
  ordem: number;
  contexto_ia: string | null;
  chave_laudo?: string | null;
  /** Aplica-se a: geral (uma vez) ou entidade do Escopo em que a pergunta se repete. */
  entidade_tipo?: string | null;
  condicional_pergunta_id: string | null;
  condicional_operador: string | null;
  condicional_valor: string | null;
};
type Opcao = { id: string; texto: string; ordem: number };

function FormBuilderPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState<Form | null>(null);
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Info modal
  const [infoOpen, setInfoOpen] = useState(false);
  const [blocosOpen, setBlocosOpen] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [iNome, setINome] = useState("");
  const [iDesc, setIDesc] = useState("");
  const [iEmp, setIEmp] = useState("");
  const [iCodigo, setICodigo] = useState("");
  const [iRevisao, setIRevisao] = useState("");
  const [iDataRev, setIDataRev] = useState("");
  const [iElaborado, setIElaborado] = useState("");
  const [iAprovado, setIAprovado] = useState("");
  const [iValidarIa, setIValidarIa] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: f, error: e1 } = await supabase
      .from("formularios")
      .select("id, nome, descricao, empresa_id, empresa:empresas(nome), codigo, revisao, data_revisao, elaborado_por, aprovado_por, validar_imagens_ia")
      .eq("id", id)
      .single();
    if (e1) {
      setError(e1.message);
      setLoading(false);
      return;
    }
    setForm(f as unknown as Form);
    const { data: secs } = await supabase
      .from("secoes")
      .select("id, titulo, ordem")
      .eq("formulario_id", id)
      .order("ordem");
    const list = (secs ?? []) as Secao[];
    setSecoes(list);
    if (list.length) {
      const { data: ps } = await supabase
        .from("perguntas")
        .select("id, secao_id, texto, tipo, obrigatoria, ordem, contexto_ia, chave_laudo, entidade_tipo")
        .in("secao_id", list.map((s) => s.id))
        .order("ordem");
      setPerguntas((ps ?? []) as Pergunta[]);
    } else {
      setPerguntas([]);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    supabase
      .from("empresas")
      .select("id, nome")
      .order("nome")
      .then(({ data }) => setEmpresas((data ?? []) as Empresa[]));
  }, []);

  const openInfo = () => {
    if (!form) return;
    setINome(form.nome);
    setIDesc(form.descricao ?? "");
    setIEmp(form.empresa_id ?? "");
    setICodigo(form.codigo ?? "");
    setIRevisao(form.revisao ?? "");
    setIDataRev(form.data_revisao ?? "");
    setIElaborado(form.elaborado_por ?? "");
    setIAprovado(form.aprovado_por ?? "");
    setIValidarIa(form.validar_imagens_ia ?? true);
    setInfoOpen(true);
  };
  const saveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase
      .from("formularios")
      .update({
        nome: iNome,
        descricao: iDesc || null,
        empresa_id: iEmp || null,
        codigo: iCodigo || null,
        revisao: iRevisao || null,
        data_revisao: iDataRev || null,
        elaborado_por: iElaborado || null,
        aprovado_por: iAprovado || null,
        validar_imagens_ia: iValidarIa,
      })
      .eq("id", id);
    setInfoOpen(false);
    load();
  };

  const addSecao = async () => {
    const ordem = secoes.length + 1;
    const { data } = await supabase
      .from("secoes")
      .insert({ formulario_id: id, titulo: `Nova seção ${ordem}`, ordem })
      .select("id, titulo, ordem")
      .single();
    if (data) setSecoes((s) => [...s, data as Secao]);
  };

  const renameSecao = async (sid: string, titulo: string) => {
    setSecoes((s) => s.map((x) => (x.id === sid ? { ...x, titulo } : x)));
    await supabase.from("secoes").update({ titulo }).eq("id", sid);
  };

  const delSecao = async (sid: string) => {
    if (!confirm("Excluir a seção e todas as suas perguntas?")) return;
    const ps = perguntas.filter((p) => p.secao_id === sid).map((p) => p.id);
    if (ps.length) {
      await supabase.from("opcoes_pergunta").delete().in("pergunta_id", ps);
      await supabase.from("perguntas").delete().in("id", ps);
    }
    await supabase.from("secoes").delete().eq("id", sid);
    setPerguntas((arr) => arr.filter((p) => p.secao_id !== sid));
    setSecoes((arr) => arr.filter((s) => s.id !== sid));
    if (selectedId && ps.includes(selectedId)) setSelectedId(null);
  };

  const addPergunta = async (secaoId: string) => {
    const ordem = perguntas.filter((p) => p.secao_id === secaoId).length + 1;
    const { data } = await supabase
      .from("perguntas")
      .insert({
        secao_id: secaoId,
        texto: "Nova pergunta",
        tipo: "texto" as TipoPergunta,
        obrigatoria: true,
        ordem,
      })
      .select("id, secao_id, texto, tipo, obrigatoria, ordem, contexto_ia, chave_laudo, entidade_tipo")
      .single();
    if (data) {
      setPerguntas((p) => [...p, data as Pergunta]);
      setSelectedId(data.id);
    }
  };

  const delPergunta = async (pid: string) => {
    if (!confirm("Excluir esta pergunta?")) return;
    await supabase.from("opcoes_pergunta").delete().eq("pergunta_id", pid);
    await supabase.from("perguntas").delete().eq("id", pid);
    setPerguntas((arr) => arr.filter((p) => p.id !== pid));
    if (selectedId === pid) setSelectedId(null);
  };

  // Reordenar seções
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const onSecaoDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = secoes.findIndex((s) => s.id === active.id);
    const newIdx = secoes.findIndex((s) => s.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(secoes, oldIdx, newIdx).map((s, i) => ({ ...s, ordem: i + 1 }));
    setSecoes(next);
    await Promise.all(
      next.map((s) => supabase.from("secoes").update({ ordem: s.ordem }).eq("id", s.id)),
    );
  };

  const onPerguntaDragEnd = async (secaoId: string, e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const inSec = perguntas.filter((p) => p.secao_id === secaoId).sort((a, b) => a.ordem - b.ordem);
    const oldIdx = inSec.findIndex((p) => p.id === active.id);
    const newIdx = inSec.findIndex((p) => p.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(inSec, oldIdx, newIdx).map((p, i) => ({ ...p, ordem: i + 1 }));
    const map = new Map(reordered.map((p) => [p.id, p.ordem]));
    setPerguntas((arr) => arr.map((p) => (map.has(p.id) ? { ...p, ordem: map.get(p.id)! } : p)));
    await Promise.all(
      reordered.map((p) =>
        supabase.from("perguntas").update({ ordem: p.ordem }).eq("id", p.id),
      ),
    );
  };

  const selected = useMemo(
    () => perguntas.find((p) => p.id === selectedId) ?? null,
    [perguntas, selectedId],
  );

  if (loading) {
    return <Card><p className="text-sm text-muted-foreground">Carregando…</p></Card>;
  }
  if (error || !form) {
    return <Card><p className="text-sm text-destructive">{error ?? "Formulário não encontrado"}</p></Card>;
  }

  return (
    <div>
      <button
        onClick={() => navigate({ to: "/app/forms" })}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Formulários
      </button>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">{form.nome}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {form.empresa?.nome ? `Empresa: ${form.empresa.nome}` : "Template (sem empresa)"}
            {form.descricao ? ` · ${form.descricao}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            title="Organize os campos em blocos (cartão, matriz ou grade de fotos), do jeito que o agente verá no celular"
            onClick={() => setBlocosOpen(true)}
          >
            <Layers className="h-4 w-4" /> Agrupar campos em blocos
          </Button>
          <Button
            variant="outline"
            title="Nome, descrição, empresa, código, revisão e responsáveis do documento"
            onClick={openInfo}
          >
            <Pencil className="h-4 w-4" /> Dados do formulário
          </Button>
          <Button
            variant="outline"
            title="Preencha o formulário aqui mesmo, como o agente faria. Nada é salvo."
            onClick={() => navigate({ to: "/app/forms/$id/preview", params: { id } })}
          >
            <Eye className="h-4 w-4" /> Testar preenchimento
          </Button>
          <a
            href={`/preview/forms/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Abre o teste de preenchimento em tela cheia, em outra aba. Nada é salvo."
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
          >
            <ExternalLink className="h-4 w-4" /> Testar em nova aba
          </a>
        </div>
      </div>

      <p className="-mt-3 mb-5 text-xs text-muted-foreground">
        Clique em um campo para editá-lo. <strong>Blocos</strong> agrupam campos na tela do agente;{" "}
        <strong>Dados do formulário</strong> muda nome, código e revisão; <strong>Testar</strong> mostra como o agente
        preencherá, sem salvar nada.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        {/* Estrutura */}
        <div className="space-y-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSecaoDragEnd}>
            <SortableContext items={secoes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {secoes.length === 0 && (
                <Card>
                  <p className="text-sm text-muted-foreground">
                    Nenhuma seção ainda. Adicione a primeira abaixo.
                  </p>
                </Card>
              )}
              {secoes.map((s) => (
                <SortableSection
                  key={s.id}
                  secao={s}
                  perguntas={perguntas.filter((p) => p.secao_id === s.id).sort((a, b) => a.ordem - b.ordem)}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onRename={renameSecao}
                  onDelete={() => delSecao(s.id)}
                  onAddPergunta={() => addPergunta(s.id)}
                  onDeletePergunta={delPergunta}
                  onReorderPerguntas={(e) => onPerguntaDragEnd(s.id, e)}
                  sensors={sensors}
                />
              ))}
            </SortableContext>
          </DndContext>
          <Button variant="outline" onClick={addSecao}>
            <Plus className="h-4 w-4" /> Adicionar seção
          </Button>
        </div>

        {/* Painel */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          {selected ? (
            <PropertiesPanel
              key={selected.id}
              pergunta={selected}
              perguntas={perguntas}
              secoes={secoes}
              onSaved={(updated) => {
                setPerguntas((arr) => arr.map((p) => (p.id === updated.id ? updated : p)));
              }}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <Card>
              <p className="text-sm text-muted-foreground">
                Selecione um campo para editar suas propriedades.
              </p>
            </Card>
          )}
        </div>
      </div>

      <Modal open={infoOpen} onClose={() => setInfoOpen(false)} title="Editar informações">
        <form onSubmit={saveInfo} className="space-y-4">
          <div><Label>Nome</Label><Input required value={iNome} onChange={(e) => setINome(e.target.value)} /></div>
          <div><Label>Descrição</Label><Input value={iDesc} onChange={(e) => setIDesc(e.target.value)} /></div>
          <div>
            <Label>Empresa (opcional)</Label>
            <Select value={iEmp} onChange={(e) => setIEmp(e.target.value)}>
              <option value="">Template (sem empresa)</option>
              {empresas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={iValidarIa}
                onChange={(e) => setIValidarIa(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span className="text-sm">
                <span className="font-medium text-foreground">Validar imagens com IA</span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  Quando ativado, cada foto enviada na vistoria é analisada pela IA antes de avançar.
                  Desative para inspeções em que a validação automática não é necessária.
                </span>
              </span>
            </label>
          </div>


          <div className="border-t border-border pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Metadados do documento (PDF)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Código</Label>
                <Input
                  value={iCodigo}
                  onChange={(e) => setICodigo(e.target.value)}
                  placeholder="FR-29-10"
                />
              </div>
              <div>
                <Label>Revisão</Label>
                <Input
                  value={iRevisao}
                  onChange={(e) => setIRevisao(e.target.value)}
                  placeholder="00"
                />
              </div>
              <div>
                <Label>Data da revisão</Label>
                <Input
                  type="date"
                  value={iDataRev}
                  onChange={(e) => setIDataRev(e.target.value)}
                />
              </div>
              <div />
              <div>
                <Label>Elaborado por</Label>
                <Input value={iElaborado} onChange={(e) => setIElaborado(e.target.value)} />
              </div>
              <div>
                <Label>Aprovado por</Label>
                <Input value={iAprovado} onChange={(e) => setIAprovado(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setInfoOpen(false)}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>

      <BlocosModal
        formularioId={id}
        open={blocosOpen}
        onClose={() => setBlocosOpen(false)}
        onChanged={() => void load()}
      />
    </div>
  );
}

// ============= Sortable Section =============
function SortableSection({
  secao,
  perguntas,
  selectedId,
  onSelect,
  onRename,
  onDelete,
  onAddPergunta,
  onDeletePergunta,
  onReorderPerguntas,
  sensors,
}: {
  secao: Secao;
  perguntas: Pergunta[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRename: (sid: string, titulo: string) => void;
  onDelete: () => void;
  onAddPergunta: () => void;
  onDeletePergunta: (pid: string) => void;
  onReorderPerguntas: (e: DragEndEvent) => void;
  sensors: ReturnType<typeof useSensors>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: secao.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const [titulo, setTitulo] = useState(secao.titulo);
  useEffect(() => setTitulo(secao.titulo), [secao.titulo]);

  return (
    <div ref={setNodeRef} style={style}>
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
            aria-label="Mover seção"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onBlur={() => titulo !== secao.titulo && onRename(secao.id, titulo)}
            className="flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-foreground hover:border-border focus:border-input focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Excluir seção"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onReorderPerguntas}>
          <SortableContext items={perguntas.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1">
              {perguntas.length === 0 && (
                <li className="px-2 py-3 text-xs text-muted-foreground">Sem perguntas ainda.</li>
              )}
              {perguntas.map((p) => (
                <SortableQuestion
                  key={p.id}
                  pergunta={p}
                  selected={selectedId === p.id}
                  onSelect={() => onSelect(p.id)}
                  onDelete={() => onDeletePergunta(p.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={onAddPergunta}>
            <Plus className="h-3.5 w-3.5" /> Adicionar campo
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ============= Sortable Question =============
function SortableQuestion({
  pergunta,
  selected,
  onSelect,
  onDelete,
}: {
  pergunta: Pergunta;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: pergunta.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border px-2 py-2 ${
        selected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        aria-label="Mover campo"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button onClick={onSelect} className="flex flex-1 items-center gap-2 text-left">
        <span className="text-sm text-foreground">{pergunta.texto || "(sem título)"}</span>
        <Badge className="bg-accent text-accent-foreground">{pergunta.tipo}</Badge>
        {pergunta.obrigatoria && (
          <Badge className="bg-warning/20 text-warning-foreground">obrig.</Badge>
        )}
      </button>
      <button
        onClick={onDelete}
        className="text-muted-foreground hover:text-destructive"
        aria-label="Excluir campo"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

// ============= Properties Panel =============
function PropertiesPanel({
  pergunta,
  perguntas,
  secoes,
  onSaved,
  onClose,
}: {
  pergunta: Pergunta;
  perguntas: Pergunta[];
  secoes: Secao[];
  onSaved: (p: Pergunta) => void;
  onClose: () => void;
}) {
  const [texto, setTexto] = useState(pergunta.texto);
  const [tipo, setTipo] = useState<TipoPergunta>(pergunta.tipo);
  const [obrigatoria, setObrigatoria] = useState(pergunta.obrigatoria);
  const [contextoIa, setContextoIa] = useState(pergunta.contexto_ia ?? "");
  const [chaveLaudo, setChaveLaudo] = useState(pergunta.chave_laudo ?? "");
  const [aplicaA, setAplicaA] = useState(pergunta.entidade_tipo ?? "geral");
  const [condRefId, setCondRefId] = useState<string>(pergunta.condicional_pergunta_id ?? "");
  const [condOp, setCondOp] = useState<string>(pergunta.condicional_operador ?? "igual");
  const [condVal, setCondVal] = useState<string>(pergunta.condicional_valor ?? "");
  const [refOpcoes, setRefOpcoes] = useState<{ id: string; texto: string }[]>([]);
  const [opcoes, setOpcoes] = useState<Opcao[]>([]);
  const [opcoesIniciais, setOpcoesIniciais] = useState<Opcao[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Perguntas elegíveis como gatilho: na mesma seção (acima) ou seções anteriores, excluindo a própria.
  const minhaSecao = secoes.find((s) => s.id === pergunta.secao_id);
  const minhaOrdem = pergunta.ordem;
  const elegiveis = perguntas
    .filter((p) => {
      if (p.id === pergunta.id) return false;
      const sec = secoes.find((s) => s.id === p.secao_id);
      if (!sec || !minhaSecao) return false;
      if (sec.ordem < minhaSecao.ordem) return true;
      if (sec.ordem === minhaSecao.ordem && p.ordem < minhaOrdem) return true;
      return false;
    })
    .sort((a, b) => {
      const sa = secoes.find((s) => s.id === a.secao_id)?.ordem ?? 0;
      const sb = secoes.find((s) => s.id === b.secao_id)?.ordem ?? 0;
      return sa - sb || a.ordem - b.ordem;
    });
  const refPergunta = elegiveis.find((p) => p.id === condRefId);

  useEffect(() => {
    if (!condRefId) {
      setRefOpcoes([]);
      return;
    }
    const ref = perguntas.find((p) => p.id === condRefId);
    if (!ref) return;
    if (ref.tipo === "toggle") {
      setRefOpcoes([
        { id: "sim", texto: "sim" },
        { id: "nao", texto: "nao" },
      ]);
      return;
    }
    if (ref.tipo === "selecao_unica" || ref.tipo === "multipla_escolha") {
      supabase
        .from("opcoes_pergunta")
        .select("id, texto")
        .eq("pergunta_id", condRefId)
        .order("ordem")
        .then(({ data }) => setRefOpcoes((data ?? []) as { id: string; texto: string }[]));
    } else {
      setRefOpcoes([]);
    }
  }, [condRefId, perguntas]);


  useEffect(() => {
    let active = true;
    supabase
      .from("opcoes_pergunta")
      .select("id, texto, ordem")
      .eq("pergunta_id", pergunta.id)
      .order("ordem")
      .then(({ data }) => {
        if (!active) return;
        const list = (data ?? []) as Opcao[];
        setOpcoes(list);
        setOpcoesIniciais(list);
      });
    return () => {
      active = false;
    };
  }, [pergunta.id]);

  const mostraContexto = tipo === "foto" || tipo === "video" || tipo === "audio";
  const mostraOpcoes = tipo === "selecao_unica" || tipo === "multipla_escolha";

  const addOpcao = () =>
    setOpcoes((arr) => [...arr, { id: `new-${Date.now()}-${arr.length}`, texto: "", ordem: arr.length + 1 }]);
  const editOpcao = (id: string, t: string) =>
    setOpcoes((arr) => arr.map((o) => (o.id === id ? { ...o, texto: t } : o)));
  const delOpcao = (id: string) =>
    setOpcoes((arr) => arr.filter((o) => o.id !== id).map((o, i) => ({ ...o, ordem: i + 1 })));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const condicional_pergunta_id = condRefId || null;
    const condicional_operador = condicional_pergunta_id ? condOp : null;
    const condicional_valor = condicional_pergunta_id ? (condVal || null) : null;
    const { error } = await supabase
      .from("perguntas")
      .update({
        texto,
        tipo,
        obrigatoria,
        contexto_ia: mostraContexto ? contextoIa || null : null,
        chave_laudo: chaveLaudo || null,
        entidade_tipo: aplicaA,
        condicional_pergunta_id,
        condicional_operador,
        condicional_valor,
      })
      .eq("id", pergunta.id);
    if (error) {
      setMsg(error.message);
      setSaving(false);
      return;
    }

    if (mostraOpcoes) {
      const limpos = opcoes.filter((o) => o.texto.trim());
      const iniciaisIds = new Set(opcoesIniciais.map((o) => o.id));
      const atuaisIds = new Set(limpos.filter((o) => !o.id.startsWith("new-")).map((o) => o.id));
      const remover = opcoesIniciais.filter((o) => !atuaisIds.has(o.id)).map((o) => o.id);
      if (remover.length) await supabase.from("opcoes_pergunta").delete().in("id", remover);
      for (const o of limpos) {
        if (o.id.startsWith("new-")) {
          await supabase
            .from("opcoes_pergunta")
            .insert({ pergunta_id: pergunta.id, texto: o.texto.trim(), ordem: o.ordem });
        } else if (iniciaisIds.has(o.id)) {
          const orig = opcoesIniciais.find((x) => x.id === o.id)!;
          if (orig.texto !== o.texto || orig.ordem !== o.ordem) {
            await supabase
              .from("opcoes_pergunta")
              .update({ texto: o.texto.trim(), ordem: o.ordem })
              .eq("id", o.id);
          }
        }
      }
    } else if (opcoesIniciais.length) {
      await supabase
        .from("opcoes_pergunta")
        .delete()
        .in("id", opcoesIniciais.map((o) => o.id));
      setOpcoesIniciais([]);
      setOpcoes([]);
    }

    onSaved({
      ...pergunta,
      texto,
      tipo,
      obrigatoria,
      contexto_ia: mostraContexto ? contextoIa || null : null,
      chave_laudo: chaveLaudo || null,
      entidade_tipo: aplicaA,
      condicional_pergunta_id,
      condicional_operador,
      condicional_valor,
    });
    setMsg("Campo salvo");
    setSaving(false);
    setTimeout(() => setMsg(null), 1500);
  };

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Propriedades do campo</h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Título / Label</Label>
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>

        <div>
          <Label>Tipo</Label>
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoPergunta)}>
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </div>

        <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
          <span className="font-medium">Obrigatório</span>
          <input
            type="checkbox"
            checked={obrigatoria}
            onChange={(e) => setObrigatoria(e.target.checked)}
            className="h-4 w-4"
          />
        </label>

        <div>
          <Label>Aplica-se a</Label>
          <Select value={aplicaA} onChange={(e) => setAplicaA(e.target.value)}>
            {APLICA_A_OPCOES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Geral aparece uma vez. Posto, ilha, bomba, bico, comboio ou frota repetem a pergunta para cada item da estrutura do escopo, com respostas independentes.
          </p>
        </div>

        <div>
          <Label>Chave do laudo</Label>
          <Select value={chaveLaudo} onChange={(e) => setChaveLaudo(e.target.value)}>
            <option value="">Nao vincular</option>
            {CHAVES_LAUDO.map((c) => (
              <option key={c.chave} value={c.chave}>
                {c.rotulo}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            {CHAVES_LAUDO.find((c) => c.chave === chaveLaudo)?.descricao ??
              "Vincule a resposta a uma variavel usada na montagem do laudo estruturado."}
          </p>
        </div>

        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Mostrar somente se
          </p>
          <div className="mt-2 space-y-2">
            <Select value={condRefId} onChange={(e) => setCondRefId(e.target.value)}>
              <option value="">Sempre mostrar</option>
              {elegiveis.map((p) => (
                <option key={p.id} value={p.id}>
                  {(p.texto || "(sem título)").slice(0, 60)}
                </option>
              ))}
            </Select>
            {condRefId && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr]">
                <Select value={condOp} onChange={(e) => setCondOp(e.target.value)}>
                  <option value="igual">for igual a</option>
                  <option value="diferente">for diferente de</option>
                  <option value="contem">contiver</option>
                </Select>
                {refOpcoes.length > 0 ? (
                  <Select value={condVal} onChange={(e) => setCondVal(e.target.value)}>
                    <option value="">Selecione…</option>
                    {refOpcoes.map((o) => (
                      <option key={o.id} value={o.texto}>{o.texto}</option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    value={condVal}
                    onChange={(e) => setCondVal(e.target.value)}
                    placeholder={
                      refPergunta?.tipo === "toggle" ? "sim ou nao" : "valor esperado"
                    }
                  />
                )}
              </div>
            )}
            {condRefId && (
              <p className="text-xs text-muted-foreground">
                A pergunta só aparece quando a resposta acima satisfaz a condição.
              </p>
            )}
          </div>
        </div>


        {mostraContexto && (
          <div>
            <Label>Contexto IA</Label>
            <textarea
              value={contextoIa}
              onChange={(e) => setContextoIa(e.target.value)}
              rows={3}
              placeholder={
                tipo === "foto"
                  ? "Ex: foto frontal do disjuntor mostrando o modelo"
                  : "Ex: descreva as condições do quadro elétrico"
              }
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Texto enviado à IA para validar/orientar a resposta.
            </p>
          </div>
        )}

        {mostraOpcoes && (
          <div>
            <Label>Opções</Label>
            <ul className="space-y-2">
              {opcoes.map((o) => (
                <li key={o.id} className="flex items-center gap-2">
                  <Input
                    value={o.texto}
                    onChange={(e) => editOpcao(o.id, e.target.value)}
                    placeholder="Texto da opção"
                  />
                  <button
                    onClick={() => delOpcao(o.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remover opção"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={addOpcao}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar opção
            </button>
          </div>
        )}

        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando…" : "Salvar campo"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
