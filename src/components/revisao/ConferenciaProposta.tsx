// Resumo compacto do escopo previsto na proposta + divergências reais
// (Proposta × Campo) para a etapa de Conferência da revisão.
// Não expõe o painel completo de proposta nem o editor de escopo.

import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, FileWarning } from "lucide-react";
import { Card } from "@/components/ui-bits";
import { carregarProposta } from "@/lib/proposta.functions";
import {
  decidirDivergencia,
  listarDecisoesDivergencia,
  type DecisaoDivergenciaRow,
} from "@/lib/mapeamento.functions";
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

type EntidadeSimples = { tipo: string };

/** Compara a estrutura definida no agendamento com as quantidades da proposta. */
function diferencasEstrutura(escopo: EscopoProposta | null, entidades: EntidadeSimples[]): string[] {
  if (!escopo || entidades.length === 0) return [];
  const n = (t: string) => entidades.filter((e) => e.tipo === t).length;
  const out: string[] = [];
  const temComboio = escopo.tem_comboio?.valor;
  if (temComboio === false && n("comboio") > 0)
    out.push(`A proposta prevê sem comboio, mas a estrutura tem ${n("comboio")} comboio(s).`);
  if (temComboio === true && n("comboio") === 0)
    out.push("A proposta prevê comboio, mas a estrutura não tem nenhum.");
  const bombas = Number(escopo.qtd_bombas?.valor);
  if (Number.isFinite(bombas) && bombas > 0 && n("bomba") > 0 && bombas !== n("bomba"))
    out.push(`Bombas: proposta ${bombas}, estrutura ${n("bomba")}.`);
  const bicos = Number(escopo.qtd_bicos?.valor);
  if (Number.isFinite(bicos) && bicos > 0 && n("bico") > 0 && bicos !== n("bico"))
    out.push(`Bicos: proposta ${bicos}, estrutura ${n("bico")}.`);
  return out;
}

export function ConferenciaProposta({
  casoId,
  onResumo,
  entidades = [],
  abrirKey = 0,
}: {
  casoId: string;
  /** informa o total de divergências para o resumo de prontidão da revisão */
  onResumo?: (r: {
    /** divergências ainda sem decisão do especialista */
    divergencias: number;
    divergenciasDecididas: number;
    diferencasEstrutura: number;
  }) => void;
  /** estrutura do Escopo (agendamento), para apontar diferenças em relação à proposta */
  entidades?: EntidadeSimples[];
  /** muda para abrir e rolar até a lista de divergências */
  abrirKey?: number;
}) {
  const fnCarregar = useServerFn(carregarProposta);
  const [escopo, setEscopo] = useState<EscopoProposta | null>(null);
  const [divergencias, setDivergencias] = useState<Divergencia[]>([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const fnListarDecisoes = useServerFn(listarDecisoesDivergencia);
  const fnDecidir = useServerFn(decidirDivergencia);
  const [decisoes, setDecisoes] = useState<Record<string, DecisaoDivergenciaRow>>({});
  const [salvandoCodigo, setSalvandoCodigo] = useState<string | null>(null);
  const [erroDecisao, setErroDecisao] = useState<string | null>(null);

  const carregarDecisoes = useMemo(
    () => async () => {
      try {
        const rows = await fnListarDecisoes({ data: { casoId } });
        setDecisoes(Object.fromEntries(rows.map((d) => [d.codigo, d])));
      } catch {
        /* sem decisões registradas ou sem permissão: tudo segue como pendente */
      }
    },
    [casoId, fnListarDecisoes],
  );

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
    void carregarDecisoes();
    return () => {
      vivo = false;
    };
  }, [casoId, fnCarregar, carregarDecisoes]);

  const decidir = async (d: Divergencia, decisao: "aceitar_campo" | "manter_proposta" | "desfazer") => {
    setSalvandoCodigo(d.codigo);
    setErroDecisao(null);
    try {
      await fnDecidir({ data: { casoId, codigo: d.codigo, titulo: d.titulo, decisao } });
      await carregarDecisoes();
    } catch (e) {
      setErroDecisao(e instanceof Error ? e.message : "Não foi possível registrar a decisão.");
    } finally {
      setSalvandoCodigo(null);
    }
  };

  const diferencas = useMemo(() => diferencasEstrutura(escopo, entidades), [escopo, entidades]);

  const decididas = divergencias.filter((d) => decisoes[d.codigo]).length;
  const pendentes = divergencias.length - decididas;

  useEffect(() => {
    onResumo?.({
      divergencias: pendentes,
      divergenciasDecididas: decididas,
      diferencasEstrutura: diferencas.length,
    });
  }, [onResumo, pendentes, decididas, diferencas.length]);

  useEffect(() => {
    if (!abrirKey) return;
    setAberto(true);
    const t = setTimeout(
      () => document.getElementById("proposta-campo")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
    return () => clearTimeout(t);
  }, [abrirKey]);

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
    <div className="scroll-mt-20 space-y-3" id="proposta-campo">
      {escopo && (
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Escopo previsto na proposta</h2>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
              {resumoEscopo(escopo)}
            </span>
          </div>
          {chips.length === 0 ? (
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
          {diferencas.length > 0 && (
            <div className="mt-3 rounded-md border border-amber-300/50 bg-amber-500/10 p-2.5">
              <p className="text-xs font-semibold text-amber-700">
                Estrutura do agendamento × proposta
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-amber-800">
                {diferencas.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {divergencias.length > 0 && (
        <Card className="p-0">
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
              <FileWarning className="h-4 w-4" />
              Proposta × Campo —{" "}
              {pendentes > 0
                ? `${pendentes} divergência(s) a decidir`
                : "todas as divergências decididas"}
              {decididas > 0 && pendentes > 0 ? ` (${decididas} decidida(s))` : ""}
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

                  {(() => {
                    const dec = decisoes[d.codigo];
                    const ocupado = salvandoCodigo === d.codigo;
                    if (dec) {
                      return (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-emerald-500/10 px-2.5 py-2">
                          <p className="text-xs text-emerald-800">
                            <span className="font-semibold">
                              {dec.decisao === "aceitar_campo"
                                ? "Aceito o que o agente encontrou"
                                : "Mantida a proposta"}
                            </span>
                            {" · "}
                            {dec.ator_nome ?? "especialista"} em{" "}
                            {new Date(dec.ocorrido_em).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => void decidir(d, "desfazer")}
                            className="text-xs font-medium text-emerald-900 underline underline-offset-2 disabled:opacity-50"
                          >
                            Desfazer
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => void decidir(d, "aceitar_campo")}
                          className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                        >
                          Aceitar o que o agente encontrou
                        </button>
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => void decidir(d, "manter_proposta")}
                          className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                        >
                          Manter a proposta
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ))}
              {erroDecisao && <p className="text-xs text-destructive">{erroDecisao}</p>}
              <p className="text-[11px] text-muted-foreground">
                A decisão só fica registrada no histórico do mapeamento; não altera a proposta, as respostas nem o documento.
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
