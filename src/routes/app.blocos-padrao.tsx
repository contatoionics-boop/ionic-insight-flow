import { IconeExcluir } from "@/components/ui/icones-de-acao";
import { CarregandoConteudo } from "@/components/ui/carregando-conteudo";
import { useTempoDeConteudo } from "@/hooks/use-tempo-de-conteudo";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, Plus } from "lucide-react";
import { PageHeader, Card, Button, Input, Textarea, Modal, Badge } from "@/components/ui-bits";
import { ConfiguracoesNav } from "@/components/ConfiguracoesNav";
import { TextosDoDocumento } from "@/components/laudo/TextosDoDocumento";
import { BibliotecaImagens, imagensDaLista } from "@/components/laudo/BibliotecaImagens";
import { lerSlot } from "@/lib/laudo/textos-padrao";
import { useTiposEscopo } from "@/hooks/use-tipos-escopo";
import { useCamposAgendamento, useOpcoesAgendamento } from "@/hooks/use-opcoes-agendamento";
import { camposExtrasAtivos, opcoesDoCampo, rotuloOpcao } from "@/lib/opcoes-agendamento";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NumericInput } from "@/components/ui/numeric-input";
import { ListaOrdenavel } from "@/components/laudo/ListaOrdenavel";
import { aplicarOrdem, moverNaLista } from "@/lib/ordenar-blocos";
import {
  excluirBlocoPadrao,
  listarBlocosPadrao,
  salvarBlocoPadrao,
  ordenarBlocosPadrao,
  type BlocoPadrao,
} from "@/lib/blocos-padrao.functions";
import {
  POSICOES_BLOCO,
  opcoesExigencia,
  ROTULO_POSICAO,
  lerRegra,
  resumoDaRegra,
  type RegraBlocoPadrao,
} from "@/lib/laudo/blocos-padrao-regras";

function abaValida(aba: unknown) {
  if (aba === "adicionais" || aba === "imagens") return aba;
  return "textos";
}

