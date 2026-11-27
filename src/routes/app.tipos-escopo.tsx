import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, EyeOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader, Card, Button, Input, Modal, Badge } from "@/components/ui-bits";
import { ConfiguracoesNav } from "@/components/ConfiguracoesNav";
import {
  contarPerguntasPorTipo,
  excluirTipoEscopo,
  listarTiposEscopo,
  salvarTipoEscopo,
  type CatalogoTipos,
} from "@/lib/escopo-tipos.functions";
import { paisPossiveis, podeOcultarTipo, rotuloDoTipo, type TipoCatalogo } from "@/lib/escopo/catalogo-tipos";
import { recarregarTiposEscopo } from "@/hooks/use-tipos-escopo";

export const Route = createFileRoute("/app/tipos-escopo")({
  component: TiposEscopoPage,
  head: () => ({
    meta: [
      { title: "Tipos de item do escopo | Ionics" },
      { name: "description", content: "Crie, renomeie e oculte os tipos de item do escopo do agendamento (Posto, Comboio, Prédio, Produto…)." },
    ],
  }),
});

type Form = { chave?: string; rotulo: string; plural: string; ativo: boolean; sistema: boolean; pai: string };
const VAZIO: Form = { rotulo: "", plural: "", ativo: true, sistema: false, pai: "" };

