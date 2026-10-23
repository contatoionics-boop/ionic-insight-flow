import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Loader2,
  CloudOff,
  MessageSquare,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui-bits";
import { BicoLoading } from "@/components/ui/bico-loading";
import {
  aoUploadConcluir,
  caminhoPendente,
  filaPronta,
  traduzirErroRede,
  useFilaUploads,
} from "@/lib/midia-upload";
import { isComplete, type Resposta } from "@/components/agent/FormFields";
import { EtapasNav, IconeStatus } from "@/components/agent/checklist/EtapasNav";
import { EtapaPerguntas } from "@/components/agent/checklist/EtapaPerguntas";
import { PainelRevisao } from "@/components/agent/checklist/PainelRevisao";
import { AssistentePanel } from "@/components/agent/checklist/AssistentePanel";
import { FalaMultiCampo } from "@/components/agent/checklist/FalaMultiCampo";
import {
  VisaoEquipamentos,
  ehGeral,
  unidadeDaPergunta,
  type Vista,
} from "@/components/agent/checklist/VisaoEquipamentos";
import { frasesOperacionais } from "@/components/agent/checklist/ResumoMapeamento";
import type { IndicePerguntas } from "@/components/agent/checklist/PreencherEquipamento";
import {
  estadoInicial,
  resumirVistoria,
  respondida,
  rotuloStatus,
  toPerguntaUI,
} from "@/lib/vistoria-checklist";
import { montarNavegacao, type ItemNav } from "@/lib/escopo/navegacao-entidades";
import { ResumoEscopo } from "@/components/escopo/ResumoEscopo";
import { contarPorEntidade } from "@/lib/escopo/arvore-perguntas";
import type { EntidadeEscopo, TipoEntidade } from "@/lib/escopo/tipos";
import {
  finalizarVistoriaChat,
  getChecklistVistoria,
  marcarEntidadeConcluida,
  salvarRespostasEtapa,
  type ChecklistVistoriaDTO,
} from "@/lib/vistoria-agent.functions";

type Props = {
  token?: string;
  casoId?: string;
  onFinalized?: () => void;
  onTrocarModo?: () => void;
};

/** Escopo definido no agendamento + orientações, recolhível (estado lembrado por caso). */
function CartaoEscopo({
  casoId,
  entidades,
  orientacoes,
  config,
  fechadoPorPadrao = false,
}: {
  casoId: string;
  entidades: ChecklistVistoriaDTO["entidades"];
  orientacoes: string | null;
  config?: ChecklistVistoriaDTO["escopoConfig"];
  /** Sem preferência salva, começa recolhido (ex.: visão por equipamento, para a lista aparecer logo). */
  fechadoPorPadrao?: boolean;
}) {
  const chave = `escopo-card:${casoId}`;
  const [aberto, setAberto] = useState(!fechadoPorPadrao);
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(chave);
      if (guardado === "fechado") setAberto(false);
      else if (guardado === "aberto") setAberto(true);
    } catch {
      /* sem armazenamento: segue aberto */
    }
  }, [chave]);
  const alternar = () => {
    setAberto((v) => {
      try {
        localStorage.setItem(chave, v ? "fechado" : "aberto");
      } catch {
        /* ignorado */
      }
      return !v;
    });
  };
  return (
    <section className="mt-3 rounded-xl border border-border bg-card p-3">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-foreground"
      >
        <span>Escopo e orientações</span>
        <span className="text-xs font-normal text-primary">{aberto ? "Recolher" : "Ver"}</span>
      </button>
      {aberto && (
        <ResumoEscopo className="mt-2" entidades={entidades} orientacoes={orientacoes} config={config} />
      )}
    </section>
  );
}

