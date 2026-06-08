import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Card, Badge, Button, Select, Label } from "@/components/ui-bits";
import { statusLabels, statusTones, type CaseStatus } from "@/lib/casos";
import {
  obterAgendamento,
  adicionarFormularioAoAgendamento,
  removerCasoDoAgendamento,
} from "@/lib/casos.functions";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, MapPin, Plus, Trash2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/app/agendamento/$id")({
  component: AgendamentoDetalhe,
});

type Form = { id: string; nome: string };
type Caso = { id: string; codigo: string; status: CaseStatus; formulario: { id: string; nome: string } | null };
type Ag = {
  id: string;
  agendado_em: string;
  duracao_min: number;
  endereco_vistoria: string | null;
  observacoes_agendamento: string | null;
  unidade: { id: string; nome: string; matriz: { id: string; nome: string; empresa: { id: string; nome: string } | null } | null } | null;
  casos: Caso[];
};

function fmtData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function AgendamentoDetalhe() {
  const { id } = Route.useParams();
  const obter = useServerFn(obterAgendamento);
  const adicionar = useServerFn(adicionarFormularioAoAgendamento);
  const remover = useServerFn(removerCasoDoAgendamento);

  const [ag, setAg] = useState<Ag | null>(null);
  const [forms, setForms] = useState<Form[]>([]);
  const [novoFormId, setNovoFormId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, f] = await Promise.all([
        obter({ data: { agendamentoId: id } }),
        supabase.from("formularios").select("id, nome").eq("ativo", true).order("nome"),
      ]);
      setAg(a as unknown as Ag);
      setForms((f.data ?? []) as Form[]);
    } catch (e: any) {
      setError(e?.message ?? "Erro ao carregar agendamento.");
    }
  }, [id, obter]);

  useEffect(() => { void load(); }, [load]);

  const addForm = async () => {
    if (!novoFormId) return;
    setWorking(true);
    setError(null);
    try {
      await adicionar({ data: { agendamentoId: id, formId: novoFormId } });
      setNovoFormId("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erro ao adicionar formulário.");
    } finally {
      setWorking(false);
    }
  };

  const removeCaso = async (casoId: string) => {
    if (!confirm("Remover este formulário do agendamento?")) return;
    setWorking(true);
    setError(null);
    try {
      await remover({ data: { casoId } });
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erro ao remover.");
    } finally {
      setWorking(false);
    }
  };

  if (!ag) {
    return (
      <div>
        <PageHeader title="Agendamento" description="Carregando..." />
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
        )}
      </div>
    );
  }

  const formsDisponiveis = forms.filter((f) => !ag.casos.some((c) => c.formulario?.id === f.id));

  return (
    <div>
      <div className="mb-4">
        <Link to="/app/agenda" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar à agenda
        </Link>
      </div>

      <PageHeader
        title={ag.unidade?.matriz?.empresa?.nome ?? "Agendamento"}
        description={ag.unidade?.nome ?? undefined}
      />

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      )}

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {fmtData(ag.agendado_em)} · {ag.duracao_min} min</span>
          {ag.endereco_vistoria && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {ag.endereco_vistoria}</span>}
        </div>
        {ag.observacoes_agendamento && (
          <p className="mt-2 text-xs italic text-muted-foreground">{ag.observacoes_agendamento}</p>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Formulários ({ag.casos.length})</h3>
        <div className="space-y-2">
          {ag.casos.map((c) => {
            const podeRemover = c.status === "agendado" || c.status === "rascunho";
            return (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{c.codigo}</span>
                    <Badge className={statusTones[c.status]}>{statusLabels[c.status]}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-foreground">{c.formulario?.nome ?? "—"}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => removeCaso(c.id)}
                  disabled={!podeRemover || working}
                  title={podeRemover ? "Remover" : "Já iniciado; não pode ser removido"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>

        {formsDisponiveis.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <Label>Adicionar formulário</Label>
            <div className="mt-1 flex gap-2">
              <Select value={novoFormId} onChange={(e) => setNovoFormId(e.target.value)} className="flex-1">
                <option value="">Selecione...</option>
                {formsDisponiveis.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </Select>
              <Button onClick={addForm} disabled={!novoFormId || working}>
                <Plus className="mr-1 h-4 w-4" /> Adicionar
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
