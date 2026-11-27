import { IconeEditar, IconeExcluir } from "@/components/ui/icones-de-acao";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Copy, Loader2 } from "lucide-react";
import { ListaOrdenavel } from "./ListaOrdenavel";
import { moverNaLista } from "@/lib/ordenar-blocos";
import { normalizarOrdemSecoes } from "@/lib/laudo/ordem-secoes";
import { Badge, Button, Card, Input, Modal } from "@/components/ui-bits";
import { EditorBlocos } from "@/components/laudo/EditorBlocos";
import { semMarcas } from "@/lib/laudo/texto-formatado";
import { carregarOrdemSecoes, salvarOrdemSecoes, excluirBlocoPadrao, salvarBlocoPadrao, type BlocoPadrao } from "@/lib/blocos-padrao.functions";
import { lerRegra, opcoesExigencia, rotuloExigencia, type RegraBlocoPadrao } from "@/lib/laudo/blocos-padrao-regras";
import { useTiposEscopo } from "@/hooks/use-tipos-escopo";
import { useCamposAgendamento, useOpcoesAgendamento } from "@/hooks/use-opcoes-agendamento";
import { camposAtuais, camposExtrasAtivos, opcoesDoCampo, rotuloOpcao } from "@/lib/opcoes-agendamento";
import type { TipoCatalogo } from "@/lib/escopo/catalogo-tipos";
import {
  INFO_SLOT,
  SLOTS_TEXTO,
  TEXTO_ORIGINAL,
  blocosParaItens,
  itensParaCorpo,
  lerSlot,
  nomeDaNovaVersao,
  type ImagemBiblioteca,
  type ItemTexto,
  type SlotTexto,
} from "@/lib/laudo/textos-padrao";

/** O texto de uma versão em linhas simples (sem as marcas de formatação), para a lista. */
function resumoItens(itens: ItemTexto[]): string {
  return itens
    .map((i) => (i.tipo === "paragraph" ? (i.rico ? semMarcas(i.texto) : i.texto) : i.tipo === "bullets" ? i.itens.map((x) => `- ${i.rico ? semMarcas(x) : x}`).join("\n") : i.tipo === "tabela" ? `[tabela${i.titulo ? `: ${i.titulo}` : ""}]` : "[imagem]"))
    .filter(Boolean)
    .join("\n\n");
}

/** Há algo para salvar? (parágrafo ou lista com texto, ou uma imagem) */
const temConteudo = (itens: ItemTexto[]) =>
  itens.some((i) => (i.tipo === "paragraph" ? !!i.texto.trim() : i.tipo === "bullets" ? i.itens.some((x) => x.trim()) : true));

type Form = {
  id?: string;
  slot: SlotTexto;
  nome: string;
  itens: ItemTexto[];
  padrao: boolean;
  ativo: boolean;
  ordem: number;
  regra: Pick<RegraBlocoPadrao, "solucao" | "nivel" | "exige" | "extras">;
  /** versão aberta para edição (permite "Salvar como nova versão" sem perder a original) */
  origem?: BlocoPadrao;
};

const SEM_CONDICAO = { solucao: [], nivel: [], exige: [], extras: {} } as Form["regra"];

/** O que vale quando não há versão cadastrada, para os textos que não têm um "original" em texto corrido. */
const SEM_ORIGINAL: Partial<Record<SlotTexto, string>> = {
  consideracoes_finais: "este texto não aparece no documento.",
  tx: "a seção mostra um espaço a confirmar para o especialista preencher.",
};

/** "On-premise · Nível 2 · com Cartão RFID" (vazio = qualquer caso) */
function condicaoEmTexto(escopo: Record<string, any> | null, catalogo?: TipoCatalogo[]): string {
  const r = lerRegra(escopo);
  const partes: string[] = [];
  if (r.solucao.length) partes.push(r.solucao.map((s) => rotuloOpcao("solucao", s) ?? s).join(" ou "));
  if (r.nivel.length) partes.push(r.nivel.map((n) => rotuloOpcao("nivel", n) ?? n).join(" ou "));
  if (r.exige.length) partes.push(`com ${r.exige.map((x) => rotuloExigencia(x, catalogo)).join(" e ")}`);
  for (const [campo, valores] of Object.entries(r.extras ?? {})) {
    partes.push(`${camposAtuais().find((c) => c.campo === campo)?.titulo ?? campo}: ${valores.map((v) => rotuloOpcao(campo, v) ?? v).join(" ou ")}`);
  }
  return partes.length ? partes.join(" · ") : "qualquer mapeamento";
}

