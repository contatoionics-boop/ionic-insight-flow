import { CarregandoConteudo } from "@/components/ui/carregando-conteudo";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { PageHeader, Card, Button, Input, Modal, Badge } from "@/components/ui-bits";
import { AcoesCatalogo, DetalhesCatalogoMobile, FiltrosCatalogo, PreviaRegraCatalogo } from "@/components/laudo/CatalogoControles";
import { useOpcoesAgendamento } from "@/hooks/use-opcoes-agendamento";
import { ConfiguracoesNav } from "@/components/ConfiguracoesNav";
import { descricaoRegraCatalogo, regraDeCampos } from "@/lib/laudo/catalogos-apresentacao";
import { NumericInput } from "@/components/ui/numeric-input";
import { listarEquipamentos, salvarEquipamento, type EquipamentoCatalogo } from "@/lib/equipamentos-catalogo.functions";

export const Route = createFileRoute("/app/catalogo-equipamentos")({
  component: CatalogoEquipamentosPage,
  head: () => ({
    meta: [
      { title: "Catálogo de equipamentos | Ionics" },
      { name: "description", content: "Equipamentos IONICS cadastráveis e regras de sugestão no Resultado de Mapeamento Técnico." },
    ],
  }),
});

type Form = {
  novo: boolean;
  codigo: string;
  nome: string;
  categoria: string;
  unidade: string;
  quantidade_padrao: number;
  ativo: boolean;
  sugerir: boolean;
  nivel: string;
  bitola: string;
  tipo_objeto: string;
  area_classificada: boolean;
};

const VAZIO: Form = {
  novo: true,
  codigo: "",
  nome: "",
  categoria: "",
  unidade: "un",
  quantidade_padrao: 1,
  ativo: true,
  sugerir: false,
  nivel: "",
  bitola: "",
  tipo_objeto: "",
  area_classificada: false,
};

