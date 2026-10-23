import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Check, ChevronDown, Flag, Lock, MapPin, Play } from "lucide-react";

import { Botao } from "@/components/agent/ui";
import { cn } from "@/lib/utils";
import { finalizado, type CasoBase, type GrupoDia, type Parada } from "@/lib/agente-roteiro";
import type { ProgressoCaso } from "@/lib/agente-progresso.functions";

export type CasoCard = CasoBase & {
  endereco_vistoria: string | null;
  unidade: { nome: string; matriz: { nome: string; empresa: { nome: string } | null } | null } | null;
  formulario: { nome: string } | null;
};

const hora = (d: Date | null) =>
  d ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
const dataCurta = (d: Date | null) =>
  d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "Sem data";

/** "FR-13-10 | MAPEAMENTO TÉCNICO..." → "FR-13-10 · Mapeamento técnico..." (curto e legível). */
function nomeCurto(nome: string | undefined | null) {
  if (!nome) return "Formulário";
  const limpo = nome.replace(/\s*\(por estrutura do escopo\)\s*/i, "").replace(/\s+/g, " ").trim();
  const [codigo, resto] = limpo.split(/\s*[|–-]\s+/, 2);
  if (!resto) return limpo;
  const texto = resto.toLowerCase().replace(/^./, (c) => c.toUpperCase());
  return `${codigo} · ${texto}`;
}

const cliente = (c: CasoCard) => c.unidade?.matriz?.empresa?.nome ?? "—";

function Circulo({ numero, estado }: { numero: number; estado: "andamento" | "proxima" | "espera" }) {
  return (
    <span
      className={cn(
        "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
        estado === "andamento" && "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_hsl(var(--primary)/0.18)]",
        estado === "proxima" && "border-primary bg-background text-primary",
        estado === "espera" && "border-border bg-muted text-muted-foreground",
      )}
      aria-label={`Parada ${numero}`}
    >
      {estado === "andamento" ? <Play className="h-4 w-4 fill-current" aria-hidden /> : numero}
    </span>
  );
}

function LinhaFormulario({
  caso,
  atual,
  progresso,
  onVerRespostas,
  unico,
}: {
  caso: CasoCard;
  atual: boolean;
  progresso?: ProgressoCaso;
  onVerRespostas: (id: string) => void;
  unico: boolean;
}) {
  const pronto = finalizado(caso);
  const iniciado = caso.status === "em_andamento" || (progresso?.respondidas ?? 0) > 0;
  const pct = progresso && progresso.total > 0 ? Math.round((progresso.respondidas / progresso.total) * 100) : 0;
  return (
    <li className="rounded-lg border border-border bg-background p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-medium leading-snug text-foreground">{nomeCurto(caso.formulario?.nome)}</p>
          <p className="font-mono text-[10px] text-muted-foreground">{caso.codigo}</p>
        </div>
        {pronto ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
            <Check className="h-3 w-3" aria-hidden /> Entregue
          </span>
        ) : iniciado ? (
          <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800">Em andamento</span>
        ) : !atual ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden /> Depois
          </span>
        ) : null}
      </div>

      {!pronto && iniciado && progresso && progresso.total > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/15" aria-hidden>
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      )}

      {(iniciado || pronto) && (
        <button
          type="button"
          onClick={() => onVerRespostas(caso.id)}
          className="mt-1.5 min-h-8 text-xs text-primary underline"
        >
          Ver respostas
        </button>
      )}

      {atual && !pronto && (
        <div className={cn("mt-2", unico && "mt-3")}>
          <Link to="/app/vistoria/$casoId" params={{ casoId: caso.id }} className="contents">
            <Botao variante="primario">
              {iniciado ? "Continuar" : "Iniciar"} <ArrowRight className="h-4 w-4" aria-hidden />
            </Botao>
          </Link>
        </div>
      )}
    </li>
  );
}

