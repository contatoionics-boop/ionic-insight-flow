import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { PageHeader, Card, Button, Input, Modal, Badge } from "@/components/ui-bits";
import { ConfiguracoesNav } from "@/components/ConfiguracoesNav";
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

const lista = (s: string) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

function CatalogoEquipamentosPage() {
  const fnListar = useServerFn(listarEquipamentos);
  const fnSalvar = useServerFn(salvarEquipamento);
  const [itens, setItens] = useState<EquipamentoCatalogo[]>([]);
  const [busca, setBusca] = useState("");
  const [somenteManuais, setSomenteManuais] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<Form>(VAZIO);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setItens(await fnListar({ data: { q: busca, somenteManuais } }));
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar o catálogo.");
    } finally {
      setCarregando(false);
    }
  }, [fnListar, busca, somenteManuais]);

  useEffect(() => {
    const t = setTimeout(() => void carregar(), 250);
    return () => clearTimeout(t);
  }, [carregar]);

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
          regra: {
            ...(form.nivel ? { nivel: lista(form.nivel) } : {}),
            ...(form.bitola ? { bitola: lista(form.bitola) } : {}),
            ...(form.tipo_objeto ? { tipo_objeto: lista(form.tipo_objeto) } : {}),
            ...(form.area_classificada ? { area_classificada: true } : {}),
          },
        },
      });
      toast.success("Equipamento salvo.");
      setAberto(false);
      await carregar();
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
        description="Equipamentos IONICS usados nas tabelas do documento. Cadastre equipamentos novos e defina quando cada um deve ser sugerido na tabela Produtos IONICS (o especialista sempre confirma antes de inserir)."
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

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input
          className="max-w-sm"
          placeholder="Buscar por código ou nome"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={somenteManuais} onChange={(e) => setSomenteManuais(e.target.checked)} />
          Só os cadastrados à mão
        </label>
      </div>

      {carregando && itens.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </p>
      ) : itens.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">Nenhum equipamento encontrado.</Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Nome</th>
                <th className="px-3 py-2 text-left">Categoria</th>
                <th className="px-3 py-2 text-left">Sugestão</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {itens.map((e) => {
                const r = e.regra ?? {};
                const regras = [
                  ...(r.nivel ?? []),
                  ...(r.bitola ?? []),
                  ...(r.tipo_objeto ?? []),
                  ...(r.area_classificada ? ["área classificada"] : []),
                ];
                return (
                  <tr key={e.codigo} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{e.codigo}</td>
                    <td className="px-3 py-2">
                      {e.nome}{" "}
                      {e.origem === "manual" && <Badge className="bg-primary/10 text-primary">novo</Badge>}{" "}
                      {!e.ativo && <Badge className="bg-muted text-muted-foreground">inativo</Badge>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{e.categoria ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {e.sugerir
                        ? `Sugerido${regras.length ? `: ${regras.join(", ")}` : " em todos os mapeamentos"}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="secondary" onClick={() => editar(e)}>
                        Editar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Mostrando até 100 itens; refine a busca para ver outros.</p>

      <Modal open={aberto} onClose={() => setAberto(false)} title={form.novo ? "Novo equipamento" : "Editar equipamento"}>
        <div className="space-y-3">
          <div className="grid grid-cols-[10rem_1fr] gap-3">
            <div>
              <label className="text-xs font-medium">Código</label>
              <Input value={form.codigo} disabled={!form.novo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium">Nome</label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
          </div>
          {form.novo && (
            <p className="text-xs text-muted-foreground">
              Use o código do Protheus; sem código ainda, informe um provisório (ex.: NOVO-001).
            </p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium">Categoria</label>
              <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium">Unidade</label>
              <Input value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium">Qtd. padrão</label>
              <NumericInput
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
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="font-medium">Nível</label>
                    <Input placeholder="nivel_1, nivel_2" value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value })} />
                  </div>
                  <div>
                    <label className="font-medium">Bitola</label>
                    <Input placeholder={'3/4", 1"'} value={form.bitola} onChange={(e) => setForm({ ...form, bitola: e.target.value })} />
                  </div>
                  <div>
                    <label className="font-medium">Tipo de objeto</label>
                    <Input
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
