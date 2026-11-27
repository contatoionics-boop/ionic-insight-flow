import { CarregandoConteudo } from "@/components/ui/carregando-conteudo";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { PageHeader, Card, Button, Input, Select, Modal, Badge } from "@/components/ui-bits";
import { AcoesCatalogo, DetalhesCatalogoMobile, FiltrosCatalogo, PreviaRegraCatalogo } from "@/components/laudo/CatalogoControles";
import { useOpcoesAgendamento } from "@/hooks/use-opcoes-agendamento";
import { ConfiguracoesNav } from "@/components/ConfiguracoesNav";
import {
  excluirMaterial,
  listarMateriais,
  salvarMaterial,
} from "@/lib/catalogo-materiais.functions";
import { descricaoRegraCatalogo, materialCorrespondeABusca, regraDeCampos } from "@/lib/laudo/catalogos-apresentacao";
import type { MaterialCatalogo } from "@/lib/laudo/regras";
import { NumericInput } from "@/components/ui/numeric-input";

export const Route = createFileRoute("/app/catalogo-materiais")({
  component: CatalogoMateriaisPage,
  head: () => ({
    meta: [
      { title: "Catálogo de materiais | Ionics" },
      {
        name: "description",
        content:
          "Gerencie os materiais de infraestrutura usados nas tabelas dinâmicas do laudo de mapeamento técnico.",
      },
      { property: "og:title", content: "Catálogo de materiais | Ionics" },
      {
        property: "og:description",
        content: "Materiais de infraestrutura e regras de aplicação no laudo técnico.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Form = {
  id?: string;
  codigo: string;
  descricao: string;
  aplicacao: string;
  unidade: string;
  quantidade_padrao: number;
  ativo: boolean;
  ordem: number;
  nivel: string;
  bitola: string;
  tipo_objeto: string;
  area_classificada: boolean;
};

const VAZIO: Form = {
  codigo: "",
  descricao: "",
  aplicacao: "",
  unidade: "un",
  quantidade_padrao: 1,
  ativo: true,
  ordem: 100,
  nivel: "",
  bitola: "",
  tipo_objeto: "",
  area_classificada: false,
};

function CatalogoMateriaisPage() {
  const opcoes = useOpcoesAgendamento();
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState<boolean>();
  const fnListar = useServerFn(listarMateriais);
  const fnSalvar = useServerFn(salvarMaterial);
  const fnExcluir = useServerFn(excluirMaterial);

  const [itens, setItens] = useState<MaterialCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(VAZIO);
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setItens(await fnListar({}));
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar o catálogo.");
    } finally {
      setLoading(false);
    }
  }, [fnListar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function editar(m: MaterialCatalogo) {
    const r = m.regra ?? {};
    setForm({
      id: m.id,
      codigo: m.codigo,
      descricao: m.descricao,
      aplicacao: m.aplicacao ?? "",
      unidade: m.unidade,
      quantidade_padrao: m.quantidade_padrao,
      ativo: m.ativo,
      ordem: m.ordem,
      nivel: (r.nivel ?? []).join(", "),
      bitola: (r.bitola ?? []).join(", "),
      tipo_objeto: (r.tipo_objeto ?? []).join(", "),
      area_classificada: r.area_classificada === true,
    });
    setOpen(true);
  }

  async function salvar() {
    setSaving(true);
    try {
      await fnSalvar({
        data: {
          id: form.id,
          codigo: form.codigo,
          descricao: form.descricao,
          aplicacao: form.aplicacao || null,
          unidade: form.unidade || "un",
          quantidade_padrao: Number(form.quantidade_padrao) || 1,
          ativo: form.ativo,
          ordem: Number(form.ordem) || 100,
          regra: regraDeCampos(form),
        },
      });
      setOpen(false);
      toast.success("Material salvo.");
      await carregar();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar o material.");
    } finally {
      setSaving(false);
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este material do catálogo?")) return;
    try {
      await fnExcluir({ data: { id } });
      toast.success("Material excluído.");
      await carregar();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir.");
    }
  }

  const filtrados = itens.filter((item) => (ativo === undefined || item.ativo === ativo) && materialCorrespondeABusca(item.codigo, item.descricao, busca));

  return (
    <div>
      <PageHeader
        title="Catálogo de materiais"
        description="Gerencie os materiais de infraestrutura sugeridos nas tabelas do laudo."
        actions={
          <Button
            onClick={() => {
              setForm(VAZIO);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Novo material
          </Button>
        }
      />
      <ConfiguracoesNav />
      <FiltrosCatalogo busca={busca} onBusca={setBusca} ativo={ativo} onAtivo={setAtivo} />

      {loading ? (
        <CarregandoConteudo className="p-6" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="hidden px-3 py-2 text-left lg:table-cell">Código</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="hidden px-3 py-2 text-left lg:table-cell">Aplicação</th>
                <th className="hidden px-3 py-2 text-left lg:table-cell">Un.</th>
                <th className="hidden px-3 py-2 text-left lg:table-cell">Qtd.</th>
                <th className="hidden px-3 py-2 text-left lg:table-cell">Quando é sugerido no laudo</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((m) => {
                const resumo = descricaoRegraCatalogo(m.regra, m.ativo, true, opcoes);
                return (
                  <tr key={m.id} className="border-t border-border">
                    <td className="hidden px-3 py-2 font-mono text-xs lg:table-cell">{m.codigo}</td>
                    <td className="px-3 py-2">
                      {m.descricao}
                      {!m.ativo && <Badge className="ml-2 bg-muted text-muted-foreground">Inativo</Badge>}
                      <DetalhesCatalogoMobile codigo={m.codigo} resumo={resumo}>
                        {m.aplicacao && <p>{m.aplicacao}</p>}
                        <p>{m.quantidade_padrao} {m.unidade}</p>
                      </DetalhesCatalogoMobile>
                    </td>
                    <td className="hidden px-3 py-2 text-muted-foreground lg:table-cell">{m.aplicacao ?? "—"}</td>
                    <td className="hidden px-3 py-2 lg:table-cell">{m.unidade}</td>
                    <td className="hidden px-3 py-2 lg:table-cell">{m.quantidade_padrao}</td>
                    <td className="hidden min-w-44 px-3 py-2 text-xs text-muted-foreground lg:table-cell">
                      {resumo}
                    </td>
                    <td className="px-3 py-2">
                      <AcoesCatalogo nome={m.descricao} onEditar={() => editar(m)} onExcluir={() => void excluir(m.id)} />
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {busca.trim() || ativo !== undefined ? "Nenhum material corresponde aos filtros." : "Nenhum material cadastrado."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? "Editar material" : "Novo material"}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium" htmlFor="material-codigo">Código</label>
            <Input id="material-codigo"
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium" htmlFor="material-unidade">Unidade</label>
            <Input id="material-unidade"
              value={form.unidade}
              onChange={(e) => setForm({ ...form, unidade: e.currentTarget.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium" htmlFor="material-descricao">Descrição</label>
            <Input id="material-descricao"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.currentTarget.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium" htmlFor="material-aplicacao">Aplicação</label>
            <Input id="material-aplicacao"
              value={form.aplicacao}
              onChange={(e) => setForm({ ...form, aplicacao: e.currentTarget.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium" htmlFor="material-quantidade_padrao">Quantidade padrão</label>
            <NumericInput id="material-quantidade_padrao"
              min={0}
              value={form.quantidade_padrao}
              onValueChange={(v) => setForm({ ...form, quantidade_padrao: Number(v) })}
            />
          </div>
          <div>
            <label className="text-xs font-medium" htmlFor="material-ordem">Ordem</label>
            <NumericInput id="material-ordem"
              min={0}
              value={form.ordem}
              onValueChange={(v) => setForm({ ...form, ordem: Number(v) })}
            />
          </div>
          <div>
            <label className="text-xs font-medium" htmlFor="material-nivel">Níveis (separados por vírgula)</label>
            <Input id="material-nivel"
              placeholder="nivel_2, nivel_3"
              value={form.nivel}
              onChange={(e) => setForm({ ...form, nivel: e.currentTarget.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium" htmlFor="material-bitola">Bitolas</label>
            <Input id="material-bitola"
              placeholder='1/2", 3/4"'
              value={form.bitola}
              onChange={(e) => setForm({ ...form, bitola: e.currentTarget.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium" htmlFor="material-tipo_objeto">Tipos de objeto</label>
            <Input id="material-tipo_objeto"
              placeholder="posto, comboio, veiculo"
              value={form.tipo_objeto}
              onChange={(e) => setForm({ ...form, tipo_objeto: e.currentTarget.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium" htmlFor="material-area_classificada">Somente área classificada</label>
            <Select id="material-area_classificada"
              value={form.area_classificada ? "sim" : "nao"}
              onChange={(e) =>
                setForm({ ...form, area_classificada: e.currentTarget.value === "sim" })
              }
            >
              <option value="nao">Não</option>
              <option value="sim">Sim</option>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium" htmlFor="material-ativo">Ativo</label>
            <Select id="material-ativo"
              value={form.ativo ? "sim" : "nao"}
              onChange={(e) => setForm({ ...form, ativo: e.currentTarget.value === "sim" })}
            >
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </Select>
          </div>
        </div>
        <div className="mt-4">
          <PreviaRegraCatalogo resumo={descricaoRegraCatalogo(regraDeCampos(form), form.ativo, true, opcoes)} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={saving || !form.codigo || !form.descricao}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
