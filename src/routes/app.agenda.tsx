import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Card, Badge, Button, Select, Label, Input } from "@/components/ui-bits";
import { DatePicker } from "@/components/ui/date-picker";
import { statusLabels, statusTones, type CaseStatus } from "@/lib/casos";
import { listarAgendaAdmin, cancelarVistoria, deletarVistoria, reagendarVistoria } from "@/lib/casos.functions";
import { listTechnicalAgents } from "@/lib/admin-users.functions";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, PlusCircle, User2, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/agenda")({
  component: AgendaPage,
});

type Evento = {
  id: string;
  codigo: string;
  status: CaseStatus;
  agendado_em: string;
  duracao_min: number | null;
  endereco_vistoria: string | null;
  observacoes_agendamento: string | null;
  agente_id: string | null;
  unidade: { nome: string; matriz: { nome: string; empresa: { nome: string } | null } | null } | null;
  agente: { nome: string } | null;
  formulario: { nome: string } | null;
};

function startOfMonth(d: Date) { const x = new Date(d); x.setDate(1); x.setHours(0, 0, 0, 0); return x; }
function endOfMonth(d: Date) { const x = new Date(d); x.setMonth(x.getMonth() + 1, 0); x.setHours(23, 59, 59, 999); return x; }

function AgendaPage() {
  const carregar = useServerFn(listarAgendaAdmin);
  const carregarAgentes = useServerFn(listTechnicalAgents);
  const cancelar = useServerFn(cancelarVistoria);
  const deletar = useServerFn(deletarVistoria);
  const reagendar = useServerFn(reagendarVistoria);

  const [mes, setMes] = useState(() => startOfMonth(new Date()));
  const [agenteId, setAgenteId] = useState<string>("");
  const [agentes, setAgentes] = useState<{ id: string; nome: string }[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Evento | null>(null);
  const [editing, setEditing] = useState<Evento | null>(null);
  const [edData, setEdData] = useState("");
  const [edHora, setEdHora] = useState("09:00");
  const [edEndereco, setEdEndereco] = useState("");
  const [edObs, setEdObs] = useState("");
  const [edSaving, setEdSaving] = useState(false);
  const [edError, setEdError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Evento | null>(null);

  useEffect(() => { carregarAgentes().then((d) => setAgentes((d ?? []) as any)); }, [carregarAgentes]);

  useEffect(() => {
    setLoading(true);
    carregar({
      data: {
        inicio: startOfMonth(mes).toISOString(),
        fim: endOfMonth(mes).toISOString(),
        agenteId: agenteId || undefined,
      },
    }).then((d) => {
      setEventos((d ?? []) as unknown as Evento[]);
      setLoading(false);
    });
  }, [carregar, mes, agenteId]);

  const dias = useMemo(() => {
    const inicio = startOfMonth(mes);
    const fim = endOfMonth(mes);
    const arr: Date[] = [];
    // start on Sunday before
    const first = new Date(inicio);
    first.setDate(first.getDate() - first.getDay());
    const last = new Date(fim);
    last.setDate(last.getDate() + (6 - last.getDay()));
    for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) arr.push(new Date(d));
    return arr;
  }, [mes]);

  const eventosPorDia = useMemo(() => {
    const map = new Map<string, Evento[]>();
    for (const e of eventos) {
      const k = new Date(e.agendado_em).toDateString();
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    return map;
  }, [eventos]);

  const handleCancelar = async (id: string) => {
    if (!confirm("Cancelar esta vistoria?")) return;
    await cancelar({ data: { casoId: id } });
    setSel(null);
    setMes(new Date(mes));
  };

  const reload = () => setMes(new Date(mes));

  const openEdit = (e: Evento) => {
    const dt = new Date(e.agendado_em);
    const pad = (n: number) => String(n).padStart(2, "0");
    setEdData(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`);
    setEdHora(`${pad(dt.getHours())}:${pad(dt.getMinutes())}`);
    setEdEndereco(e.endereco_vistoria ?? "");
    setEdObs(e.observacoes_agendamento ?? "");
    setEdError(null);
    setEditing(e);
    setSel(null);
  };

  const submitEdit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editing) return;
    setEdSaving(true);
    setEdError(null);
    try {
      const agendadoEm = new Date(`${edData}T${edHora}:00`).toISOString();
      await reagendar({
        data: {
          casoId: editing.id,
          agendadoEm,
          duracaoMin: editing.duracao_min ?? 60,
          enderecoVistoria: edEndereco || null,
          observacoes: edObs || null,
        },
      });
      setEditing(null);
      reload();
    } catch (e: any) {
      setEdError(e?.message ?? "Erro ao salvar.");
    } finally {
      setEdSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    await deletar({ data: { casoId: toDelete.id } });
    setToDelete(null);
    setSel(null);
    reload();
  };

  return (
    <div>
      <PageHeader
        title="Agenda"
        description="Mapeamentos agendados no mês."
        actions={
          <Link to="/app/new-case">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Agendar mapeamento
            </Button>

          </Link>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[180px] text-center text-sm font-semibold capitalize">
              {mes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </div>
            <Button variant="outline" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={() => setMes(startOfMonth(new Date()))}>Hoje</Button>
          </div>
          <div className="ml-auto min-w-[220px]">
            <Label>Agente Técnico</Label>
            <Select value={agenteId} onChange={(e) => setAgenteId(e.target.value)}>
              <option value="">Todos</option>
              {agentes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        <div className="grid grid-cols-7 gap-px bg-border text-xs">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} className="bg-muted px-2 py-1 text-center font-semibold text-muted-foreground">{d}</div>
          ))}
          {dias.map((d) => {
            const inMonth = d.getMonth() === mes.getMonth();
            const items = eventosPorDia.get(d.toDateString()) ?? [];
            return (
              <div key={d.toISOString()} className={`min-h-[88px] bg-card p-1 ${inMonth ? "" : "opacity-40"}`}>
                <div className="text-[10px] font-semibold text-muted-foreground">{d.getDate()}</div>
                <div className="mt-1 space-y-0.5">
                  {items.slice(0, 3).map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setSel(e)}
                      className="block w-full truncate rounded bg-primary/10 px-1 py-0.5 text-left text-[10px] text-primary hover:bg-primary/20"
                    >
                      {new Date(e.agendado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} {e.unidade?.matriz?.empresa?.nome ?? ""}{e.unidade?.nome ? ` · ${e.unidade.nome}` : ""}
                    </button>
                  ))}
                  {items.length > 3 && <div className="text-[10px] text-muted-foreground">+{items.length - 3}</div>}
                </div>
              </div>
            );
          })}
        </div>
        {loading && <p className="mt-3 text-xs text-muted-foreground">Carregando...</p>}
      </Card>

      {sel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSel(null)}>
          <Card className="w-full max-w-md" >
            <div onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{sel.codigo}</span>
                <Badge className={statusTones[sel.status]}>{statusLabels[sel.status]}</Badge>
              </div>
              <h3 className="mt-2 text-lg font-semibold">{sel.unidade?.matriz?.empresa?.nome}{sel.unidade?.nome ? <span className="ml-1 text-sm font-normal text-muted-foreground">· {sel.unidade.nome}</span> : null}</h3>
              <p className="text-sm text-muted-foreground">{sel.formulario?.nome}</p>
              <div className="mt-3 space-y-1 text-sm">
                <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {new Date(sel.agendado_em).toLocaleString("pt-BR")} · {sel.duracao_min} min</p>
                {sel.agente?.nome && <p className="flex items-center gap-2"><User2 className="h-4 w-4" /> {sel.agente.nome}</p>}
                {sel.endereco_vistoria && <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {sel.endereco_vistoria}</p>}
              </div>
              {sel.observacoes_agendamento && (
                <p className="mt-2 rounded bg-muted/40 p-2 text-xs italic">{sel.observacoes_agendamento}</p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSel(null)}>Fechar</Button>
                {sel.status !== "cancelado" && sel.status !== "aprovado" && sel.status !== "concluido" && (
                  <Button variant="destructive" onClick={() => handleCancelar(sel.id)}>Cancelar vistoria</Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
