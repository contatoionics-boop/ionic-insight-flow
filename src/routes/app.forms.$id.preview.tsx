import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, Loader2 } from "lucide-react";

import { Button, Card } from "@/components/ui-bits";
import {
  PerguntaBloco,
  isComplete,
  type Pergunta,
  type Resposta,
  type TipoPergunta,
} from "@/components/agent/FormFields";
import { useConfiguracoesEmpresa } from "@/hooks/use-configuracoes-empresa";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/forms/$id/preview")({
  component: FormPreviewPage,
});

type Secao = { id: string; titulo: string; ordem: number; descricao: string | null };

function FormPreviewPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { config } = useConfiguracoesEmpresa();

  const [formNome, setFormNome] = useState<string>("");
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [perguntasPorSecao, setPerguntasPorSecao] = useState<Record<string, Pergunta[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [state, setState] = useState<Record<string, Resposta>>({});

  useEffect(() => {
    (async () => {
      try {
        const { data: f, error: fErr } = await supabase
          .from("formularios")
          .select("nome")
          .eq("id", id)
          .single();
        if (fErr) throw fErr;
        setFormNome(f.nome);

        const { data: secs } = await supabase
          .from("secoes")
          .select("id, titulo, ordem, descricao")
          .eq("formulario_id", id)
          .order("ordem");
        const list = (secs ?? []) as Secao[];
        setSecoes(list);

        if (list.length) {
          const { data: ps } = await supabase
            .from("perguntas")
            .select("id, secao_id, texto, tipo, obrigatoria, ordem, instrucao_agente, contexto_ia")
            .in("secao_id", list.map((s) => s.id))
            .order("ordem");
          const perguntasIds = (ps ?? []).map((p: any) => p.id);
          const { data: ops } = perguntasIds.length
            ? await supabase
                .from("opcoes_pergunta")
                .select("id, pergunta_id, texto, ordem")
                .in("pergunta_id", perguntasIds)
                .order("ordem")
            : { data: [] };
          const opcoesPorPergunta = new Map<string, { id: string; texto: string }[]>();
          for (const o of ops ?? []) {
            const arr = opcoesPorPergunta.get(o.pergunta_id) ?? [];
            arr.push({ id: o.id, texto: o.texto });
            opcoesPorPergunta.set(o.pergunta_id, arr);
          }
          const map: Record<string, Pergunta[]> = {};
          for (const p of ps ?? []) {
            const item: Pergunta = {
              id: p.id,
              secao_id: p.secao_id,
              texto: p.texto,
              tipo: p.tipo as TipoPergunta,
              obrigatoria: p.obrigatoria,
              ordem: p.ordem,
              instrucao_agente: p.instrucao_agente,
              contexto_ia: p.contexto_ia,
              opcoes: opcoesPorPergunta.get(p.id),
            };
            (map[p.secao_id] ??= []).push(item);
          }
          setPerguntasPorSecao(map);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar formulário.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const update = useCallback((perguntaId: string, patch: Partial<Resposta>) => {
    setState((s) => ({ ...s, [perguntaId]: { ...s[perguntaId], ...patch } }));
  }, []);

  const totalSteps = secoes.length;
  const secaoAtual = secoes[step];
  const perguntasAtuais = secaoAtual ? perguntasPorSecao[secaoAtual.id] ?? [] : [];
  const progress = totalSteps ? Math.round(((step + 1) / totalSteps) * 100) : 0;
  const isLast = step >= totalSteps - 1;

  const sectionComplete = useMemo(
    () => perguntasAtuais.every((p) => isComplete(p, state[p.id] ?? {}, "preview")),
    [perguntasAtuais, state],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <Card className="max-w-md text-center">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      </div>
    );
  }

  if (secoes.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white p-6">
        <Card className="max-w-md text-center">
          <p className="text-sm text-muted-foreground">Este formulário ainda não possui seções configuradas.</p>
        </Card>
        <Button variant="outline" onClick={() => navigate({ to: "/app/forms/$id", params: { id } })}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
      </div>
    );
  }

  const nomeEmpresa = config?.nome_empresa || "Ionics";

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-20 border-b border-border bg-white">
        <div className="bg-warning/10 px-4 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-warning-foreground">
          <Eye className="mr-1 inline h-3 w-3" /> Preview — nenhum dado será salvo
        </div>
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {config?.logo_url && (
              <img src={config.logo_url} alt={nomeEmpresa} className="h-7 w-auto object-contain" />
            )}
            <span className="text-lg font-bold tracking-tight text-primary">{nomeEmpresa}</span>
          </div>
          <button
            onClick={() => navigate({ to: "/app/forms/$id", params: { id } })}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Fechar preview
          </button>
        </div>
        <div className="mx-auto max-w-2xl px-4 pb-2">
          <p className="text-sm font-semibold text-foreground">{formNome}</p>
        </div>
        <div className="h-1.5 w-full bg-muted">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2 text-xs">
          <span className="font-medium text-foreground">Seção {step + 1} de {totalSteps}</span>
          <span className="text-muted-foreground">{progress}%</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 pb-32">
        {secaoAtual && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Seção {step + 1}</p>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">{secaoAtual.titulo}</h1>
            {secaoAtual.descricao && (
              <p className="mt-2 text-sm text-muted-foreground">{secaoAtual.descricao}</p>
            )}
            <div className="mt-6 space-y-6">
              {perguntasAtuais.map((p) => (
                <PerguntaBloco
                  key={p.id}
                  pergunta={p}
                  casoId="preview"
                  token="preview"
                  resposta={state[p.id] ?? {}}
                  update={(patch) => update(p.id, patch)}
                  mode="preview"
                />
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 border-t border-border bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} className="h-12">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
          )}
          <Button
            onClick={() => {
              if (isLast) navigate({ to: "/app/forms/$id", params: { id } });
              else setStep((s) => s + 1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            disabled={!sectionComplete}
            className="h-12 flex-1 text-base"
          >
            {isLast ? "Fechar preview" : <>Próxima seção <ArrowRight className="h-4 w-4" /></>}
          </Button>
        </div>
      </footer>
    </div>
  );
}
