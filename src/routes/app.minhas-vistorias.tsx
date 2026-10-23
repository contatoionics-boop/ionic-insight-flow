import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Modal } from "@/components/ui-bits";
import type { CaseStatus } from "@/lib/casos";
import { listarMinhasVistorias } from "@/lib/casos.functions";
import {
  listarProgressoMeusCasos,
  type ProgressoCaso,
} from "@/lib/agente-progresso.functions";
import { ResumoRespostasModal } from "@/components/agent/ResumoRespostas";
import {
  listarAgendamentosDoAgente,
  confirmarAgendamentoAgente,
  recusarAgendamentoAgente,
  type AceiteAgendamento,
} from "@/lib/agendamentos.functions";
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  CheckCircle2,
  MapPin,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

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

const FINALIZADOS: CaseStatus[] = ["aguardando_revisao", "aprovado", "concluido"];

/** Ordem em campo: o que está em andamento primeiro, depois os aceitos (por data) e por fim os entregues. */
const ORDEM: Partial<Record<CaseStatus, number>> = {
  em_andamento: 0,
  agendado: 1,
  rascunho: 1,
  aguardando_revisao: 2,
  aprovado: 3,
  concluido: 3,
};

const BADGE: Partial<Record<CaseStatus, { cls: string; rotulo: string; aceito?: boolean }>> = {
  agendado: { cls: "bg-emerald-100 text-emerald-800", rotulo: "Aceito", aceito: true },
  rascunho: { cls: "bg-emerald-100 text-emerald-800", rotulo: "Aceito", aceito: true },
  em_andamento: { cls: "bg-blue-100 text-blue-800", rotulo: "Em andamento" },
  aguardando_revisao: { cls: "bg-muted text-muted-foreground", rotulo: "Entregue para revisão" },
  aprovado: { cls: "bg-emerald-100 text-emerald-800", rotulo: "Aprovado" },
  concluido: { cls: "bg-emerald-100 text-emerald-800", rotulo: "Concluído" },
};

