import { formulariosVisiveis, qtdDeOutrosClientes } from "@/lib/formularios-visiveis";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Card, Label, Input, Select, Button } from "@/components/ui-bits";
import { CarregandoConteudo } from "@/components/ui/carregando-conteudo";
import { DatePicker } from "@/components/ui/date-picker";
import { supabase } from "@/integrations/supabase/client";
import { listTechnicalAgents } from "@/lib/admin-users.functions";
import { agendarMapeamento } from "@/lib/casos.functions";
import { verificarConflitoAgente } from "@/lib/agendamentos.functions";
import { analisarEscopoManual, analisarPropostaPrevia, registrarProposta } from "@/lib/proposta.functions";
import { normalizarEscopo, type EscopoProposta } from "@/lib/proposta/tipos";
import { EstruturaEscopo } from "@/components/escopo/EstruturaEscopo";
import { estruturaDoEscopo, estruturaEhVazia } from "@/lib/escopo/sugerir";
import { salvarEscopoEstrutura } from "@/lib/escopo.functions";
import { resumoEscopoAgendamento, type LinhaResumoEscopo } from "@/lib/escopo/resumo-agendamento";
import { montarOrientacoes } from "@/lib/escopo/orientacoes";
import {
  arvoreTemEstrutura,
  arvoreVazia,
  configTemDados,
  normalizarArvore,
  quantidadesDoEscopo,
  type ArvoreEscopo,
} from "@/lib/escopo/tipos";
import { NumericInput } from "@/components/ui/numeric-input";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useTiposEscopo } from "@/hooks/use-tipos-escopo";
import { useCamposAgendamento, useOpcoesAgendamento } from "@/hooks/use-opcoes-agendamento";
import { SLUG_CAMPO, camposExtrasAtivos, opcoesDoCampo, rotuloOpcao } from "@/lib/opcoes-agendamento";
import { opcoesSugerir } from "@/lib/escopo/catalogo-tipos";