/** Textos fixos do documento com versões: o especialista salva, duplica e define qual vale como padrão. */
export function TextosDoDocumento({ itens, onAlterou, imagens }: { itens: BlocoPadrao[]; onAlterou: () => void | Promise<void>; imagens: ImagemBiblioteca[] }) {
  const catalogoTipos = useTiposEscopo();
  const opcoesAg = useOpcoesAgendamento();
  const fnSalvar = useServerFn(salvarBlocoPadrao);
  const fnExcluir = useServerFn(excluirBlocoPadrao);
  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);
  const fnCarregarOrdem = useServerFn(carregarOrdemSecoes);
  const fnSalvarOrdem = useServerFn(salvarOrdemSecoes);
  const [slots, setSlots] = useState<SlotTexto[]>([...SLOTS_TEXTO]);
  const [ordenando, setOrdenando] = useState(false);
  const [ordemPronta, setOrdemPronta] = useState(false);
  useEffect(() => {
    let ativo = true;
    fnCarregarOrdem().then((ordem) => {
      if (!ativo) return;
      setSlots(normalizarOrdemSecoes(ordem));
      setOrdemPronta(true);
    }).catch(() => { if (ativo) toast.error("Não foi possível carregar a ordem. Recarregue esta tela para tentar novamente."); });
    return () => { ativo = false; };
  }, [fnCarregarOrdem]);

  async function reposicionar(origem: number, destino: number) {
    if (ordenando || !ordemPronta) return;
    const anteriores = slots;
    const novos = moverNaLista(slots, origem, destino);
    if (novos === slots) return;
    setOrdenando(true);
    setSlots(novos);
    try {
      await fnSalvarOrdem({ data: { slots: novos } });
      toast.success("Ordem das seções salva para o documento e PDF.");
    } catch (e: any) {
      setSlots(anteriores);
      toast.error(e?.message ?? "Não foi possível salvar a ordem.");
    } finally { setOrdenando(false); }
  }

  const versoesDe = (slot: SlotTexto) => itens.filter((b) => lerSlot(b.escopo).slot === slot);

  function nova(slot: SlotTexto) {
    setForm({ slot, nome: "", itens: JSON.parse(JSON.stringify(TEXTO_ORIGINAL[slot])) as ItemTexto[], padrao: false, ativo: true, ordem: 100, regra: SEM_CONDICAO });
  }
  function abrir(b: BlocoPadrao, duplicar = false) {
    const { slot, padrao } = lerSlot(b.escopo);
    if (!slot) return;
    const r = lerRegra(b.escopo);
    setForm({
      id: duplicar ? undefined : b.id,
      slot,
      nome: duplicar ? `${b.nome} (cópia)` : b.nome,
      itens: blocosParaItens(b.blocos),
      // a cópia nasce fora do padrão: o especialista decide quando passa a valer
      padrao: duplicar ? false : padrao,
      ativo: b.ativo,
      ordem: b.ordem,
      regra: { solucao: r.solucao, nivel: r.nivel, exige: r.exige, extras: r.extras ?? {} },
      origem: duplicar ? undefined : b,
    });
  }

  /**
   * `comoNova`: grava uma versão nova a partir do que está na tela e mantém a original guardada.
   * Se a nova passa a ser a padrão, a anterior deixa de ser (continua disponível para escolher em um mapeamento).
   */
  async function salvar(comoNova = false) {
    if (!form) return;
    setSalvando(true);
    try {
      const dados = {
        descricao: null,
        categoria: "texto",
        corpo: "",
        itens: form.itens,
        ativo: form.ativo,
        ordem: Number(form.ordem) || 0,
        slot: form.slot,
        padrao: form.padrao,
        regra: { automatico: false, ...form.regra },
      };
      if (comoNova) {
        const existentes = versoesDe(form.slot).map((b) => b.nome);
        const nome = form.nome.trim() === form.origem?.nome.trim() ? nomeDaNovaVersao(form.nome, existentes) : form.nome;
        await fnSalvar({ data: { ...dados, nome } });
        const anterior = form.origem;
        if (anterior && form.padrao && lerSlot(anterior.escopo).padrao) {
          const r = lerRegra(anterior.escopo);
          await fnSalvar({
            data: {
              id: anterior.id, nome: anterior.nome, descricao: anterior.descricao, categoria: "texto", corpo: "", itens: blocosParaItens(anterior.blocos),
              ativo: anterior.ativo, ordem: anterior.ordem, slot: form.slot, padrao: false, regra: { automatico: false, solucao: r.solucao, nivel: r.nivel, exige: r.exige, extras: r.extras ?? {} },
            },
          });
          toast.success(`Nova versão "${nome}" salva como padrão. A anterior continua guardada (use-a escolhendo no mapeamento).`);
        } else {
          toast.success(`Nova versão "${nome}" salva. A original continua guardada.`);
        }
      } else {
        await fnSalvar({ data: { ...dados, id: form.id, nome: form.nome } });
        toast.success("Versão salva.");
      }
      setForm(null);
      await onAlterou();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar a versão.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(b: BlocoPadrao) {
    if (!confirm(`Excluir a versão "${b.nome}"? Mapeamentos que a usam voltam para o texto padrão.`)) return;
    try {
      await fnExcluir({ data: { id: b.id } });
      toast.success("Versão excluída.");
      await onAlterou();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir.");
    }
  }

  // campos criados em Opções do agendamento: cada um vira um grupo de condições
  const camposAg = useCamposAgendamento();
  const marcarExtra = (campo: string, valor: string, ligado: boolean) => {
    if (!form) return;
    const atuais = form.regra.extras?.[campo] ?? [];
    const novos = ligado ? [...atuais, valor] : atuais.filter((x) => x !== valor);
    const extras = { ...(form.regra.extras ?? {}), [campo]: novos };
    if (!novos.length) delete extras[campo];
    setForm({ ...form, regra: { ...form.regra, extras } });
  };
  const marcar = (grupo: "solucao" | "nivel" | "exige", valor: string, ligado: boolean) => {
    if (!form) return;
    const atuais = form.regra[grupo] as string[];
    setForm({ ...form, regra: { ...form.regra, [grupo]: ligado ? [...atuais, valor] : atuais.filter((x) => x !== valor) } });
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Textos do documento</h2>
        <p className="text-xs text-muted-foreground">
          Cada texto fixo do Resultado de Mapeamento pode ter várias versões. A versão marcada como <b>padrão</b> (e cujas condições o mapeamento atende) entra
          sozinha; sem nenhuma, vale o texto original do sistema. Para um mapeamento específico, troque a versão na aba Documento (“Textos do documento”).
        </p>
      </div>

      <ListaOrdenavel itens={slots} idDe={(slot) => slot} disabled={ordenando || !ordemPronta} onMover={(origem, destino) => void reposicionar(origem, destino)} render={(slot, indice, alca) => {
        const versoes = versoesDe(slot);
        const original = itensParaCorpo(TEXTO_ORIGINAL[slot]);
        return (
          <Card className="space-y-3 p-4">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 sm:flex">
              {alca}
              <div className="min-w-0 sm:flex-1">
                <p className="text-sm font-medium">{INFO_SLOT[slot].rotulo}</p>
                <p className="text-xs text-muted-foreground">{INFO_SLOT[slot].descricao}</p>
              </div>
              <div className="col-start-2 flex flex-wrap items-center gap-1 sm:shrink-0">
                <Button type="button" variant="ghost" size="sm" title="Subir seção" aria-label={`Subir seção ${INFO_SLOT[slot].rotulo}`} disabled={ordenando || !ordemPronta || indice === 0} onClick={() => void reposicionar(indice, indice - 1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="sm" title="Descer seção" aria-label={`Descer seção ${INFO_SLOT[slot].rotulo}`} disabled={ordenando || !ordemPronta || indice === slots.length - 1} onClick={() => void reposicionar(indice, indice + 1)}><ArrowDown className="h-4 w-4" /></Button>
              <Button variant="secondary" onClick={() => nova(slot)} disabled={ordenando}>
                Nova versão
              </Button>
              </div>
            </div>

            {versoes.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {original ? "Nenhuma versão salva: o documento usa o texto original do sistema." : `Nenhuma versão salva: ${SEM_ORIGINAL[slot] ?? "este texto não aparece no documento."}`}
              </p>
            ) : (
              <div className="space-y-2">
                {versoes.map((b) => {
                  const { padrao } = lerSlot(b.escopo);
                  return (
                    <div key={b.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          {b.nome}
                          {padrao && <Badge className="bg-primary/10 text-primary">Padrão: {condicaoEmTexto(b.escopo, catalogoTipos)}</Badge>}
                          {!padrao && <Badge className="bg-muted text-muted-foreground">Só por escolha no mapeamento</Badge>}
                          {!b.ativo && <Badge className="bg-muted text-muted-foreground">inativa</Badge>}
                        </p>
                        <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">{resumoItens(blocosParaItens(b.blocos))}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1">
                        <Button variant="secondary" onClick={() => abrir(b)} aria-label="Editar versão">
                          <IconeEditar className="mr-1.5" /> Editar
                        </Button>
                        <Button variant="secondary" onClick={() => abrir(b, true)} aria-label="Duplicar versão e editar a cópia">
                          <Copy className="mr-1.5 h-4 w-4" /> Duplicar e editar
                        </Button>
                        <Button variant="secondary" onClick={() => excluir(b)} aria-label="Excluir versão">
                          <IconeExcluir />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {original && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Ver o texto original do sistema</summary>
                <p className="mt-2 whitespace-pre-line rounded-md bg-muted/50 p-3 text-muted-foreground">{original}</p>
                <Button variant="secondary" className="mt-2" onClick={() => nova(slot)}>
                  <Copy className="mr-1.5 h-4 w-4" /> Duplicar para editar
                </Button>
              </details>
            )}
          </Card>
        );
      }} />

      <Modal open={!!form} onClose={() => setForm(null)} title={form ? `${form.id ? "Editar" : "Nova"} versão — ${INFO_SLOT[form.slot].rotulo}` : ""}>
        {form && (
          <div className="space-y-3">
            {form.origem && (
              <p className="rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
                <b>Salvar alterações</b> substitui esta versão. <b>Salvar como nova versão</b> cria outra e mantém esta como está (mapeamentos que usam esta continuam iguais).
              </p>
            )}
            <div>
              <label className="text-xs font-medium">Nome da versão</label>
              <Input value={form.nome} placeholder="Ex.: Introdução 2026" onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })} />
            </div>

            <div>
              <label className="text-xs font-medium">Texto</label>
              <p className="mb-1 text-[11px] text-muted-foreground">
                O texto é uma lista de blocos: parágrafos (com negrito, itálico, sublinhado, caixa alta e alinhamento), listas e imagens. Cada bloco tem seus botões.
              </p>
              <EditorBlocos slot={form.slot} itens={form.itens} onChange={(novos) => setForm({ ...form, itens: novos })} imagens={imagens} />
            </div>

            <div className="space-y-2 rounded-md border border-border p-3 text-xs">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={form.padrao} onChange={(e) => setForm({ ...form, padrao: e.target.checked })} />
                Usar como padrão
              </label>
              <p className="text-muted-foreground">
                Quando marcado, esta versão entra sozinha nos mapeamentos que atendem a TODAS as condições abaixo (grupo sem marcação = qualquer). Se mais de uma
                se aplicar, vale a mais específica. Desmarcado, ela só é usada quando escolhida em um mapeamento.
              </p>
              {form.padrao && (
                <>
                  <Grupo titulo="Solução" opcoes={opcoesDoCampo("solucao", { todas: opcoesAg, incluir: form.regra.solucao }).map((o) => [o.valor, o.rotulo])} marcados={form.regra.solucao} onMarcar={(v, l) => marcar("solucao", v, l)} />
                  <Grupo titulo="Nível de serviço" opcoes={opcoesDoCampo("nivel", { todas: opcoesAg, incluir: form.regra.nivel }).map((o) => [o.valor, o.rotulo])} marcados={form.regra.nivel} onMarcar={(v, l) => marcar("nivel", v, l)} />
                  {camposExtrasAtivos(camposAg)
                    .concat(camposAg.filter((c) => !c.sistema && !c.ativo && (form.regra.extras?.[c.campo]?.length ?? 0) > 0))
                    .map((c) => (
                      <Grupo
                        key={c.campo}
                        titulo={c.titulo}
                        opcoes={opcoesDoCampo(c.campo, { todas: opcoesAg, incluir: form.regra.extras?.[c.campo] }).map((o) => [o.valor, o.rotulo])}
                        marcados={form.regra.extras?.[c.campo] ?? []}
                        onMarcar={(v, l) => marcarExtra(c.campo, v, l)}
                      />
                    ))}
                  <Grupo
                    titulo="Só quando o Escopo tiver"
                    opcoes={opcoesExigencia(catalogoTipos, form.regra.exige).map((o) => [o.valor, o.rotulo])}
                    marcados={form.regra.exige}
                    onMarcar={(v, l) => marcar("exige", v, l)}
                  />
                </>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
              Ativa
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setForm(null)}>
                Cancelar
              </Button>
              {form.origem && (
                <Button variant="secondary" onClick={() => salvar(true)} disabled={salvando || !form.nome.trim() || !temConteudo(form.itens)}>
                  Salvar como nova versão
                </Button>
              )}
              <Button onClick={() => salvar(false)} disabled={salvando || !form.nome.trim() || !temConteudo(form.itens)}>
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {form.origem ? "Salvar alterações" : "Salvar"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Grupo({
  titulo,
  opcoes,
  marcados,
  onMarcar,
}: {
  titulo: string;
  opcoes: (readonly [string, string])[];
  marcados: string[];
  onMarcar: (valor: string, ligado: boolean) => void;
}) {
  return (
    <div>
      <p className="mb-1 font-medium">{titulo}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {opcoes.map(([valor, rotulo]) => (
          <label key={valor} className="flex items-center gap-1.5">
            <input type="checkbox" checked={marcados.includes(valor)} onChange={(e) => onMarcar(valor, e.target.checked)} />
            {rotulo}
          </label>
        ))}
      </div>
    </div>
  );
}
