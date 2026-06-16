import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, MapPin, FileText, User, Building2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { PageHeader, Card, Badge, Button } from "@/components/ui-bits";
import { Progress } from "@/components/ui/progress";
import { statusLabels, statusTones, type CaseStatus } from "@/lib/casos";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { TimelineMapeamento } from "@/components/mapeamento/TimelineMapeamento";
import { ObservacoesPanel } from "@/components/mapeamento/ObservacoesPanel";

export const Route = createFileRoute("/app/vistorias/$id")({
  component: VistoriaDetalhesPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Erro ao carregar mapeamento: {error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Mapeamento não encontrado.</div>
  ),
});

type Caso = {
  id: string;
  codigo: string;
  status: CaseStatus;
  criado_em: string;
  agendado_em: string | null;
  duracao_min: number | null;
  endereco_vistoria: string | null;
  observacoes_agendamento: string | null;
  formulario_id: string | null;
  data_execucao: string | null;
  data_entrega_agente: string | null;
  data_aprovacao_pablo: string | null;
  motivo_recusa: string | null;
  unidade: { nome: string; matriz: { nome: string; empresa: { nome: string } | null } | null } | null;
  agente: { nome: string } | null;
  formulario: { nome: string } | null;
};

type Secao = { id: string; titulo: string; descricao: string | null; ordem: number };
type Pergunta = {
  id: string;
  secao_id: string;
  texto: string;
  tipo: string;
  obrigatoria: boolean;
  ordem: number;
};
type Opcao = { id: string; pergunta_id: string; texto: string };
type Resposta = {
  id: string;
  pergunta_id: string;
  tipo: string;
  valor_texto: string | null;
  arquivo_path: string | null;
  transcricao: string | null;
  ia_aprovado: boolean | null;
  ia_motivo: string | null;
  criado_em: string;
};

