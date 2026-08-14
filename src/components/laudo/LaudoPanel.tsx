import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronDown,
  Eye,
  FileDown,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Badge, Button, Card, Input, Modal, Textarea } from "@/components/ui-bits";
import {
  carregarLaudo,
  confirmarAlertaLaudo,
  gerarLaudo,
  gerarPdfLaudo,
  salvarVariaveisLaudo,
} from "@/lib/laudo.functions";
import { CHAVES_LAUDO, rotuloChave } from "@/lib/laudo/chaves";
import { DocumentoEditor } from "@/components/laudo/DocumentoEditor";
import { AnaliseTecnicaPanel } from "@/components/laudo/AnaliseTecnicaPanel";
import type { NoArvore } from "@/lib/laudo/numeracao";
import type { Achado } from "@/lib/laudo/analise/achados";
import type {
  BlocoLaudo,
  ConfirmacaoAlerta,
  LaudoConteudo,
  VariaveisLaudo,
} from "@/lib/laudo/tipos";
import { blocosComPendencia } from "@/lib/laudo/tipos";

function baixarBase64(base64: string, filename: string, mime: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function irParaBloco(id: string) {
  const el = document.getElementById(`bloco-${id}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary/50", "rounded-md");
    setTimeout(() => el.classList.remove("ring-2", "ring-primary/50", "rounded-md"), 2000);
    return;
  }
  toast.info("Trecho sem âncora: localize-o no documento ou preencha a variável correspondente.");
}

/** rótulos das pendências [CONFIRMAR: ...] de um bloco visível */
function pendenciasDoBloco(b: BlocoLaudo): string[] {
  const { conteudo_original: _o, conflito: _c, ...visivel } = b as Record<string, unknown>;
  const texto = JSON.stringify(visivel);
  return Array.from(texto.matchAll(/\[CONFIRMAR:\s*([^\]]*)\]/g)).map((m) => m[1].trim());
}

export function LaudoPanel({
  casoId,
  etapa = "documento",
}: {
  casoId: string;
  etapa?: "analise" | "documento";
}) {
  const fnCarregar = useServerFn(carregarLaudo);
  const fnGerar = useServerFn(gerarLaudo);
  const fnSalvar = useServerFn(salvarVariaveisLaudo);
  const fnConfirmar = useServerFn(confirmarAlertaLaudo);
  const fnPdf = useServerFn(gerarPdfLaudo);

  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvandoDoc, setSalvandoDoc] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [conteudo, setConteudo] = useState<LaudoConteudo | null>(null);
  const [variaveis, setVariaveis] = useState<VariaveisLaudo>({});
  const [confirmacoes, setConfirmacoes] = useState<ConfirmacaoAlerta[]>([]);
  const [achados, setAchados] = useState<Achado[]>([]);
  const [descartados, setDescartados] = useState<string[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [alertaAberto, setAlertaAberto] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [decisao, setDecisao] = useState<"corrigido" | "ciente_do_risco">("corrigido");
  const [justificativa, setJustificativa] = useState("");
  const [docSujo, setDocSujo] = useState(false);
  const [modoDoc, setModoDoc] = useState<"visualizar" | "editar">("visualizar");
  const [arvore, setArvore] = useState<NoArvore[]>([]);
  const [aba, setAba] = useState<"pendencias" | "variaveis" | "achados">("pendencias");
  const [sumarioAberto, setSumarioAberto] = useState(false);
  const [salvarDoc, setSalvarDoc] = useState<{ fn: (() => Promise<void>) | null }>({ fn: null });

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fnCarregar({ data: { casoId } });
      setConteudo(r.conteudo);
      setVariaveis(r.variaveis ?? {});
      setConfirmacoes(r.confirmacoes ?? []);
      setAchados((r.achados ?? []) as Achado[]);
      setDescartados(r.descartados ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar o laudo.");
    } finally {
      setLoading(false);
    }
  }, [casoId, fnCarregar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

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

  const motivoPdf = !conteudo
    ? "Gere o rascunho do documento antes de emitir o PDF."
    : docSujo
      ? "Salve a revisão do documento antes de gerar o PDF."
      : pendenciasDoc
        ? `${pendenciasDoc} pendência(s) [CONFIRMAR] no documento.`
        : pendentes.length
          ? "Confirme os alertas bloqueantes antes de emitir o PDF."
          : null;
  const pdfBloqueado = !!motivoPdf;
  const totalPendencias = pendenciasDoc + pendentes.length;

  async function handleGerar() {
    setGerando(true);
    try {
      const r = await fnGerar({ data: { casoId } });
      setConteudo(r.conteudo);
      setVariaveis(r.variaveis);
      setConfirmacoes(r.confirmacoes ?? []);
      setAchados((r.achados ?? []) as Achado[]);
      setDescartados(r.descartados ?? []);
      setEdits({});
      toast.success(
        r.pendencias > 0
          ? `Laudo gerado com ${r.pendencias} bloco(s) contendo pendências.`
          : "Laudo gerado sem pendências.",
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar o laudo.");
    } finally {
      setGerando(false);
    }
  }

  async function handleSalvar() {
    if (!Object.keys(edits).length) return;
    setSalvando(true);
    try {
      const r = await fnSalvar({ data: { casoId, valores: edits } });
      setConteudo(r.conteudo);
      setVariaveis(r.variaveis);
      setEdits({});
      toast.success("Variáveis atualizadas e rascunho remontado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar as variáveis.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleSalvarRevisao() {
    if (!salvarDoc.fn) return;
    setSalvandoDoc(true);
    try {
      await salvarDoc.fn();
    } finally {
      setSalvandoDoc(false);
    }
  }

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

  async function handlePdf(preview = false) {
    setBaixando(true);
    try {
      const r = await fnPdf({ data: { casoId } });
      if (preview) {
        const bin = atob(r.contentBase64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const url = URL.createObjectURL(new Blob([bytes], { type: r.mimeType }));
        setPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } else {
        baixarBase64(r.contentBase64, r.filename, r.mimeType);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar o PDF.");
    } finally {
      setBaixando(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando laudo...
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
    <div className="space-y-4">
      {/* 1 — cabeçalho único da revisão */}
      <div className="sticky top-0 z-30 -mx-1 rounded-lg border border-border bg-card/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 lg:flex lg:flex-wrap lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-foreground">Revisão do Laudo</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge
                className={
                  pdfBloqueado
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                }
              >
                {pdfBloqueado ? "Em revisão" : "Pronto para PDF"}
              </Badge>
              <Badge
                className={
                  totalPendencias
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "bg-muted text-muted-foreground"
                }
              >
                {pendenciasDoc} pendência(s)
              </Badge>
              <Badge
                className={
                  pendentes.length
                    ? "bg-destructive/15 text-destructive"
                    : "bg-muted text-muted-foreground"
                }
              >
                {bloqueantes.length} alerta(s)
              </Badge>
              {docSujo && (
                <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-300">
                  Alterações não salvas
                </Badge>
              )}
              {conteudo && (
                <span className="hidden sm:inline">
                  Última edição: {new Date(conteudo.gerado_em).toLocaleString("pt-BR")}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {etapa === "documento" && (
              <Button variant="ghost" onClick={handleGerar} disabled={gerando} size="sm">
                {gerando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : conteudo ? (
                  <RefreshCw className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {conteudo ? "Regerar rascunho" : "Gerar rascunho"}
              </Button>
            )}
            {etapa === "documento" && (
              <Button
                onClick={handleSalvarRevisao}
                disabled={!docSujo || salvandoDoc || !salvarDoc.fn}
                size="sm"
                title={docSujo ? undefined : "Nenhuma alteração do documento pendente"}
              >
                {salvandoDoc ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar revisão
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePdf(true)}
              disabled={baixando || pdfBloqueado}
              title={motivoPdf ?? undefined}
            >
              {baixando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Pré-visualizar PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePdf(false)}
              disabled={baixando || pdfBloqueado}
              title={motivoPdf ?? undefined}
            >
              <FileDown className="h-4 w-4" />
              Baixar PDF
            </Button>
          </div>
        </div>
        {motivoPdf ? (
          <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">PDF bloqueado: {motivoPdf}</p>
        ) : null}
      </div>

      {pdfUrl && (
        <Card className="space-y-2 p-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-xs text-muted-foreground">Pré-visualização do laudo</p>
            <div className="flex gap-2">
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
              >
                Abrir em nova aba
              </a>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  URL.revokeObjectURL(pdfUrl);
                  setPdfUrl(null);
                }}
              >
                <X className="h-4 w-4" /> Fechar
              </Button>
            </div>
          </div>
          <iframe
            src={pdfUrl}
            title="Pré-visualização do laudo"
            className="h-[70vh] w-full rounded-lg border border-border"
          />
        </Card>
      )}

      {/* sumário compacto em telas menores */}
      <div className="xl:hidden">
        <button
          type="button"
          onClick={() => setSumarioAberto((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium"
        >
          Seções do documento
          <ChevronDown
            className={`h-4 w-4 transition-transform ${sumarioAberto ? "rotate-180" : ""}`}
          />
        </button>
        {sumarioAberto && (
          <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-border bg-card p-2">
            {sumario}
          </div>
        )}
      </div>

      {/* 3 — layout principal */}
      <div className="grid gap-4 xl:grid-cols-[210px_minmax(0,1fr)_340px]">
        <aside className="hidden h-fit rounded-lg border border-border bg-card p-3 xl:sticky xl:top-24 xl:block">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Sumário
          </p>
          {sumario}
        </aside>

        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
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
            {docSujo && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Alterações não salvas
              </span>
            )}
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
            semChrome
          />
        </section>

        {/* 4 — painel contextual único com abas */}
        <aside className="h-fit min-w-0 rounded-lg border border-border bg-card xl:sticky xl:top-24">
          <div className="flex border-b border-border text-xs">
            {(
              [
                ["pendencias", `Pendências${totalPendencias ? ` (${totalPendencias})` : ""}`],
                ["variaveis", "Variáveis"],
                ["achados", `Achados${achados.length ? ` (${achados.length})` : ""}`],
              ] as const
            ).map(([k, r]) => (
              <button
                key={k}
                type="button"
                onClick={() => setAba(k)}
                className={`flex-1 px-2 py-2.5 font-medium transition-colors ${
                  aba === k
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-3">
            {aba === "pendencias" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Pendências do documento
                  </p>
                  {listaPendencias.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhuma pendência [CONFIRMAR] no documento.
                    </p>
                  ) : (
                    listaPendencias.map(({ bloco, rotulos }) => (
                      <div key={bloco.id} className="rounded-lg border border-border p-2 text-xs">
                        <p className="font-medium text-amber-700 dark:text-amber-300">
                          {rotulos.join(" · ")}
                        </p>
                        <button
                          type="button"
                          className="mt-1 text-[11px] text-primary underline"
                          onClick={() => irParaBloco(bloco.id)}
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
                        <div
                          key={b.codigo}
                          className="rounded-lg border border-border p-2 text-xs"
                        >
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
            )}

            {aba === "variaveis" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    Origem: cadastro, proposta, IA ou manual.
                  </p>
                  <Button
                    size="sm"
                    onClick={handleSalvar}
                    disabled={salvando || !Object.keys(edits).length}
                  >
                    {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Salvar variáveis
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  “Salvar variáveis e atualizar rascunho” remonta o documento com os novos valores.
                </p>
                <div className="space-y-3">
                  {CHAVES_LAUDO.map((c) => {
                    const v = variaveis[c.chave];
                    const valor = edits[c.chave] ?? v?.valor ?? "";
                    return (
                      <div key={c.chave} className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <label className="text-xs font-medium">{c.rotulo}</label>
                          {v?.origem === "ia" && (
                            <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-300">
                              IA {Math.round((v.confianca ?? 0) * 100)}%
                            </Badge>
                          )}
                          {v?.origem === "proposta" && (
                            <Badge className="bg-violet-500/15 text-violet-600 dark:text-violet-300">
                              proposta {Math.round((v.confianca ?? 0) * 100)}%
                            </Badge>
                          )}
                          {v?.origem === "cadastro" && (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                              cadastro
                            </Badge>
                          )}
                          {v?.origem === "manual" && <Badge>manual</Badge>}
                          {!v?.valor && (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                              pendente
                            </Badge>
                          )}
                        </div>
                        <Input
                          value={valor}
                          placeholder={c.exemplos?.join(" | ") ?? c.descricao}
                          onChange={(e) => {
                            const novo = e.target.value;
                            setEdits((prev) => ({ ...prev, [c.chave]: novo }));
                          }}
                        />
                        {v?.sugestao && !v.valor ? (
                          <button
                            type="button"
                            className="text-[11px] text-blue-600 underline dark:text-blue-400"
                            onClick={() =>
                              setEdits((prev) => ({ ...prev, [c.chave]: v.sugestao as string }))
                            }
                          >
                            Sugestão da IA (baixa confiança): {v.sugestao}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {aba === "achados" && (
              <AnaliseTecnicaPanel
                casoId={casoId}
                achados={achados}
                descartados={descartados}
                semCard
                onAtualizar={(r) => {
                  setConteudo(r.conteudo);
                  setAchados(r.achados ?? []);
                  setDescartados(r.descartados ?? []);
                }}
              />
            )}
          </div>
        </aside>
      </div>

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
    </div>
  );
}
