import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  PageHeader,
  Card,
  Button,
  Textarea,
  Input,
  Modal,
} from "@/components/ui-bits";
import {
  ArrowLeft,
  Check,
  AlertCircle,
  FileDown,
  Loader2,
  Save,
  ImageOff,
} from "lucide-react";
import { MicButton } from "@/components/MicButton";
import { supabase } from "@/integrations/supabase/client";
import { gerarPdfMapeamento } from "@/lib/casos-pdf.functions";
import { aprovarMapeamento, solicitarCorrecao } from "@/lib/mapeamento.functions";

export const Route = createFileRoute("/app/review/$id")({
  component: ReviewCasePage,
});

type Caso = {
  id: string;
  codigo: string;
  status: string;
  formulario_id: string | null;
  unidade: {
    nome: string;
    matriz: { nome: string; empresa: { nome: string } | null } | null;
  } | null;
  agente: { nome: string } | null;
};

type Pergunta = {
  id: string;
  secao_id: string;
  texto: string;
  tipo: string;
  ordem: number;
  instrucao_agente: string | null;
};

type Secao = { id: string; titulo: string; ordem: number };

type Opcao = { id: string; pergunta_id: string; texto: string };

type Resposta = {
  pergunta_id: string;
  valor_texto: string | null;
  arquivo_path: string | null;
  arquivos_paths: string[] | null;
  transcricao: string | null;
};

function ReviewCasePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<Caso | null>(null);
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [opcoes, setOpcoes] = useState<Opcao[]>([]);
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({});
  const [fotoUrls, setFotoUrls] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [reopenOpen, setReopenOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [working, setWorking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const gerarPdf = useServerFn(gerarPdfMapeamento);
  const aprovarFn = useServerFn(aprovarMapeamento);
  const recusarFn = useServerFn(solicitarCorrecao);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: c } = await supabase
        .from("casos")
        .select(
          "id, codigo, status, formulario_id, unidade:unidades(nome, matriz:matrizes(nome, empresa:empresas(nome))), agente:profiles!agente_id(nome)",
        )
        .eq("id", id)
        .maybeSingle();
      const caso = (c as unknown as Caso) ?? null;
      setCaseData(caso);

      if (caso?.formulario_id) {
        const { data: secs } = await supabase
          .from("secoes")
          .select("id, titulo, ordem")
          .eq("formulario_id", caso.formulario_id)
          .order("ordem");
        const secList = (secs ?? []) as Secao[];
        setSecoes(secList);

        if (secList.length) {
          const { data: ps } = await supabase
            .from("perguntas")
            .select("id, secao_id, texto, tipo, ordem, instrucao_agente")
            .in(
              "secao_id",
              secList.map((s) => s.id),
            )
            .order("ordem");
          const pList = (ps ?? []) as Pergunta[];
          setPerguntas(pList);

          if (pList.length) {
            const { data: ops } = await supabase
              .from("opcoes_pergunta")
              .select("id, pergunta_id, texto, ordem")
              .in(
                "pergunta_id",
                pList.map((p) => p.id),
              )
              .order("ordem");
            setOpcoes((ops ?? []) as Opcao[]);
          }
        }
      }

      const { data: rs } = await supabase
        .from("respostas_agente")
        .select("pergunta_id, valor_texto, arquivo_path, arquivos_paths, transcricao")
        .eq("caso_id", id);
      const map: Record<string, Resposta> = {};
      const paths: string[] = [];
      for (const r of (rs ?? []) as Resposta[]) {
        map[r.pergunta_id] = r;
        const list = Array.isArray(r.arquivos_paths) && r.arquivos_paths.length
          ? r.arquivos_paths
          : r.arquivo_path ? [r.arquivo_path] : [];
        for (const pth of list) if (pth && !paths.includes(pth)) paths.push(pth);
      }
      setRespostas(map);

      if (paths.length) {
        const { data: signed } = await supabase.storage
          .from("agente-uploads")
          .createSignedUrls(paths, 60 * 60);
        const urls: Record<string, string> = {};
        for (const s of signed ?? []) {
          if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
        }
        setFotoUrls(urls);
      }

      setLoading(false);
    })();
  }, [id]);

  const opcoesPorPergunta = useMemo(() => {
    const m = new Map<string, Opcao[]>();
    for (const o of opcoes) {
      const arr = m.get(o.pergunta_id) ?? [];
      arr.push(o);
      m.set(o.pergunta_id, arr);
    }
    return m;
  }, [opcoes]);

  const perguntasPorSecao = useMemo(() => {
    const m = new Map<string, Pergunta[]>();
    for (const p of perguntas) {
      const arr = m.get(p.secao_id) ?? [];
      arr.push(p);
      m.set(p.secao_id, arr);
    }
    return m;
  }, [perguntas]);

  const updateResposta = (
    perguntaId: string,
    patch: Partial<Resposta>,
  ) => {
    setRespostas((prev) => ({
      ...prev,
      [perguntaId]: {
        pergunta_id: perguntaId,
        valor_texto: prev[perguntaId]?.valor_texto ?? null,
        arquivo_path: prev[perguntaId]?.arquivo_path ?? null,
        arquivos_paths: prev[perguntaId]?.arquivos_paths ?? null,
        transcricao: prev[perguntaId]?.transcricao ?? null,
        ...patch,
      },
    }));
    setDirty((d) => ({ ...d, [perguntaId]: true }));
  };

  const salvarTudo = async () => {
    if (!caseData) return;
    setSavingAll(true);
    try {
      const updates = Object.keys(dirty).filter((k) => dirty[k]);
      for (const pid of updates) {
        const r = respostas[pid];
        if (!r) continue;
        await supabase
          .from("respostas_agente")
          .update({
            valor_texto: r.valor_texto,
            transcricao: r.transcricao,
          })
          .eq("caso_id", caseData.id)
          .eq("pergunta_id", pid);
      }
      setDirty({});
      setSavedAt(Date.now());
    } finally {
      setSavingAll(false);
    }
  };

  const approve = async () => {
    if (!caseData) return;
    setWorking(true);
    try {
      if (Object.values(dirty).some(Boolean)) await salvarTudo();
      await aprovarFn({ data: { casoId: caseData.id } });
      setApproveOpen(false);
      navigate({ to: "/app/history" });
    } finally {
      setWorking(false);
    }
  };

  const reopen = async () => {
    if (!caseData) return;
    setWorking(true);
    try {
      await recusarFn({ data: { casoId: caseData.id, motivo: reopenReason || "Solicitação de correção" } });
      setReopenOpen(false);
      navigate({ to: "/app/review-queue" });
    } finally {
      setWorking(false);
    }
  };

  const baixarPdf = async () => {
    if (!caseData) return;
    setDownloading(true);
    setPdfError(null);
    try {
      if (Object.values(dirty).some(Boolean)) await salvarTudo();
      const out = await gerarPdf({ data: { casoId: caseData.id } });
      const binary = atob(out.contentBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: out.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = out.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : "Falha ao gerar PDF.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!caseData) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">Mapeamento não encontrado.</p>
        <Link to="/app/review-queue" className="mt-2 inline-block text-sm text-primary hover:underline">
          Voltar para fila
        </Link>
      </div>
    );
  }

  const hasDirty = Object.values(dirty).some(Boolean);

  return (
    <div>
      <Link
        to="/app/review-queue"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para fila
      </Link>

      <PageHeader
        title={`Revisão ${caseData.codigo}`}
        description={`${caseData.unidade?.matriz?.empresa?.nome ?? "—"}${caseData.unidade?.nome ? ` · ${caseData.unidade.nome}` : ""} · Agente ${caseData.agente?.nome ?? "—"}`}
        actions={
          <>
            <Button variant="outline" onClick={salvarTudo} disabled={savingAll || !hasDirty}>
              {savingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar alterações
            </Button>
            <Button variant="outline" onClick={baixarPdf} disabled={downloading}>
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Baixar PDF
            </Button>
            <Button variant="outline" onClick={() => setReopenOpen(true)}>
              <AlertCircle className="h-4 w-4" /> Solicitar reenvio
            </Button>
            <Button variant="success" onClick={() => setApproveOpen(true)}>
              <Check className="h-4 w-4" /> Aprovar
            </Button>
          </>
        }
      />

      {pdfError && (
        <Card className="mb-3 border-destructive/30 bg-destructive/5">
          <p className="text-sm text-destructive">{pdfError}</p>
        </Card>
      )}

      {hasDirty && (
        <Card className="mb-3 border-amber-300/40 bg-amber-50">
          <p className="text-sm text-amber-900">
            Você tem alterações não salvas. Clique em <strong>Salvar alterações</strong> antes de aprovar ou gerar o PDF (também salvamos automaticamente nessas ações).
          </p>
        </Card>
      )}
      {!hasDirty && savedAt && (
        <Card className="mb-3 border-emerald-300/40 bg-emerald-50">
          <p className="text-sm text-emerald-900">Alterações salvas.</p>
        </Card>
      )}

      <div className="space-y-4">
        {secoes.length === 0 && (
          <Card>
            <p className="text-sm text-muted-foreground">
              Este mapeamento não possui seções/perguntas configuradas no formulário.
            </p>
          </Card>
        )}
        {secoes.map((s) => {
          const ps = perguntasPorSecao.get(s.id) ?? [];
          return (
            <Card key={s.id}>
              <h3 className="mb-3 text-lg font-semibold text-foreground">{s.titulo}</h3>
              {ps.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem perguntas nesta seção.</p>
              )}
              <div className="space-y-5">
                {ps.map((p) => {
                  const r = respostas[p.id];
                  return (
                    <div key={p.id} className="rounded-md border border-border p-3">
                      <div className="text-sm font-medium text-foreground">
                        {p.texto}
                      </div>
                      {p.instrucao_agente && (
                        <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
                          {p.instrucao_agente}
                        </p>
                      )}

                      {p.tipo === "texto" && (
                        <div className="mt-2 space-y-2">
                          <Textarea
                            rows={3}
                            value={r?.valor_texto ?? ""}
                            onChange={(e) =>
                              updateResposta(p.id, { valor_texto: e.target.value })
                            }
                            placeholder="Sem resposta"
                          />
                          <MicButton
                            currentValue={r?.valor_texto ?? ""}
                            onTranscricao={(t) => updateResposta(p.id, { valor_texto: t })}
                          />
                        </div>
                      )}

                      {p.tipo === "selecao_unica" && (
                        <div className="mt-2 space-y-2">
                          <select
                            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                            value={r?.valor_texto ?? ""}
                            onChange={(e) =>
                              updateResposta(p.id, { valor_texto: e.target.value })
                            }
                          >
                            <option value="">— Sem resposta —</option>
                            {(opcoesPorPergunta.get(p.id) ?? []).map((o) => (
                              <option key={o.id} value={o.texto}>
                                {o.texto}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {p.tipo === "audio" && (
                        <div className="mt-2 space-y-2">
                          {r?.arquivo_path && fotoUrls[r.arquivo_path] && (
                            <audio controls src={fotoUrls[r.arquivo_path]} className="w-full" />
                          )}
                          <div className="text-xs text-muted-foreground">Transcrição</div>
                          <Textarea
                            rows={4}
                            value={r?.transcricao ?? ""}
                            onChange={(e) =>
                              updateResposta(p.id, { transcricao: e.target.value })
                            }
                            placeholder="Sem transcrição"
                          />
                          <MicButton
                            currentValue={r?.transcricao ?? ""}
                            onTranscricao={(t) => updateResposta(p.id, { transcricao: t })}
                          />
                        </div>
                      )}

                      {p.tipo === "foto" && (() => {
                        const fotoList: string[] =
                          Array.isArray(r?.arquivos_paths) && r!.arquivos_paths!.length
                            ? r!.arquivos_paths!
                            : r?.arquivo_path ? [r.arquivo_path] : [];
                        return (
                          <div className="mt-2 grid gap-3 md:grid-cols-[200px_1fr]">
                            <div className="space-y-2">
                              {fotoList.length === 0 ? (
                                <div className="flex h-44 items-center justify-center overflow-hidden rounded-md border border-border bg-muted text-muted-foreground">
                                  <ImageOff className="h-8 w-8" />
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 gap-1.5">
                                  {fotoList.map((pth, i) => (
                                    <div key={pth + i} className="overflow-hidden rounded-md border border-border bg-muted">
                                      {fotoUrls[pth] ? (
                                        <img src={fotoUrls[pth]} alt={`${p.texto} ${i + 1}`} className="h-24 w-full object-cover" />
                                      ) : (
                                        <div className="flex h-24 items-center justify-center text-muted-foreground">
                                          <ImageOff className="h-5 w-5" />
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {fotoList.length > 1 && (
                                <p className="text-center text-[11px] text-muted-foreground">{fotoList.length} fotos</p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">Legenda / observação</div>
                              <Textarea
                                rows={4}
                                value={r?.valor_texto ?? ""}
                                onChange={(e) => updateResposta(p.id, { valor_texto: e.target.value })}
                                placeholder="Sem legenda"
                              />
                              <MicButton
                                currentValue={r?.valor_texto ?? ""}
                                onTranscricao={(t) => updateResposta(p.id, { valor_texto: t })}
                              />
                            </div>
                          </div>
                        );
                      })()}

                      {p.tipo === "video" && r?.arquivo_path && fotoUrls[r.arquivo_path] && (
                        <video controls preload="metadata" src={fotoUrls[r.arquivo_path]} className="mt-2 w-full max-w-2xl rounded-md border border-border" />
                      )}

                      {!["texto", "selecao_unica", "audio", "foto", "video"].includes(p.tipo) && (
                        <div className="mt-2 space-y-2">
                          <Input
                            value={r?.valor_texto ?? ""}
                            onChange={(e) =>
                              updateResposta(p.id, { valor_texto: e.target.value })
                            }
                            placeholder="Sem resposta"
                          />
                          <MicButton
                            currentValue={r?.valor_texto ?? ""}
                            onTranscricao={(t) => updateResposta(p.id, { valor_texto: t })}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={reopenOpen} onClose={() => setReopenOpen(false)} title="Solicitar reenvio">
        <p className="mb-3 text-sm text-muted-foreground">
          Descreva o que precisa ser refeito pelo agente:
        </p>
        <Textarea
          rows={5}
          value={reopenReason}
          onChange={(e) => setReopenReason(e.target.value)}
          placeholder="Ex: foto do hodômetro está borrada, refazer..."
        />
        <div className="mt-2">
          <MicButton
            currentValue={reopenReason}
            onTranscricao={(t) => setReopenReason(t)}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setReopenOpen(false)} disabled={working}>
            Cancelar
          </Button>
          <Button onClick={reopen} disabled={working}>
            Enviar solicitação
          </Button>
        </div>
      </Modal>

      <Modal open={approveOpen} onClose={() => setApproveOpen(false)} title="Aprovar relatório">
        <p className="text-sm text-foreground">
          Confirma a aprovação do caso <strong>{caseData.codigo}</strong>? Suas alterações serão
          salvas antes da aprovação.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setApproveOpen(false)} disabled={working}>
            Cancelar
          </Button>
          <Button variant="success" onClick={approve} disabled={working}>
            Confirmar aprovação
          </Button>
        </div>
      </Modal>
    </div>
  );
}