function MinhasVistoriasPage() {
  const load = useServerFn(listarMinhasVistorias);
  const loadAgendamentos = useServerFn(listarAgendamentosDoAgente);
  const confirmar = useServerFn(confirmarAgendamentoAgente);
  const recusar = useServerFn(recusarAgendamentoAgente);
  const loadProgresso = useServerFn(listarProgressoMeusCasos);

  const [rows, setRows] = useState<Vistoria[]>([]);
  const [agendamentos, setAgendamentos] = useState<AceiteAgendamento[]>([]);
  const [progresso, setProgresso] = useState<ProgressoCaso[]>([]);
  const [loading, setLoading] = useState(true);
  const [recusando, setRecusando] = useState<AceiteAgendamento | null>(null);
  const [motivo, setMotivo] = useState("");
  const [working, setWorking] = useState(false);
  const [resumoCasoId, setResumoCasoId] = useState<string | null>(null);

  const progressoMap = useMemo(() => new Map(progresso.map((p) => [p.casoId, p])), [progresso]);

  const reload = async () => {
    // O progresso é o cálculo mais pesado: a lista aparece sem esperar por ele.
    void loadProgresso()
      .then((prog) => setProgresso(prog ?? []))
      .catch(() => {});
    const [d, ags] = await Promise.all([load(), loadAgendamentos()]);
    setRows((d ?? []) as unknown as Vistoria[]);
    setAgendamentos(ags ?? []);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendentesAceite = agendamentos.filter((a) => a.aceite_status === "aguardando_aceite");

  const handleConfirmar = async (ag: AceiteAgendamento) => {
    setWorking(true);
    try {
      await confirmar({ data: { agendamentoId: ag.id } });
      toast.success("Agendamento confirmado.");
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível confirmar.");
    } finally {
      setWorking(false);
    }
  };

  const handleRecusar = async () => {
    if (!recusando || motivo.trim().length < 5) return;
    setWorking(true);
    try {
      await recusar({ data: { agendamentoId: recusando.id, motivo: motivo.trim() } });
      toast.success("Recusa enviada com o motivo.");
      setRecusando(null);
      setMotivo("");
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível recusar o agendamento.");
    } finally {
      setWorking(false);
    }
  };

  const emCampo = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const d = (ORDEM[a.status] ?? 1) - (ORDEM[b.status] ?? 1);
        if (d) return d;
        return new Date(a.agendado_em ?? 0).getTime() - new Date(b.agendado_em ?? 0).getTime();
      }),
    [rows],
  );

  /** Em um mesmo agendamento, termine o formulário em andamento antes de iniciar o próximo. */
  const emAndamentoPorAgendamento = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.status === "em_andamento") m.set(r.agendamento_id, r.id);
    return m;
  }, [rows]);

  return (
    <div className="space-y-4">
      <ResumoRespostasModal
        casoId={resumoCasoId}
        open={!!resumoCasoId}
        onClose={() => setResumoCasoId(null)}
      />

      <div className="space-y-2">
        <h1 className="text-2xl font-bold leading-tight text-foreground">Meus mapeamentos</h1>
        <p className="text-sm text-muted-foreground">
          Cada agendamento pode ter vários formulários. Conclua um antes de iniciar o próximo.
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <>
          {pendentesAceite.length > 0 && (
            <section className="space-y-3">
              <Rotulo>Aguardando sua confirmação</Rotulo>
              {pendentesAceite.map((ag) => (
                <article
                  key={ag.id}
                  className="flex flex-col gap-2 rounded-xl border border-[#f3e0bc] bg-[#f8f5f1] p-4"
                >
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <BellRing className="h-4 w-4 shrink-0" aria-hidden /> Novo agendamento — confirmar?
                  </div>
                  <div className="font-semibold text-foreground">
                    {ag.cliente_nome ?? "Cliente"}
                    {ag.unidade_nome ? <span className="font-normal text-muted-foreground"> · {ag.unidade_nome}</span> : null}
                  </div>
                  <Meta icone={<CalendarDays className="h-3.5 w-3.5" />}>
                    {new Date(ag.agendado_em).toLocaleString("pt-BR")}
                  </Meta>
                  {ag.endereco_vistoria && <Meta icone={<MapPin className="h-3.5 w-3.5" />}>{ag.endereco_vistoria}</Meta>}
                  {ag.observacoes_agendamento && (
                    <p className="whitespace-pre-line break-words text-xs italic leading-[17px] text-muted-foreground">
                      {ag.observacoes_agendamento}
                    </p>
                  )}
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <Botao
                      variante="contorno"
                      onClick={() => {
                        setRecusando(ag);
                        setMotivo("");
                      }}
                      disabled={working}
                    >
                      <XCircle className="h-4 w-4" aria-hidden /> Recusar / Reagendar
                    </Botao>
                    <Botao variante="primario" onClick={() => handleConfirmar(ag)} disabled={working}>
                      <CheckCircle2 className="h-4 w-4" aria-hidden /> Confirmar agendamento
                    </Botao>
                  </div>
                </article>
              ))}
            </section>
          )}

          <section className="space-y-3">
            <Rotulo>Em campo</Rotulo>
            {emCampo.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-4">
                <b>Nenhum mapeamento por aqui.</b>
                <p className="mt-1 text-sm text-muted-foreground">
                  Quando o IAM agendar uma vistoria para você, ela aparece nesta lista.
                </p>
              </div>
            ) : (
              emCampo.map((c) => {
                const finalizado = FINALIZADOS.includes(c.status);
                const prog = progressoMap.get(c.id);
                const iniciado = c.status === "em_andamento" || (prog?.respondidas ?? 0) > 0;
                const outroEmAndamento = emAndamentoPorAgendamento.get(c.agendamento_id);
                const bloqueado = !finalizado && !!outroEmAndamento && outroEmAndamento !== c.id;
                const pct = prog && prog.total > 0 ? Math.round((prog.respondidas / prog.total) * 100) : 0;
                const cliente = c.unidade?.matriz?.empresa?.nome ?? "—";
                const badge = BADGE[c.status];
                return (
                  <article key={c.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs uppercase leading-4 text-muted-foreground">
                          <span className="font-mono">{c.codigo}</span> · {c.formulario?.nome ?? "—"}
                        </div>
                        <div className="break-words font-semibold text-foreground">
                          {cliente}
                          {c.unidade?.nome && cliente === "IONICS" ? (
                            <span className="font-normal text-muted-foreground"> · {c.unidade.nome}</span>
                          ) : null}
                        </div>
                      </div>
                      {badge && (
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}
                        >
                          {badge.aceito ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : null}
                          {badge.rotulo}
                        </span>
                      )}
                    </div>
                    <Meta icone={<CalendarDays className="h-3.5 w-3.5" />}>{fmtData(c.agendado_em)}</Meta>

                    {prog && prog.total > 0 && (iniciado || finalizado) && (
                      <div className="flex flex-col gap-2">
                        <span className="text-xs text-foreground">
                          {prog.respondidas} de {prog.total} itens · {pct}%
                        </span>
                        <div
                          className="h-2 overflow-hidden rounded-full bg-primary/15"
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={pct}
                          aria-label="Progresso do mapeamento"
                        >
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}

                    <div className={`mt-1 grid gap-3 ${iniciado || finalizado ? "grid-cols-2" : "grid-cols-1"}`}>
                      {(iniciado || finalizado) && (
                        <Botao variante="contorno" onClick={() => setResumoCasoId(c.id)}>
                          Ver respostas
                        </Botao>
                      )}
                      {finalizado ? (
                        <Botao variante="primario" disabled>
                          Em revisão
                        </Botao>
                      ) : bloqueado ? (
                        <Botao variante="primario" disabled>
                          Iniciar <ArrowRight className="h-4 w-4" aria-hidden />
                        </Botao>
                      ) : (
                        <Link to="/app/vistoria/$casoId" params={{ casoId: c.id }} className="contents">
                          <Botao variante="primario">
                            {iniciado ? "Continuar" : "Iniciar"} <ArrowRight className="h-4 w-4" aria-hidden />
                          </Botao>
                        </Link>
                      )}
                    </div>
                    {bloqueado && (
                      <p className="text-xs leading-4 text-muted-foreground">
                        Conclua o mapeamento em andamento antes de iniciar este.
                      </p>
                    )}
                  </article>
                );
              })
            )}
          </section>
        </>
      )}

      {/* folha inferior para a recusa (motivo obrigatório) */}
      <Modal open={!!recusando} onClose={() => setRecusando(null)} title="Recusar / Reagendar">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Explique o motivo para o IAM ou Especialista reagendar. A justificativa é obrigatória.
          </p>
          <label htmlFor="motivo-recusa" className="font-semibold">
            Motivo
          </label>
          <textarea
            id="motivo-recusa"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={4}
            className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
            placeholder="Ex.: estarei em outro cliente nesse horário"
          />
          <p className="text-xs text-muted-foreground" role="status">
            {motivo.trim().length >= 5 ? "Pronto para enviar." : "Escreva pelo menos 5 caracteres."}
          </p>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Botao variante="contorno" onClick={() => setRecusando(null)} disabled={working}>
              Cancelar
            </Botao>
            <Botao variante="primario" onClick={handleRecusar} disabled={working || motivo.trim().length < 5}>
              Enviar recusa
            </Botao>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** Rótulo de seção (caixa alta, discreto), como no desenho do agente. */
function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">{children}</h2>
  );
}

function Meta({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs leading-4 text-muted-foreground">
      <span className="mt-px shrink-0">{icone}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

/** Botão de 44 px (alvo de toque confortável). */
function Botao({
  variante,
  children,
  ...props
}: {
  variante: "primario" | "contorno";
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-center text-sm font-semibold transition-colors disabled:cursor-not-allowed";
  const cor =
    variante === "primario"
      ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
      : "border-border bg-card text-foreground hover:bg-muted disabled:text-muted-foreground";
  return (
    <button type="button" {...props} className={`${base} ${cor}`}>
      {children}
    </button>
  );
}