function fmtData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function VistoriaDetalhesPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [caso, setCaso] = useState<Caso | null>(null);
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [opcoes, setOpcoes] = useState<Opcao[]>([]);
  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data: casoData } = await supabase
        .from("casos")
        .select(
          "id, codigo, status, criado_em, agendado_em, duracao_min, endereco_vistoria, observacoes_agendamento, formulario_id, data_execucao, data_entrega_agente, data_aprovacao_pablo, motivo_recusa, unidade:unidades(nome, matriz:matrizes(nome, empresa:empresas(nome))), agente:profiles!agente_id(nome), formulario:formularios(nome)",
        )
        .eq("id", id)
        .maybeSingle();

      if (!active) return;
      const c = (casoData as unknown as Caso) ?? null;
      setCaso(c);

      const respPromise = supabase
        .from("respostas_agente")
        .select("id, pergunta_id, tipo, valor_texto, arquivo_path, transcricao, ia_aprovado, ia_motivo, criado_em")
        .eq("caso_id", id)
        .order("criado_em", { ascending: true });

      if (c?.formulario_id) {
        const { data: secData } = await supabase
          .from("secoes")
          .select("id, titulo, descricao, ordem")
          .eq("formulario_id", c.formulario_id)
          .order("ordem", { ascending: true });
        const secs = (secData ?? []) as Secao[];
        setSecoes(secs);

        if (secs.length > 0) {
          const secIds = secs.map((s) => s.id);
          const { data: pData } = await supabase
            .from("perguntas")
            .select("id, secao_id, texto, tipo, obrigatoria, ordem")
            .in("secao_id", secIds)
            .order("ordem", { ascending: true });
          const ps = (pData ?? []) as Pergunta[];
          setPerguntas(ps);

          if (ps.length > 0) {
            const { data: oData } = await supabase
              .from("opcoes_pergunta")
              .select("id, pergunta_id, texto")
              .in("pergunta_id", ps.map((p) => p.id));
            setOpcoes((oData ?? []) as Opcao[]);
          }
        }
      }

      const { data: rData } = await respPromise;
      const rs = (rData ?? []) as Resposta[];
      setRespostas(rs);

      const paths = rs.map((r) => r.arquivo_path).filter((p): p is string => !!p);
      if (paths.length > 0) {
        const map: Record<string, string> = {};
        await Promise.all(
          paths.map(async (p) => {
            const { data } = await supabase.storage.from("agente-uploads").createSignedUrl(p, 3600);
            if (data?.signedUrl) map[p] = data.signedUrl;
          }),
        );
        if (active) setSignedUrls(map);
      }

      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const respostasPorPergunta = useMemo(() => {
    const map = new Map<string, Resposta[]>();
    for (const r of respostas) {
      const arr = map.get(r.pergunta_id) ?? [];
      arr.push(r);
      map.set(r.pergunta_id, arr);
    }
    return map;
  }, [respostas]);

  const opcoesPorPergunta = useMemo(() => {
    const map = new Map<string, Opcao[]>();
    for (const o of opcoes) {
      const arr = map.get(o.pergunta_id) ?? [];
      arr.push(o);
      map.set(o.pergunta_id, arr);
    }
    return map;
  }, [opcoes]);

  const total = perguntas.length;
  const respondidas = perguntas.filter((p) => (respostasPorPergunta.get(p.id) ?? []).length > 0).length;
  const progresso = total > 0 ? Math.round((respondidas / total) * 100) : 0;

  const podeAbrirRevisao =
    auth.role === "super_admin" &&
    caso &&
    (caso.status === "aguardando_revisao" || caso.status === "aprovado" || caso.status === "em_analise");

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }
  if (!caso) {
    return (
      <div>
        <Button variant="ghost" onClick={() => navigate({ to: "/app/cases" })}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <p className="mt-4 text-sm text-muted-foreground">Mapeamento não encontrado.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link to="/app/cases" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar para mapeamentos
        </Link>
      </div>

      <PageHeader
        title={`Mapeamento ${caso.codigo}`}
        description={caso.unidade?.matriz?.empresa?.nome ?? undefined}
        actions={
          podeAbrirRevisao ? (
            <Link to="/app/review/$id" params={{ id: caso.id }}>
              <Button>
                <ExternalLink className="h-4 w-4" />
                Abrir na revisão
              </Button>
            </Link>
          ) : null
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={statusTones[caso.status]}>{statusLabels[caso.status]}</Badge>
          <span className="text-xs text-muted-foreground">Criado em {fmtData(caso.criado_em)}</span>
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Info icon={Building2} label="Empresa" value={caso.unidade?.matriz?.empresa?.nome ?? "—"} />
          <Info icon={Building2} label="Unidade" value={caso.unidade?.nome ?? "—"} />
          <Info icon={User} label="Agente" value={caso.agente?.nome ?? "—"} />
          <Info icon={FileText} label="Formulário" value={caso.formulario?.nome ?? "—"} />
          <Info
            icon={CalendarDays}
            label="Agendado para"
            value={`${fmtData(caso.agendado_em)}${caso.duracao_min ? ` · ${caso.duracao_min} min` : ""}`}
          />
          {caso.endereco_vistoria && (
            <Info icon={MapPin} label="Endereço" value={caso.endereco_vistoria} />
          )}
        </div>
        {caso.observacoes_agendamento && (
          <p className="mt-3 rounded-md bg-muted/50 p-3 text-xs italic text-muted-foreground">
            {caso.observacoes_agendamento}
          </p>
        )}

        <div className="mt-5">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Progresso</span>
            <span className="font-medium text-foreground">{respondidas} de {total} respondidas ({progresso}%)</span>
          </div>
          <Progress value={progresso} />
        </div>
      </Card>

      {secoes.length === 0 ? (
        <Card><p className="text-sm text-muted-foreground">Este mapeamento não tem formulário associado.</p></Card>
      ) : (
        <div className="space-y-5">
          {secoes.map((s) => {
            const ps = perguntas.filter((p) => p.secao_id === s.id);
            return (
              <div key={s.id}>
                <h3 className="mb-2 text-sm font-semibold text-foreground">{s.titulo}</h3>
                {s.descricao && <p className="mb-3 text-xs text-muted-foreground">{s.descricao}</p>}
                <div className="space-y-2">
                  {ps.length === 0 ? (
                    <Card><p className="text-xs text-muted-foreground">Sem perguntas nesta seção.</p></Card>
                  ) : (
                    ps.map((p) => (
                      <RespostaPergunta
                        key={p.id}
                        pergunta={p}
                        respostas={respostasPorPergunta.get(p.id) ?? []}
                        opcoes={opcoesPorPergunta.get(p.id) ?? []}
                        signedUrls={signedUrls}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function RespostaPergunta({
  pergunta,
  respostas,
  opcoes,
  signedUrls,
}: {
  pergunta: Pergunta;
  respostas: Resposta[];
  opcoes: Opcao[];
  signedUrls: Record<string, string>;
}) {
  const respondida = respostas.length > 0;
  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {pergunta.texto}
            {pergunta.obrigatoria && <span className="ml-1 text-destructive">*</span>}
          </p>
          <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">{pergunta.tipo}</p>
        </div>
        {!respondida && (
          <Badge className="bg-muted text-muted-foreground">Sem resposta</Badge>
        )}
      </div>

      {respondida && (
        <div className="space-y-2">
          {respostas.map((r) => (
            <div key={r.id} className="rounded-md border border-border bg-background/40 p-3">
              {r.valor_texto && (
                <p className="whitespace-pre-wrap text-sm text-foreground">{renderValorTexto(r.valor_texto, pergunta, opcoes)}</p>
              )}
              {r.transcricao && (
                <p className="mt-2 text-xs italic text-muted-foreground">"{r.transcricao}"</p>
              )}
              {r.arquivo_path && signedUrls[r.arquivo_path] && (
                <div className="mt-2">
                  {pergunta.tipo === "foto" ? (
                    <img
                      src={signedUrls[r.arquivo_path]}
                      alt="Resposta"
                      className="max-h-64 rounded-md border border-border object-contain"
                    />
                  ) : pergunta.tipo === "audio" ? (
                    <audio controls src={signedUrls[r.arquivo_path]} className="w-full" />
                  ) : (
                    <a
                      href={signedUrls[r.arquivo_path]}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary underline"
                    >
                      Abrir arquivo
                    </a>
                  )}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {r.ia_aprovado === true && (
                  <Badge className="bg-success/15 text-success">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> IA aprovou
                  </Badge>
                )}
                {r.ia_aprovado === false && (
                  <Badge className="bg-destructive/15 text-destructive">
                    <XCircle className="mr-1 h-3 w-3" /> IA reprovou
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground">{fmtData(r.criado_em)}</span>
              </div>
              {r.ia_motivo && (
                <p className="mt-1 text-xs text-muted-foreground">{r.ia_motivo}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function renderValorTexto(valor: string, pergunta: Pergunta, opcoes: Opcao[]): string {
  if (pergunta.tipo === "selecao_unica" && opcoes.length > 0) {
    const found = opcoes.find((o) => o.id === valor);
    if (found) return found.texto;
  }
  if (pergunta.tipo === "toggle") {
    return valor === "true" || valor === "sim" ? "Sim" : "Não";
  }
  return valor;
}
