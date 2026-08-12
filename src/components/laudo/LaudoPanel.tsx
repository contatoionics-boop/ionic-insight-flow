import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  FileDown,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
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
import type {
  BlocoLaudo,
  ConfirmacaoAlerta,
  LaudoConteudo,
  VariaveisLaudo,
} from "@/lib/laudo/tipos";

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

function Pendencia({ texto }: { texto: string }) {
  const partes = texto.split(/(\[CONFIRMAR:[^\]]*\])/g);
  return (
    <>
      {partes.map((p, i) =>
        p.startsWith("[CONFIRMAR:") ? (
          <span
            key={i}
            className="rounded bg-amber-100 px-1 font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
          >
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function Bloco({ bloco }: { bloco: BlocoLaudo }) {
  switch (bloco.tipo) {
    case "heading": {
      const cls =
        bloco.nivel === 1
          ? "mt-6 text-base font-semibold"
          : bloco.nivel === 2
            ? "mt-4 text-sm font-semibold"
            : "mt-3 text-sm font-medium";
      return (
        <h3 className={`${cls} text-foreground`}>
          {bloco.numero ? `${bloco.numero}. ` : ""}
          {bloco.texto}
        </h3>
      );
    }
    case "paragraph":
      return (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          <Pendencia texto={bloco.texto} />
        </p>
      );
    case "bullets":
      return (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {bloco.itens.map((i, k) => (
            <li key={k}>
              <Pendencia texto={i} />
            </li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          {bloco.titulo ? (
            <div className="border-b border-border bg-muted/40 px-3 py-2 text-xs font-semibold">
              {bloco.titulo}
            </div>
          ) : null}
          <table className="w-full text-xs">
            <thead className="bg-muted/20 text-muted-foreground">
              <tr>
                {bloco.colunas.map((c) => (
                  <th key={c} className="px-3 py-2 text-left font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloco.linhas.map((l, i) => (
                <tr key={i} className="border-t border-border">
                  {l.celulas.map((c, j) => (
                    <td key={j} className="px-3 py-2 align-top">
                      <Pendencia texto={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "notes":
      return (
        <ul className="mt-2 space-y-1 text-xs italic text-muted-foreground">
          {bloco.itens.map((i, k) => (
            <li key={k}>Obs.: {i}</li>
          ))}
        </ul>
      );
    case "alert":
      return (
        <div
          className={`mt-3 flex gap-2 rounded-lg border p-3 text-sm ${
            bloco.severidade === "bloqueante"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          }`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{bloco.texto}</span>
        </div>
      );
    case "image":
      return (
        <figure className="mt-4 flex flex-col items-center gap-2">
          <img
            src={bloco.url}
            alt={bloco.alt}
            loading="lazy"
            className="w-full rounded-lg border border-border bg-background object-contain p-2"
            style={{ maxWidth: bloco.larguraMax ?? 360 }}
          />
          {bloco.legenda ? (
            <figcaption className="text-center text-xs text-muted-foreground">
              {bloco.legenda}
            </figcaption>
          ) : null}
        </figure>
      );
  }
}

export function LaudoPanel({ casoId }: { casoId: string }) {
  const fnCarregar = useServerFn(carregarLaudo);
  const fnGerar = useServerFn(gerarLaudo);
  const fnSalvar = useServerFn(salvarVariaveisLaudo);
  const fnConfirmar = useServerFn(confirmarAlertaLaudo);
  const fnPdf = useServerFn(gerarPdfLaudo);

  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [conteudo, setConteudo] = useState<LaudoConteudo | null>(null);
  const [variaveis, setVariaveis] = useState<VariaveisLaudo>({});
  const [confirmacoes, setConfirmacoes] = useState<ConfirmacaoAlerta[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [alertaAberto, setAlertaAberto] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [decisao, setDecisao] = useState<"corrigido" | "ciente_do_risco">("corrigido");
  const [justificativa, setJustificativa] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fnCarregar({ data: { casoId } });
      setConteudo(r.conteudo);
      setVariaveis(r.variaveis ?? {});
      setConfirmacoes(r.confirmacoes ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar o laudo.");
    } finally {
      setLoading(false);
    }
  }, [casoId, fnCarregar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const bloqueantes = useMemo(
    () =>
      (conteudo?.blocos ?? []).filter(
        (b): b is Extract<BlocoLaudo, { tipo: "alert" }> =>
          b.tipo === "alert" && b.severidade === "bloqueante",
      ),
    [conteudo],
  );
  const pendentes = bloqueantes.filter((b) => !confirmacoes.some((c) => c.codigo === b.codigo));

  async function handleGerar() {
    setGerando(true);
    try {
      const r = await fnGerar({ data: { casoId } });
      setConteudo(r.conteudo);
      setVariaveis(r.variaveis);
      setConfirmacoes(r.confirmacoes ?? []);
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
      toast.success("Variáveis atualizadas e laudo remontado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar as variáveis.");
    } finally {
      setSalvando(false);
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

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-medium">Laudo estruturado</p>
          <p className="text-xs text-muted-foreground">
            {conteudo
              ? `Gerado em ${new Date(conteudo.gerado_em).toLocaleString("pt-BR")}`
              : "Ainda não gerado para este mapeamento."}
          </p>
          <p className="text-xs text-muted-foreground">
            Editou respostas na aba anterior? Clique em <strong>Regerar</strong> para atualizar o
            documento e o PDF.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleGerar} disabled={gerando}>
            {gerando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : conteudo ? (
              <RefreshCw className="mr-2 h-4 w-4" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {conteudo ? "Regerar" : "Gerar laudo"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => handlePdf(true)}
            disabled={!conteudo || baixando || pendentes.length > 0}
            title={
              pendentes.length ? "Confirme os alertas bloqueantes antes de emitir o PDF." : undefined
            }
          >
            {baixando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Pré-visualizar PDF
          </Button>
          <Button
            variant="secondary"
            onClick={() => handlePdf(false)}
            disabled={!conteudo || baixando || pendentes.length > 0}
            title={
              pendentes.length ? "Confirme os alertas bloqueantes antes de emitir o PDF." : undefined
            }
          >
            {baixando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Baixar PDF
          </Button>
        </div>
      </Card>

      {pdfUrl && (
        <Card className="p-2">
          <iframe
            src={pdfUrl}
            title="Pré-visualização do laudo"
            className="h-[70vh] w-full rounded-lg border border-border"
          />
        </Card>
      )}

      {bloqueantes.length > 0 && (
        <Card className="p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" /> Alertas bloqueantes
          </p>
          <div className="space-y-2">
            {bloqueantes.map((b) => {
              const conf = confirmacoes.find((c) => c.codigo === b.codigo);
              return (
                <div
                  key={b.codigo}
                  className="rounded-lg border border-border p-3 text-sm"
                >
                  <p className="text-muted-foreground">{b.texto}</p>
                  {conf ? (
                    <p className="mt-2 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {conf.decisao === "corrigido" ? "Corrigido" : "Ciente do risco"} por{" "}
                      {conf.confirmado_por_nome ?? "usuário"} em{" "}
                      {new Date(conf.confirmado_em).toLocaleString("pt-BR")} — {conf.justificativa}
                    </p>
                  ) : (
                    <Button
                      className="mt-2"
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
            })}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Variáveis do laudo</p>
          <Button onClick={handleSalvar} disabled={salvando || !Object.keys(edits).length}>
            {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar e remontar
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {CHAVES_LAUDO.map((c) => {
            const v = variaveis[c.chave];
            const valor = edits[c.chave] ?? v?.valor ?? "";
            return (
              <div key={c.chave} className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium">{c.rotulo}</label>
                  {v?.origem === "ia" && (
                    <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-300">
                      IA {Math.round((v.confianca ?? 0) * 100)}%
                    </Badge>
                  )}
                  {v?.origem === "manual" && <Badge>manual</Badge>}
                  {(!v?.valor || v?.origem === "ausente") && (
                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                      pendente
                    </Badge>
                  )}
                </div>
                <Input
                  value={valor}
                  placeholder={c.exemplos?.join(" | ") ?? c.descricao}
                  onChange={(e) =>
                    setEdits((prev) => ({ ...prev, [c.chave]: e.currentTarget.value }))
                  }
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
      </Card>

      <Card className="p-5">
        <p className="mb-2 text-sm font-medium">Prévia do documento</p>
        {conteudo?.blocos?.length ? (
          conteudo.blocos.map((b) => <Bloco key={b.id} bloco={b} />)
        ) : (
          <p className="text-sm text-muted-foreground">
            Clique em “Gerar laudo” para montar o documento a partir das respostas.
          </p>
        )}
      </Card>

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
