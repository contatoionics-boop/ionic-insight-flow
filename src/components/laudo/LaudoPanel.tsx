import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Pencil,
  ShieldCheck,
  Type,
} from "lucide-react";
import { Badge, Button, Modal, Textarea } from "@/components/ui-bits";
import { carregarLaudo, confirmarAlertaLaudo, escolherTextoLaudo, gerarLaudo } from "@/lib/laudo.functions";
import { listarBlocosPadrao, type BlocoPadrao } from "@/lib/blocos-padrao.functions";
import { INFO_SLOT, SLOTS_TEXTO, lerSlot, type SlotTexto } from "@/lib/laudo/textos-padrao";
import { rotuloChave } from "@/lib/laudo/chaves";
import { DocumentoEditor } from "@/components/laudo/DocumentoEditor";
import type { NoArvore } from "@/lib/laudo/numeracao";
import type { Achado } from "@/lib/laudo/analise/achados";
import type {
  BlocoLaudo,
  ConfirmacaoAlerta,
  LaudoConteudo,
  VariaveisLaudo,
} from "@/lib/laudo/tipos";
import { blocosComPendencia } from "@/lib/laudo/tipos";

function irParaBloco(id: string) {
  const el = document.getElementById(`bloco-${id}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary/50", "rounded-md");
    setTimeout(() => el.classList.remove("ring-2", "ring-primary/50", "rounded-md"), 2000);
    return;
  }
  toast.info("Trecho sem âncora: localize-o no documento.");
}

/** rótulos das pendências [CONFIRMAR: ...] de um bloco visível */
function pendenciasDoBloco(b: BlocoLaudo): string[] {
  const { conteudo_original: _o, conflito: _c, ...visivel } = b as Record<string, unknown>;
  const texto = JSON.stringify(visivel);
  return Array.from(texto.matchAll(/\[CONFIRMAR:\s*([^\]]*)\]/g)).map((m) => m[1].trim());
}

/** estado do documento exposto para a barra de ações única da revisão */
export type EstadoDocumento = {
  carregando: boolean;
  temConteudo: boolean;
  docSujo: boolean;
  pendencias: number;
  alertasPendentes: number;
  achados: Achado[];
  motivoPdf: string | null;
  gerando: boolean;
  salvando: boolean;
  gerar: () => Promise<void>;
  salvar: () => Promise<void>;
  abrirPendencias: () => void;
};

export function LaudoPanel({
  casoId,
  onEstado,
}: {
  casoId: string;
  onEstado?: (e: EstadoDocumento) => void;
}) {
  const fnCarregar = useServerFn(carregarLaudo);
  const fnGerar = useServerFn(gerarLaudo);
  const fnConfirmar = useServerFn(confirmarAlertaLaudo);
  const fnEscolherTexto = useServerFn(escolherTextoLaudo);
  const fnVersoes = useServerFn(listarBlocosPadrao);

  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [salvandoDoc, setSalvandoDoc] = useState(false);
  const [conteudo, setConteudo] = useState<LaudoConteudo | null>(null);
  const [metaDoc, setMetaDoc] = useState<import("@/lib/laudo/meta").MetaLaudo | null>(null);
  const [, setVariaveis] = useState<VariaveisLaudo>({});
  const [confirmacoes, setConfirmacoes] = useState<ConfirmacaoAlerta[]>([]);
  const [achados, setAchados] = useState<Achado[]>([]);
  const [alertaAberto, setAlertaAberto] = useState<string | null>(null);
  const [decisao, setDecisao] = useState<"corrigido" | "ciente_do_risco">("corrigido");
  const [justificativa, setJustificativa] = useState("");
  const [docSujo, setDocSujo] = useState(false);
  const [modoDoc, setModoDoc] = useState<"visualizar" | "editar">("visualizar");
  const [arvore, setArvore] = useState<NoArvore[]>([]);
  const [sumarioAberto, setSumarioAberto] = useState(false);
  const [pendenciasAbertas, setPendenciasAbertas] = useState(false);
  /** Ponto a confirmar atual na navegação anterior/próximo (-1 = ainda não navegou). */
  const [pontoAtual, setPontoAtual] = useState(-1);
  const [salvarDoc, setSalvarDoc] = useState<{ fn: (() => Promise<void>) | null }>({ fn: null });
  /** textos do documento (Introdução, Instruções…): versão escolhida só para este mapeamento */
  const [textosAberto, setTextosAberto] = useState(false);
  const [textosEscolhidos, setTextosEscolhidos] = useState<Record<string, string>>({});
  const [versoesTexto, setVersoesTexto] = useState<BlocoPadrao[]>([]);
  const [trocandoTexto, setTrocandoTexto] = useState<SlotTexto | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fnCarregar({ data: { casoId } });
      setConteudo(r.conteudo);
      setMetaDoc((r as any).meta ?? null);
      setVariaveis(r.variaveis ?? {});
      setConfirmacoes(r.confirmacoes ?? []);
      setAchados((r.achados ?? []) as Achado[]);
      setTextosEscolhidos(((r as any).textosEscolhidos ?? {}) as Record<string, string>);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar o laudo.");
    } finally {
      setLoading(false);
    }
  }, [casoId, fnCarregar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abrirTextos = useCallback(async () => {
    setTextosAberto(true);
    try {
      const lista = (await fnVersoes({ data: {} as any })) as BlocoPadrao[];
      setVersoesTexto(lista.filter((b) => b.ativo && lerSlot(b.escopo).slot));
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar as versões dos textos.");
    }
  }, [fnVersoes]);

  /** "" = automático (padrão que o mapeamento atende ou o original), "sistema" = texto original, senão o id da versão */
  const trocarTexto = useCallback(
    async (slot: SlotTexto, valor: string) => {
      if (docSujo) {
        toast.error("Salve a revisão do documento antes de trocar um texto.");
        return;
      }
      if (!confirm(`O texto "${INFO_SLOT[slot].rotulo}" será trocado e o documento remontado. Edições feitas à mão nesse trecho serão descartadas. Continuar?`)) return;
      setTrocandoTexto(slot);
      try {
        const r = await fnEscolherTexto({ data: { casoId, slot, versaoId: valor || null } });
        setConteudo(r.conteudo);
        setAchados((r.achados ?? []) as Achado[]);
        setTextosEscolhidos(r.textosEscolhidos ?? {});
        toast.success("Texto atualizado no documento.");
      } catch (e: any) {
        toast.error(e?.message ?? "Falha ao trocar o texto.");
      } finally {
        setTrocandoTexto(null);
      }
    },
    [casoId, docSujo, fnEscolherTexto],
  );

  const registrarSalvar = useCallback((fn: (() => Promise<void>) | null) => {
    setSalvarDoc({ fn });
  }, []);
  const onArvoreChange = useCallback((a: NoArvore[]) => setArvore(a), []);

  const bloqueantes = useMemo(
    () =>
      (conteudo?.blocos ?? []).filter(
        (b): b is Extract<BlocoLaudo, { tipo: "alert" }> =>
          b.tipo === "alert" && b.severidade === "bloqueante" && !b.oculto,
      ),
    [conteudo],
  );
  const pendentes = bloqueantes.filter((b) => !confirmacoes.some((c) => c.codigo === b.codigo));
  const pendenciasDoc = useMemo(() => blocosComPendencia(conteudo?.blocos ?? []), [conteudo]);
  const listaPendencias = useMemo(() => {
    return (conteudo?.blocos ?? [])
      .filter((b) => !b.oculto)
      .map((b) => ({ bloco: b, rotulos: pendenciasDoBloco(b) }))
      .filter((x) => x.rotulos.length > 0);
  }, [conteudo]);

  /** Vai ao ponto a confirmar seguinte/anterior (circular) e rola até o trecho. */
  const navegarPonto = useCallback(
    (passo: 1 | -1) => {
      const n = listaPendencias.length;
      if (!n) return;
      const proximo = pontoAtual < 0 ? (passo === 1 ? 0 : n - 1) : (pontoAtual + passo + n) % n;
      setPontoAtual(proximo);
      irParaBloco(listaPendencias[proximo].bloco.id);
    },
    [listaPendencias, pontoAtual],
  );
  // Ao resolver pontos a lista encolhe: mantém o índice dentro do intervalo.
  useEffect(() => {
    if (pontoAtual >= listaPendencias.length) setPontoAtual(listaPendencias.length - 1);
  }, [listaPendencias.length, pontoAtual]);

  const motivoPdf = !conteudo
    ? "Gere o rascunho do documento antes de emitir o PDF."
    : docSujo
      ? "Salve a revisão do documento antes de gerar o PDF."
      : pendenciasDoc
        ? `${pendenciasDoc} trecho(s) aguardando confirmação.`
        : pendentes.length
          ? "Confirme os alertas técnicos antes de emitir o PDF."
          : null;
  const totalPendencias = pendenciasDoc + pendentes.length;

  const handleGerar = useCallback(async () => {
    setGerando(true);
    try {
      const r = await fnGerar({ data: { casoId } });
      setConteudo(r.conteudo);
      setVariaveis(r.variaveis);
      setConfirmacoes(r.confirmacoes ?? []);
      setAchados((r.achados ?? []) as Achado[]);
      toast.success(
        r.pendencias > 0
          ? `Rascunho gerado com ${r.pendencias} trecho(s) a confirmar.`
          : "Rascunho gerado sem pendências.",
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar o documento.");
    } finally {
      setGerando(false);
    }
  }, [casoId, fnGerar]);

  const handleSalvarRevisao = useCallback(async () => {
    if (!salvarDoc.fn) return;
    setSalvandoDoc(true);
    try {
      await salvarDoc.fn();
    } finally {
      setSalvandoDoc(false);
    }
  }, [salvarDoc]);

  const abrirPendencias = useCallback(() => setPendenciasAbertas(true), []);

  useEffect(() => {
    onEstado?.({
      carregando: loading,
      temConteudo: !!conteudo,
      docSujo,
      pendencias: pendenciasDoc,
      alertasPendentes: pendentes.length,
      achados,
      motivoPdf,
      gerando,
      salvando: salvandoDoc,
      gerar: handleGerar,
      salvar: handleSalvarRevisao,
      abrirPendencias,
    });
  }, [
    onEstado,
    loading,
    conteudo,
    docSujo,
    pendenciasDoc,
    pendentes.length,
    achados,
    motivoPdf,
    gerando,
    salvandoDoc,
    handleGerar,
    handleSalvarRevisao,
    abrirPendencias,
  ]);

  async function handleConfirmar() {
    if (!alertaAberto) return;
    try {
      const r = await fnConfirmar({
        data: { casoId, codigo: alertaAberto, decisao, justificativa },
      });
      setConfirmacoes(r.confirmacoes);
      setAlertaAberto(null);
      setJustificativa("");
      toast.success("Alerta confirmado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao confirmar o alerta.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando documento...
      </div>
    );
  }

  const sumario = (
    <nav className="space-y-0.5 text-xs">
      {arvore.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem seções ainda.</p>
      ) : (
        arvore.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`block w-full truncate rounded px-2 py-1 text-left transition-colors hover:bg-muted ${
              n.nivel === 1 ? "font-medium text-foreground" : "text-muted-foreground"
            }`}
            style={{ paddingLeft: 8 + Math.min(n.nivel - 1, 2) * 10 }}
            onClick={() => {
              setSumarioAberto(false);
              irParaBloco(n.id);
            }}
          >
            {n.numero ? `${n.numero}. ` : ""}
            {n.texto}
          </button>
        ))
      )}
    </nav>
  );

  return (
    <div className="space-y-3">
      {/* barra fina do documento: modo, sumário e estado */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-border bg-card p-0.5">
            <button
              type="button"
              onClick={() => setModoDoc("visualizar")}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                modoDoc === "visualizar"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Eye className="h-3.5 w-3.5" /> Visualizar
            </button>
            <button
              type="button"
              onClick={() => setModoDoc("editar")}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                modoDoc === "editar"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setSumarioAberto((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium"
            >
              Seções do documento
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${sumarioAberto ? "rotate-180" : ""}`}
              />
            </button>
            {sumarioAberto && (
              <div className="absolute left-0 z-30 mt-1 max-h-72 w-72 overflow-y-auto rounded-lg border border-border bg-card p-2 shadow-lg">
                {sumario}
              </div>
            )}
          </div>

          {conteudo && (
            <button
              type="button"
              onClick={() => void abrirTextos()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium"
            >
              <Type className="h-3.5 w-3.5" /> Textos do documento
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {totalPendencias > 0 && (
            <div className="inline-flex items-center overflow-hidden rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <button
                type="button"
                onClick={abrirPendencias}
                className="px-2 py-1 font-medium hover:bg-amber-500/20"
              >
                {totalPendencias} ponto(s) a confirmar
              </button>
              {listaPendencias.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => navegarPonto(-1)}
                    aria-label="Ponto a confirmar anterior"
                    title="Anterior"
                    className="border-l border-amber-500/30 px-1.5 py-1 hover:bg-amber-500/20"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-1 tabular-nums" aria-live="polite">
                    {pontoAtual >= 0 ? `${pontoAtual + 1}/${listaPendencias.length}` : `–/${listaPendencias.length}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => navegarPonto(1)}
                    aria-label="Próximo ponto a confirmar"
                    title="Próximo"
                    className="border-l border-amber-500/30 px-1.5 py-1 hover:bg-amber-500/20"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
          {docSujo && (
            <span className="text-amber-600 dark:text-amber-400">Alterações não salvas</span>
          )}
          {conteudo && (
            <span className="hidden text-muted-foreground sm:inline">
              Última edição: {new Date(conteudo.gerado_em).toLocaleString("pt-BR")}
            </span>
          )}
        </div>
      </div>

      <DocumentoEditor
        casoId={casoId}
        conteudo={conteudo}
        onConteudo={setConteudo}
        onDirtyChange={setDocSujo}
        modo={modoDoc}
        onModoChange={setModoDoc}
        onArvoreChange={onArvoreChange}
        registrarSalvar={registrarSalvar}
        meta={metaDoc}
        semChrome
      />

      {/* versão de cada texto fixo (Introdução, Instruções gerais…) só para este mapeamento */}
      <Modal open={textosAberto} onClose={() => setTextosAberto(false)} title="Textos do documento">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Escolha a versão de cada texto para <b>este mapeamento</b>. “Automático” usa a versão padrão que o mapeamento atende ou, sem ela, o texto original do
            sistema. As versões são criadas em Configurações › Blocos padrão.
          </p>
          {SLOTS_TEXTO.map((slot) => {
            const opcoes = versoesTexto.filter((b) => lerSlot(b.escopo).slot === slot);
            return (
              <div key={slot} className="space-y-1">
                <label className="flex items-center gap-2 text-xs font-medium">
                  {INFO_SLOT[slot].rotulo}
                  {trocandoTexto === slot && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                </label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
                  value={opcoes.some((o) => o.id === textosEscolhidos[slot]) || textosEscolhidos[slot] === "sistema" ? textosEscolhidos[slot] : ""}
                  disabled={trocandoTexto !== null}
                  onChange={(e) => void trocarTexto(slot, e.target.value)}
                >
                  <option value="">Automático</option>
                  <option value="sistema">Texto original do sistema</option>
                  {opcoes.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </Modal>

      {/* pendências e alertas — fora do fluxo visual do documento */}
      <Modal
        open={pendenciasAbertas}
        onClose={() => setPendenciasAbertas(false)}
        title="Pontos a confirmar"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Trechos do documento
            </p>
            {listaPendencias.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum trecho aguardando confirmação.</p>
            ) : (
              listaPendencias.map(({ bloco, rotulos }) => (
                <div key={bloco.id} className="rounded-lg border border-border p-2 text-xs">
                  <p className="font-medium text-amber-700 dark:text-amber-300">
                    {rotulos.join(" · ")}
                  </p>
                  <button
                    type="button"
                    className="mt-1 text-[11px] text-primary underline"
                    onClick={() => {
                      setPendenciasAbertas(false);
                      irParaBloco(bloco.id);
                    }}
                  >
                    Ir para trecho
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Alertas técnicos
            </p>
            {bloqueantes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum alerta bloqueante.</p>
            ) : (
              bloqueantes.map((b) => {
                const conf = confirmacoes.find((c) => c.codigo === b.codigo);
                return (
                  <div key={b.codigo} className="rounded-lg border border-border p-2 text-xs">
                    <p className="flex gap-1.5 text-muted-foreground">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                      <span>{b.texto}</span>
                    </p>
                    {conf ? (
                      <p className="mt-2 flex items-start gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          {conf.decisao === "corrigido" ? "Corrigido" : "Ciente do risco"} por{" "}
                          {conf.confirmado_por_nome ?? "usuário"} em{" "}
                          {new Date(conf.confirmado_em).toLocaleString("pt-BR")} —{" "}
                          {conf.justificativa}
                        </span>
                      </p>
                    ) : (
                      <Button
                        className="mt-2"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setPendenciasAbertas(false);
                          setAlertaAberto(b.codigo);
                          setDecisao("corrigido");
                          setJustificativa("");
                        }}
                      >
                        Confirmar tratativa
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={!!alertaAberto}
        onClose={() => setAlertaAberto(null)}
        title={`Confirmar tratativa — ${alertaAberto ? rotuloChave(alertaAberto) : ""}`}
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              variant={decisao === "corrigido" ? "primary" : "secondary"}
              onClick={() => setDecisao("corrigido")}
            >
              Corrigido
            </Button>
            <Button
              variant={decisao === "ciente_do_risco" ? "primary" : "secondary"}
              onClick={() => setDecisao("ciente_do_risco")}
            >
              Ciente do risco
            </Button>
          </div>
          <Textarea
            rows={4}
            value={justificativa}
            placeholder="Descreva a correção aplicada ou a justificativa para prosseguir com o risco."
            onChange={(e) => setJustificativa(e.currentTarget.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAlertaAberto(null)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmar} disabled={justificativa.trim().length < 10}>
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>

      <Badge className="sr-only">{achados.length} achados</Badge>
    </div>
  );
}