function TiposEscopoPage() {
  const fnListar = useServerFn(listarTiposEscopo);
  const fnSalvar = useServerFn(salvarTipoEscopo);
  const fnExcluir = useServerFn(excluirTipoEscopo);
  const fnUso = useServerFn(contarPerguntasPorTipo);
  /** quantas perguntas de formulário usam cada tipo (null = ainda não carregou / indisponível) */
  const [uso, setUso] = useState<Record<string, number> | null>(null);

  const [dados, setDados] = useState<CatalogoTipos | null>(null);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<Form>(VAZIO);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setDados((await fnListar({ data: undefined as never })) as CatalogoTipos);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar os tipos de item.");
    }
  }, [fnListar]);

  useEffect(() => {
    void carregar();
    void fnUso({ data: undefined as never })
      .then((u) => setUso(u))
      .catch(() => setUso(null));
  }, [carregar, fnUso]);

  async function gravar(f: Form) {
    setSalvando(true);
    try {
      await fnSalvar({ data: { chave: f.chave, rotulo: f.rotulo, plural: f.plural || undefined, ativo: f.ativo, pai: f.sistema ? undefined : f.pai || null } });
      await Promise.all([carregar(), recarregarTiposEscopo()]);
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar.");
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function salvarForm() {
    if (await gravar(form)) {
      toast.success(form.chave ? "Tipo de item atualizado." : "Tipo de item criado.");
      setAberto(false);
      setForm(VAZIO);
    }
  }

  async function alternarVisibilidade(t: TipoCatalogo) {
    if (await gravar({ chave: t.chave, rotulo: t.rotulo, plural: t.plural, ativo: !t.ativo, sistema: t.sistema, pai: t.pai ?? "" })) {
      toast.success(t.ativo ? `"${t.rotulo}" ocultado do escopo.` : `"${t.rotulo}" voltou ao escopo.`);
    }
  }

  async function excluir(t: TipoCatalogo) {
    if (!window.confirm(`Excluir o tipo "${t.rotulo}"? Isso não pode ser desfeito. Se ele já tiver sido usado em algum mapeamento, o sistema pede para ocultar em vez de excluir.`)) return;
    try {
      await fnExcluir({ data: { chave: t.chave } });
      await Promise.all([carregar(), recarregarTiposEscopo()]);
      toast.success("Tipo de item excluído.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir.");
    }
  }

  const abrirEdicao = (t: TipoCatalogo) => {
    setForm({ chave: t.chave, rotulo: t.rotulo, plural: t.plural, ativo: t.ativo, sistema: t.sistema, pai: t.pai ?? "" });
    setAberto(true);
  };

  const sistema = (dados?.catalogo ?? []).filter((t) => t.sistema);
  const novos = (dados?.catalogo ?? []).filter((t) => !t.sistema);

  return (
    <div>
      <PageHeader
        title="Tipos de item"
        description="Os itens que aparecem na estrutura do escopo (Posto, Comboio, Prédio, Produto…). Crie novos, renomeie ou oculte os que a operação não usa."
        actions={
          <Button
            onClick={() => {
              setForm(VAZIO);
              setAberto(true);
            }}
            disabled={dados?.migracaoPendente}
          >
            <Plus className="mr-2 h-4 w-4" /> Novo tipo de item
          </Button>
        }
      />
      <ConfiguracoesNav />

      {!dados ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </p>
      ) : (
        <div className="space-y-8">
          {dados.migracaoPendente && (
            <Card className="flex items-start gap-3 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                O banco ainda não recebeu a atualização dos tipos de item (migration <code>20261127120000_escopo_tipos</code>). Execute o arquivo no SQL Editor do
                Supabase para poder criar, renomear e ocultar tipos. Enquanto isso, valem os tipos padrão.
              </p>
            </Card>
          )}

          <section>
            <h2 className="text-sm font-semibold">Criados por você</h2>
            <p className="mb-2 text-xs text-muted-foreground">
              Itens simples: no agendamento você informa a quantidade e, se quiser, uma identificação para cada um (ex.: Prédio A). Eles entram nas perguntas dos formulários
              ("Aplica-se a"), no checklist do agente e no documento.
            </p>
            {novos.length === 0 ? (
              <Card className="p-5 text-sm text-muted-foreground">Nenhum tipo criado ainda. Use "Novo tipo de item" para começar.</Card>
            ) : (
              <div className="space-y-2">
                {novos.map((t) => (
                  <Linha key={t.chave} t={t} catalogo={dados.catalogo} perguntas={uso ? (uso[t.chave] ?? 0) : null} onEditar={() => abrirEdicao(t)} onVisibilidade={() => alternarVisibilidade(t)} onExcluir={() => excluir(t)} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold">Do sistema</h2>
            <p className="mb-2 text-xs text-muted-foreground">
              Só o nome exibido e a visibilidade mudam: a estrutura interna e o documento continuam os mesmos. Para o nome novo valer nos itens já cadastrados, salve o escopo do
              mapeamento de novo.
            </p>
            <div className="space-y-2">
              {sistema.map((t) => (
                <Linha key={t.chave} t={t} perguntas={uso ? (uso[t.chave] ?? 0) : null} onEditar={() => abrirEdicao(t)} onVisibilidade={podeOcultarTipo(t.chave) ? () => alternarVisibilidade(t) : undefined} />
              ))}
            </div>
          </section>
        </div>
      )}

      <Modal open={aberto} onClose={() => setAberto(false)} title={form.chave ? "Editar tipo de item" : "Novo tipo de item"}>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Nome (no singular)</label>
            <Input value={form.rotulo} placeholder="Ex.: Prédio" onChange={(e) => setForm({ ...form, rotulo: e.currentTarget.value })} />
          </div>
          <div>
            <label className="text-xs font-medium">Nome no plural</label>
            <Input value={form.plural} placeholder="Ex.: Prédios" onChange={(e) => setForm({ ...form, plural: e.currentTarget.value })} />
            <p className="mt-1 text-[11px] text-muted-foreground">Usado em títulos e no documento. Em branco, repete o singular.</p>
          </div>
          {!form.sistema && (
            <div>
              <label className="text-xs font-medium">Fica dentro de</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={form.pai}
                onChange={(e) => setForm({ ...form, pai: e.currentTarget.value })}
              >
                <option value="">Nenhum (direto no escopo)</option>
                {paisPossiveis(dados?.catalogo, form.chave ?? "").map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Ex.: "Andar" dentro de "Prédio". No agendamento, cada prédio passa a ter "Quantidade de andares", como cada posto tem suas ilhas.
              </p>
            </div>
          )}
          {(!form.chave || podeOcultarTipo(form.chave)) && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.currentTarget.checked })} />
              Disponível no escopo
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarForm} disabled={salvando || form.rotulo.trim().length < 2}>
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Linha({
  t,
  catalogo,
  perguntas,
  onEditar,
  onVisibilidade,
  onExcluir,
}: {
  t: TipoCatalogo;
  catalogo?: TipoCatalogo[];
  /** perguntas de formulário que usam este tipo em "Aplica-se a"; null = não carregado */
  perguntas: number | null;
  onEditar: () => void;
  onVisibilidade?: () => void;
  onExcluir?: () => void;
}) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {t.rotulo}
          {t.plural !== t.rotulo && <span className="text-xs font-normal text-muted-foreground">({t.plural})</span>}
          {t.sistema && <Badge className="bg-muted text-muted-foreground">do sistema</Badge>}
          {!t.ativo && (
            <Badge className="bg-muted text-muted-foreground">
              <EyeOff className="mr-1 h-3 w-3" /> oculto
            </Badge>
          )}
        </p>
        <p className="text-[11px] text-muted-foreground">
          chave: {t.chave}
          {t.pai ? ` · dentro de ${rotuloDoTipo(catalogo, t.pai)}` : ""}
        </p>
        {perguntas !== null &&
          (perguntas > 0 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {perguntas} {perguntas === 1 ? "pergunta usa" : "perguntas usam"} este tipo em "Aplica-se a".
            </p>
          ) : !t.sistema ? (
            <p className="mt-1 flex items-start gap-1 text-[11px] text-amber-700">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                Nenhuma pergunta usa este tipo, então ele não gera perguntas para o agente. Em Formulários, abra a pergunta e escolha "Aplica-se a: {t.rotulo}"
                (ou use "Aplicar em lote").
              </span>
            </p>
          ) : null)}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button variant="secondary" onClick={onEditar} aria-label={`Editar ${t.rotulo}`}>
          <Pencil className="mr-1.5 h-4 w-4" /> Editar
        </Button>
        {onVisibilidade && (
          <Button variant="secondary" onClick={onVisibilidade}>
            {t.ativo ? "Ocultar" : "Mostrar"}
          </Button>
        )}
        {onExcluir && (
          <Button variant="secondary" onClick={onExcluir} aria-label={`Excluir ${t.rotulo}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}