function CatalogoEquipamentosPage() {
  const opcoes = useOpcoesAgendamento();
  const [ativo, setAtivo] = useState<boolean>();
  const [atualizacao, setAtualizacao] = useState(0);
  const fnListar = useServerFn(listarEquipamentos);
  const fnSalvar = useServerFn(salvarEquipamento);
  const [itens, setItens] = useState<EquipamentoCatalogo[]>([]);
  const [busca, setBusca] = useState("");
  const [somenteManuais, setSomenteManuais] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<Form>(VAZIO);
  const [salvando, setSalvando] = useState(false);

  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setCarregando(true);
    setErro(null);
    const consulta = window.setTimeout(async () => {
      try {
        const resultado = await fnListar({ data: { q: busca, somenteManuais, ativo } });
        if (vigente) setItens(resultado);
      } catch (error) {
        if (vigente) setErro(error instanceof Error ? error.message : "Falha ao carregar o catálogo.");
      } finally {
        if (vigente) setCarregando(false);
      }
    }, busca ? 250 : 0);
    return () => {
      vigente = false;
      window.clearTimeout(consulta);
    };
  }, [fnListar, busca, somenteManuais, ativo, atualizacao]);

  function editar(e: EquipamentoCatalogo) {
    const r = e.regra ?? {};
    setForm({
      novo: false,
      codigo: e.codigo,
      nome: e.nome,
      categoria: e.categoria ?? "",
      unidade: e.unidade || "un",
      quantidade_padrao: e.quantidade_padrao,
      ativo: e.ativo,
      sugerir: e.sugerir,
      nivel: (r.nivel ?? []).join(", "),
      bitola: (r.bitola ?? []).join(", "),
      tipo_objeto: (r.tipo_objeto ?? []).join(", "),
      area_classificada: r.area_classificada === true,
    });
    setAberto(true);
  }

  async function salvar() {
    setSalvando(true);
    try {
      await fnSalvar({
        data: {
          codigo: form.codigo,
          nome: form.nome,
          categoria: form.categoria || null,
          unidade: form.unidade || "un",
          quantidade_padrao: Number(form.quantidade_padrao) || 1,
          ativo: form.ativo,
          sugerir: form.sugerir,
          somenteNovo: form.novo,
          regra: regraDeCampos(form),
        },
      });
      toast.success("Equipamento salvo.");
      setAberto(false);
      setAtualizacao((anterior) => anterior + 1);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Catálogo de equipamentos"
        description="Gerencie os equipamentos sugeridos na tabela Produtos IONICS do laudo."
        actions={
          <Button
            onClick={() => {
              setForm(VAZIO);
              setAberto(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Novo equipamento
          </Button>
        }
      />
      <ConfiguracoesNav />

      <FiltrosCatalogo busca={busca} onBusca={setBusca} ativo={ativo} onAtivo={setAtivo}>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={somenteManuais} onChange={(e) => setSomenteManuais(e.target.checked)} />
          Só os cadastrados à mão
        </label>
      </FiltrosCatalogo>

      {carregando ? (
        <CarregandoConteudo className="p-6" />
      ) : erro ? (
        <Card className="space-y-2 p-6 text-sm">
          <p role="alert">{erro}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setAtualizacao((anterior) => anterior + 1)}>Tentar novamente</Button>
        </Card>
      ) : itens.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">{busca.trim() || ativo !== undefined || somenteManuais ? "Nenhum equipamento corresponde aos filtros." : "Nenhum equipamento cadastrado."}</Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="hidden px-3 py-2 text-left lg:table-cell">Código</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="hidden px-3 py-2 text-left lg:table-cell">Categoria</th>
                <th className="hidden px-3 py-2 text-left lg:table-cell">Quando é sugerido no laudo</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((e) => {
                const resumo = descricaoRegraCatalogo(e.regra, e.ativo, e.sugerir, opcoes);
                return (
                  <tr key={e.codigo} className="border-t border-border">
                    <td className="hidden px-3 py-2 font-mono text-xs lg:table-cell">{e.codigo}</td>
                    <td className="px-3 py-2">
                      {e.nome}{" "}
                      {e.origem === "manual" && <Badge className="bg-primary/10 text-primary">Manual</Badge>}{" "}
                      {!e.ativo && <Badge className="bg-muted text-muted-foreground">Inativo</Badge>}
                      <DetalhesCatalogoMobile codigo={e.codigo} resumo={resumo}>
                        {e.categoria && <p>{e.categoria}</p>}
                      </DetalhesCatalogoMobile>
                    </td>
                    <td className="hidden px-3 py-2 text-muted-foreground lg:table-cell">{e.categoria ?? "—"}</td>
                    <td className="hidden min-w-44 px-3 py-2 text-xs text-muted-foreground lg:table-cell">
                      {resumo}
                    </td>
                    <td className="px-3 py-2">
                      <AcoesCatalogo nome={e.nome} onEditar={() => editar(e)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!carregando && !erro && itens.length === 100 && <p className="mt-2 text-xs text-muted-foreground">100 itens exibidos. Refine a busca para ver outros.</p>}

      <Modal open={aberto} onClose={() => setAberto(false)} title={form.novo ? "Novo equipamento" : "Editar equipamento"}>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <div>
              <label className="text-xs font-medium" htmlFor="equipamento-codigo">Código</label>
              <Input id="equipamento-codigo" value={form.codigo} disabled={!form.novo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium" htmlFor="equipamento-nome">Nome</label>
              <Input id="equipamento-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
          </div>
          {form.novo && (
            <p className="text-xs text-muted-foreground">
              Use o código do Protheus; sem código ainda, informe um provisório (ex.: NOVO-001).
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium" htmlFor="equipamento-categoria">Categoria</label>
              <Input id="equipamento-categoria" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium" htmlFor="equipamento-unidade">Unidade</label>
              <Input id="equipamento-unidade" value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium" htmlFor="equipamento-quantidade_padrao">Qtd. padrão</label>
              <NumericInput id="equipamento-quantidade_padrao"
                min={0}
                value={String(form.quantidade_padrao)}
                onValueChange={(v) => setForm({ ...form, quantidade_padrao: Number(v) })}
              />
            </div>
          </div>
          <div className="space-y-2 rounded-md border border-border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={form.sugerir} onChange={(e) => setForm({ ...form, sugerir: e.target.checked })} />
              Sugerir na tabela Produtos IONICS
            </label>
            {form.sugerir && (
              <div className="space-y-2 text-xs">
                <p className="text-muted-foreground">
                  Deixe em branco para sugerir em todos os mapeamentos. Separe valores por vírgula.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="font-medium" htmlFor="equipamento-nivel">Nível</label>
                    <Input id="equipamento-nivel" placeholder="nivel_1, nivel_2" value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value })} />
                  </div>
                  <div>
                    <label className="font-medium" htmlFor="equipamento-bitola">Bitola</label>
                    <Input id="equipamento-bitola" placeholder={'3/4", 1"'} value={form.bitola} onChange={(e) => setForm({ ...form, bitola: e.target.value })} />
                  </div>
                  <div>
                    <label className="font-medium" htmlFor="equipamento-tipo_objeto">Tipo de objeto</label>
                    <Input id="equipamento-tipo_objeto"
                      placeholder="pista, comboio"
                      value={form.tipo_objeto}
                      onChange={(e) => setForm({ ...form, tipo_objeto: e.target.value })}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.area_classificada}
                    onChange={(e) => setForm({ ...form, area_classificada: e.target.checked })}
                  />
                  Só em área classificada
                </label>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
            Ativo
          </label>
          <PreviaRegraCatalogo resumo={descricaoRegraCatalogo(regraDeCampos(form), form.ativo, form.sugerir, opcoes)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando || form.codigo.trim().length < 2 || form.nome.trim().length < 2}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
