import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { PageHeader, Card, Button, Input, Select, Modal, Badge } from "@/components/ui-bits";
import { ConfiguracoesNav } from "@/components/ConfiguracoesNav";
import {
  excluirMaterial,
  listarMateriais,
  salvarMaterial,
} from "@/lib/catalogo-materiais.functions";
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

const lista = (s: string) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

function CatalogoMateriaisPage() {
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
          regra: {
            ...(form.nivel ? { nivel: lista(form.nivel) } : {}),
            ...(form.bitola ? { bitola: lista(form.bitola) } : {}),
            ...(form.tipo_objeto ? { tipo_objeto: lista(form.tipo_objeto) } : {}),
            ...(form.area_classificada ? { area_classificada: true } : {}),
          },
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

  return (
    <div>
      <PageHeader
        title="Catálogo de materiais"
        description="Materiais de infraestrutura usados nas tabelas dinâmicas do laudo. As regras definem em quais mapeamentos cada item aparece."
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

      {loading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2 text-left">Aplicação</th>
                <th className="px-3 py-2 text-left">Un.</th>
                <th className="px-3 py-2 text-left">Qtd.</th>
                <th className="px-3 py-2 text-left">Regras</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {itens.map((m) => {
                const r = m.regra ?? {};
                const tags = [
                  ...(r.nivel ?? []),
                  ...(r.bitola ?? []),
                  ...(r.tipo_objeto ?? []),
                  ...(r.area_classificada ? ["área classificada"] : []),
                ];
                return (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{m.codigo}</td>
                    <td className="px-3 py-2">
                      <button
                        className="text-left hover:underline"
                        onClick={() => editar(m)}
                        type="button"
                      >
                        {m.descricao}
                      </button>
                      {!m.ativo && (
                        <Badge className="ml-2 bg-muted text-muted-foreground">inativo</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{m.aplicacao ?? "—"}</td>
                    <td className="px-3 py-2">{m.unidade}</td>
                    <td className="px-3 py-2">{m.quantidade_padrao}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {tags.length ? (
                          tags.map((t) => (
                            <Badge key={t} className="bg-primary/10 text-primary">
                              {t}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">sempre</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => excluir(m.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {itens.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Nenhum material cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? "Editar material" : "Novo material"}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium">Código</label>
            <Input
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Unidade</label>
            <Input
              value={form.unidade}
              onChange={(e) => setForm({ ...form, unidade: e.currentTarget.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium">Descrição</label>
            <Input
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.currentTarget.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium">Aplicação</label>
            <Input
              value={form.aplicacao}
              onChange={(e) => setForm({ ...form, aplicacao: e.currentTarget.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Quantidade padrão</label>
            <NumericInput
              min={0}
              value={form.quantidade_padrao}
              onValueChange={(v) => setForm({ ...form, quantidade_padrao: Number(v) })}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Ordem</label>
            <NumericInput
              min={0}
              value={form.ordem}
              onValueChange={(v) => setForm({ ...form, ordem: Number(v) })}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Níveis (separados por vírgula)</label>
            <Input
              placeholder="nivel_2, nivel_3"
              value={form.nivel}
              onChange={(e) => setForm({ ...form, nivel: e.currentTarget.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Bitolas</label>
            <Input
              placeholder='1/2", 3/4"'
              value={form.bitola}
              onChange={(e) => setForm({ ...form, bitola: e.currentTarget.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Tipos de objeto</label>
            <Input
              placeholder="posto, comboio, veiculo"
              value={form.tipo_objeto}
              onChange={(e) => setForm({ ...form, tipo_objeto: e.currentTarget.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Somente área classificada</label>
            <Select
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
            <label className="text-xs font-medium">Ativo</label>
            <Select
              value={form.ativo ? "sim" : "nao"}
              onChange={(e) => setForm({ ...form, ativo: e.currentTarget.value === "sim" })}
            >
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </Select>
          </div>
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
