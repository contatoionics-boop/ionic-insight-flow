import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
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
  ChevronDown,
  Eye,
  FileDown,
  Loader2,
  Save,
  ImageOff,
  Sparkles,
  Trash2,
  Upload,
  RefreshCw,
  X,
} from "lucide-react";
import { MicButton } from "@/components/MicButton";
import { supabase } from "@/integrations/supabase/client";
import { carregarLaudo, gerarPdfLaudo } from "@/lib/laudo.functions";
import { LaudoPanel, type EstadoDocumento } from "@/components/laudo/LaudoPanel";
import { ConferenciaProposta } from "@/components/revisao/ConferenciaProposta";
import { RespostasLeitura } from "@/components/revisao/RespostasLeitura";
import { useImagemLightbox } from "@/components/revisao/ImagemLightbox";
import { aprovarMapeamento, solicitarCorrecao } from "@/lib/mapeamento.functions";
import { avaliarCondicional } from "@/lib/perguntas-mapeamento";
import { carregarEscopoEstrutura } from "@/lib/escopo.functions";
import { decodificarIdInstancia, expandirPerguntas, idInstancia } from "@/lib/escopo/expandir";
import type { EntidadeEscopo } from "@/lib/escopo/tipos";


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
  condicional_pergunta_id: string | null;
  condicional_operador: string | null;
  condicional_valor: string | null;
  /** Instância do Escopo (pergunta repetida por posto/ilha/bomba/bico/comboio). */
  base_id?: string;
  entidade_id?: string | null;
  entidade_rotulo?: string | null;
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

function arquivosDe(r: Resposta | undefined): string[] {
  if (!r) return [];
  if (Array.isArray(r.arquivos_paths) && r.arquivos_paths.length) return r.arquivos_paths;
  return r.arquivo_path ? [r.arquivo_path] : [];
}