export const Route = createFileRoute("/app/new-case")({
  component: NewCasePage,
  validateSearch: (search: Record<string, unknown>): { campo?: string } =>
    typeof search.campo === "string" && SLUG_CAMPO.test(search.campo) ? { campo: search.campo } : {},
  head: () => ({
    meta: [
      { title: "Agendar mapeamento | Ionics" },
      { name: "description", content: "Agende um novo mapeamento técnico Ionics." },
      { property: "og:title", content: "Agendar mapeamento | Ionics" },
      { property: "og:description", content: "Agende um novo mapeamento técnico Ionics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Empresa = { id: string; nome: string; codigo_ionics: string | null };
type EnderecoBase = {
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
};
type Matriz = { id: string; empresa_id: string; nome: string; cnpj: string | null } & EnderecoBase;
type Unidade = { id: string; matriz_id: string; nome: string; codigo_ionics: string | null } & EnderecoBase;
type Form = { id: string; nome: string; empresa_id: string | null };
type Agente = { id: string; nome: string; user_id: string };

type AgendamentoDraft = {
  empresaId: string;
  matrizId: string;
  unidadeId: string;
  formIds: string[];
  /** quantidade de mapeamentos por formulário (padrão 1) */
  formQtd?: Record<string, number>;
  agentId: string;
  agenteNomeManual: string;
  tipoSolicitacao: string;
  modalidade: string;
  nivel: string;
  escolhasExtras?: Record<string, string>;
  data: string;
  hora: string;
  endereco: string;
  observacoes: string;
  propostaPathPrevia: string | null;
  propostaNome: string | null;
  propostaTamanho: number | null;
  escopoPrevia: EscopoProposta | null;
  escopoModo: "pdf" | "manual";
  escopoManualTexto: string;
  /** Estrutura física do escopo (postos, comboios, tanques, RFID, TX...). */
  estrutura: ArvoreEscopo;
};

function formatEndereco(u?: EnderecoBase | null) {
  if (!u) return "";
  const parts = [
    [u.logradouro, u.numero].filter(Boolean).join(", "),
    u.bairro,
    [u.cidade, u.estado].filter(Boolean).join("/"),
  ].filter(Boolean);
  return parts.join(" - ");
}

function temEndereco(e?: EnderecoBase | null) {
  return !!(e && (e.logradouro || e.cidade || e.bairro));
}

const ETAPAS = [
  { id: "cliente", titulo: "Cliente e atendimento", descricao: "Escolha onde o mapeamento será feito e defina o tipo de atendimento." },
  { id: "escopo", titulo: "Escopo", descricao: "Defina os itens da visita. Se tiver a proposta comercial, use o PDF para ajudar no preenchimento." },
  { id: "formularios", titulo: "Formulários", descricao: "Escolha pelo menos um formulário para o responsável preencher." },
  { id: "agenda", titulo: "Responsável e horário", descricao: "Escolha quem fará o mapeamento, a data e a hora." },
] as const;

type EtapaAgendamento = (typeof ETAPAS)[number]["id"];

type ErroDeEtapa = { mensagem: string; campo?: string };

function NewCasePage() {
  const { campo: campoAtalho } = Route.useSearch();
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState<EtapaAgendamento>(() => campoAtalho === "solucao" ? "escopo" : "cliente");
  const [foco, setFoco] = useState<{ etapa: EtapaAgendamento; campo?: string } | null>(null);
  const [erroEtapa, setErroEtapa] = useState<ErroDeEtapa | null>(null);
  const [buscaFormularios, setBuscaFormularios] = useState("");
  const [carregandoDados, setCarregandoDados] = useState(true);
  const formularioRef = useRef<HTMLFormElement>(null);
  const atalhoUsado = useRef<string | null>(null);
  const { userId } = useAuth();
  const loadAgents = useServerFn(listTechnicalAgents);
  const agendar = useServerFn(agendarMapeamento);
  const registrar = useServerFn(registrarProposta);
  const analisarPrevia = useServerFn(analisarPropostaPrevia);
  const analisarManual = useServerFn(analisarEscopoManual);
  const [proposta, setProposta] = useState<File | null>(null);
  const [propostaPathPrevia, setPropostaPathPrevia] = useState<string | null>(null);
  const [propostaNome, setPropostaNome] = useState<string | null>(null);
  const [propostaTamanho, setPropostaTamanho] = useState<number | null>(null);
  const [escopoPrevia, setEscopoPrevia] = useState<EscopoProposta | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [erroPrevia, setErroPrevia] = useState<string | null>(null);
  const [propostaAberta, setPropostaAberta] = useState(false);
  const [escopoModo, setEscopoModo] = useState<"pdf" | "manual">("pdf");
  const [escopoManualTexto, setEscopoManualTexto] = useState("");
  const [analisandoManual, setAnalisandoManual] = useState(false);
  const [erroManual, setErroManual] = useState<string | null>(null);
  const salvarEstrutura = useServerFn(salvarEscopoEstrutura);
  const [estrutura, setEstrutura] = useState<ArvoreEscopo>(arvoreVazia());
  const catalogoTipos = useTiposEscopo();

  /** true enquanto a estrutura foi preenchida pelo sistema (a partir da proposta) e ninguém mexeu nela. */
  const estruturaAuto = useRef(false);
  const [inputPropostaKey, setInputPropostaKey] = useState(0);

  /** Sugere a árvore a partir das quantidades do escopo identificado (editável depois). */
  function sugerirEstrutura() {
    if (!escopoPrevia) return;
    if (!estruturaAuto.current && !estruturaEhVazia(estrutura) && !window.confirm("Aplicar as quantidades da leitura e substituir a estrutura preenchida?")) return;
    estruturaAuto.current = true;
    setEstrutura(estruturaDoEscopo(escopoPrevia, estrutura.config ?? {}));
  }

  // A estrutura física acompanha o escopo lido da proposta (e as correções feitas nele) enquanto não for editada à mão.
  useEffect(() => {
    if (!escopoPrevia) return;
    if (!estruturaAuto.current && !estruturaEhVazia(estrutura)) return;
    estruturaAuto.current = true;
    setEstrutura((atual) => estruturaDoEscopo(escopoPrevia, atual.config ?? {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escopoPrevia]);

  function editarEstrutura(v: ArvoreEscopo) {
    estruturaAuto.current = false;
    setEstrutura(v);
  }

  /** Remove o documento (ou o texto) do escopo e o que foi preenchido a partir dele, para começar de novo. */
  function limparEscopo() {
    if (propostaPathPrevia) void supabase.storage.from("propostas").remove([propostaPathPrevia]);
    setProposta(null);
    setPropostaPathPrevia(null);
    setPropostaNome(null);
    setPropostaTamanho(null);
    setEscopoPrevia(null);
    setErroPrevia(null);
    setErroManual(null);
    setEscopoManualTexto("");
    setInputPropostaKey((k) => k + 1);
    if (estruturaAuto.current) setEstrutura((atual) => ({ ...arvoreVazia(), config: atual.config ?? {} }));
    estruturaAuto.current = false;
  }

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [matrizes, setMatrizes] = useState<Matriz[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [agents, setAgents] = useState<Agente[]>([]);

  const [empresaId, setEmpresaId] = useState("");
  const [matrizId, setMatrizId] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [formIds, setFormIds] = useState<string[]>([]);
  const [formQtd, setFormQtd] = useState<Record<string, number>>({});
  /** Por formulário: itens do escopo que o sugerem e se já repete perguntas por entidade. */
  const [formMeta, setFormMeta] = useState<Record<string, { sugerirQuando: string[]; repetePorEntidade: boolean }>>({});
  const [mostrarOutrosClientes, setMostrarOutrosClientes] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [agenteNomeManual, setAgenteNomeManual] = useState("");
  const [tipoSolicitacao, setTipoSolicitacao] = useState<string>("instalacao");
  const [modalidade, setModalidade] = useState<string>("presencial");
  const [nivel, setNivel] = useState<string>("nivel_1");
  const opcoesAg = useOpcoesAgendamento();
  // campos criados em Configurações › Opções do agendamento (listas a mais), com a escolha de cada um
  const camposAg = useCamposAgendamento();
  const camposExtras = camposExtrasAtivos(camposAg).filter((c) => opcoesDoCampo(c.campo, { todas: opcoesAg }).length > 0);
  const campoVisivel = campoAtalho !== undefined && (["tipo_solicitacao", "modalidade", "nivel", "solucao"].includes(campoAtalho) || camposExtras.some((c) => c.campo === campoAtalho));
  useEffect(() => {
    if (!campoAtalho || !campoVisivel || carregandoDados || atalhoUsado.current === campoAtalho) return;
    atalhoUsado.current = campoAtalho;
    const destino = campoAtalho === "solucao" ? "escopo" : "cliente";
    setEtapa(destino);
    setFoco({ etapa: destino, campo: "campo-agendamento-" + campoAtalho });
  }, [campoAtalho, campoVisivel, carregandoDados]);

  useEffect(() => {
    if (!foco || foco.etapa !== etapa || carregandoDados) return;
    const alvo = document.getElementById(foco.campo ?? "titulo-etapa-" + etapa);
    alvo?.scrollIntoView({ block: foco.campo ? "center" : "start" });
    alvo?.focus({ preventScroll: true });
  }, [etapa, foco, carregandoDados]);

  const [escolhasExtras, setEscolhasExtras] = useState<Record<string, string>>({});
  const [data, setData] = useState("");
  const [hora, setHora] = useState("09:00");
  const [endereco, setEndereco] = useState("");
  const [observacoes, setObservacoes] = useState("");

  /** Rascunho das orientações; se já houver texto digitado, pede confirmação antes de acrescentar. */
  function gerarOrientacoes() {
    const rascunho = montarOrientacoes(escopoPrevia, estrutura, escopoModo === "manual" ? escopoManualTexto : "", catalogoTipos);
    if (!rascunho) {
      mostrarEtapa("escopo", { mensagem: "Defina a estrutura ou o escopo antes de gerar o resumo." });
      return;
    }
    if (observacoes.trim()) {
      if (!window.confirm("Já existe texto nas orientações. Acrescentar o resumo ao final?")) return;
      setObservacoes(`${observacoes.trim()}\n\n${rascunho}`);
    } else {
      setObservacoes(rascunho);
    }
  }

  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  /** Etapa em andamento ("Gravando a estrutura do escopo…"), mostrada no botão e no aviso do topo. */
  const [progresso, setProgresso] = useState<string | null>(null);
  /** Códigos dos mapeamentos já criados; depois disso o formulário não pode ser enviado de novo. */
  const [criados, setCriados] = useState<string[] | null>(null);
  const [conflito, setConflito] = useState<{ agenteNome?: string | null; clienteNome?: string | null; dataConflito?: string | null } | null>(null);
  const verificar = useServerFn(verificarConflitoAgente);
  const [draftReady, setDraftReady] = useState(false);
  const draftKey = userId ? `agendamento-draft:${userId}` : null;

  // O formulário SEMPRE abre zerado. Se houver um agendamento interrompido (rascunho),
  // apenas oferece retomar; nunca preenche sozinho.
  const [rascunhoPendente, setRascunhoPendente] = useState<Partial<AgendamentoDraft> | null>(null);
  const agendadoRef = useRef(false);

  const aplicarRascunho = (draft: Partial<AgendamentoDraft>) => {
    setEmpresaId(draft.empresaId ?? "");
    setMatrizId(draft.matrizId ?? "");
    setUnidadeId(draft.unidadeId ?? "");
    setFormIds(Array.isArray(draft.formIds) ? draft.formIds : []);
    setFormQtd(draft.formQtd && typeof draft.formQtd === "object" ? draft.formQtd : {});
    setAgentId(draft.agentId ?? "");
    setAgenteNomeManual(draft.agenteNomeManual ?? "");
    setTipoSolicitacao(draft.tipoSolicitacao ?? "instalacao");
    setModalidade(draft.modalidade ?? "presencial");
    setNivel(draft.nivel ?? "nivel_1");
    setEscolhasExtras(draft.escolhasExtras ?? {});
    setData(draft.data ?? "");
    setHora(draft.hora ?? "09:00");
    setEndereco(draft.endereco ?? "");
    setObservacoes(draft.observacoes ?? "");
    setPropostaPathPrevia(draft.propostaPathPrevia ?? null);
    setPropostaNome(draft.propostaNome ?? null);
    setPropostaTamanho(draft.propostaTamanho ?? null);
    setEscopoPrevia(draft.escopoPrevia ? normalizarEscopo(draft.escopoPrevia) : null);
    setEscopoModo(draft.escopoModo ?? "pdf");
    setPropostaAberta(!!(draft.propostaPathPrevia || draft.escopoManualTexto?.trim()));
    setEscopoManualTexto(draft.escopoManualTexto ?? "");
    setEstrutura(draft.estrutura ? normalizarArvore(draft.estrutura) : arvoreVazia());
  };

  const descartarRascunho = () => {
    if (draftKey) {
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // ignorado
      }
    }
    setRascunhoPendente(null);
  };

  useEffect(() => {
    if (!draftKey) return;
    setDraftReady(false);
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<AgendamentoDraft>;
        const temConteudo = !!(
          draft.empresaId ||
          draft.agentId ||
          draft.data ||
          draft.observacoes?.trim() ||
          draft.propostaPathPrevia ||
          draft.escopoManualTexto?.trim() ||
          Object.values(draft.escolhasExtras ?? {}).some(Boolean) ||
          draft.estrutura
        );
        if (temConteudo) setRascunhoPendente(draft);
        else window.localStorage.removeItem(draftKey);
      }
    } catch {
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // ignorado
      }
    } finally {
      setDraftReady(true);
    }
  }, [draftKey]);

  const temConteudoNovo = !!(
    empresaId ||
    agentId ||
    data ||
    observacoes.trim() ||
    propostaPathPrevia ||
    escopoManualTexto.trim() ||
    Object.values(escolhasExtras).some(Boolean) ||
    arvoreTemEstrutura(estrutura) ||
    configTemDados(estrutura.config)
  );

  useEffect(() => {
    if (!draftReady || !draftKey || agendadoRef.current) return;
    // Só grava o rascunho de um agendamento que o usuário realmente começou a preencher.
    if (!temConteudoNovo) return;
    if (rascunhoPendente) setRascunhoPendente(null); // começou um novo: o rascunho antigo sai de cena
    const draft: AgendamentoDraft = {
      empresaId, matrizId, unidadeId, formIds, formQtd, agentId, agenteNomeManual,
      tipoSolicitacao, modalidade, nivel, escolhasExtras, data, hora, endereco, observacoes,
      propostaPathPrevia, propostaNome, propostaTamanho, escopoPrevia,
      escopoModo, escopoManualTexto, estrutura,
    };
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // O preenchimento continua funcionando mesmo se o armazenamento local estiver indisponível.
    }
  }, [draftReady, draftKey, temConteudoNovo, rascunhoPendente, empresaId, matrizId, unidadeId, formIds, formQtd, agentId,
    agenteNomeManual, tipoSolicitacao, modalidade, nivel, escolhasExtras, data, hora, endereco,
    observacoes, propostaPathPrevia, propostaNome, propostaTamanho, escopoPrevia,
    escopoModo, escopoManualTexto, estrutura]);

  useEffect(() => {
    (async () => {
      const [e, m, u, f, ag] = await Promise.all([
        supabase.from("empresas").select("id, nome, codigo_ionics" as any).order("nome"),
        supabase
          .from("matrizes")
          .select("id, empresa_id, nome, cnpj, logradouro, numero, bairro, cidade, estado")
          .order("nome"),
        supabase
          .from("unidades")
          .select("id, matriz_id, nome, codigo_ionics, logradouro, numero, bairro, cidade, estado" as any)
          .order("nome"),
        supabase.from("formularios").select("id, nome, empresa_id").eq("ativo", true).order("nome"),
        loadAgents().catch(() => null),
      ]);
      setEmpresas(((e.data ?? []) as unknown) as Empresa[]);
      setMatrizes((m.data ?? []) as Matriz[]);
      setUnidades(((u.data ?? []) as unknown) as Unidade[]);
      const formulariosAtivos = (f.data ?? []) as Form[];
      setForms(formulariosAtivos);
      // Sugestão pelo escopo e repetição por entidade (colunas/valores novos: falha silenciosa se ausentes).
      try {
        const meta: Record<string, { sugerirQuando: string[]; repetePorEntidade: boolean }> = {};
        const { data: sug, error: sugErr } = await (supabase as any).from("formularios").select("id, sugerir_quando");
        if (!sugErr) for (const r of sug ?? []) meta[r.id] = { sugerirQuando: r.sugerir_quando ?? [], repetePorEntidade: false };
        const { data: marc } = await (supabase as any)
          .from("perguntas")
          .select("id, secoes!inner(formulario_id)")
          .neq("entidade_tipo", "geral");
        for (const r of marc ?? []) {
          const fid = r.secoes?.formulario_id;
          if (fid) meta[fid] = { sugerirQuando: meta[fid]?.sugerirQuando ?? [], repetePorEntidade: true };
        }
        setFormMeta(meta);
      } catch {
        /* sem sugestões */
      }
      if (formulariosAtivos.length === 1) {
        setFormIds((atuais) => atuais.length > 0 ? atuais : [formulariosAtivos[0].id]);
      }
      setAgents((ag ?? []) as Agente[]);
      if (e.error || m.error || u.error || f.error || !ag) {
        setError("Não foi possível carregar todos os dados do agendamento. Atualize a página e tente novamente.");
      }
    })().catch(() => {
      setError("Não foi possível carregar os dados do agendamento. Atualize a página e tente novamente.");
    }).finally(() => setCarregandoDados(false));
  }, [loadAgents]);

  const matrizesDaEmpresa = useMemo(
    () => matrizes.filter((m) => m.empresa_id === empresaId),
    [matrizes, empresaId],
  );
  const unidadesDaMatriz = useMemo(
    () => unidades.filter((u) => u.matriz_id === matrizId),
    [unidades, matrizId],
  );

  // Auto-seleciona matriz/unidade quando há só uma
  useEffect(() => {
    if (matrizesDaEmpresa.length === 1 && !matrizId) {
      setMatrizId(matrizesDaEmpresa[0].id);
    } else if (matrizesDaEmpresa.length === 0) {
      setMatrizId("");
    }
  }, [matrizesDaEmpresa, matrizId]);

  useEffect(() => {
    if (unidadesDaMatriz.length === 1 && !unidadeId) {
      setUnidadeId(unidadesDaMatriz[0].id);
    } else if (unidadesDaMatriz.length === 0) {
      setUnidadeId("");
    }
  }, [unidadesDaMatriz, unidadeId]);

  // Auto-preenche endereço a partir da unidade, ou matriz como fallback
  useEffect(() => {
    if (endereco) return;
    const u = unidades.find((x) => x.id === unidadeId);
    if (temEndereco(u)) {
      setEndereco(formatEndereco(u));
      return;
    }
    const m = matrizes.find((x) => x.id === matrizId);
    if (temEndereco(m)) setEndereco(formatEndereco(m));
  }, [unidadeId, matrizId, unidades, matrizes, endereco]);

  const onChangeEmpresa = (v: string) => {
    setEmpresaId(v);
    setMatrizId("");
    setUnidadeId("");
    setEndereco("");
  };
  const onChangeMatriz = (v: string) => {
    setMatrizId(v);
    setUnidadeId("");
    setEndereco("");
  };
  const onChangeUnidade = (v: string) => {
    setUnidadeId(v);
    setEndereco("");
  };

  // Verifica conflito em tempo real quando agente + data estão preenchidos
  useEffect(() => {
    setConflito(null);
    if (!agentId || !data || !hora) return;
    let cancelled = false;
    (async () => {
      try {
        const agendadoEm = new Date(`${data}T${hora || "09:00"}:00`).toISOString();
        const res = await verificar({ data: { agenteId: agentId, data: agendadoEm, duracaoMin: 60 } });
        if (cancelled) return;
        if (res.conflito) {
          setConflito({ agenteNome: res.agenteNome, clienteNome: res.clienteNome, dataConflito: res.dataConflito });
        } else {
          setConflito(null);
        }
      } catch {
        // ignora
      }
    })();
    return () => { cancelled = true; };
  }, [agentId, data, hora, verificar]);

  function checarEtapa(id: EtapaAgendamento): ErroDeEtapa | null {
    if (id === "cliente") {
      if (!empresaId) return { mensagem: "Selecione a empresa.", campo: "agendamento-empresa" };
      if (!matrizId) return { mensagem: "Selecione a matriz.", campo: "agendamento-matriz" };
      if (unidadesDaMatriz.length && !unidadeId) return { mensagem: "Selecione a unidade.", campo: "agendamento-unidade" };
      const extra = camposExtras.find((c) => c.obrigatorio && !escolhasExtras[c.campo]);
      if (extra) return { mensagem: "Selecione a opção de " + extra.titulo + ".", campo: "campo-agendamento-" + extra.campo };
    }
    if (id === "escopo" && (analisando || analisandoManual)) {
      return { mensagem: "Aguarde a leitura do escopo antes de continuar." };
    }
    if (id === "formularios" && !formIds.length) {
      return { mensagem: "Selecione pelo menos um formulário.", campo: "agendamento-lista-formularios" };
    }
    if (id === "agenda") {
      if (!agentId) return { mensagem: "Selecione o responsável pelo mapeamento.", campo: "agendamento-responsavel" };
      if (!data) return { mensagem: "Selecione a data do mapeamento.", campo: "agendamento-data" };
      if (conflito) return { mensagem: "Escolha outro responsável, data ou hora.", campo: "agendamento-conflito" };
    }

    const invalido = formularioRef.current?.querySelector<HTMLInputElement | HTMLSelectElement>(
      '[data-etapa="' + id + '"] :is(input, select, textarea):invalid',
    );
    return invalido ? { mensagem: invalido.validationMessage, campo: invalido.id || undefined } : null;
  }

  function mostrarEtapa(id: EtapaAgendamento, falha: ErroDeEtapa | null = null) {
    setEtapa(id);
    setErroEtapa(falha);
    setFoco({ etapa: id, campo: falha?.campo });
  }

  function validarAte(limite: number) {
    for (const atual of ETAPAS.slice(0, limite)) {
      const falha = checarEtapa(atual.id);
      if (falha) {
        mostrarEtapa(atual.id, falha);
        return false;
      }
    }
    return true;
  }

  const indiceEtapa = ETAPAS.findIndex((item) => item.id === etapa);

  function irParaEtapa(indice: number) {
    const destino = ETAPAS[indice];
    if (!destino || indice === indiceEtapa || working || criados) return;
    if (indice < indiceEtapa || validarAte(indice)) mostrarEtapa(destino.id);
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (working || criados) return;
    if (indiceEtapa < ETAPAS.length - 1) {
      irParaEtapa(indiceEtapa + 1);
      return;
    }
    if (!validarAte(ETAPAS.length)) return;
    setErroEtapa(null);
    setWorking(true);
    setError(null);
    setProgresso("Criando o agendamento…");
    try {
      const agendadoEm = new Date(`${data}T${hora}:00`).toISOString();
      const res = await agendar({
        data: {
          unidadeId: unidadeId || null,
          matrizId: matrizId || null,
          formIds: formIdsExpandidos,
          agenteId: agentId,
          agenteNomeManual: null,
          tipoSolicitacao,
          modalidade,
          nivel,
          ...(Object.keys(escolhasExtras).some((k) => escolhasExtras[k]) ? { camposExtras: Object.fromEntries(Object.entries(escolhasExtras).filter(([, v]) => v)) } : {}),
          agendadoEm,
          duracaoMin: 60,
          enderecoVistoria: endereco || null,
          observacoes: observacoes || null,
        },
      });

      agendadoRef.current = true;
      if (draftKey) window.localStorage.removeItem(draftKey);

      // Retorno imediato: o agendamento já existe. O resto (proposta/estrutura) é complemento.
      const codigos = ((res?.casos ?? []) as { id: string; codigo?: string }[]).map((c) => c.codigo ?? "").filter(Boolean);
      setCriados(codigos);
      toast.success(codigos.length ? `Agendamento criado: ${codigos.join(", ")}` : "Agendamento criado");
      window.scrollTo({ top: 0, behavior: "smooth" });

      if (escopoModo === "pdf" && propostaPathPrevia && propostaNome && res?.casos?.length) {
        setProgresso("Anexando a proposta comercial…");
        try {
          const casos = res.casos as { id: string }[];
          for (const c of casos) {
            const path = `casos/${c.id}/${Date.now()}-${propostaNome.replace(/[^\w.-]+/g, "_")}`;
            const copia = await supabase.storage.from("propostas").copy(propostaPathPrevia, path);
            if (copia.error) throw new Error(copia.error.message);
            await registrar({
              data: {
                casoId: c.id,
                origem: "pdf",
                arquivoNome: propostaNome,
                arquivoPath: path,
                tamanhoBytes: propostaTamanho ?? 0,
                escopo: escopoPrevia ? (escopoPrevia as any) : null,
              },
            });
          }
          await supabase.storage.from("propostas").remove([propostaPathPrevia]);
        } catch (errProposta: any) {
          setError(
            `Mapeamento agendado, mas a proposta não pôde ser processada: ${errProposta?.message ?? "erro desconhecido"}. Anexe-a novamente na tela de revisão.`,
          );
          setWorking(false);
          setProgresso(null);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
      } else if (escopoModo === "manual" && escopoManualTexto.trim() && res?.casos?.length) {
        setProgresso("Registrando a descrição do escopo…");
        try {
          const casos = res.casos as { id: string }[];
          for (const c of casos) {
            await registrar({
              data: {
                casoId: c.id,
                origem: "manual",
                textoManual: escopoManualTexto.trim(),
                escopo: escopoPrevia ? (escopoPrevia as any) : null,
              },
            });
          }
        } catch (errProposta: any) {
          setError(
            `Mapeamento agendado, mas o escopo manual não pôde ser registrado: ${errProposta?.message ?? "erro desconhecido"}. Informe-o novamente na tela de revisão.`,
          );
          setWorking(false);
          setProgresso(null);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
      }

      // inclui os tipos novos (Casa, Pátio…): sem isso a estrutura só com eles não era gravada
      const temEstrutura = arvoreTemEstrutura(estrutura) || configTemDados(estrutura.config);
      if (temEstrutura && res?.casos?.length) {
        setProgresso("Gravando a estrutura do escopo…");
        try {
          const casoIds = (res.casos as { id: string }[]).map((c) => c.id);
          let salvo = await salvarEstrutura({ data: { casoIds, arvore: estrutura } });
          if (salvo.status === "precisa_confirmacao") {
            // A unidade tem escopo de mapeamentos anteriores com respostas. A estrutura
            // definida aqui vale para este agendamento; os anteriores mantêm a deles.
            salvo = await salvarEstrutura({ data: { casoIds, arvore: estrutura, confirmarRemocao: true } });
          }
          if (salvo.status !== "ok") throw new Error("A estrutura não foi gravada.");
        } catch (errEstrutura: any) {
          setError(
            `Mapeamento agendado, mas a estrutura do escopo não pôde ser salva: ${errEstrutura?.message ?? "erro desconhecido"}. Ela poderá ser definida depois no caso.`,
          );
          setWorking(false);
          setProgresso(null);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
      }

      toast.success("Agendamento concluído.");
      navigate({ to: "/app/agenda" });
    } catch (err: any) {
      setError(err?.message ?? "Erro ao agendar mapeamento.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setWorking(false);
      setProgresso(null);
    }
  };

  async function analisarProposta(file: File) {
    setAnalisando(true);
    setErroPrevia(null);
    try {
      const path = `previas/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const up = await supabase.storage.from("propostas").upload(path, file, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (up.error) throw new Error(up.error.message);
      setPropostaPathPrevia(path);
      setPropostaNome(file.name);
      setPropostaTamanho(file.size);
      const r = await analisarPrevia({ data: { arquivoPath: path } });
      setEscopoPrevia(normalizarEscopo(r.escopo));
    } catch (e: any) {
      setErroPrevia(
        `Não foi possível ler o escopo agora (${e?.message ?? "erro"}). O agendamento pode seguir; o escopo poderá ser revisado na tela de revisão.`,
      );
    } finally {
      setAnalisando(false);
    }
  }

  async function analisarEscopoDoTexto() {
    if (!escopoManualTexto.trim()) return;
    setAnalisandoManual(true);
    setErroManual(null);
    try {
      const r = await analisarManual({ data: { texto: escopoManualTexto.trim() } });
      setEscopoPrevia(normalizarEscopo(r.escopo));
    } catch (e: any) {
      setErroManual(
        `Não foi possível interpretar o escopo agora (${e?.message ?? "erro"}). O agendamento pode seguir; o escopo poderá ser revisado na tela de revisão.`,
      );
    } finally {
      setAnalisandoManual(false);
    }
  }

  function onChangeEscopoModo(modo: "pdf" | "manual") {
    if (modo === escopoModo) return;
    setEscopoModo(modo);
    setEscopoPrevia(null);
    setErroPrevia(null);
    setErroManual(null);
    if (modo === "manual" && propostaPathPrevia) {
      void supabase.storage.from("propostas").remove([propostaPathPrevia]);
      setProposta(null);
      setPropostaPathPrevia(null);
      setPropostaNome(null);
      setPropostaTamanho(null);
    } else if (modo === "pdf") {
      setEscopoManualTexto("");
    }
  }

  // Formulário de cliente específico só aparece para esse cliente; os padrão (sem cliente) aparecem sempre.
  const formsVisiveis = useMemo(
    () => formulariosVisiveis(forms, empresaId, mostrarOutrosClientes),
    [forms, empresaId, mostrarOutrosClientes],
  );
  const outrosEscondidos = useMemo(() => qtdDeOutrosClientes(forms, empresaId), [forms, empresaId]);
  const nomeDaEmpresa = (id: string | null) => empresas.find((e) => e.id === id)?.nome ?? "outro cliente";
  // Trocou de cliente: tira da seleção o que deixou de ser visível (formulário de outro cliente).
  useEffect(() => {
    if (!forms.length) return;
    const visiveis = new Set(formsVisiveis.map((f) => f.id));
    setFormIds((cur) => (cur.every((id) => visiveis.has(id)) ? cur : cur.filter((id) => visiveis.has(id))));
  }, [forms, formsVisiveis]);

  const toggleForm = (id: string) => {
    setFormIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };
  /** Formulário que repete as perguntas por equipamento do escopo cobre tudo num só mapeamento: sempre 1. */
  const repetePorEntidade = (id: string) => !!formMeta[id]?.repetePorEntidade;
  const qtdDoForm = (id: string) =>
    repetePorEntidade(id) ? 1 : Math.max(1, Math.min(20, Math.floor(formQtd[id] ?? 1)));
  /** Lista final enviada ao servidor: cada formulário repetido pela sua quantidade. */
  const formIdsExpandidos = formIds.flatMap((id) => Array.from({ length: qtdDoForm(id) }, () => id));

  // Formulários sugeridos pelo escopo (ainda não escolhidos). Se o formulário não repete
  // perguntas por entidade, a quantidade sugerida é a do escopo (ex.: 2 comboios = 2 mapeamentos).
  const sugestoesDoEscopo = useMemo(() => {
    const q = quantidadesDoEscopo(estrutura);
    const out: { form: Form; motivos: string[]; qtd: number }[] = [];
    for (const f of formsVisiveis) {
      const quando = formMeta[f.id]?.sugerirQuando ?? [];
      const ativos = opcoesSugerir(catalogoTipos, quando).filter((o) => quando.includes(o.value) && (q[o.value] ?? 0) > 0);
      if (!ativos.length || formIds.includes(f.id)) continue;
      const base = Math.max(...ativos.map((o) => q[o.value]));
      out.push({
        form: f,
        motivos: ativos.map((o) => `${q[o.value]} ${o.label.toLowerCase()}`),
        qtd: formMeta[f.id]?.repetePorEntidade ? 1 : Math.min(20, base),
      });
    }
    return out;
  }, [formsVisiveis, formMeta, estrutura, formIds, catalogoTipos]);

  const adicionarSugestao = (id: string, qtd: number) => {
    setErroEtapa(null);
    setFormIds((cur) => (cur.includes(id) ? cur : [...cur, id]));
    setFormQtd((cur) => ({ ...cur, [id]: qtd }));
  };

  const empresaSel = empresas.find((x) => x.id === empresaId);
  const unidadeSel = unidades.find((x) => x.id === unidadeId);
  const matrizSel = matrizesDaEmpresa.find((x) => x.id === matrizId);
  const agenteSel = agents.find((x) => x.id === agentId);
  const dataFormatada = data ? new Date(data + "T12:00:00").toLocaleDateString("pt-BR") : "";
  const resumoEscopo = resumoEscopoAgendamento(estrutura, catalogoTipos, opcoesAg);
  const formulariosSelecionados = formIds.flatMap((id) => {
    const form = forms.find((item) => item.id === id);
    return form ? [{ id, nome: form.nome, quantidade: qtdDoForm(id) }] : [];
  });
  const resumo = {
    cliente: empresaSel?.nome,
    local: unidadeSel?.nome || matrizSel?.nome,
    endereco,
    responsavel: agenteSel?.nome,
    horario: dataFormatada && hora ? dataFormatada + " às " + hora : "",
    total: formIdsExpandidos.length,
    formularios: formulariosSelecionados,
    escopo: resumoEscopo,
    baseEscopo: escopoModo === "pdf" && propostaPathPrevia ? propostaNome : escopoModo === "manual" && escopoManualTexto.trim() ? "Descrição manual" : undefined,
  };
  const termoFormulario = buscaFormularios.trim().toLocaleLowerCase("pt-BR");
  const formulariosFiltrados = formsVisiveis.filter((form) => form.nome.toLocaleLowerCase("pt-BR").includes(termoFormulario));


  return (
    <div>
      {campoAtalho && (
        <Link to="/app/opcoes-agendamento" search={{ campo: campoAtalho }} className="mb-4 inline-block rounded text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          Voltar às opções do agendamento
        </Link>
      )}
      <PageHeader
        title="Agendar mapeamento"
        description="Informe o cliente, defina o escopo e escolha quem fará o mapeamento."
      />

      {error && (
        <div role="alert" className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      )}

      {criados && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-foreground" role="status">
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Agendamento criado{criados.length ? `: ${criados.join(", ")}` : ""}.
            {progresso && (
              <span className="flex items-center gap-1 font-normal text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {progresso}
              </span>
            )}
          </span>
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/app/agenda" })}>
            Ir para a agenda
          </Button>
        </div>
      )}

      {rascunhoPendente && !criados && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
          <span>Há um agendamento em rascunho.</span>
          <span className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                aplicarRascunho(rascunhoPendente);
                setRascunhoPendente(null);
              }}
            >
              Retomar rascunho
            </Button>
            <Button type="button" variant="secondary" onClick={descartarRascunho}>
              Descartar
            </Button>
          </span>
        </div>
      )}

      {carregandoDados ? (
        <Card><CarregandoConteudo texto="Carregando os dados do agendamento…" /></Card>
      ) : !criados && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="min-w-0 space-y-4">
            <nav aria-label="Etapas do agendamento">
              <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ETAPAS.map((item, indice) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => irParaEtapa(indice)}
                      aria-current={etapa === item.id ? "step" : undefined}
                      disabled={working}
                      className={"flex min-h-12 w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring " + (etapa === item.id ? "border-primary bg-primary/5 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted")}
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-foreground" aria-hidden="true">{indice + 1}</span>
                      {item.titulo}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
            <Card>
              <form ref={formularioRef} onSubmit={submit} onChange={() => setErroEtapa(null)} noValidate className="space-y-5">
                <header>
                  <h2 id={"titulo-etapa-" + etapa} tabIndex={-1} className="scroll-mt-20 text-xl font-semibold tracking-tight">{ETAPAS[indiceEtapa].titulo}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{ETAPAS[indiceEtapa].descricao}</p>
                </header>
                {erroEtapa && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erroEtapa.mensagem}</p>}
                <fieldset disabled={working} className="min-w-0 space-y-5">
                  <section hidden={etapa !== "cliente"} data-etapa="cliente" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <Label htmlFor="agendamento-empresa" required>Empresa</Label>
                        <Select id="agendamento-empresa" value={empresaId} onChange={(e) => onChangeEmpresa(e.target.value)} required>
                          <option value="">Selecione a empresa</option>
                          {empresas.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.nome}{e.codigo_ionics ? ` · ${e.codigo_ionics}` : ""}
                            </option>
                          ))}
                        </Select>
                        {empresaSel?.codigo_ionics && (
                          <p className="mt-1 font-mono text-xs text-primary">{empresaSel.codigo_ionics}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="agendamento-matriz" required>Matriz</Label>
                        <Select
                          id="agendamento-matriz"
                          value={matrizId}
                          onChange={(e) => onChangeMatriz(e.target.value)}
                          required
                          disabled={!empresaId}
                        >
                          <option value="">{empresaId ? "Selecione a matriz" : "Selecione a empresa antes"}</option>
                          {matrizesDaEmpresa.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.nome}
                              {m.cnpj ? ` · ${m.cnpj}` : ""}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={matrizId && unidadesDaMatriz.length === 0 ? undefined : "agendamento-unidade"} required={unidadesDaMatriz.length > 0}>Unidade</Label>
                        {matrizId && unidadesDaMatriz.length === 0 ? (
                          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                            Sem unidades cadastradas — o mapeamento será agendado na sede (endereço da matriz).
                          </div>
                        ) : (
                          <Select
                            id="agendamento-unidade"
                            value={unidadeId}
                            onChange={(e) => onChangeUnidade(e.target.value)}
                            required={unidadesDaMatriz.length > 0}
                            disabled={!matrizId}
                          >
                            <option value="">{matrizId ? "Selecione a unidade" : "Selecione a matriz antes"}</option>
                            {unidadesDaMatriz.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.nome}{u.codigo_ionics ? ` · ${u.codigo_ionics}` : ""}
                              </option>
                            ))}
                          </Select>
                        )}
                        {unidadeSel?.codigo_ionics && (
                          <p className="mt-1 font-mono text-xs text-primary">{unidadeSel.codigo_ionics}</p>
                        )}
                      </div>

                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <Label htmlFor="campo-agendamento-tipo_solicitacao">Tipo de solicitação</Label>
                        <Select id="campo-agendamento-tipo_solicitacao" value={tipoSolicitacao} onChange={(e) => setTipoSolicitacao(e.target.value as any)} required>
                          {opcoesDoCampo("tipo_solicitacao", { todas: opcoesAg, incluir: [tipoSolicitacao] }).map((o) => (
                            <option key={o.valor} value={o.valor}>
                              {o.rotulo}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="campo-agendamento-modalidade">Modalidade</Label>
                        <Select
                          id="campo-agendamento-modalidade"
                          value={modalidade}
                          onChange={(e) => {
                            const v = e.target.value;
                            setModalidade(v);
                            if (v === "presencial") setAgenteNomeManual("");
                          }}
                          required
                        >
                          {opcoesDoCampo("modalidade", { todas: opcoesAg, incluir: [modalidade] }).map((o) => (
                            <option key={o.valor} value={o.valor}>
                              {o.rotulo}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="campo-agendamento-nivel">Nível do mapeamento</Label>
                        <Select id="campo-agendamento-nivel" value={nivel} onChange={(e) => setNivel(e.target.value as any)} required>
                          {opcoesDoCampo("nivel", { todas: opcoesAg, incluir: [nivel] }).map((o) => (
                            <option key={o.valor} value={o.valor}>
                              {o.rotulo}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    {camposExtras.length > 0 && (
                      <div className="grid gap-4 md:grid-cols-3">
                        {camposExtras.map((c) => (
                          <div key={c.campo}>
                            <Label htmlFor={"campo-agendamento-" + c.campo} required={c.obrigatorio}>{c.titulo}</Label>
                            <Select
                              id={"campo-agendamento-" + c.campo}
                              value={escolhasExtras[c.campo] ?? ""}
                              onChange={(e) => setEscolhasExtras((cur) => ({ ...cur, [c.campo]: e.target.value }))}
                              required={c.obrigatorio}
                            >
                              <option value="">{c.obrigatorio ? "Selecione" : "Não informado"}</option>
                              {opcoesDoCampo(c.campo, { todas: opcoesAg }).map((o) => (
                                <option key={o.valor} value={o.valor}>
                                  {o.rotulo}
                                </option>
                              ))}
                            </Select>
                          </div>
                        ))}
                      </div>
                    )}

                  </section>
                  <section hidden={etapa !== "escopo"} data-etapa="escopo" className="space-y-5">
                    <details open={propostaAberta} onToggle={(event) => setPropostaAberta(event.currentTarget.open)} className="group rounded-lg border border-border">
                      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                        Proposta ou descrição comercial
                        <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                          {analisando || analisandoManual ? "Em leitura" : resumo.baseEscopo ? "Informada" : "Opcional"}
                          <ChevronDown className="size-4 motion-safe:transition-transform group-open:rotate-180" aria-hidden="true" />
                        </span>
                      </summary>
                      <div className="border-t border-border p-4">
                        <div className="mb-2 inline-flex flex-wrap gap-1 rounded-md border border-border bg-card p-0.5 text-xs">
                          <button
                            type="button"
                            onClick={() => onChangeEscopoModo("pdf")}
                            aria-pressed={escopoModo === "pdf"}
                            className={`rounded px-3 py-1.5 font-medium transition-colors ${
                              escopoModo === "pdf" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            Usar PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => onChangeEscopoModo("manual")}
                            aria-pressed={escopoModo === "manual"}
                            className={`rounded px-3 py-1.5 font-medium transition-colors ${
                              escopoModo === "manual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            Descrever em texto
                          </button>
                        </div>

                        {escopoModo === "pdf" ? (
                          <>
                            <input
                              key={inputPropostaKey}
                              aria-label="Proposta comercial em PDF"
                              type="file"
                              accept="application/pdf"
                              onChange={(e) => {
                                const f = e.target.files?.[0] ?? null;
                                if (f && f.size > 25 * 1024 * 1024) {
                                  setErroPrevia("A proposta deve ter no máximo 25 MB.");
                                  e.target.value = "";
                                  return;
                                }
                                setProposta(f);
                                setPropostaNome(f?.name ?? null);
                                setPropostaTamanho(f?.size ?? null);
                                if (propostaPathPrevia) {
                                  void supabase.storage.from("propostas").remove([propostaPathPrevia]);
                                }
                                setPropostaPathPrevia(null);
                                setEscopoPrevia(null);
                                setErroPrevia(null);
                                if (f) void analisarProposta(f);
                              }}
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                            />
                            <p className="mt-1 text-xs text-muted-foreground">
                              O PDF ajuda a preencher as quantidades do escopo. Limite de 25 MB.
                            </p>
                            {!proposta && propostaPathPrevia && propostaNome && (
                              <p className="mt-2 text-xs text-success">Proposta recuperada: {propostaNome}</p>
                            )}
                            {analisando && (
                              <p className="mt-2 text-xs text-muted-foreground">Lendo o escopo da proposta…</p>
                            )}
                            {(proposta || propostaPathPrevia || escopoPrevia) && !analisando && (
                              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={limparEscopo}>
                                Limpar e enviar outro documento
                              </Button>
                            )}
                            {erroPrevia && (
                              <p className="mt-2 text-xs text-destructive">{erroPrevia}</p>
                            )}
                          </>
                        ) : (
                          <>
                            <textarea
                              aria-label="Descrição do escopo comercial"
                              value={escopoManualTexto}
                              onChange={(e) => setEscopoManualTexto(e.target.value)}
                              rows={4}
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                              placeholder="Ex.: 1 posto com 2 bombas e 4 bicos. Verificar a conexão de dados."
                            />
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                disabled={!escopoManualTexto.trim() || analisandoManual}
                                onClick={() => void analisarEscopoDoTexto()}
                              >
                                {analisandoManual ? "Interpretando…" : "Interpretar escopo com IA"}
                              </Button>
                              <p className="text-xs text-muted-foreground">
A descrição pode ser salva como está. A leitura com IA é opcional.
                              </p>
                            </div>
                            {erroManual && (
                              <p className="mt-2 text-xs text-destructive">{erroManual}</p>
                            )}
                            {(escopoManualTexto || escopoPrevia) && (
                              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={limparEscopo}>
                                Limpar texto e escopo identificado
                              </Button>
                            )}
                          </>
                        )}

                      </div>
                    </details>

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="mb-1 text-sm font-semibold">Estrutura física</h3>
                          <p className="text-xs text-muted-foreground">
                            Informe apenas o que faz parte do mapeamento.
                          </p>
                        </div>
                        {escopoPrevia && (
                          <Button type="button" variant="outline" onClick={sugerirEstrutura}>
                            Aplicar quantidades da leitura
                          </Button>
                        )}
                      </div>
                      {escopoPrevia && (
                        <p role="status" className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                          {estruturaAuto.current ? "Quantidades sugeridas pela leitura. Confira os itens preenchidos." : "A leitura está disponível. Use Aplicar quantidades da leitura se quiser refazer a estrutura."}
                        </p>
                      )}
                      <EstruturaEscopo
                        value={estrutura}
                        onChange={editarEstrutura}
                        disabled={working}
                        itensDaProposta={escopoPrevia?.itens_previstos?.valor ?? []}
                        idCampoSolucao="campo-agendamento-solucao"
                        noAgendamento
                      />
                    </div>

                    <div className="rounded-lg border border-border p-4 xl:hidden">
                      <h3 className="mb-2 text-sm font-semibold">Escopo definido</h3>
                      <ResumoEscopoLinhas linhas={resumoEscopo} />
                    </div>
                    <div className="space-y-2 rounded-lg border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label htmlFor="agendamento-orientacoes">Orientações para o agente</Label>
                        <Button type="button" variant="outline" onClick={gerarOrientacoes}>
                          Preencher com dados do escopo
                        </Button>
                      </div>
                      <textarea
                        id="agendamento-orientacoes"
                        value={observacoes}
                        onChange={(e) => setObservacoes(e.target.value)}
                        rows={5}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        placeholder="Resumo do que é esperado no local, prioridades, ponto de referência, contato, cuidados..."
                      />
                      <p className="text-xs text-muted-foreground">
O agente verá estas orientações na agenda e no checklist.
                      </p>
                    </div>

                  </section>
                  <section hidden={etapa !== "formularios"} data-etapa="formularios" className="space-y-4">
                    <div>
                      {formsVisiveis.length > 5 && (
                        <div className="mb-3">
                          <Label htmlFor="agendamento-busca-formularios">Buscar formulário</Label>
                          <Input id="agendamento-busca-formularios" type="search" value={buscaFormularios} onChange={(e) => setBuscaFormularios(e.target.value)} />
                        </div>
                      )}
                      {sugestoesDoEscopo.length > 0 && (
                        <div className="mt-1 space-y-1.5 rounded-md border border-primary/30 bg-primary/5 p-2.5">
                          <p className="text-xs font-medium text-foreground">Sugerido pelo escopo</p>
                          {sugestoesDoEscopo.map((s) => (
                            <div key={s.form.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="min-w-0 text-foreground">
                                {s.form.nome}
                                <span className="ml-1 text-muted-foreground">
                                  ({s.motivos.join(", ")} no escopo: {s.qtd}x)
                                </span>
                              </span>
                              <Button type="button" variant="outline" onClick={() => adicionarSugestao(s.form.id, s.qtd)}>
                                Adicionar {s.qtd}x
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div id="agendamento-lista-formularios" tabIndex={-1} aria-label="Formulários disponíveis" className="mt-3 max-h-72 space-y-1 overflow-auto rounded-md border border-border bg-background p-2">
                        {formsVisiveis.length === 0 ? (
                          <p className="px-2 py-1 text-xs text-muted-foreground">Nenhum formulário disponível para este cliente.</p>
                        ) : (
                          formulariosFiltrados.length === 0 ? (
                            <p className="px-2 py-1 text-xs text-muted-foreground">Nenhum formulário corresponde à busca.</p>
                          ) : formulariosFiltrados.map((f) => (
                            <div key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded px-2 py-2 text-sm hover:bg-muted/50">
                              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={formIds.includes(f.id)}
                                  onChange={() => toggleForm(f.id)}
                                  disabled={forms.length === 1}
                                  aria-label={`Selecionar formulário ${f.nome}`}
                                  className="h-4 w-4 rounded border-border disabled:cursor-not-allowed"
                                />
                                <span className="min-w-0 flex-1 text-foreground">
                                  {f.nome}
                                  {f.grupo === "cliente" && (
                                    <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">deste cliente</span>
                                  )}
                                  {f.grupo === "outro" && (
                                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                      de {nomeDaEmpresa(f.empresa_id)}
                                    </span>
                                  )}
                                </span>
                              </label>
                              {formIds.includes(f.id) && repetePorEntidade(f.id) && (
                                <span className="shrink-0 text-xs text-muted-foreground">cobre todo o escopo</span>
                              )}
                              {formIds.includes(f.id) && !repetePorEntidade(f.id) && (
                                <span
                                  className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
                                >
                                  Qtd.
                                  <NumericInput
                                    min={1}
                                    max={20}
                                    value={qtdDoForm(f.id)}
                                    className="w-28"
                                    aria-label={`Quantidade de mapeamentos de ${f.nome}`}
                                    onValueChange={(v) =>
                                      setFormQtd((cur) => ({ ...cur, [f.id]: Math.max(1, Math.min(20, Math.floor(Number(v) || 1))) }))
                                    }
                                  />
                                </span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                      {(outrosEscondidos > 0 || mostrarOutrosClientes) && (
                        <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={mostrarOutrosClientes}
                            onChange={(e) => setMostrarOutrosClientes(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-border"
                          />
                          Mostrar também formulários feitos para outros clientes ({outrosEscondidos})
                        </label>
                      )}
                      <p className="mt-3 text-sm font-medium" aria-live="polite">{formIdsExpandidos.length} {formIdsExpandidos.length === 1 ? "mapeamento selecionado" : "mapeamentos selecionados"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {forms.length === 1
                          ? "O único formulário ativo já foi selecionado automaticamente."
                          : "Formulários que cobrem todo o escopo geram um mapeamento. Nos demais, use Qtd. para criar mais de um."}
                      </p>
                    </div>
                  </section>
                  <section hidden={etapa !== "agenda"} data-etapa="agenda" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="agendamento-responsavel" required>Responsável pelo mapeamento</Label>
                        <Select
                          id="agendamento-responsavel"
                          value={agentId}
                          onChange={(e) => setAgentId(e.target.value)}
                          required
                          className={conflito ? "border-destructive ring-1 ring-destructive" : undefined}
                        >
                          <option value="">
                            Selecione um agente técnico ou especialista
                          </option>
                          {agents.map((a) => <option key={a.id} value={a.id}>{a.nome || "(sem nome)"}</option>)}
                        </Select>
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="agendamento-endereco">Endereço do mapeamento</Label>
                        <Input id="agendamento-endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Auto-preenchido pela unidade ou matriz" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <Label htmlFor="agendamento-data" required>Data</Label>
                          <div className={conflito ? "rounded-md border border-destructive ring-1 ring-destructive" : undefined}>
                            <DatePicker id="agendamento-data" value={data} onChange={(dia) => { setData(dia); setErroEtapa(null); }} />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="agendamento-hora" required>Hora</Label>
                          <Input id="agendamento-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} required />
                        </div>
                      </div>
                    </div>

                    {conflito && (
                      <div id="agendamento-conflito" tabIndex={-1} role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <p>
                          {conflito.agenteNome || "O responsável"} já tem um atendimento para {conflito.clienteNome || "outro cliente"}
                          {conflito.dataConflito ? " em " + new Date(conflito.dataConflito).toLocaleString("pt-BR") : " neste horário"}. Escolha outro responsável, data ou hora.
                        </p>
                      </div>
                    )}
                    <div className="xl:hidden"><ResumoAgendamento dados={resumo} onEditar={(id) => irParaEtapa(ETAPAS.findIndex((item) => item.id === id))} /></div>
                  </section>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    {indiceEtapa > 0 ? (
                      <Button type="button" variant="outline" onClick={() => irParaEtapa(indiceEtapa - 1)} disabled={working}>
                        <ArrowLeft className="size-4" aria-hidden="true" /> Voltar
                      </Button>
                    ) : <p className="text-xs text-muted-foreground">Etapa 1 de {ETAPAS.length}</p>}
                    <Button type="submit" disabled={working}>
                      {working ? (
                        <><Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" /> {progresso ?? "Agendando…"}</>
                      ) : etapa === "agenda" ? "Confirmar agendamento" : <>Continuar <ArrowRight className="size-4" aria-hidden="true" /></>}
                    </Button>
                  </div>
                </fieldset>
              </form>
            </Card>
          </div>
          <aside className="sticky top-24 hidden max-h-[calc(100dvh-7rem)] overflow-auto rounded-lg xl:block"><ResumoAgendamento dados={resumo} onEditar={(id) => irParaEtapa(ETAPAS.findIndex((item) => item.id === id))} /></aside>
        </div>
      )}
    </div>
  );
}

type DadosResumoAgendamento = {
  cliente?: string;
  local?: string;
  endereco: string;
  responsavel?: string;
  horario: string;
  total: number;
  formularios: Array<{ id: string; nome: string; quantidade: number }>;
  escopo: LinhaResumoEscopo[];
  baseEscopo?: string | null;
};

function ResumoEscopoLinhas({ linhas }: { linhas: LinhaResumoEscopo[] }) {
  if (!linhas.length) return <p className="text-xs text-muted-foreground">Nenhum item definido no escopo.</p>;
  return (
    <dl className="space-y-1.5 text-xs">
      {linhas.map(({ grupo, itens }) => (
        <div key={grupo}>
          <dt className="font-medium text-foreground">{grupo}</dt>
          <dd className="break-words text-muted-foreground">{itens.join(" · ")}</dd>
        </div>
      ))}
    </dl>
  );
}

function ResumoAgendamento({ dados, onEditar }: { dados: DadosResumoAgendamento; onEditar: (id: EtapaAgendamento) => void }) {
  const blocos: Array<{ id: EtapaAgendamento; titulo: string; conteudo: React.ReactNode }> = [
    { id: "cliente", titulo: "Local", conteudo: dados.cliente ? (
      <><p className="break-words text-sm font-medium">{dados.cliente}</p>{dados.local && <p className="break-words text-xs text-muted-foreground">{dados.local}</p>}</>
    ) : <p className="text-xs text-muted-foreground">Selecione o cliente.</p> },
    { id: "escopo", titulo: "Escopo", conteudo: <>
      {dados.baseEscopo && <p className="mb-2 break-words text-xs text-muted-foreground">{dados.baseEscopo}</p>}
      <ResumoEscopoLinhas linhas={dados.escopo} />
    </> },
    { id: "formularios", titulo: "Mapeamentos a criar", conteudo: dados.total ? (
      <>
        <p className="text-sm font-medium">{dados.total} {dados.total === 1 ? "mapeamento" : "mapeamentos"}</p>
        <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
          {dados.formularios.map((form) => <li key={form.id} className="break-words">{form.nome}{form.quantidade > 1 ? " × " + form.quantidade : ""}</li>)}
        </ul>
      </>
    ) : <p className="text-xs text-muted-foreground">Selecione pelo menos um formulário.</p> },
    { id: "agenda", titulo: "Visita", conteudo: <div className="space-y-1 text-xs text-muted-foreground">
      <p>{dados.responsavel || "Responsável a definir"}</p>
      <p>{dados.horario || "Data e hora a definir"}</p>
      {dados.endereco && <p className="break-words">{dados.endereco}</p>}
    </div> },
  ];

  return (
    <section aria-label="Resumo do agendamento" className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Resumo do agendamento</h2>
      <div className="mt-2 divide-y divide-border">
        {blocos.map(({ id, titulo, conteudo }) => (
          <section key={id} className="py-2.5 last:pb-0">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-semibold">{titulo}</h3>
              <button type="button" aria-label={"Editar " + titulo} onClick={() => onEditar(id)} className="rounded py-1 text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Editar</button>
            </div>
            {conteudo}
          </section>
        ))}
      </div>
    </section>
  );
}
