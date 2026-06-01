import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Card, Badge, Button } from "@/components/ui-bits";
import { statusLabels, statusTones, type CaseStatus } from "@/lib/casos";
import { listarMinhasVistorias } from "@/lib/casos.functions";
import { CalendarDays, ListChecks, MapPin, Play } from "lucide-react";

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
  cliente: { nome: string } | null;
  formulario: { nome: string } | null;
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

function MinhasVistoriasPage() {
  const load = useServerFn(listarMinhasVistorias);
  const [rows, setRows] = useState<Vistoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"lista" | "agenda">("lista");

  useEffect(() => {
    load().then((d) => {
      setRows((d ?? []) as unknown as Vistoria[]);
      setLoading(false);
    });
  }, [load]);

  const agora = Date.now();
  const pendentes = rows.filter(
    (r) => (r.status === "agendado" || r.status === "em_andamento" || r.status === "rascunho") && r.status !== "cancelado",
  );
  const concluidas = rows.filter((r) => ["aguardando_revisao", "aprovado", "concluido"].includes(r.status));
  const futuras = pendentes
    .filter((r) => r.agendado_em && new Date(r.agendado_em).getTime() >= agora - 60 * 60_000)
    .sort((a, b) => new Date(a.agendado_em!).getTime() - new Date(b.agendado_em!).getTime());

  const porDia = useMemo(() => {
    const map = new Map<string, Vistoria[]>();
    for (const v of futuras) {
      if (!v.agendado_em) continue;
      const d = new Date(v.agendado_em);
      const key = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
      const arr = map.get(key) ?? [];
      arr.push(v);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [futuras]);

  return (
    <div>
      <PageHeader
        title="Minhas vistorias"
        description="Vistorias agendadas para você. Clique em iniciar para preencher o formulário."
      />

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
          <Section title="Pendentes" items={pendentes} empty="Nenhuma vistoria pendente." />
          <Section title="Concluídas" items={concluidas} empty="Nenhuma vistoria concluída." />
        </div>
      ) : (
        <div className="space-y-4">
          {porDia.length === 0 ? (
            <Card><p className="text-sm text-muted-foreground">Nenhuma vistoria futura agendada.</p></Card>
          ) : (
            porDia.map(([dia, items]) => (
              <div key={dia}>
                <h3 className="mb-2 text-sm font-semibold capitalize text-foreground">{dia}</h3>
                <div className="space-y-2">
                  {items.map((v) => <VistoriaCard key={v.id} v={v} />)}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, items, empty }: { title: string; items: Vistoria[]; empty: string }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-foreground">{title} <span className="text-muted-foreground">({items.length})</span></h3>
      {items.length === 0 ? (
        <Card><p className="text-sm text-muted-foreground">{empty}</p></Card>
      ) : (
        <div className="space-y-2">
          {items.map((v) => <VistoriaCard key={v.id} v={v} />)}
        </div>
      )}
    </div>
  );
}

function VistoriaCard({ v }: { v: Vistoria }) {
  const podeIniciar = v.status === "agendado" || v.status === "em_andamento" || v.status === "rascunho";
  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{v.codigo}</span>
          <Badge className={statusTones[v.status]}>{statusLabels[v.status]}</Badge>
        </div>
        <p className="mt-1 text-base font-semibold text-foreground">{v.cliente?.nome ?? "—"}</p>
        <p className="text-sm text-muted-foreground">{v.formulario?.nome ?? "—"}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {fmtData(v.agendado_em)}{v.duracao_min ? ` · ${v.duracao_min} min` : ""}</span>
          {v.endereco_vistoria && (
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {v.endereco_vistoria}</span>
          )}
        </div>
        {v.observacoes_agendamento && (
          <p className="mt-2 text-xs italic text-muted-foreground">{v.observacoes_agendamento}</p>
        )}
      </div>
      {podeIniciar && (
        <Link to="/app/vistoria/$casoId" params={{ casoId: v.id }}>
          <Button>
            <Play className="mr-1 h-4 w-4" />
            {v.status === "em_andamento" ? "Continuar" : "Iniciar"}
          </Button>
        </Link>
      )}
    </Card>
  );
}
