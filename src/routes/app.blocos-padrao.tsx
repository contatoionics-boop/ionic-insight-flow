import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { PageHeader, Card, Button, Input, Textarea, Modal, Badge } from "@/components/ui-bits";
import { ConfiguracoesNav } from "@/components/ConfiguracoesNav";
import { NumericInput } from "@/components/ui/numeric-input";
import {
  excluirBlocoPadrao,
  listarBlocosPadrao,
  salvarBlocoPadrao,
  type BlocoPadrao,
} from "@/lib/blocos-padrao.functions";

export const Route = createFileRoute("/app/blocos-padrao")({
  component: BlocosPadraoPage,
  head: () => ({
    meta: [
      { title: "Blocos padrão do laudo | Ionics" },
      {
        name: "description",
        content:
          "Biblioteca de textos técnicos reutilizáveis para inserir no Resultado de Mapeamento Técnico FR-31-10.",
      },
      { property: "og:title", content: "Blocos padrão do laudo | Ionics" },
      {
        property: "og:description",
        content: "Textos técnicos reutilizáveis para o laudo estruturado FR-31-10.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Form = {
  id?: string;
  nome: string;
  descricao: string;
  categoria: string;
  titulo_secao: string;
  corpo: string;
  ativo: boolean;
  ordem: number;
};

const VAZIO: Form = {
  nome: "",
  descricao: "",
  categoria: "geral",
  titulo_secao: "",
  corpo: "",
  ativo: true,
  ordem: 100,
};

function corpoDosBlocos(b: BlocoPadrao): string {
  return (b.blocos ?? [])
    .map((bl: any) => {
      if (bl.tipo === "bullets") return (bl.itens ?? []).map((i: string) => `- ${i}`).join("\n");
      if (bl.tipo === "paragraph") return bl.texto ?? "";
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function BlocosPadraoPage() {
  const fnListar = useServerFn(listarBlocosPadrao);
  const fnSalvar = useServerFn(salvarBlocoPadrao);
  const fnExcluir = useServerFn(excluirBlocoPadrao);

  const [itens, setItens] = useState<BlocoPadrao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<Form>(VAZIO);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setItens((await fnListar({ data: {} as any })) as BlocoPadrao[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar os blocos padrão.");
    } finally {
      setCarregando(false);
    }
  }, [fnListar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function editar(b: BlocoPadrao) {
    const titulo = (b.blocos ?? []).find((x: any) => x.tipo === "heading") as any;
    setForm({
      id: b.id,
      nome: b.nome,
      descricao: b.descricao ?? "",
      categoria: b.categoria,
      titulo_secao: titulo?.texto ?? "",
      corpo: corpoDosBlocos(b),
      ativo: b.ativo,
      ordem: b.ordem,
    });
    setAberto(true);
  }

  async function salvar() {
    setSalvando(true);
    try {
      await fnSalvar({
        data: {
          id: form.id,
          nome: form.nome,
          descricao: form.descricao || null,
          categoria: form.categoria || "geral",
          titulo_secao: form.titulo_secao || null,
          corpo: form.corpo,
          ativo: form.ativo,
          ordem: Number(form.ordem) || 0,
        },
      });
      toast.success("Bloco padrão salvo.");
      setAberto(false);
      setForm(VAZIO);
      await carregar();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este bloco padrão?")) return;
    try {
      await fnExcluir({ data: { id } });
      setItens((l) => l.filter((i) => i.id !== id));
      toast.success("Bloco excluído.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Blocos padrão"
        description="Textos técnicos reutilizáveis para inserir no laudo FR-31-10 durante a revisão."
        actions={
          <Button
            onClick={() => {
              setForm(VAZIO);
              setAberto(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Novo bloco
          </Button>
        }
      />
      <ConfiguracoesNav />

      {carregando ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </p>
      ) : itens.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Nenhum bloco padrão cadastrado ainda.
        </Card>
      ) : (
        <div className="space-y-2">
          {itens.map((b) => (
            <Card key={b.id} className="flex items-start justify-between gap-3 p-4">
              <button type="button" className="min-w-0 text-left" onClick={() => editar(b)}>
                <p className="flex items-center gap-2 text-sm font-medium">
                  {b.nome}
                  <Badge className="bg-muted text-muted-foreground">{b.categoria}</Badge>
                  {!b.ativo && <Badge className="bg-muted text-muted-foreground">inativo</Badge>}
                </p>
                {b.descricao && <p className="text-xs text-muted-foreground">{b.descricao}</p>}
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {corpoDosBlocos(b)}
                </p>
              </button>
              <Button variant="secondary" onClick={() => excluir(b.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={aberto}
        onClose={() => setAberto(false)}
        title={form.id ? "Editar bloco padrão" : "Novo bloco padrão"}
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Nome</label>
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Descrição</label>
            <Input
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.currentTarget.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Categoria</label>
              <Input
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.currentTarget.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Ordem</label>
              <NumericInput
                min={0}
                value={String(form.ordem)}
                onValueChange={(v) => setForm({ ...form, ordem: Number(v) })}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Título da seção (opcional)</label>
            <Input
              value={form.titulo_secao}
              onChange={(e) => setForm({ ...form, titulo_secao: e.currentTarget.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium">
              Conteúdo (uma linha por parágrafo; comece com "- " para itens de lista)
            </label>
            <Textarea
              rows={10}
              value={form.corpo}
              onChange={(e) => setForm({ ...form, corpo: e.currentTarget.value })}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            />
            Ativo
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando || !form.nome || !form.corpo}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
