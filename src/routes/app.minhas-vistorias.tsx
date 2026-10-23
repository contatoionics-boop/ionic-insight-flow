import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, ChevronRight, Route as RouteIcon } from "lucide-react";

import { AceitesPendentes } from "@/components/agent/AceitesPendentes";
import { RoteiroTimeline, type CasoCard } from "@/components/agent/RoteiroTimeline";
import { ResumoRespostasModal } from "@/components/agent/ResumoRespostas";
import { listarMinhasVistorias } from "@/lib/casos.functions";
import { listarProgressoMeusCasos, type ProgressoCaso } from "@/lib/agente-progresso.functions";
import { listarAgendamentosDoAgente, type AceiteAgendamento } from "@/lib/agendamentos.functions";
import { agruparPorDia, montarParadas, separarPorAceite } from "@/lib/agente-roteiro";

export const Route = createFileRoute("/app/minhas-vistorias")({
  head: () => ({
    meta: [
      { title: "Meus mapeamentos | IONICS" },
      { name: "description", content: "Consulte e execute os mapeamentos técnicos atribuídos a você." },
      { property: "og:title", content: "Meus mapeamentos | IONICS" },
      { property: "og:description", content: "Consulte e execute os mapeamentos técnicos atribuídos a você." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // ?aba=aceitar mostra os agendamentos a aceitar; sem parâmetro mostra o roteiro.
  validateSearch: (s: Record<string, unknown>): { aba?: "aceitar" } => (s.aba === "aceitar" ? { aba: "aceitar" } : {}),
  component: MinhasVistoriasPage,
});

/** Avisa o menu inferior para recontar os agendamentos a aceitar. */
const EVENTO_ACEITE = "agente:aceite-mudou";

function MinhasVistoriasPage() {
  const { aba } = Route.useSearch();
  const navigate = useNavigate();
  const load = useServerFn(listarMinhasVistorias);
  const loadAgendamentos = useServerFn(listarAgendamentosDoAgente);
  const loadProgresso = useServerFn(listarProgressoMeusCasos);

  const [rows, setRows] = useState<CasoCard[]>([]);
  const [agendamentos, setAgendamentos] = useState<AceiteAgendamento[]>([]);
  const [progresso, setProgresso] = useState<ProgressoCaso[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumoCasoId, setResumoCasoId] = useState<string | null>(null);

  const reload = async () => {
    // O progresso é o cálculo mais pesado: a tela aparece sem esperar por ele.
    void loadProgresso()
      .then((prog) => setProgresso(prog ?? []))
      .catch(() => {});
    const [d, ags] = await Promise.all([load(), loadAgendamentos()]);
    setRows((d ?? []) as unknown as CasoCard[]);
    setAgendamentos(ags ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aoMudarAceite = async () => {
    await reload();
    window.dispatchEvent(new Event(EVENTO_ACEITE));
  };

  const progressoMap = useMemo(() => new Map(progresso.map((p) => [p.casoId, p])), [progresso]);

  const { pendentes, recusados, grupos, entregues, totalAFazer } = useMemo(() => {
    const aceites = new Map(agendamentos.map((a) => [a.id, a.aceite_status]));
    const sep = separarPorAceite(rows, aceites);
    const { ativas, entregues: ent } = montarParadas(sep.aceitos);
    return {
      pendentes: agendamentos.filter((a) => a.aceite_status === "aguardando_aceite"),
      recusados: agendamentos.filter((a) => a.aceite_status === "recusado_pelo_agente"),
      grupos: agruparPorDia(ativas, new Date()),
      entregues: ent,
      totalAFazer: ativas.reduce((n, p) => n + p.casos.filter((c) => !["aguardando_revisao", "aprovado", "concluido"].includes(c.status)).length, 0),
    };
  }, [rows, agendamentos]);

  const irPara = (a?: "aceitar") => navigate({ to: "/app/minhas-vistorias", search: a ? { aba: a } : {} });

  if (loading) {
    return <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Carregando…</div>;
  }

  if (aba === "aceitar") {
    return (
      <AceitesPendentes
        pendentes={pendentes}
        recusados={recusados}
        onMudou={aoMudarAceite}
        onIrParaRoteiro={() => irPara()}
      />
    );
  }

  const paradas = grupos.reduce((n, g) => n + g.paradas.length, 0);

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <ResumoRespostasModal
        casoId={resumoCasoId}
        open={!!resumoCasoId}
        onClose={() => setResumoCasoId(null)}
      />

      <div className="space-y-1">
        <h1 className="text-2xl font-bold leading-tight text-foreground">Meu roteiro</h1>
        <p className="text-sm text-muted-foreground">
          {paradas === 0
            ? "Nenhuma parada aceita no momento."
            : `${paradas} ${paradas === 1 ? "parada" : "paradas"} · ${totalAFazer} ${totalAFazer === 1 ? "formulário" : "formulários"} a fazer. Siga a ordem numerada.`}
        </p>
      </div>

      {pendentes.length > 0 && (
        <button
          type="button"
          onClick={() => irPara("aceitar")}
          className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[#f3e0bc] bg-[#f8f5f1] px-4 py-3 text-left"
        >
          <BellRing className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
          <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">
            {pendentes.length} {pendentes.length === 1 ? "agendamento aguarda" : "agendamentos aguardam"} o seu aceite
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      )}

      {paradas === 0 && entregues.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-6 text-center">
          <RouteIcon className="h-8 w-8 text-muted-foreground" aria-hidden />
          <b>Seu roteiro está vazio.</b>
          <p className="text-sm text-muted-foreground">
            Quando você aceitar um agendamento, ele aparece aqui, na ordem em que deve ser feito.
          </p>
        </div>
      ) : (
        <RoteiroTimeline
          grupos={grupos}
          entregues={entregues}
          progresso={progressoMap}
          onVerRespostas={setResumoCasoId}
        />
      )}
    </div>
  );
}
