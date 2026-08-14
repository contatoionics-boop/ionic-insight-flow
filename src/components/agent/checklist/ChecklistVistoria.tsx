import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Loader2,
  MessageSquare,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui-bits";
import { LumaSpin } from "@/components/ui/luma-spin";
import type { Resposta } from "@/components/agent/FormFields";
import { EtapasNav, IconeStatus } from "@/components/agent/checklist/EtapasNav";
import { EtapaPerguntas } from "@/components/agent/checklist/EtapaPerguntas";
import { PainelRevisao } from "@/components/agent/checklist/PainelRevisao";
import { AssistentePanel } from "@/components/agent/checklist/AssistentePanel";
import { FalaMultiCampo } from "@/components/agent/checklist/FalaMultiCampo";
import {
  estadoInicial,
  resumirVistoria,
  rotuloStatus,
} from "@/lib/vistoria-checklist";
import {
  finalizarVistoriaChat,
  getChecklistVistoria,
  salvarRespostasEtapa,
  type ChecklistVistoriaDTO,
} from "@/lib/vistoria-agent.functions";

type Props = {
  token?: string;
  casoId?: string;
  onFinalized?: () => void;
  onTrocarModo?: () => void;
};

export function ChecklistVistoria({ token, casoId, onFinalized, onTrocarModo }: Props) {
  const carregar = useServerFn(getChecklistVistoria);
  const salvar = useServerFn(salvarRespostasEtapa);
  const finalizar = useServerFn(finalizarVistoriaChat);

  const [dados, setDados] = useState<ChecklistVistoriaDTO | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [state, setState] = useState<Record<string, Resposta>>({});
  const [etapaAtual, setEtapaAtual] = useState(0);
  const [modoRevisao, setModoRevisao] = useState(false);
  const [destaque, setDestaque] = useState<string | null>(null);
  const [assistenteAberto, setAssistenteAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvoEm, setSalvoEm] = useState<Date | null>(null);
  const [avisoEtapa, setAvisoEtapa] = useState<string | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [finalizado, setFinalizado] = useState(false);

  const sujosRef = useRef<Set<string>>(new Set());
  const stateRef = useRef<Record<string, Resposta>>({});
  stateRef.current = state;

  const draftKey = dados ? `checklist-draft:${dados.casoId}` : null;

  useEffect(() => {
    (async () => {
      try {
        const d = await carregar({ data: { token, casoId } });
        const base = estadoInicial(d);
        let inicial = base;
        try {
          const raw = window.localStorage.getItem(`checklist-draft:${d.casoId}`);
          if (raw) inicial = { ...base, ...(JSON.parse(raw) as Record<string, Resposta>) };
        } catch {
          // sem rascunho local
        }
        // Respostas que só existem no rascunho local precisam ser enviadas ao
        // servidor — senão a finalização é recusada por "pendência" fantasma.
        for (const [id, r] of Object.entries(inicial)) {
          const b = base[id];
          const mudou =
            (r.text ?? "") !== (b?.text ?? "") ||
            (r.transcription ?? "") !== (b?.transcription ?? "") ||
            (r.filePath ?? "") !== (b?.filePath ?? "") ||
            (r.audioPath ?? "") !== (b?.audioPath ?? "");
          if (mudou) sujosRef.current.add(id);
        }
        setDados(d);
        setState(inicial);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao carregar o mapeamento.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, casoId]);


  // Rascunho local: trocar de aba ou recarregar não perde nada.
  useEffect(() => {
    if (!draftKey) return;
    try {
      const limpo = Object.fromEntries(
        Object.entries(state).map(([k, r]) => {
          const { filePreview: _ignored, ...rest } = r as Resposta & { filePreview?: string };
          return [k, rest];
        }),
      );
      window.localStorage.setItem(draftKey, JSON.stringify(limpo));
    } catch {
      // storage indisponível
    }
  }, [state, draftKey]);

  const resumo = useMemo(
    () => (dados ? resumirVistoria(dados, state) : null),
    [dados, state],
  );

  const persistir = useCallback(async () => {
    if (!dados) return true;
    const ids = [...sujosRef.current];
    if (ids.length === 0) return true;
    const atual = stateRef.current;
    const respostas = ids
      .map((id) => {
        const r = atual[id] ?? {};
        const arquivos = [r.filePath, r.audioPath].filter(Boolean) as string[];
        return {
          perguntaId: id,
          ...(r.text?.trim() ? { valorTexto: r.text.trim() } : {}),
          ...(r.transcription?.trim() ? { transcricao: r.transcription.trim() } : {}),
          ...(arquivos.length ? { arquivosPaths: arquivos } : {}),
        };
      })
      .filter((r) => r.valorTexto || r.transcricao || r.arquivosPaths);
    if (respostas.length === 0) {
      sujosRef.current.clear();
      return true;
    }
    setSalvando(true);
    try {
      const res = await salvar({
        data: {
          ...(token ? { token } : {}),
          ...(casoId ? { casoId } : {}),
          respostas,
        },
      });
      sujosRef.current.clear();
      setSalvoEm(new Date());
      if (!res.ok && res.erros.length) {
        setErro(res.erros.map((e) => e.motivo).join(" · "));
        return false;
      }
      setErro(null);
      return true;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar as respostas.");
      return false;
    } finally {
      setSalvando(false);
    }
  }, [dados, salvar, token, casoId]);

  // Autosave periódico
  useEffect(() => {
    const t = setInterval(() => {
      if (sujosRef.current.size > 0) void persistir();
    }, 10000);
    return () => clearInterval(t);
  }, [persistir]);

  const update = useCallback((perguntaId: string, patch: Partial<Resposta>) => {
    sujosRef.current.add(perguntaId);
    setState((s) => ({ ...s, [perguntaId]: { ...(s[perguntaId] ?? {}), ...patch } }));
  }, []);

  const irPara = async (indice: number, perguntaId?: string) => {
    await persistir();
    setModoRevisao(false);
    setEtapaAtual(indice);
    setAvisoEtapa(null);
    setDestaque(perguntaId ?? null);
    if (perguntaId) {
      setTimeout(() => {
        document
          .getElementById(`pergunta-${perguntaId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (erro && !dados) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <CircleAlert className="mx-auto mb-3 h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{erro}</p>
      </div>
    );
  }

  if (!dados || !resumo) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LumaSpin />
      </div>
    );
  }

  if (finalizado) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <Check className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
        <h2 className="text-lg font-semibold text-foreground">Mapeamento finalizado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O resultado foi enviado para revisão e o laudo está sendo montado.
        </p>
      </div>
    );
  }

  const etapaResumo = resumo.etapas[etapaAtual]!;
  const ultima = etapaAtual === resumo.etapas.length - 1;

  const avancar = async () => {
    if (etapaResumo.faltandoObrigatorias.length > 0) {
      setAvisoEtapa(
        `Faltam ${etapaResumo.faltandoObrigatorias.length} campo(s) obrigatório(s) nesta etapa.`,
      );
      setDestaque(etapaResumo.faltandoObrigatorias[0]!.id);
      document
        .getElementById(`pergunta-${etapaResumo.faltandoObrigatorias[0]!.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (ultima) {
      await persistir();
      setModoRevisao(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    await irPara(etapaAtual + 1);
  };

  const handleFinalizar = async () => {
    // Reenvia tudo que está preenchido localmente: garante que o servidor
    // enxergue exatamente o mesmo estado do checklist antes de validar.
    for (const [id, r] of Object.entries(stateRef.current)) {
      if (r.text?.trim() || r.transcription?.trim() || r.filePath || r.audioPath) {
        sujosRef.current.add(id);
      }
    }
    const ok = await persistir();
    if (!ok) return;

    setFinalizando(true);
    try {
      await finalizar({ data: { ...(token ? { token } : {}), ...(casoId ? { casoId } : {}) } });
      try {
        if (draftKey) window.localStorage.removeItem(draftKey);
      } catch {
        // ignora
      }
      setFinalizado(true);
      onFinalized?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao finalizar o mapeamento.");
    } finally {
      setFinalizando(false);
    }
  };

  const perguntaFoco =
    etapaResumo.visiveis.find((p) => p.id === destaque) ??
    etapaResumo.faltandoObrigatorias[0] ??
    etapaResumo.visiveis[0] ??
    null;

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-32 pt-4 sm:px-5 lg:pb-10">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-foreground sm:text-xl">
            {dados.clienteNome}
          </h1>
          <p className="truncate text-xs text-muted-foreground">{dados.formularioNome}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onTrocarModo && (
            <Button variant="secondary" onClick={onTrocarModo}>
              <MessageSquare className="h-4 w-4" /> Assistente em chat
            </Button>
          )}
          <Button variant="secondary" onClick={() => setAssistenteAberto(true)}>
            <Sparkles className="h-4 w-4" /> Ajuda
          </Button>
        </div>
      </header>

      <div className="mt-3 rounded-xl border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-foreground">
            {resumo.totalRespondidas} de {resumo.totalVisiveis} itens · {resumo.percentual}%
          </span>
          <span className="text-xs text-muted-foreground">
            {salvando ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Salvando
              </span>
            ) : salvoEm ? (
              `Salvo às ${salvoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
            ) : (
              "Rascunho local ativo"
            )}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${resumo.percentual}%` }}
          />
        </div>
      </div>

      <div className="mt-4 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)_18rem] lg:gap-5">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <EtapasNav
            etapas={resumo.etapas}
            atual={modoRevisao ? -1 : etapaAtual}
            onSelecionar={(i) => void irPara(i)}
          />
        </aside>

        <main className="mt-4 min-w-0 lg:mt-0">
          {modoRevisao ? (
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-foreground">Revisão final</h2>
              <PainelRevisao resumo={resumo} onIrPara={(i, p) => void irPara(i, p)} />
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  onClick={handleFinalizar}
                  disabled={!resumo.podeFinalizar || finalizando}
                >
                  {finalizando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Finalizar mapeamento
                </Button>
              </div>
            </section>
          ) : (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <IconeStatus status={etapaResumo.status} />
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground">
                    Etapa {etapaAtual + 1} de {resumo.etapas.length} · {etapaResumo.etapa.titulo}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {etapaResumo.respondidas}/{etapaResumo.visiveis.length} itens ·{" "}
                    {rotuloStatus[etapaResumo.status]}
                  </p>
                </div>
              </div>

              <FalaMultiCampo
                token={token ?? "app"}
                tokenLink={token}
                casoIdAuth={casoId}
                perguntas={etapaResumo.visiveis}
                onAplicar={(valores) =>
                  valores.forEach((v) => update(v.perguntaId, { text: v.valor }))
                }
              />

              <EtapaPerguntas
                etapa={etapaResumo.etapa}
                visiveis={etapaResumo.visiveis}
                state={state}
                update={update}
                casoId={dados.casoId}
                token={token ?? "app"}
                destaque={destaque}
              />

              {avisoEtapa && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {avisoEtapa}
                </p>
              )}
              {erro && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {erro}
                </p>
              )}
            </section>
          )}
        </main>

        <aside className="mt-6 hidden lg:sticky lg:top-4 lg:mt-0 lg:block lg:self-start">
          <PainelRevisao resumo={resumo} onIrPara={(i, p) => void irPara(i, p)} compacto />
        </aside>
      </div>

      {!modoRevisao && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-3 py-3 backdrop-blur [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))] lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <Button
              variant="secondary"
              onClick={() => void irPara(Math.max(0, etapaAtual - 1))}
              disabled={etapaAtual === 0}
            >
              <ArrowLeft className="h-4 w-4" /> Anterior
            </Button>
            <Button variant="primary" onClick={avancar}>
              {ultima ? "Revisar" : "Próximo"} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <AssistentePanel
        aberto={assistenteAberto}
        onFechar={() => setAssistenteAberto(false)}
        tokenLink={token}
        casoIdAuth={casoId}
        etapaTitulo={etapaResumo.etapa.titulo}
        perguntaFoco={perguntaFoco}
        onUsarSugestao={(id, valor) => update(id, { text: valor })}
      />
    </div>
  );
}
