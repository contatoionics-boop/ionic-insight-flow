import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowDown, ArrowUp, EyeOff, Loader2, Pencil, Plus } from "lucide-react";
import { PageHeader, Card, Button, Input, Modal, Badge } from "@/components/ui-bits";
import { ConfiguracoesNav } from "@/components/ConfiguracoesNav";
import {
  adicionarOpcaoAgendamento,
  listarOpcoesAgendamento,
  salvarOpcaoAgendamento,
  type ListaOpcoes,
} from "@/lib/opcoes-agendamento.functions";
import { CAMPOS_OPCAO, type CampoOpcao, type OpcaoAgendamento } from "@/lib/opcoes-agendamento";
import { recarregarOpcoesAgendamento } from "@/hooks/use-opcoes-agendamento";

export const Route = createFileRoute("/app/opcoes-agendamento")({
  component: OpcoesAgendamentoPage,
  head: () => ({
    meta: [
      { title: "Opções do agendamento | Ionics" },
      { name: "description", content: "Edite as opções de tipo de solicitação, modalidade, nível do mapeamento e solução." },
    ],
  }),
});

type Edicao = { campo: CampoOpcao; valor?: string; rotulo: string; ativo: boolean; ordem: number };

function OpcoesAgendamentoPage() {
  const fnListar = useServerFn(listarOpcoesAgendamento);
  const fnSalvar = useServerFn(salvarOpcaoAgendamento);
  const fnAdicionar = useServerFn(adicionarOpcaoAgendamento);

  const [dados, setDados] = useState<ListaOpcoes | null>(null);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setDados((await fnListar({ data: undefined as never })) as ListaOpcoes);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar as opções.");
    }
  }, [fnListar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const atualizar = () => Promise.all([carregar(), recarregarOpcoesAgendamento()]);

  async function gravar(o: OpcaoAgendamento, patch: Partial<Pick<OpcaoAgendamento, "rotulo" | "ativo" | "ordem">>) {
    await fnSalvar({ data: { campo: o.campo, valor: o.valor, rotulo: patch.rotulo ?? o.rotulo, ativo: patch.ativo ?? o.ativo, ordem: patch.ordem ?? o.ordem } });
  }

  async function confirmar() {
    if (!edicao) return;
    setSalvando(true);
    try {
      if (edicao.valor) {
        const atual = dados!.opcoes.find((x) => x.campo === edicao.campo && x.valor === edicao.valor)!;
        await gravar(atual, { rotulo: edicao.rotulo, ativo: edicao.ativo });
        toast.success("Opção atualizada.");
      } else {
        await fnAdicionar({ data: { campo: edicao.campo, rotulo: edicao.rotulo } });
        toast.success("Opção criada.");
      }
      setEdicao(null);
      await atualizar();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternar(o: OpcaoAgendamento) {
    try {
      await gravar(o, { ativo: !o.ativo });
      await atualizar();
      toast.success(o.ativo ? `"${o.rotulo}" ocultada.` : `"${o.rotulo}" voltou à lista.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar.");
    }
  }

  /** Troca a posição com a vizinha: renumera o campo de 10 em 10 e grava só o que mudou. */
  async function mover(campo: CampoOpcao, indice: number, delta: -1 | 1) {
    const lista = dados!.opcoes.filter((x) => x.campo === campo);
    const alvo = indice + delta;
    if (alvo < 0 || alvo >= lista.length) return;
    const nova = [...lista];
    [nova[indice], nova[alvo]] = [nova[alvo]!, nova[indice]!];
    try {
      for (const [i, o] of nova.entries()) {
        const ordem = (i + 1) * 10;
        if (o.ordem !== ordem) await gravar(o, { ordem });
      }
      await atualizar();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao reordenar.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Opções do agendamento"
        description="As listas usadas ao agendar um mapeamento. Renomeie, oculte, reordene ou crie opções novas sem depender de desenvolvimento."
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
                O banco ainda não recebeu a atualização das opções (migration <code>20261128120000_opcoes_agendamento</code>). Execute o arquivo no SQL Editor do Supabase para
                poder editar. Enquanto isso, valem as opções padrão.
              </p>
            </Card>
          )}

          <p className="text-xs text-muted-foreground">
            Mudar o nome vale em todo o sistema (agenda, listas, documento, agente). O valor gravado nos mapeamentos antigos não muda. Uma opção criada aqui aparece nas listas e como
            condição nos textos padrão; o texto do documento para ela você ajusta em Blocos padrão. Opções já usadas só podem ser ocultadas, não excluídas.
          </p>

          {CAMPOS_OPCAO.map((c) => {
            const lista = dados.opcoes.filter((x) => x.campo === c.campo);
            return (
              <section key={c.campo}>
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">{c.titulo}</h2>
                    <p className="text-xs text-muted-foreground">{c.descricao}</p>
                  </div>
                  <Button variant="secondary" disabled={dados.migracaoPendente} onClick={() => setEdicao({ campo: c.campo, rotulo: "", ativo: true, ordem: 0 })}>
                    <Plus className="mr-1.5 h-4 w-4" /> Nova opção
                  </Button>
                </div>
                <div className="space-y-2">
                  {lista.map((o, i) => (
                    <Card key={o.valor} className="flex flex-wrap items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          {o.rotulo}
                          {o.sistema && <Badge className="bg-muted text-muted-foreground">do sistema</Badge>}
                          {!o.ativo && (
                            <Badge className="bg-muted text-muted-foreground">
                              <EyeOff className="mr-1 h-3 w-3" /> oculta
                            </Badge>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">valor: {o.valor}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button variant="secondary" disabled={i === 0 || dados.migracaoPendente} onClick={() => mover(c.campo, i, -1)} aria-label={`Subir ${o.rotulo}`}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button variant="secondary" disabled={i === lista.length - 1 || dados.migracaoPendente} onClick={() => mover(c.campo, i, 1)} aria-label={`Descer ${o.rotulo}`}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button variant="secondary" disabled={dados.migracaoPendente} onClick={() => setEdicao({ campo: o.campo, valor: o.valor, rotulo: o.rotulo, ativo: o.ativo, ordem: o.ordem })}>
                          <Pencil className="mr-1.5 h-4 w-4" /> Editar
                        </Button>
                        <Button variant="secondary" disabled={dados.migracaoPendente} onClick={() => alternar(o)}>
                          {o.ativo ? "Ocultar" : "Mostrar"}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Modal open={!!edicao} onClose={() => setEdicao(null)} title={edicao?.valor ? "Editar opção" : "Nova opção"}>
        {edicao && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{CAMPOS_OPCAO.find((c) => c.campo === edicao.campo)?.titulo}</p>
            <div>
              <label className="text-xs font-medium">Nome exibido</label>
              <Input value={edicao.rotulo} placeholder="Ex.: Nível 4" onChange={(e) => setEdicao({ ...edicao, rotulo: e.currentTarget.value })} />
            </div>
            {edicao.valor && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={edicao.ativo} onChange={(e) => setEdicao({ ...edicao, ativo: e.currentTarget.checked })} />
                Disponível nas listas
              </label>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setEdicao(null)}>
                Cancelar
              </Button>
              <Button onClick={confirmar} disabled={salvando || !edicao.rotulo.trim()}>
                {salvando ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