function CartaoParada({
  parada,
  numero,
  estado,
  atrasada,
  ultima,
  progresso,
  onVerRespostas,
}: {
  parada: Parada<CasoCard>;
  numero: number;
  estado: "andamento" | "proxima" | "espera";
  atrasada: boolean;
  ultima: boolean;
  progresso: Map<string, ProgressoCaso>;
  onVerRespostas: (id: string) => void;
}) {
  const primeiro = parada.casos[0]!;
  const endereco = primeiro.endereco_vistoria;
  const unidade = primeiro.unidade?.nome;
  const mostrarUnidade = unidade && cliente(primeiro) === "IONICS";
  return (
    <li className="relative flex gap-3">
      {/* trilho: círculo numerado + linha até a próxima parada */}
      <div className="flex w-9 shrink-0 flex-col items-center">
        <Circulo numero={numero} estado={estado} />
        {!ultima && <span className="mt-1 w-0.5 flex-1 rounded-full bg-border" aria-hidden />}
      </div>

      <article
        className={cn(
          "mb-4 min-w-0 flex-1 rounded-xl border bg-card p-3 shadow-sm",
          estado === "andamento" && "border-primary/60",
          estado === "proxima" && "border-primary/40",
          estado === "espera" && "border-border",
        )}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-base font-bold text-foreground">{hora(parada.quando)}</span>
          {estado === "andamento" && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">Você está aqui</span>
          )}
          {estado === "proxima" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              <Flag className="h-3 w-3" aria-hidden /> Próxima parada
            </span>
          )}
          {atrasada && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">Atrasada</span>
          )}
        </div>

        <h3 className="mt-1 break-words text-sm font-semibold leading-snug text-foreground">
          {cliente(primeiro)}
          {mostrarUnidade ? <span className="font-normal text-muted-foreground"> · {unidade}</span> : null}
        </h3>
        {endereco && (
          <p className="mt-0.5 flex items-start gap-1.5 text-xs leading-4 text-muted-foreground">
            <MapPin className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">{endereco}</span>
          </p>
        )}

        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {parada.casos.length === 1 ? "1 formulário" : `${parada.casos.length} formulários · faça um de cada vez`}
        </p>
        <ul className="mt-1.5 space-y-2">
          {parada.casos.map((c) => (
            <LinhaFormulario
              key={c.id}
              caso={c}
              atual={parada.atual?.id === c.id}
              progresso={progresso.get(c.id)}
              onVerRespostas={onVerRespostas}
              unico={parada.casos.length === 1}
            />
          ))}
        </ul>
      </article>
    </li>
  );
}

/** Roteiro do agente: trilha numerada por dia, na ordem em que as paradas devem ser feitas. */
export function RoteiroTimeline({
  grupos,
  entregues,
  progresso,
  onVerRespostas,
}: {
  grupos: GrupoDia<CasoCard>[];
  entregues: Parada<CasoCard>[];
  progresso: Map<string, ProgressoCaso>;
  onVerRespostas: (id: string) => void;
}) {
  let numero = 0;
  const total = grupos.reduce((a, g) => a + g.paradas.length, 0);
  const idPrimeira = grupos[0]?.paradas[0]?.chave;

  return (
    <div className="space-y-5">
      {grupos.map((g) => (
        <section key={g.chave} aria-label={g.rotulo}>
          <div className="mb-3 flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide",
                g.atrasado ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" aria-hidden /> {g.rotulo}
            </span>
            <span className="text-xs text-muted-foreground">
              {g.paradas.length} {g.paradas.length === 1 ? "parada" : "paradas"}
            </span>
          </div>
          <ol>
            {g.paradas.map((p) => {
              numero += 1;
              const estado = p.emAndamento ? "andamento" : p.chave === idPrimeira ? "proxima" : "espera";
              return (
                <CartaoParada
                  key={p.chave}
                  parada={p}
                  numero={numero}
                  estado={estado}
                  atrasada={g.atrasado}
                  ultima={numero === total}
                  progresso={progresso}
                  onVerRespostas={onVerRespostas}
                />
              );
            })}
          </ol>
        </section>
      ))}

      {entregues.length > 0 && (
        <details className="group rounded-xl border border-border bg-card">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-foreground">
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" aria-hidden /> Já entregues ({entregues.length})
            </span>
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {entregues.map((p) => {
              const primeiro = p.casos[0]!;
              return (
                <li key={p.chave} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{cliente(primeiro)}</p>
                    <p className="text-xs text-muted-foreground">
                      {dataCurta(p.quando)} · {p.casos.length} {p.casos.length === 1 ? "formulário" : "formulários"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onVerRespostas(primeiro.id)}
                    className="min-h-9 shrink-0 text-xs text-primary underline"
                  >
                    Ver respostas
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}
