import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Card, Badge, Button, Modal } from "@/components/ui-bits";
import { statusLabels, statusTones, type CaseStatus } from "@/lib/casos";
import { listarMinhasVistorias } from "@/lib/casos.functions";
import {
  listarAgendamentosDoAgente,
  confirmarAgendamentoAgente,
  recusarAgendamentoAgente,
  type AceiteAgendamento,
} from "@/lib/agendamentos.functions";
import { CalendarDays, ListChecks, MapPin, Play, Lock, CheckCircle2, XCircle, BellRing } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/minhas-vistorias")({
  component: MinhasVistoriasPage,
});

type Vistoria = {
  id: string;
  codigo: string;
  status: CaseStatus;
  agendado_em: string | null;
  duracao_min: number | null;
  endereco_vistoria: string | null;
  observacoes_agendamento: string | null;
  agendamento_id: string;
  unidade: { nome: string; matriz: { nome: string; empresa: { nome: string } | null } | null } | null;
  formulario: { nome: string } | null;
};

type Grupo = {
  agendamentoId: string;
  cliente: string;
  unidade: string | null;
  agendadoEm: string | null;
  endereco: string | null;
  observacoes: string | null;
  casos: Vistoria[];
  status: "concluido" | "em_andamento" | "agendado";
};

function fmtData(iso: string | null) {
  if (!iso) return "Sem data";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PENDENTES: CaseStatus[] = ["agendado", "em_andamento", "rascunho"];
const FINALIZADOS: CaseStatus[] = ["aguardando_revisao", "aprovado", "concluido"];

function agrupar(rows: Vistoria[]): Grupo[] {
  const map = new Map<string, Grupo>();
  for (const r of rows) {
    const key = r.agendamento_id;
    if (!map.has(key)) {
      map.set(key, {
        agendamentoId: key,
        cliente: r.unidade?.matriz?.empresa?.nome ?? "—",
        unidade: r.unidade?.nome ?? null,
        agendadoEm: r.agendado_em,
        endereco: r.endereco_vistoria,
        observacoes: r.observacoes_agendamento,
        casos: [],
        status: "agendado",
      });
    }
    map.get(key)!.casos.push(r);
  }
  for (const g of map.values()) {
    if (g.casos.every((c) => FINALIZADOS.includes(c.status))) g.status = "concluido";
    else if (g.casos.some((c) => c.status === "em_andamento")) g.status = "em_andamento";
    else g.status = "agendado";
  }
  return [...map.values()];
}

function MinhasVistoriasPage() {
  const load = useServerFn(listarMinhasVistorias);
  const loadAgendamentos = useServerFn(listarAgendamentosDoAgente);
  const confirmar = useServerFn(confirmarAgendamentoAgente);
  const recusar = useServerFn(recusarAgendamentoAgente);
  const [rows, setRows] = useState<Vistoria[]>([]);
  const [agendamentos, setAgendamentos] = useState<AceiteAgendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"lista" | "agenda">("lista");
  const [recusando, setRecusando] = useState<AceiteAgendamento | null>(null);
  const [motivo, setMotivo] = useState("");
  const [working, setWorking] = useState(false);

  const reload = async () => {
    const [d, ags] = await Promise.all([load(), loadAgendamentos()]);
    setRows((d ?? []) as unknown as Vistoria[]);
    setAgendamentos(ags ?? []);
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const pendentesAceite = agendamentos.filter((a) => a.aceite_status === "aguardando_aceite");

  const handleConfirmar = async (ag: AceiteAgendamento) => {
    setWorking(true);
    try { await confirmar({ data: { agendamentoId: ag.id } }); await reload(); }
    finally { setWorking(false); }
  };

  const handleRecusar = async () => {
    if (!recusando || motivo.trim().length < 3) return;
    setWorking(true);
    try {
      await recusar({ data: { agendamentoId: recusando.id, motivo: motivo.trim() } });
      toast.success("Agendamento recusado. Ian foi notificado para reagendar.");
      setRecusando(null); setMotivo("");
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível recusar o agendamento.");
    } finally { setWorking(false); }
  };

  const grupos = useMemo(() => agrupar(rows), [rows]);
  const pendentes = grupos.filter((g) => g.status !== "concluido");
  const concluidos = grupos.filter((g) => g.status === "concluido");

  const agora = Date.now();
  const futuras = pendentes
    .filter((g) => g.agendadoEm && new Date(g.agendadoEm).getTime() >= agora - 60 * 60_000)
    .sort((a, b) => new Date(a.agendadoEm!).getTime() - new Date(b.agendadoEm!).getTime());

  const porDia = useMemo(() => {
    const map = new Map<string, Grupo[]>();
    for (const g of futuras) {
      if (!g.agendadoEm) continue;
      const d = new Date(g.agendadoEm);
      const key = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
      const arr = map.get(key) ?? [];
      arr.push(g);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [futuras]);

  return (
    <div>
      <PageHeader
        title="Meus mapeamentos"
        description="Cada agendamento pode ter vários formulários. Conclua um antes de iniciar o próximo."
      />

      {pendentesAceite.length > 0 && (
        <div className="mb-4 space-y-2">
          {pendentesAceite.map((ag) => (
            <Card key={ag.id} className="border-warning/40 bg-warning/5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <BellRing className="h-4 w-4 text-warning-foreground" />
                    Novo agendamento — confirmar?
                  </div>
                  <p className="mt-1 text-sm">
                    <strong>{ag.cliente_nome ?? "Cliente"}</strong>
                    {ag.unidade_nome ? <span className="text-muted-foreground"> · {ag.unidade_nome}</span> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <CalendarDays className="mr-1 inline h-3 w-3" />
                    {new Date(ag.agendado_em).toLocaleString("pt-BR")}
                  </p>
                  {ag.endereco_vistoria && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <MapPin className="mr-1 inline h-3 w-3" />{ag.endereco_vistoria}
                    </p>
                  )}
                  {ag.observacoes_agendamento && (
                    <p className="mt-1 text-xs italic text-muted-foreground">{ag.observacoes_agendamento}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setRecusando(ag); setMotivo(""); }} disabled={working}>
                    <XCircle className="mr-1 h-4 w-4" /> Recusar / Reagendar
                  </Button>
                  <Button onClick={() => handleConfirmar(ag)} disabled={working}>
                    <CheckCircle2 className="mr-1 h-4 w-4" /> Confirmar agendamento
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!recusando} onClose={() => setRecusando(null)} title="Recusar / Solicitar reagendamento">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Informe o motivo da recusa. Ian receberá uma notificação e poderá reagendar.
          </p>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Ex: estarei em outro agendamento já confirmado nesse dia."
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRecusando(null)} disabled={working}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRecusar} disabled={working || motivo.trim().length < 3}>
              Recusar agendamento
            </Button>
          </div>
        </div>
      </Modal>


      <div className="mb-4 inline-flex rounded-md border border-border bg-card p-1">
        <button
          onClick={() => setTab("lista")}
          className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium ${
            tab === "lista" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          <ListChecks className="h-4 w-4" /> Lista
        </button>
        <button
          onClick={() => setTab("agenda")}
          className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium ${
            tab === "agenda" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          <CalendarDays className="h-4 w-4" /> Agenda
        </button>
      </div>

      {loading ? (
        <Card><p className="text-sm text-muted-foreground">Carregando...</p></Card>
      ) : tab === "lista" ? (
        <div className="space-y-6">
          <Section title="Pendentes" items={pendentes} empty="Nenhum agendamento pendente." />
          <Section title="Concluídos" items={concluidos} empty="Nenhum agendamento concluído." />
        </div>
      ) : (
        <div className="space-y-4">
          {porDia.length === 0 ? (
            <Card><p className="text-sm text-muted-foreground">Nenhum mapeamento futuro agendado.</p></Card>
          ) : (
            porDia.map(([dia, items]) => (
              <div key={dia}>
                <h3 className="mb-2 text-sm font-semibold capitalize text-foreground">{dia}</h3>
                <div className="space-y-2">
                  {items.map((g) => <AgendamentoCard key={g.agendamentoId} g={g} />)}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, items, empty }: { title: string; items: Grupo[]; empty: string }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-foreground">
        {title} <span className="text-muted-foreground">({items.length})</span>
      </h3>
      {items.length === 0 ? (
        <Card><p className="text-sm text-muted-foreground">{empty}</p></Card>
      ) : (
        <div className="space-y-2">
          {items.map((g) => <AgendamentoCard key={g.agendamentoId} g={g} />)}
        </div>
      )}
    </div>
  );
}

function AgendamentoCard({ g }: { g: Grupo }) {
  const emAndamento = g.casos.find((c) => c.status === "em_andamento");
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground">
            {g.cliente}
            {g.unidade && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">· {g.unidade}</span>
            )}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> {fmtData(g.agendadoEm)}
            </span>
            {g.endereco && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {g.endereco}
              </span>
            )}
          </div>
          {g.observacoes && (
            <p className="mt-2 text-xs italic text-muted-foreground">{g.observacoes}</p>
          )}
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        {g.casos.map((c) => {
          const finalizado = FINALIZADOS.includes(c.status);
          const isCurrent = c.status === "em_andamento";
          const podeIniciar = !finalizado && (!emAndamento || isCurrent);
          return (
            <div
              key={c.id}
              className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">{c.codigo}</span>
                  <Badge className={statusTones[c.status]}>{statusLabels[c.status]}</Badge>
                </div>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {c.formulario?.nome ?? "—"}
                </p>
              </div>
              {podeIniciar ? (
                <Link to="/app/vistoria/$casoId" params={{ casoId: c.id }}>
                  <Button>
                    <Play className="mr-1 h-4 w-4" />
                    {isCurrent ? "Continuar" : "Iniciar"}
                  </Button>
                </Link>
              ) : !finalizado ? (
                <Button disabled title="Termine o formulário em andamento antes">
                  <Lock className="mr-1 h-4 w-4" />
                  Bloqueado
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
