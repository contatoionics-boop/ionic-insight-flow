import { useMemo } from "react";
import {
  Building2,
  Car,
  ClipboardList,
  Cylinder,
  Droplet,
  Fuel,
  Gauge,
  LayoutGrid,
  Layers,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { TipoEntidade } from "@/lib/escopo/tipos";

export type EntidadeResumo = {
  id: string;
  tipo: TipoEntidade | string;
  parentId: string | null;
  ordem: number;
  rotulo: string;
};

/** Ícone + cor de cada tipo de entidade do escopo. */
const VISUAL: Record<string, { icone: LucideIcon; cor: string; um: string; varios: string }> = {
  posto: { icone: Building2, cor: "text-sky-500 bg-sky-500/10 border-sky-500/30", um: "posto", varios: "postos" },
  ilha: { icone: LayoutGrid, cor: "text-violet-500 bg-violet-500/10 border-violet-500/30", um: "ilha", varios: "ilhas" },
  bomba: { icone: Fuel, cor: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30", um: "bomba", varios: "bombas" },
  bico: { icone: Droplet, cor: "text-cyan-500 bg-cyan-500/10 border-cyan-500/30", um: "bico", varios: "bicos" },
  tanque: { icone: Cylinder, cor: "text-amber-500 bg-amber-500/10 border-amber-500/30", um: "tanque", varios: "tanques" },
  sonda: { icone: Gauge, cor: "text-rose-500 bg-rose-500/10 border-rose-500/30", um: "sonda", varios: "sondas" },
  comboio: { icone: Truck, cor: "text-orange-500 bg-orange-500/10 border-orange-500/30", um: "comboio", varios: "comboios" },
  frota: { icone: Car, cor: "text-indigo-500 bg-indigo-500/10 border-indigo-500/30", um: "Frota / DIV", varios: "Frota / DIV" },
};

const ORDEM_CHIPS = ["posto", "ilha", "bomba", "bico", "tanque", "sonda", "comboio", "frota"];

const RAIZES: { tipo: string; titulo: string }[] = [
  { tipo: "posto", titulo: "Pista" },
  { tipo: "tanque", titulo: "Tanques" },
  { tipo: "sonda", titulo: "Sondas" },
  { tipo: "comboio", titulo: "Comboios" },
  { tipo: "frota", titulo: "Frota / DIV" },
];

export function contagensEscopo(entidades: EntidadeResumo[]) {
  const c = (t: string) => entidades.filter((e) => e.tipo === t).length;
  return {
    postos: c("posto"),
    ilhas: c("ilha"),
    bombas: c("bomba"),
    bicos: c("bico"),
    tanques: c("tanque"),
    sondas: c("sonda"),
    comboios: c("comboio"),
    frota: c("frota") > 0,
  };
}

/** Tipos presentes com a contagem (só o que existe). */
export function chipsEscopo(entidades: EntidadeResumo[]): { tipo: string; n: number; texto: string }[] {
  const out: { tipo: string; n: number; texto: string }[] = [];
  for (const tipo of ORDEM_CHIPS) {
    const n = entidades.filter((e) => e.tipo === tipo).length;
    if (!n) continue;
    const v = VISUAL[tipo];
    out.push({ tipo, n, texto: tipo === "frota" ? v.um : `${n} ${n === 1 ? v.um : v.varios}` });
  }
  return out;
}

function IconeTipo({ tipo, className = "h-3.5 w-3.5" }: { tipo: string; className?: string }) {
  const v = VISUAL[tipo];
  if (!v) return null;
  const I = v.icone;
  return <I className={className} aria-hidden />;
}

function Ramo({
  no,
  filhos,
}: {
  no: EntidadeResumo;
  filhos: Map<string | null, EntidadeResumo[]>;
}) {
  const sub = filhos.get(no.id) ?? [];
  // Bicos entram como contagem na bomba para não poluir a lista.
  const bicos = sub.filter((s) => s.tipo === "bico").length;
  const demais = sub.filter((s) => s.tipo !== "bico");
  const v = VISUAL[no.tipo];
  return (
    <li>
      <div className="flex items-center gap-1.5">
        <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border ${v?.cor ?? ""}`}>
          <IconeTipo tipo={no.tipo} className="h-3 w-3" />
        </span>
        <span className="text-foreground">{no.rotulo}</span>
        {bicos > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-500">
            <Droplet className="h-2.5 w-2.5" aria-hidden />
            {bicos}
          </span>
        )}
      </div>
      {demais.length > 0 && (
        <ul className="ml-2.5 mt-1 space-y-1 border-l border-border pl-3">
          {demais.map((d) => (
            <Ramo key={d.id} no={d} filhos={filhos} />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Leitura do Escopo definido no agendamento (estrutura física + orientações).
 * Somente leitura: não conhece o motor nem o banco.
 */
export function ResumoEscopo({
  entidades,
  versao,
  orientacoes,
  compacto = false,
  className = "",
}: {
  entidades: EntidadeResumo[];
  versao?: number | null;
  orientacoes?: string | null;
  /** Só chips + orientações (sem a árvore). */
  compacto?: boolean;
  className?: string;
}) {
  const chips = useMemo(() => chipsEscopo(entidades), [entidades]);
  const filhos = useMemo(() => {
    const m = new Map<string | null, EntidadeResumo[]>();
    for (const e of [...entidades].sort((a, b) => a.ordem - b.ordem)) {
      const k = e.parentId ?? null;
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return m;
  }, [entidades]);
  const texto = orientacoes?.trim();
  const raizes = filhos.get(null) ?? [];

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="rounded-md border border-border bg-muted/30 p-2.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Layers className="h-3.5 w-3.5 text-primary" />
          Estrutura do escopo{versao ? ` · V${versao}` : ""}
        </div>
        {chips.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">Sem estrutura definida para este mapeamento.</p>
        ) : (
          <>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {chips.map((c) => {
                const v = VISUAL[c.tipo];
                return (
                  <div
                    key={c.tipo}
                    className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${v.cor}`}
                  >
                    <IconeTipo tipo={c.tipo} className="h-5 w-5 shrink-0" />
                    <div className="min-w-0 leading-tight">
                      {c.tipo === "frota" ? (
                        <span className="text-xs font-semibold text-foreground">Frota / DIV</span>
                      ) : (
                        <>
                          <span className="text-base font-bold text-foreground">{c.n}</span>
                          <span className="ml-1 text-[11px] text-muted-foreground">
                            {c.n === 1 ? v.um : v.varios}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {!compacto && (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer select-none text-primary">Ver estrutura detalhada</summary>
                <div className="mt-2 space-y-3">
                  {RAIZES.map((g) => {
                    const itens = raizes.filter((r) => r.tipo === g.tipo);
                    if (!itens.length) return null;
                    return (
                      <div key={g.tipo}>
                        <p className="mb-1 font-medium text-muted-foreground">{g.titulo}</p>
                        <ul className="space-y-1">
                          {itens.map((r) => (
                            <Ramo key={r.id} no={r} filhos={filhos} />
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
          </>
        )}
      </div>

      {texto && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <ClipboardList className="h-3.5 w-3.5 text-primary" />
            Orientações para o agente
          </div>
          <p className="mt-1 whitespace-pre-line text-xs text-foreground">{texto}</p>
        </div>
      )}
    </div>
  );
}