function ReviewCasePage() {
  const { id } = Route.useParams();
  const [tab, setTab] = useState<"conferencia" | "documento">("conferencia");
  const [estadoDoc, setEstadoDoc] = useState<EstadoDocumento | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfMenu, setPdfMenu] = useState(false);
  const [divergencias, setDivergencias] = useState(0);
  const [alertasTecnicos, setAlertasTecnicos] = useState(0);

  const [modoRespostas, setModoRespostas] = useState<"leitura" | "editar">("leitura");
  const { abrir: abrirImagem, elemento: lightboxEdicao } = useImagemLightbox();
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
  const gerarLaudoPdf = useServerFn(gerarPdfLaudo);
  const carregarEstruturaFn = useServerFn(carregarEscopoEstrutura);
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
            .select(
              "id, secao_id, texto, tipo, ordem, instrucao_agente, condicional_pergunta_id, condicional_operador, condicional_valor",
            )
            .in(
              "secao_id",
              secList.map((s) => s.id),
            )
            .order("ordem");
          const pBase = (ps ?? []) as Pergunta[];
          // Repetição estrutural pelo Escopo (sem estrutura, segue o fluxo legado).
          const aplicaA = new Map<string, string>();
          const { data: aplic, error: aplicErr } = await (supabase as any)
            .from("perguntas")
            .select("id, entidade_tipo")
            .in("id", pBase.map((p) => p.id));
          if (!aplicErr) for (const r of aplic ?? []) aplicaA.set(r.id, r.entidade_tipo ?? "geral");
          let estrutura: Awaited<ReturnType<typeof carregarEstruturaFn>> | null = null;
          try {
            estrutura = await carregarEstruturaFn({ data: { casoId: id } });
          } catch {
            estrutura = null;
          }
          const pList = expandirPerguntas(
            pBase,
            aplicaA,
            (estrutura?.entidades ?? []) as EntidadeEscopo[],
            !!estrutura?.versaoId,
          ) as Pergunta[];
          setPerguntas(pList);

          if (pList.length) {
            const { data: ops } = await supabase
              .from("opcoes_pergunta")
              .select("id, pergunta_id, texto, ordem")
              .in(
                "pergunta_id",
                pBase.map((p) => p.id),
              )
              .order("ordem");
            setOpcoes((ops ?? []) as Opcao[]);
          }
        }
      }

      let rs: any[] | null = null;
      {
        const r1 = await (supabase as any)
          .from("respostas_agente")
          .select("pergunta_id, entidade_id, valor_texto, arquivo_path, arquivos_paths, transcricao")
          .eq("caso_id", id);
        if (r1.error) {
          const r2 = await supabase
            .from("respostas_agente")
            .select("pergunta_id, valor_texto, arquivo_path, arquivos_paths, transcricao")
            .eq("caso_id", id);
          rs = r2.data as any[] | null;
        } else rs = r1.data;
      }
      const map: Record<string, Resposta> = {};
      const paths: string[] = [];
      for (const r of (rs ?? []) as (Resposta & { entidade_id?: string | null })[]) {
        map[idInstancia(r.pergunta_id, r.entidade_id)] = r;
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

  const carregarLaudoFn = useServerFn(carregarLaudo);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await carregarLaudoFn({ data: { casoId: id } });
        if (!vivo) return;
        const achados = (r.achados ?? []) as { severidade?: string }[];
        setAlertasTecnicos(achados.filter((a) => a.severidade === "atencao").length);
      } catch {
        /* sem laudo ainda */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id, carregarLaudoFn]);

  const opcoesPorPergunta = useMemo(() => {
    const m = new Map<string, Opcao[]>();
    for (const o of opcoes) {
      const arr = m.get(o.pergunta_id) ?? [];
      arr.push(o);
      m.set(o.pergunta_id, arr);
    }
    // Instâncias do Escopo reutilizam as opções da pergunta-template.
    for (const p of perguntas) {
      if (p.base_id && !m.has(p.id)) m.set(p.id, m.get(p.base_id) ?? []);
    }
    return m;
  }, [opcoes, perguntas]);

  // Perguntas com condicional não satisfeita nunca foram exibidas ao agente
  // em campo (mesma regra de `vistoria-checklist.ts`) — contá-las como "não
  // respondidas" aqui causaria uma divergência falsa com o app do agente.
  const perguntasVisiveis = useMemo(() => {
    const estado: Record<string, { text?: string; transcription?: string }> = {};
    for (const [pid, r] of Object.entries(respostas)) {
      estado[pid] = { text: r.valor_texto ?? undefined, transcription: r.transcricao ?? undefined };
    }
    return perguntas.filter((p) => avaliarCondicional(p, estado as never));
  }, [perguntas, respostas]);

  const statsRespostas = useMemo(() => {
    let ok = 0;
    for (const p of perguntasVisiveis) {
      const r = respostas[p.id];
      if (!r) continue;
      const temArquivo = arquivosDe(r).length > 0;
      if (
        temArquivo ||
        !!r.valor_texto?.trim() ||
        !!r.transcricao?.trim()
      ) {
        ok++;
      }
    }
    return { total: perguntasVisiveis.length, ok };
  }, [perguntasVisiveis, respostas]);

  const perguntasPorSecao = useMemo(() => {
    const m = new Map<string, Pergunta[]>();
    for (const p of perguntasVisiveis) {
      const arr = m.get(p.secao_id) ?? [];
      arr.push(p);
      m.set(p.secao_id, arr);
    }
    return m;
  }, [perguntasVisiveis]);

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

  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const persistirArquivos = async (
    perguntaId: string,
    tipo: string,
    lista: string[],
  ) => {
    if (!caseData) return;
    const patch = {
      arquivos_paths: lista,
      arquivo_path: lista[0] ?? null,
    };
    const { perguntaId: pidBase, entidadeId } = decodificarIdInstancia(perguntaId);
    let q = (supabase as any)
      .from("respostas_agente")
      .update(patch)
      .eq("caso_id", caseData.id)
      .eq("pergunta_id", pidBase);
    q = entidadeId ? q.eq("entidade_id", entidadeId) : q.is("entidade_id", null);
    const { data: upd } = await q.select("pergunta_id");
    if (!upd || upd.length === 0) {
      await (supabase as any).from("respostas_agente").insert({
        caso_id: caseData.id,
        pergunta_id: pidBase,
        ...(entidadeId ? { entidade_id: entidadeId } : {}),
        tipo: tipo as never,
        ...patch,
      });
    }
    setRespostas((prev) => ({
      ...prev,
      [perguntaId]: {
        pergunta_id: perguntaId,
        valor_texto: prev[perguntaId]?.valor_texto ?? null,
        transcricao: prev[perguntaId]?.transcricao ?? null,
        arquivos_paths: lista,
        arquivo_path: lista[0] ?? null,
      },
    }));
    setSavedAt(Date.now());
  };

  const adicionarArquivos = async (
    perguntaId: string,
    tipo: string,
    files: FileList | null,
    substituirTudo = false,
  ) => {
    if (!caseData || !files || files.length === 0) return;
    setUploading((u) => ({ ...u, [perguntaId]: true }));
    try {
      const novos: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
        const path = `casos/${caseData.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("agente-uploads")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (error) throw error;
        novos.push(path);
      }
      const atual = substituirTudo || tipo === "video" ? [] : arquivosDe(respostas[perguntaId]);
      const lista = [...atual, ...novos];
      const { data: signed } = await supabase.storage
        .from("agente-uploads")
        .createSignedUrls(novos, 60 * 60);
      setFotoUrls((prev) => {
        const next = { ...prev };
        for (const s of signed ?? []) if (s.path && s.signedUrl) next[s.path] = s.signedUrl;
        return next;
      });
      await persistirArquivos(perguntaId, tipo, lista);
    } catch (e) {
      alert("Falha ao enviar arquivo: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setUploading((u) => ({ ...u, [perguntaId]: false }));
    }
  };

  const removerArquivo = async (perguntaId: string, tipo: string, path: string) => {
    if (!confirm("Remover este arquivo do mapeamento?")) return;
    setUploading((u) => ({ ...u, [perguntaId]: true }));
    try {
      const lista = arquivosDe(respostas[perguntaId]).filter((p) => p !== path);
      await persistirArquivos(perguntaId, tipo, lista);
    } finally {
      setUploading((u) => ({ ...u, [perguntaId]: false }));
    }
  };

  const salvarTudo = async () => {
    if (!caseData) return;
    setSavingAll(true);
    try {
      const perguntaPorId = new Map(perguntas.map((p) => [p.id, p]));
      const updates = Object.keys(dirty).filter((k) => dirty[k]);
      const linhas = updates
        .map((pid) => {
          const r = respostas[pid];
          const p = perguntaPorId.get(pid);
          if (!r || !p) return null;
          const { perguntaId: pidBase, entidadeId } = decodificarIdInstancia(pid);
          return {
            caso_id: caseData.id,
            pergunta_id: pidBase,
            ...(entidadeId ? { entidade_id: entidadeId } : {}),
            tipo: p.tipo,
            valor_texto: r.valor_texto,
            transcricao: r.transcricao,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      if (linhas.length) {
        // upsert: perguntas sem resposta do agente ainda não têm linha em
        // respostas_agente — um simples UPDATE não as criaria.
        const { error } = await supabase
          .from("respostas_agente")
          .upsert(linhas as any, { onConflict: "caso_id,pergunta_id,entidade_key" });
        if (error) throw new Error(error.message);
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

  const baixarArquivo = async (
    fn: (args: { data: { casoId: string } }) => Promise<{
      contentBase64: string;
      mimeType: string;
      filename: string;
    }>,
    setBusy: (v: boolean) => void,
  ) => {
    if (!caseData) return;
    setBusy(true);
    setPdfError(null);
    try {
      if (Object.values(dirty).some(Boolean)) await salvarTudo();
      const out = await fn({ data: { casoId: caseData.id } });
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
      setBusy(false);
    }
  };

  const baixarPdf = () =>
    baixarArquivo(
      ((args: any) =>
        (gerarLaudoPdf as any)({ data: args.data })) as any,
      setDownloading,
    );

  const previewPdf = async () => {
    if (!caseData) return;
    setDownloading(true);
    setPdfError(null);
    try {
      if (Object.values(dirty).some(Boolean)) await salvarTudo();
      const out = await gerarLaudoPdf({ data: { casoId: caseData.id } });
      const binary = atob(out.contentBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: out.mimeType }));
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
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

  const salvandoAlgo = savingAll || !!estadoDoc?.salvando;
  const podeSalvar =
    !salvandoAlgo && (tab === "documento" ? !!estadoDoc?.docSujo : hasDirty);
  const salvar = async () => {
    if (tab === "documento") {
      if (estadoDoc?.docSujo) await estadoDoc.salvar();
      return;
    }
    await salvarTudo();
  };

  const podePdf = tab === "documento" ? !estadoDoc?.motivoPdf : true;
  const motivoPdf = tab === "documento" ? (estadoDoc?.motivoPdf ?? null) : null;

  return (
    <div className="pb-4">
      <Link
        to="/app/review-queue"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para fila
      </Link>

      {/* resumo do mapeamento */}
      <Card className="mb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground">
              {caseData.unidade?.matriz?.empresa?.nome ?? "Empresa não informada"}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {caseData.codigo}
              {caseData.unidade?.nome ? ` · ${caseData.unidade.nome}` : ""} · Agente{" "}
              {caseData.agente?.nome ?? "—"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
              Status: {caseData.status.replace(/_/g, " ")}
            </span>
            {tab === "documento" && estadoDoc && estadoDoc.pendencias + estadoDoc.alertasPendentes > 0 && (
              <button
                type="button"
                onClick={estadoDoc.abrirPendencias}
                className="rounded-md bg-amber-500/15 px-2 py-1 font-medium text-amber-700 dark:text-amber-300"
              >
                {estadoDoc.pendencias + estadoDoc.alertasPendentes} ponto(s) a confirmar
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* barra de ações única */}
      <div className="sticky top-0 z-30 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-sm backdrop-blur">
        <div className="flex flex-1 flex-wrap gap-1">
          {(
            [
              ["conferencia", "1. Conferência do mapeamento", "1. Conferência"],
              ["documento", "2. Documento final", "2. Documento"],
            ] as const
          ).map(([key, label, curto]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{curto}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {tab === "documento" && estadoDoc && (
            <Button
              variant="ghost"
              onClick={() => void estadoDoc.gerar()}
              disabled={estadoDoc.gerando}
            >
              {estadoDoc.gerando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : estadoDoc.temConteudo ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {estadoDoc.temConteudo ? "Regerar rascunho" : "Gerar rascunho"}
            </Button>
          )}

          <Button variant="outline" onClick={() => void salvar()} disabled={!podeSalvar}>
            {salvandoAlgo ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar
          </Button>

          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setPdfMenu((v) => !v)}
              disabled={downloading || !podePdf}
              title={motivoPdf ?? undefined}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              PDF
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            {pdfMenu && !downloading && podePdf && (
              <div className="absolute right-0 z-40 mt-1 w-52 overflow-hidden rounded-md border border-border bg-card shadow-lg">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setPdfMenu(false);
                    void previewPdf();
                  }}
                >
                  <Eye className="h-4 w-4" /> Pré-visualizar PDF
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setPdfMenu(false);
                    void baixarPdf();
                  }}
                >
                  <FileDown className="h-4 w-4" /> Baixar PDF
                </button>
              </div>
            )}
          </div>

          <Button variant="outline" onClick={() => setReopenOpen(true)}>
            <AlertCircle className="h-4 w-4" /> Solicitar reenvio
          </Button>
          <Button variant="success" onClick={() => setApproveOpen(true)}>
            <Check className="h-4 w-4" /> Aprovar
          </Button>
        </div>
        {motivoPdf ? (
          <p className="w-full text-[11px] text-amber-600 dark:text-amber-400">
            PDF bloqueado: {motivoPdf}
          </p>
        ) : null}
      </div>


      {pdfError && (
        <Card className="mb-3 border-destructive/30 bg-destructive/5">
          <p className="text-sm text-destructive">{pdfError}</p>
        </Card>
      )}

      {hasDirty && (
        <Card className="mb-3 border-amber-300/40 bg-amber-500/5">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Você tem alterações não salvas nas respostas.
          </p>
        </Card>
      )}
      {!hasDirty && savedAt && tab === "conferencia" && (
        <Card className="mb-3 border-emerald-300/40 bg-emerald-500/5">
          <p className="text-sm text-emerald-700 dark:text-emerald-300">Alterações salvas.</p>
        </Card>
      )}

      {pdfUrl && (
        <Card className="mb-3 space-y-2 p-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-xs text-muted-foreground">Pré-visualização do PDF</p>
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
            title="Pré-visualização do PDF"
            className="h-[70vh] w-full rounded-lg border border-border"
          />
        </Card>
      )}

      {tab === "documento" && <LaudoPanel casoId={id} onEstado={setEstadoDoc} />}

      {tab === "conferencia" && (
        <div className="space-y-4">
          {/* chips de resumo da conferência */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-muted px-2 py-1 font-medium text-foreground">
              {statsRespostas.ok}/{statsRespostas.total} respondidas
            </span>
            {statsRespostas.total - statsRespostas.ok > 0 && (
              <span className="rounded-md bg-amber-500/15 px-2 py-1 font-medium text-amber-700 dark:text-amber-300">
                {statsRespostas.total - statsRespostas.ok} não respondidas
              </span>
            )}
            {divergencias > 0 && (
              <span className="rounded-md bg-amber-500/15 px-2 py-1 font-medium text-amber-700 dark:text-amber-300">
                {divergencias} divergência(s)
              </span>
            )}
            {alertasTecnicos > 0 && (
              <span className="rounded-md bg-destructive/15 px-2 py-1 font-medium text-destructive">
                {alertasTecnicos} alerta(s) técnico(s)
              </span>
            )}
          </div>

          <ConferenciaProposta
            casoId={id}
            onResumo={(r: { divergencias: number }) => setDivergencias(r.divergencias)}
          />

          <div className="inline-flex rounded-md border border-border bg-card p-0.5">
            {(
              [
                ["leitura", "Leitura"],
                ["editar", "Editar respostas"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setModoRespostas(k)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  modoRespostas === k
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}


      {tab === "conferencia" && modoRespostas === "leitura" && (
        <RespostasLeitura
          secoes={secoes}
          perguntasPorSecao={perguntasPorSecao}
          respostas={respostas}
          urls={fotoUrls}
          agente={caseData.agente?.nome ?? null}
        />
      )}


      <div
        className="space-y-4"
        hidden={tab !== "conferencia" || modoRespostas !== "editar"}
      >
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
                      {p.entidade_rotulo && (
                        <div className="mb-1 text-xs font-semibold text-primary">{p.entidade_rotulo}</div>
                      )}
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
                        const fotoList: string[] = arquivosDe(r);
                        const busy = !!uploading[p.id];
                        return (
                          <div className="mt-2 grid gap-3 md:grid-cols-[220px_1fr]">
                            <div className="space-y-2">
                              {fotoList.length === 0 ? (
                                <div className="flex h-44 items-center justify-center overflow-hidden rounded-md border border-border bg-muted text-muted-foreground">
                                  <ImageOff className="h-8 w-8" />
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 gap-1.5">
                                  {fotoList.map((pth, i) => (
                                    <div key={pth + i} className="group relative overflow-hidden rounded-md border border-border bg-muted">
                                      {fotoUrls[pth] ? (
                                        <button
                                          type="button"
                                          title="Ampliar imagem"
                                          onClick={() => abrirImagem(fotoUrls[pth], `${p.texto} — imagem ${i + 1}`)}
                                          className="block w-full cursor-zoom-in"
                                        >
                                          <img src={fotoUrls[pth]} alt={`${p.texto} ${i + 1}`} className="h-24 w-full object-cover" />
                                        </button>
                                      ) : (
                                        <div className="flex h-24 items-center justify-center text-muted-foreground">
                                          <ImageOff className="h-5 w-5" />
                                        </div>
                                      )}
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => removerArquivo(p.id, p.tipo, pth)}
                                        title="Remover imagem"
                                        className="absolute right-1 top-1 rounded-md bg-destructive/90 p-1 text-destructive-foreground opacity-90 hover:opacity-100 disabled:opacity-50"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {fotoList.length > 1 && (
                                <p className="text-center text-[11px] text-muted-foreground">{fotoList.length} fotos</p>
                              )}
                              <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-2 py-2 text-xs text-muted-foreground hover:bg-muted">
                                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                {busy ? "Enviando..." : "Adicionar imagens"}
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  disabled={busy}
                                  onChange={(e) => {
                                    void adicionarArquivos(p.id, p.tipo, e.target.files);
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                              {fotoList.length > 0 && (
                                <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border px-2 py-2 text-xs text-foreground hover:bg-muted">
                                  <RefreshCw className="h-3.5 w-3.5" /> Substituir todas
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    disabled={busy}
                                    onChange={(e) => {
                                      void adicionarArquivos(p.id, p.tipo, e.target.files, true);
                                      e.target.value = "";
                                    }}
                                  />
                                </label>
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

                      {p.tipo === "video" && (
                        <div className="mt-2 space-y-2">
                          {r?.arquivo_path && fotoUrls[r.arquivo_path] ? (
                            <video controls preload="metadata" src={fotoUrls[r.arquivo_path]} className="w-full max-w-2xl rounded-md border border-border" />
                          ) : (
                            <p className="text-xs text-muted-foreground">Sem vídeo anexado.</p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted">
                              {uploading[p.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                              {r?.arquivo_path ? "Substituir vídeo" : "Anexar vídeo"}
                              <input
                                type="file"
                                accept="video/*"
                                className="hidden"
                                disabled={!!uploading[p.id]}
                                onChange={(e) => {
                                  void adicionarArquivos(p.id, p.tipo, e.target.files, true);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                            {r?.arquivo_path && (
                              <Button
                                variant="outline"
                                onClick={() => removerArquivo(p.id, p.tipo, r.arquivo_path!)}
                                disabled={!!uploading[p.id]}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Remover
                              </Button>
                            )}
                          </div>
                        </div>
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

      {lightboxEdicao}
    </div>
  );
}