export const Route = createFileRoute("/app/blocos-padrao")({
  component: BlocosPadraoPage,
  validateSearch: (search: Record<string, unknown>) => ({ aba: abaValida(search.aba) }),
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
  regra: RegraBlocoPadrao;
};

const VAZIO: Form = {
  nome: "",
  descricao: "",
  categoria: "geral",
  titulo_secao: "",
  corpo: "",
  ativo: true,
  ordem: 100,
  regra: { automatico: false, solucao: [], nivel: [], exige: [], extras: {}, posicao: "antes_instrucoes" },
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
  const { aba } = Route.useSearch();
  const navigate = Route.useNavigate();
  const catalogoTipos = useTiposEscopo();
  const opcoesAg = useOpcoesAgendamento();
  const camposAg = useCamposAgendamento();
  const fnListar = useServerFn(listarBlocosPadrao);
  const fnSalvar = useServerFn(salvarBlocoPadrao);
  const fnExcluir = useServerFn(excluirBlocoPadrao);
  const fnOrdenar = useServerFn(ordenarBlocosPadrao);
  const [ordenando, setOrdenando] = useState(false);

  const [itens, setItens] = useState<BlocoPadrao[]>([]);
  const [carregando, setCarregando] = useState(true);
  useTempoDeConteudo("blocos-padrao", carregando);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<Form>(VAZIO);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
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

  // Textos versionados e imagens têm abas próprias.
  const blocosAdicionais = itens.filter((b) => !lerSlot(b.escopo).slot && b.categoria !== "imagem");

  async function ordenar(origem: number, destino: number) {
    if (ordenando) return;
    const ids = moverNaLista(blocosAdicionais, origem, destino).map((b) => b.id);
    setOrdenando(true);
    setItens((atuais) => aplicarOrdem(atuais, ids));
    try {
      await fnOrdenar({ data: { ids } });
      toast.success("Ordem dos blocos salva.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar a ordem.");
      await carregar();
    } finally {
      setOrdenando(false);
    }
  }

  function editar(b: BlocoPadrao, duplicar = false) {
    const titulo = (b.blocos ?? []).find((x: any) => x.tipo === "heading") as any;
    setForm({
      // a cópia nasce sem id (cria outro bloco) e sem inserção automática, para não repetir o texto no documento
      id: duplicar ? undefined : b.id,
      nome: duplicar ? `${b.nome} (cópia)` : b.nome,
      descricao: b.descricao ?? "",
      categoria: b.categoria,
      titulo_secao: titulo?.texto ?? "",
      corpo: corpoDosBlocos(b),
      ativo: b.ativo,
      ordem: b.ordem,
      regra: duplicar ? { ...lerRegra(b.escopo), automatico: false } : lerRegra(b.escopo),
    });
    setAberto(true);
  }

  async function salvar(comoNovo = false) {
    setSalvando(true);
    try {
      await fnSalvar({
        data: {
          id: comoNovo ? undefined : form.id,
          nome: comoNovo && form.nome.trim() === (itens.find((i) => i.id === form.id)?.nome ?? "").trim() ? `${form.nome.trim()} (cópia)` : form.nome,
          descricao: form.descricao || null,
          categoria: form.categoria || "geral",
          titulo_secao: form.titulo_secao || null,
          corpo: form.corpo,
          ativo: form.ativo,
          ordem: Number(form.ordem) || 0,
          regra: form.regra,
        },
      });
      toast.success(comoNovo ? "Novo bloco salvo. O original continua guardado." : "Bloco padrão salvo.");
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
        description="Textos do documento com versões (Introdução, Instruções gerais…) e blocos técnicos reutilizáveis do laudo FR-31-10."
      />
      <ConfiguracoesNav />

      <Tabs value={aba} onValueChange={(value) => void navigate({ search: { aba: abaValida(value) }, resetScroll: false })}>
        <TabsList aria-label="Conteúdo do laudo" className="h-auto w-full flex-wrap justify-start sm:w-auto">
          <TabsTrigger value="textos" className="py-2">Textos do documento</TabsTrigger>
          <TabsTrigger value="adicionais" className="py-2">Blocos adicionais</TabsTrigger>
          <TabsTrigger value="imagens" className="py-2">Biblioteca de imagens</TabsTrigger>
        </TabsList>

        {carregando ? (
          <CarregandoConteudo className="mt-5" />
        ) : (
          <>
            <TabsContent value="textos" className="mt-5">
              <TextosDoDocumento itens={itens} onAlterou={carregar} imagens={imagensDaLista(itens)} />
            </TabsContent>
            <TabsContent value="imagens" className="mt-5">
              <BibliotecaImagens lista={itens} onAlterou={carregar} />
            </TabsContent>
            <TabsContent value="adicionais" className="mt-5">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Blocos adicionais</h2>
                  <p className="text-xs text-muted-foreground">Textos extras inseridos automaticamente no laudo ou pelo especialista durante a revisão.</p>
                </div>
                <Button onClick={() => { setForm(VAZIO); setAberto(true); }}>
                  <Plus className="mr-2 h-4 w-4" /> Novo bloco
                </Button>
              </div>
              {blocosAdicionais.length === 0 ? (
                <Card className="p-6 text-sm text-muted-foreground">
                  Nenhum bloco padrão cadastrado ainda.
                </Card>
              ) : (
                <ListaOrdenavel itens={blocosAdicionais} idDe={(b) => b.id} onMover={(origem, destino) => void ordenar(origem, destino)} disabled={ordenando} render={(b, _i, alca) => (
                    <Card className="flex flex-wrap items-start gap-3 p-4">
                      {alca}
                      <button type="button" className="min-w-0 text-left" onClick={() => editar(b)}>
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          {b.nome}
                          <Badge className="bg-muted text-muted-foreground">{b.categoria}</Badge>
                          {!b.ativo && <Badge className="bg-muted text-muted-foreground">inativo</Badge>}
                          {lerRegra(b.escopo).automatico && <Badge className="bg-primary/10 text-primary">{resumoDaRegra(lerRegra(b.escopo), catalogoTipos)}</Badge>}
                        </p>
                        {b.descricao && <p className="text-xs text-muted-foreground">{b.descricao}</p>}
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {corpoDosBlocos(b)}
                        </p>
                      </button>
                      <div className="ml-auto flex shrink-0 gap-1">
                        <Button variant="secondary" disabled={ordenando} onClick={() => editar(b, true)} aria-label="Duplicar bloco e editar a cópia">
                          <Copy className="mr-1.5 h-4 w-4" /> Duplicar e editar
                        </Button>
                        <Button variant="secondary" disabled={ordenando} onClick={() => excluir(b.id)} aria-label="Excluir bloco">
                          <IconeExcluir />
                        </Button>
                      </div>
                    </Card>
                  )} />
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

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

          <div className="space-y-2 rounded-md border border-border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.regra.automatico}
                onChange={(e) => setForm({ ...form, regra: { ...form.regra, automatico: e.target.checked } })}
              />
              Inserir automaticamente no documento
            </label>
            {form.regra.automatico && (
              <div className="space-y-2 text-xs">
                <p className="text-muted-foreground">
                  O bloco entra na posição escolhida abaixo, quando o mapeamento atender a TODAS as condições marcadas
                  (grupo sem marcação = qualquer). Depois de entrar, o especialista pode editar o texto.
                </p>
                <div>
                  <p className="mb-1 font-medium">Posição no documento</p>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
                    value={form.regra.posicao}
                    onChange={(e) => setForm({ ...form, regra: { ...form.regra, posicao: e.target.value as RegraBlocoPadrao["posicao"] } })}
                  >
                    {POSICOES_BLOCO.map((p) => (
                      <option key={p} value={p}>
                        {ROTULO_POSICAO[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <GrupoMarcas
                  titulo="Solução"
                  opcoes={opcoesDoCampo("solucao", { todas: opcoesAg, incluir: form.regra.solucao }).map((o) => ({ valor: o.valor, rotulo: o.rotulo }))}
                  marcados={form.regra.solucao}
                  onChange={(solucao) => setForm({ ...form, regra: { ...form.regra, solucao } })}
                />
                <GrupoMarcas
                  titulo="Nível de serviço"
                  opcoes={opcoesDoCampo("nivel", { todas: opcoesAg, incluir: form.regra.nivel }).map((o) => ({ valor: o.valor, rotulo: o.rotulo }))}
                  marcados={form.regra.nivel}
                  onChange={(nivel) => setForm({ ...form, regra: { ...form.regra, nivel } })}
                />
                {camposExtrasAtivos(camposAg)
                  .concat(camposAg.filter((c) => !c.sistema && !c.ativo && (form.regra.extras?.[c.campo]?.length ?? 0) > 0))
                  .map((c) => (
                    <GrupoMarcas
                      key={c.campo}
                      titulo={c.titulo}
                      opcoes={opcoesDoCampo(c.campo, { todas: opcoesAg, incluir: form.regra.extras?.[c.campo] }).map((o) => ({ valor: o.valor, rotulo: o.rotulo }))}
                      marcados={form.regra.extras?.[c.campo] ?? []}
                      onChange={(valores) => {
                        const extras = { ...(form.regra.extras ?? {}), [c.campo]: valores };
                        if (!valores.length) delete extras[c.campo];
                        setForm({ ...form, regra: { ...form.regra, extras } });
                      }}
                    />
                  ))}
                <GrupoMarcas
                  titulo="Só quando o Escopo tiver"
                  opcoes={opcoesExigencia(catalogoTipos, form.regra.exige)}
                  marcados={form.regra.exige}
                  onChange={(exige) => setForm({ ...form, regra: { ...form.regra, exige: exige as RegraBlocoPadrao["exige"] } })}
                />
              </div>
            )}
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
            {form.id && (
              <Button variant="secondary" onClick={() => salvar(true)} disabled={salvando || !form.nome || !form.corpo}>
                Salvar como novo bloco
              </Button>
            )}
            <Button onClick={() => salvar(false)} disabled={salvando || !form.nome || !form.corpo}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {form.id ? "Salvar alterações" : "Salvar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function GrupoMarcas({
  titulo,
  opcoes,
  marcados,
  onChange,
}: {
  titulo: string;
  opcoes: { valor: string; rotulo: string }[];
  marcados: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div>
      <p className="mb-1 font-medium">{titulo}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {opcoes.map((o) => (
          <label key={o.valor} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={marcados.includes(o.valor)}
              onChange={(e) => onChange(e.target.checked ? [...marcados, o.valor] : marcados.filter((x) => x !== o.valor))}
            />
            {o.rotulo}
          </label>
        ))}
      </div>
    </div>
  );
}