export function ChecklistVistoria({ token, casoId, onFinalized, onTrocarModo }: Props) {
  const carregar = useServerFn(getChecklistVistoria);
  const salvar = useServerFn(salvarRespostasEtapa);
  const finalizar = useServerFn(finalizarVistoriaChat);
  const marcarConcluida = useServerFn(marcarEntidadeConcluida);

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
  // Visão por equipamento (padrão quando o escopo tem equipamentos) ou por etapa.
  const [visaoEscolhida, setVisaoEscolhida] = useState<"equipamentos" | "etapas" | null>(null);
  const [vista, setVista] = useState<Vista>({ tipo: "resumo" });
  const [concluidas, setConcluidas] = useState<Set<string>>(new Set());
  const [tentaram, setTentaram] = useState<Set<string>>(new Set());

  const sujosRef = useRef<Set<string>>(new Set());
  const stateRef = useRef<Record<string, Resposta>>({});
  stateRef.current = state;

  const fila = useFilaUploads();
  const draftKey = dados ? `checklist-draft:${dados.casoId}` : null;

  useEffect(() => {
    (async () => {
      try {
        await filaPronta();
        const d = await carregar({ data: { token, casoId } });
        const base = estadoInicial(d);
        const perguntasAtuais = new Set(
          d.etapas.flatMap((etapa) => etapa.perguntas.map((pergunta) => pergunta.id)),
        );
        let inicial = base;
        try {
          const raw = window.localStorage.getItem(`checklist-draft:${d.casoId}`);
          if (raw) {
            const rascunho = JSON.parse(raw) as Record<string, Resposta>;
            const rascunhoAtual = Object.fromEntries(
              Object.entries(rascunho).filter(([id]) => perguntasAtuais.has(id)),
            );
            inicial = { ...base, ...rascunhoAtual };
          }
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
        setConcluidas(new Set(d.entidadesConcluidas ?? []));
        try {
          const v = window.localStorage.getItem(`visao-agente:${d.casoId}`);
          if (v === "etapas" || v === "equipamentos") setVisaoEscolhida(v);
        } catch {
          // sem armazenamento: usa o padrão
        }
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

  // Estrutura do Escopo e progresso por entidade (considera o formulário inteiro).
  const entidades = useMemo<EntidadeEscopo[]>(
    () =>
      (dados?.entidades ?? []).map((e) => ({
        id: e.id,
        tipo: e.tipo as TipoEntidade,
        parent_id: e.parentId,
        ordem: e.ordem,
        rotulo: e.rotulo,
      })),
    [dados],
  );
  const contagemEntidades = useMemo(
    () =>
      resumo
        ? contarPorEntidade(
            entidades,
            resumo.etapas.flatMap((e) => e.visiveis),
            (p) => p.entidadeId,
            (p) => respondida(p, state[p.id]),
          )
        : new Map(),
    [entidades, resumo, state],
  );

  // Navegação por equipamento: mesmas perguntas visíveis, agrupadas pela entidade do Escopo.
  const itensNav = useMemo<ItemNav[]>(
    () =>
      resumo
        ? resumo.etapas.flatMap((e) =>
            e.visiveis.map((p) => ({
              id: p.id,
              entidadeId: p.entidadeId ?? null,
              obrigatoria: p.obrigatoria,
              respondida: respondida(p, state[p.id]),
              completa: !p.obrigatoria || isComplete(toPerguntaUI(p, e.etapa.id), state[p.id] ?? {}, "live"),
              texto: p.texto,
              valor: state[p.id]?.text ?? "",
              etapaId: e.etapa.id,
              etapaTitulo: e.etapa.titulo,
              etapaOrdem: e.etapa.ordem,
            })),
          )
        : [],
    [resumo, state],
  );
  const modelo = useMemo(
    () => montarNavegacao(entidades, itensNav, { concluidas, tentaram }),
    [entidades, itensNav, concluidas, tentaram],
  );
  const indice = useMemo<IndicePerguntas>(() => {
    const m: IndicePerguntas = new Map();
    for (const e of resumo?.etapas ?? []) for (const p of e.visiveis) m.set(p.id, { pergunta: p, etapa: e.etapa });
    return m;
  }, [resumo]);
  const temEquipamentos = modelo.porId.size > 0;
  const visao: "equipamentos" | "etapas" = temEquipamentos ? (visaoEscolhida ?? "equipamentos") : "etapas";

  const escolherVisao = (v: "equipamentos" | "etapas") => {
    setVisaoEscolhida(v);
    setModoRevisao(false);
    try {
      if (dados) window.localStorage.setItem(`visao-agente:${dados.casoId}`, v);
    } catch {
      // ignorado
    }
    window.scrollTo({ top: 0 });
  };

  const persistir = useCallback(async () => {
    if (!dados) return true;
    const perguntasAtuais = new Set(
      dados.etapas.flatMap((etapa) => etapa.perguntas.map((pergunta) => pergunta.id)),
    );
    const ids = [...sujosRef.current].filter((id) => perguntasAtuais.has(id));
    for (const id of sujosRef.current) {
      if (!perguntasAtuais.has(id)) sujosRef.current.delete(id);
    }
    if (ids.length === 0) return true;
    const atual = stateRef.current;
    const respostas = ids
      .map((id) => {
        const r = atual[id] ?? {};
        // Arquivo ainda na fila offline não existe no servidor: só é enviado depois do upload.
        const arquivos = ([r.filePath, r.audioPath].filter(Boolean) as string[]).filter(
          (p) => !caminhoPendente(p),
        );
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
      // O servidor aceita até 120 respostas por chamada: envia em lotes menores.
      const motivos: string[] = [];
      for (let i = 0; i < respostas.length; i += 100) {
        const res = await salvar({
          data: {
            ...(token ? { token } : {}),
            ...(casoId ? { casoId } : {}),
            respostas: respostas.slice(i, i + 100),
          },
        });
        if (!res.ok) motivos.push(...res.erros.map((e) => e.motivo));
      }
      sujosRef.current.clear();
      setSalvoEm(new Date());
      if (motivos.length) {
        setErro(motivos.join(" · "));
        return false;
      }
      setErro(null);
      return true;
    } catch (e) {
      setErro(traduzirErroRede(e, "Falha ao salvar as respostas. Tentaremos de novo automaticamente."));
      return false;
    } finally {
      setSalvando(false);
    }
  }, [dados, salvar, token, casoId]);

  // Quando um arquivo da fila offline termina de subir, marca a resposta para ser enviada.
  useEffect(
    () =>
      aoUploadConcluir((path) => {
        for (const [id, r] of Object.entries(stateRef.current)) {
          if (r.filePath === path || r.audioPath === path) sujosRef.current.add(id);
        }
        void persistir();
      }),
    [persistir],
  );

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

  /** Marca/reabre um equipamento como concluído (confirmação; o estado real vem das respostas). */
  const marcarEquipamento = async (entidadeId: string, concluida: boolean) => {
    setConcluidas((s) => {
      const n = new Set(s);
      if (concluida) n.add(entidadeId);
      else n.delete(entidadeId);
      return n;
    });
    if (concluida) {
      setTentaram((s) => {
        const n = new Set(s);
        n.delete(entidadeId);
        return n;
      });
    }
    try {
      await marcarConcluida({
        data: { ...(token ? { token } : {}), ...(casoId ? { casoId } : {}), entidadeId, concluida },
      });
    } catch {
      // a marcação é só confirmação: sem rede, o estado automático continua valendo
    }
  };

  /** Abre o equipamento (ou as informações gerais) que contém a pergunta e rola até ela. */
  const abrirPergunta = async (perguntaId: string) => {
    const u = unidadeDaPergunta(modelo, perguntaId);
    const naMesmaTela =
      (u && vista.tipo === "equip" && vista.id === u.id) || (!u && vista.tipo === "geral" && ehGeral(modelo, perguntaId));
    if (!naMesmaTela) {
      await persistir();
      if (u) setVista({ tipo: "equip", id: u.id, origem: { tipo: "resumo" } });
      else if (ehGeral(modelo, perguntaId)) setVista({ tipo: "geral" });
    }
    setModoRevisao(false);
    setDestaque(perguntaId);
    setTimeout(() => {
      document.getElementById(`pergunta-${perguntaId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  };

  if (erro && !dados) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6 text-center">
        <CircleAlert className="mx-auto h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{erro}</p>
        <Button variant="primary" className="min-h-11" onClick={() => window.location.reload()}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  if (!dados || !resumo) {
    return (
      <BicoLoading />
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

  const unidadeAberta = visao === "equipamentos" && vista.tipo === "equip" ? (modelo.porId.get(vista.id) ?? null) : null;
  const perguntaFoco =
    visao === "equipamentos"
      ? ((destaque ? indice.get(destaque)?.pergunta : undefined) ??
        (unidadeAberta
          ? indice.get(unidadeAberta.itens.find((i) => i.obrigatoria && !i.completa)?.id ?? unidadeAberta.itens[0]?.id ?? "")?.pergunta
          : undefined) ??
        null)
      : (etapaResumo.visiveis.find((p) => p.id === destaque) ??
        etapaResumo.faltandoObrigatorias[0] ??
        etapaResumo.visiveis[0] ??
        null);
  const tituloAssistente =
    visao === "equipamentos"
      ? (unidadeAberta?.tituloCompleto ?? (vista.tipo === "geral" ? "Informações gerais" : dados.formularioNome))
      : etapaResumo.etapa.titulo;
  const frases = visao === "equipamentos" ? frasesOperacionais(modelo) : [];
  const faltantesTotal = resumo.etapas.reduce((a, e) => a + e.faltandoObrigatorias.length, 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-32 pt-4 sm:px-5 lg:pb-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-bold uppercase leading-tight text-foreground">
            {dados.clienteNome}
          </h1>
          <p className="mt-1 break-words text-xs uppercase text-muted-foreground">{dados.formularioNome}</p>
          {temEquipamentos && (
            <button
              type="button"
              onClick={() => escolherVisao(visao === "equipamentos" ? "etapas" : "equipamentos")}
              className="mt-1 min-h-9 text-xs text-muted-foreground underline"
            >
              {visao === "equipamentos" ? "Ver por etapa" : "Ver por equipamento"}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
          {onTrocarModo && (
            <Button variant="secondary" className="min-h-11 w-full sm:w-auto" onClick={onTrocarModo}>
              <MessageSquare className="h-4 w-4" /> Assistente em chat
            </Button>
          )}
          <Button
            variant="secondary"
            className={`min-h-11 w-full sm:w-auto ${onTrocarModo ? "" : "col-span-2"}`}
            onClick={() => setAssistenteAberto(true)}
          >
            <Sparkles className="h-4 w-4" /> Ajuda
          </Button>
        </div>
      </header>

      {(dados.entidades.length > 0 ||
        dados.orientacoes?.trim() ||
        Object.keys(dados.escopoConfig ?? {}).length > 0) && (
        <CartaoEscopo
          casoId={dados.casoId}
          entidades={dados.entidades}
          orientacoes={dados.orientacoes}
          config={dados.escopoConfig}
          fechadoPorPadrao={visao === "equipamentos"}
        />
      )}

      {visao === "equipamentos" ? (
        vista.tipo !== "equip" &&
        vista.tipo !== "geral" && (
          <p className="mt-2 text-right text-xs text-muted-foreground">
            {salvando ? "Salvando…" : salvoEm ? `Salvo às ${salvoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Salvo no aparelho"}
          </p>
        )
      ) : (
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
              "Salvo no aparelho"
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
      )}

      {(!fila.online || fila.pendentes.length > 0) && (
        <div
          role="status"
          className="mt-3 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground"
        >
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
          <div className="min-w-0">
            {!fila.online && <p className="font-medium">Sem conexão — o que você preencher fica salvo no aparelho.</p>}
            {fila.pendentes.length > 0 && (
              <p className={fila.online ? "font-medium" : "text-xs text-muted-foreground"}>
                {fila.pendentes.length} arquivo(s) aguardando envio
                {fila.enviando ? ` — enviando agora${fila.progresso ? ` (${fila.progresso}%)` : ""}` : ""}. Eles sobem
                sozinhos quando houver sinal; mantenha o aplicativo aberto.
              </p>
            )}
          </div>
        </div>
      )}

      <div
        className={`mt-4 lg:grid lg:gap-5 ${
          visao === "equipamentos" ? "lg:grid-cols-[minmax(0,1fr)_18rem]" : "lg:grid-cols-[16rem_minmax(0,1fr)_18rem]"
        }`}
      >
        {visao === "etapas" && (
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <EtapasNav
              etapas={resumo.etapas}
              atual={modoRevisao ? -1 : etapaAtual}
              onSelecionar={(i) => void irPara(i)}
            />
          </aside>
        )}

        <main className="mt-4 min-w-0 lg:mt-0">
          {modoRevisao ? (
            <section className="space-y-4">
              {visao === "equipamentos" && (
                <button
                  type="button"
                  onClick={() => {
                    setModoRevisao(false);
                    window.scrollTo({ top: 0 });
                  }}
                  className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary"
                >
                  <ArrowLeft className="h-4 w-4" /> Voltar ao resumo
                </button>
              )}
              <h2 className="text-base font-semibold text-foreground">Revisão final</h2>
              <PainelRevisao
                resumo={resumo}
                frases={frases}
                onIrPara={(i, p) => (visao === "equipamentos" ? void abrirPergunta(p) : void irPara(i, p))}
              />
              {erro && (
                <p className="whitespace-pre-line rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {erro}
                </p>
              )}
              {fila.pendentes.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Aguarde o envio dos arquivos pendentes para finalizar o mapeamento.
                </p>
              )}
              <div className="flex justify-end">

                <Button
                  variant="primary"
                  onClick={handleFinalizar}
                  disabled={!resumo.podeFinalizar || finalizando || fila.pendentes.length > 0}
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
          ) : visao === "equipamentos" ? (
            <section className="space-y-4">
              <VisaoEquipamentos
                modelo={modelo}
                vista={vista}
                onVista={setVista}
                indice={indice}
                state={state}
                update={update}
                casoId={dados.casoId}
                token={token ?? "app"}
                destaque={destaque}
                fala={(perguntas) => (
                  <FalaMultiCampo
                    token={token ?? "app"}
                    tokenLink={token}
                    casoIdAuth={casoId}
                    perguntas={perguntas}
                    onAplicar={(valores) => valores.forEach((v) => update(v.perguntaId, { text: v.valor }))}
                  />
                )}
                salvando={salvando}
                salvoEm={salvoEm}
                persistir={persistir}
                onTentou={(id) => setTentaram((s) => new Set(s).add(id))}
                onMarcar={marcarEquipamento}
                onIrParaPergunta={(id) => void abrirPergunta(id)}
              />
              {erro && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {erro}
                </p>
              )}
            </section>
          ) : (
            <section className="space-y-4">
              <div className="flex items-start gap-3">
                <IconeStatus status={etapaResumo.status} className="mt-0.5 h-5 w-5" />
                <div className="min-w-0">
                  <h2 className="text-base font-semibold leading-snug text-foreground">
                    Etapa {etapaAtual + 1} de {resumo.etapas.length} · {etapaResumo.etapa.titulo}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const obrig = etapaResumo.visiveis.filter((p) => p.obrigatoria).length;
                      const feitas = obrig - etapaResumo.faltandoObrigatorias.length;
                      return obrig > 0
                        ? `${feitas}/${obrig} itens obrigatórios · `
                        : `${etapaResumo.respondidas}/${etapaResumo.visiveis.length} itens · `;
                    })()}
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
                entidades={entidades}
                contagem={contagemEntidades}
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
          <PainelRevisao
            resumo={resumo}
            frases={frases}
            onIrPara={(i, p) => (visao === "equipamentos" ? void abrirPergunta(p) : void irPara(i, p))}
            compacto
          />
        </aside>
      </div>

      {!modoRevisao && visao === "equipamentos" && vista.tipo === "resumo" && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-3 py-3 backdrop-blur [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-6xl flex-col gap-1">
            {faltantesTotal > 0 && (
              <p className="text-center text-xs text-muted-foreground">
                {faltantesTotal} {faltantesTotal === 1 ? "campo obrigatório pendente" : "campos obrigatórios pendentes"}
              </p>
            )}
            <Button
              variant="primary"
              className="min-h-11 w-full"
              onClick={async () => {
                await persistir();
                setModoRevisao(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Revisar e finalizar <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {!modoRevisao && visao === "etapas" && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-3 py-3 backdrop-blur [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))] lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <Button
              variant="secondary"
              className="min-h-11"
              onClick={() => void irPara(Math.max(0, etapaAtual - 1))}
              disabled={etapaAtual === 0}
            >
              <ArrowLeft className="h-4 w-4" /> Anterior
            </Button>
            {ultima && !resumo.podeFinalizar && (
              <button
                type="button"
                className="flex-1 py-2 text-center text-xs font-semibold text-primary underline"
                onClick={() => {
                  const i = resumo.etapas.findIndex((e) => e.faltandoObrigatorias.length > 0);
                  if (i >= 0) void irPara(i, resumo.etapas[i].faltandoObrigatorias[0]?.id);
                }}
              >
                {(() => {
                  const n = resumo.etapas.reduce((a, e) => a + e.faltandoObrigatorias.length, 0);
                  return `${n} ${n === 1 ? "pendência" : "pendências"} · ir para a primeira`;
                })()}
              </button>
            )}
            <Button variant="primary" className="min-h-11" onClick={avancar}>
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
        etapaTitulo={tituloAssistente}
        perguntaFoco={perguntaFoco}
        onUsarSugestao={(id, valor) => update(id, { text: valor })}
      />
    </div>
  );
}
