// Resumo compacto do escopo previsto na proposta + divergências reais
// (Proposta × Campo) para a etapa de Conferência da revisão.
// Não expõe o painel completo de proposta nem o editor de escopo.

import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, FileWarning } from "lucide-react";
import { Card } from "@/components/ui-bits";
import { carregarProposta } from "@/lib/proposta.functions";
import {
  formatarValorEscopo,
  normalizarEscopo,
  resumoEscopo,
  ROTULOS_ESCOPO,
  type Divergencia,
  type EscopoProposta,
} from "@/lib/proposta/tipos";

/** chaves exibidas como chips no resumo do escopo previsto */
const CHIPS: (keyof EscopoProposta)[] = [
  "nome_solucao",
  "nivel_automacao",
  "fase_automacao",
  "tem_pista",
  "tem_comboio",
  "qtd_bombas",
  "qtd_bicos",
  "comunicacao_prevista",
];

export function ConferenciaProposta({
  casoId,
  onResumo,
}: {
  casoId: string;
  /** informa o total de divergências para os chips do resumo da conferência */
  onResumo?: (r: { divergencias: number }) => void;
}) {
  const fnCarregar = useServerFn(carregarProposta);
  const [escopo, setEscopo] = useState<EscopoProposta | null>(null);
  const [divergencias, setDivergencias] = useState<Divergencia[]>([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fnCarregar({ data: { casoId } });
        if (!vivo) return;
        setEscopo(r.proposta ? normalizarEscopo(r.proposta.escopo) : null);
        setDivergencias((r.comparacao?.divergencias ?? []) as Divergencia[]);
      } catch {
        /* proposta ausente não bloqueia a conferência */
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [casoId, fnCarregar]);

  useEffect(() => {
    onResumo?.({ divergencias: divergencias.length });
  }, [onResumo, divergencias.length]);

  const chips = useMemo(() => {
    if (!escopo) return [] as { rotulo: string; valor: string }[];
    return CHIPS.map((c) => {
      const valor = escopo[c]?.valor;
      if (valor === null || valor === undefined || valor === "") return null;
      return { rotulo: ROTULOS_ESCOPO[c], valor: formatarValorEscopo(c, valor) };
    }).filter((x): x is { rotulo: string; valor: string } => !!x);
  }, [escopo]);

  if (carregando) return null;

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Escopo previsto</h2>
          {escopo && (
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
              {resumoEscopo(escopo)}
            </span>
          )}
        </div>
        {!escopo ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Nenhuma proposta comercial anexada a este mapeamento.
          </p>
        ) : chips.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            A proposta não trouxe itens de escopo identificáveis.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c.rotulo}
                className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"
              >
                {c.rotulo}: <span className="font-medium text-foreground">{c.valor}</span>
              </span>
            ))}
          </div>
        )}
      </Card>

      {divergencias.length > 0 && (
        <Card className="p-0">
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
              <FileWarning className="h-4 w-4" />
              Proposta × Campo — {divergencias.length} divergência(s)
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${aberto ? "rotate-180" : ""}`}
            />
          </button>
          {aberto && (
            <div className="space-y-2 border-t border-border p-3">
              {divergencias.map((d, i) => (
                <div key={d.codigo + i} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{d.titulo}</p>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        d.severidade === "alta"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      {d.severidade === "alta" ? "alta" : "atenção"}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <p className="text-xs text-muted-foreground">
                      Previsto:{" "}
                      <span className="font-medium text-foreground">{d.proposta || "—"}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Encontrado:{" "}
                      <span className="font-medium text-foreground">{d.campo || "—"}</span>
                    </p>
                  </div>
                  {d.recomendacao ? (
                    <p className="mt-2 text-xs text-muted-foreground">{d.recomendacao}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
