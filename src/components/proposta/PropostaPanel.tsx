import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, FileText, Loader2, RefreshCw, ScanSearch, Trash2 } from "lucide-react";
import { Badge, Button, Card, Input } from "@/components/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import {
  carregarProposta,
  compararProposta,
  reextrairProposta,
  registrarProposta,
  removerProposta,
  salvarEscopoProposta,
  urlProposta,
} from "@/lib/proposta.functions";
import {
  ESCOPO_VAZIO,
  ROTULOS_ESCOPO,
  formatarValorEscopo,
  type EscopoProposta,
  type PropostaResumo,
  type ResultadoComparacao,
} from "@/lib/proposta/tipos";

const CHAVES = Object.keys(ESCOPO_VAZIO) as (keyof EscopoProposta)[];

function parseValor(chave: keyof EscopoProposta, texto: string): any {
  const t = texto.trim();
  if (!t) return null;
  if (chave === "itens_inclusos" || chave === "itens_nao_inclusos")
    return t.split(/;|\n/).map((s) => s.trim()).filter(Boolean);
  if (chave === "comboio") return /^(sim|s|true|1)$/i.test(t);
  if (chave === "comunicacao") {
    const l = t.toLowerCase();
    return /ambos/.test(l) ? "ambos" : /4g/.test(l) ? "4g" : /wi-?fi/.test(l) ? "wifi" : null;
  }
  const n = Number(t.replace(/\D/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function PropostaPanel({ casoId }: { casoId: string }) {
  const carregar = useServerFn(carregarProposta);
  const registrar = useServerFn(registrarProposta);
  const reextrair = useServerFn(reextrairProposta);
  const comparar = useServerFn(compararProposta);
  const salvar = useServerFn(salvarEscopoProposta);
  const remover = useServerFn(removerProposta);
  const assinar = useServerFn(urlProposta);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [proposta, setProposta] = useState<PropostaResumo | null>(null);
  const [comparacao, setComparacao] = useState<ResultadoComparacao | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await carregar({ data: { casoId } });
      setProposta(r.proposta);
      setComparacao(r.comparacao);
      setEdits({});
      if (r.proposta) {
        const s = await assinar({ data: { path: r.proposta.arquivo_path } });
        setPdfUrl(s.url);
      } else setPdfUrl(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar a proposta.");
    } finally {
      setLoading(false);
    }
  }, [assinar, carregar, casoId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onUpload(file: File) {
    if (file.type !== "application/pdf") return toast.error("Envie a proposta em PDF.");
    if (file.size > 25 * 1024 * 1024) return toast.error("Arquivo acima de 25 MB.");
    setBusy("upload");
    try {
      const path = `casos/${casoId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const { error } = await supabase.storage.from("propostas").upload(path, file, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (error) throw new Error(error.message);
      await registrar({
        data: {
          casoId,
          arquivoNome: file.name,
          arquivoPath: path,
          tamanhoBytes: file.size,
        },
      });
      toast.success("Proposta anexada e analisada.");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao anexar a proposta.");
    } finally {
      setBusy(null);
    }
  }

  async function acao(nome: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(nome);
    try {
      await fn();
      toast.success(ok);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível concluir.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando proposta…
        </p>
      </Card>
    );
  }

  if (!proposta) {
    return (
      <Card>
        <h3 className="mb-1 text-sm font-semibold">Proposta comercial</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Nenhuma proposta anexada a este mapeamento. Anexe o PDF vendido ao cliente para comparar o
          escopo com o que foi encontrado em campo.
        </p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
          {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Anexar proposta (PDF)
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void onUpload(f);
            }}
          />
        </label>
      </Card>
    );
  }

  const escopo = proposta.escopo;
  const altas = comparacao?.divergencias.filter((d) => d.severidade === "alta").length ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">{proposta.arquivo_nome}</h3>
            <p className="text-xs text-muted-foreground">
              Status da leitura:{" "}
              {proposta.status === "pronto"
                ? "escopo extraído"
                : proposta.status === "erro"
                  ? proposta.erro_mensagem
                  : proposta.status}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {pdfUrl && (
              <Button variant="outline" onClick={() => window.open(pdfUrl, "_blank")}>
                Abrir PDF
              </Button>
            )}
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={() => acao("reextrair", () => reextrair({ data: { propostaId: proposta.id } }), "Escopo relido.")}
            >
              {busy === "reextrair" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Reler PDF
            </Button>
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={() => acao("comparar", () => comparar({ data: { casoId } }), "Comparação atualizada.")}
            >
              {busy === "comparar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
              Recomparar
            </Button>
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={() => acao("remover", () => remover({ data: { propostaId: proposta.id } }), "Proposta removida.")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {CHAVES.map((chave) => {
            const campo = escopo[chave];
            const atual = edits[chave] ?? "";
            return (
              <div key={chave}>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {ROTULOS_ESCOPO[chave]}
                  {campo?.confianca ? (
                    <span className="ml-2 text-[11px]">
                      confiança {Math.round(campo.confianca * 100)}%
                    </span>
                  ) : null}
                </label>
                <Input
                  value={atual || formatarValorEscopo(chave, campo?.valor ?? null).replace("não identificado", "")}
                  placeholder="não identificado — preencha manualmente"
                  onChange={(e) => {
                    const novo = e.target.value;
                    setEdits((prev) => ({ ...prev, [chave]: novo }));
                  }}
                />
                {campo?.trecho ? (
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">“{campo.trecho}”</p>
                ) : null}
              </div>
            );
          })}
        </div>

        {Object.keys(edits).length > 0 && (
          <div className="mt-3">
            <Button
              disabled={busy !== null}
              onClick={() =>
                acao(
                  "salvar",
                  async () => {
                    const novo: any = JSON.parse(JSON.stringify(escopo));
                    for (const [chave, texto] of Object.entries(edits)) {
                      novo[chave] = {
                        valor: parseValor(chave as keyof EscopoProposta, texto),
                        confianca: 1,
                        trecho: "ajuste manual",
                      };
                    }
                    await salvar({ data: { propostaId: proposta.id, escopo: novo } });
                    await comparar({ data: { casoId } });
                  },
                  "Escopo atualizado e recomparado.",
                )
              }
            >
              {busy === "salvar" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Salvar escopo e recomparar
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-semibold">Proposta × Campo</h3>
          {comparacao && (
            <Badge variant={altas > 0 ? "destructive" : comparacao.divergencias.length ? "warning" : "success"}>
              {comparacao.divergencias.length === 0
                ? "sem divergências"
                : `${comparacao.divergencias.length} divergência(s)`}
            </Badge>
          )}
        </div>

        {!comparacao && (
          <p className="text-sm text-muted-foreground">
            Ainda não há comparação. Clique em “Recomparar” após o formulário ter respostas.
          </p>
        )}

        <div className="space-y-3">
          {comparacao?.divergencias.map((d) => (
            <div
              key={d.codigo}
              className={`rounded-md border p-3 ${
                d.severidade === "alta"
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-amber-300/50 bg-amber-50"
              }`}
            >
              <p className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4" /> {d.titulo}
              </p>
              <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">Proposta:</span> {d.proposta}
                </p>
                <p>
                  <span className="text-muted-foreground">Campo:</span> {d.campo}
                </p>
              </div>
              <p className="mt-2 text-xs">{d.recomendacao}</p>
            </div>
          ))}
        </div>

        {comparacao?.pendencias?.length ? (
          <div className="mt-3 rounded-md border border-border p-3">
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Sem base para comparar</p>
            <ul className="list-disc pl-4 text-xs text-muted-foreground">
              {comparacao.pendencias.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
