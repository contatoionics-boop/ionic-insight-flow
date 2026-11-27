import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, List, Plus, Table2, Trash2, Type, X } from "lucide-react";
import { Button } from "@/components/ui-bits";
import { ListaOrdenavel } from "@/components/laudo/ListaOrdenavel";
import { moverNaLista } from "@/lib/ordenar-blocos";
import { CampoFormatavel, type EstadoTexto } from "@/components/laudo/TextoFormatado";
import {
  FIGURAS_TEXTO,
  MODELOS_TABELA,
  camposDoSlot,
  novaTabela,
  type ModeloTabela,
  type ImagemBiblioteca,
  type ItemTexto,
  type NomeFigura,
  type SlotTexto,
} from "@/lib/laudo/textos-padrao";

/** Tira as chaves vazias de um item (o objeto salvo só leva o que foi pedido). */
function limpar(i: ItemTexto): ItemTexto {
  return Object.fromEntries(Object.entries(i).filter(([, v]) => v !== undefined && v !== false)) as ItemTexto;
}

type Tabela = Extract<ItemTexto, { tipo: "tabela" }>;

/** Editor de uma tabela: título, colunas e linhas (as células aceitam {{campos}}). */
function EditorTabela({ item, onChange }: { item: Tabela; onChange: (t: Tabela) => void }) {
  const n = item.colunas.length;
  const celula = (r: number, c: number, v: string) => onChange({ ...item, linhas: item.linhas.map((l, i) => (i === r ? l.map((x, j) => (j === c ? v : x)) : l)) });
  const cls = "w-full min-w-[6rem] rounded border border-border bg-background px-1.5 py-1 text-xs outline-none focus:border-primary";
  return (
    <div className="space-y-2">
      <input className={cls} value={item.titulo ?? ""} placeholder="Título da tabela (opcional)" onChange={(e) => onChange({ ...item, titulo: e.target.value })} />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {item.colunas.map((c, j) => (
                <th key={j} className="p-0.5 align-top">
                  <div className="flex items-center gap-0.5">
                    <input className={`${cls} font-semibold`} value={c} aria-label={`Nome da coluna ${j + 1}`} onChange={(e) => onChange({ ...item, colunas: item.colunas.map((x, k) => (k === j ? e.target.value : x)) })} />
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                      title="Remover coluna"
                      aria-label={`Remover coluna ${j + 1}`}
                      disabled={n <= 1}
                      onClick={() => onChange({ ...item, colunas: item.colunas.filter((_, k) => k !== j), linhas: item.linhas.map((l) => l.filter((_, k) => k !== j)) })}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </th>
              ))}
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {item.linhas.map((l, r) => (
              <tr key={r}>
                {item.colunas.map((_, c) => (
                  <td key={c} className="p-0.5">
                    <input className={cls} value={l[c] ?? ""} aria-label={`Linha ${r + 1}, coluna ${c + 1}`} onChange={(e) => celula(r, c, e.target.value)} />
                  </td>
                ))}
                <td className="p-0.5">
                  <button type="button" className="rounded p-1 text-destructive hover:bg-muted" title="Remover linha" aria-label={`Remover linha ${r + 1}`} onClick={() => onChange({ ...item, linhas: item.linhas.filter((_, k) => k !== r) })}>
                    <X className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40" disabled={item.linhas.length >= 100} onClick={() => onChange({ ...item, linhas: [...item.linhas, item.colunas.map(() => "")] })}>
          <Plus className="h-3 w-3" /> Linha
        </button>
        <button type="button" className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40" disabled={n >= 8} onClick={() => onChange({ ...item, colunas: [...item.colunas, `Coluna ${n + 1}`], linhas: item.linhas.map((l) => [...l, ""]) })}>
          <Plus className="h-3 w-3" /> Coluna
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">No documento a tabela nasce assim e o especialista completa ou ajusta as linhas na revisão.</p>
    </div>
  );
}

/**
 * Editor do conteúdo de uma versão de texto: lista de blocos (parágrafo, lista, tabela, imagem), cada um com a sua barra
 * de formatação, subir/descer e remover, e botões para inserir campos `{{…}}` e imagens.
 */
export function EditorBlocos({
  slot,
  itens,
  onChange,
  imagens,
}: {
  slot: SlotTexto;
  itens: ItemTexto[];
  onChange: (itens: ItemTexto[]) => void;
  imagens: ImagemBiblioteca[];
}) {
  const inserirRef = useRef<((t: string) => void) | null>(null);
  const [escolhendoImagem, setEscolhendoImagem] = useState(false);
  const [escolhendoTabela, setEscolhendoTabela] = useState(false);
  const chaves = useRef(new WeakMap<ItemTexto, string>());
  const proximaChave = useRef(0);
  function chaveDe(item: ItemTexto) {
    const atual = chaves.current.get(item);
    if (atual) return atual;
    const chave = `texto-${proximaChave.current++}`;
    chaves.current.set(item, chave);
    return chave;
  }
  const trocar = (i: number, novo: ItemTexto) => onChange(itens.map((x, k) => {
    if (k !== i) return x;
    const atualizado = limpar(novo);
    chaves.current.set(atualizado, chaveDe(x));
    return atualizado;
  }));
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= itens.length) return;
    onChange(moverNaLista(itens, i, j));
  };
  const remover = (i: number) => onChange(itens.filter((_, k) => k !== i));
  const adicionar = (item: ItemTexto) => onChange([...itens, item]);

  const acoes = (i: number) => (
    <div className="flex shrink-0 gap-1">
      <button type="button" className="rounded border border-border p-1 text-muted-foreground hover:bg-muted disabled:opacity-30" title="Subir" aria-label="Subir bloco" disabled={i === 0} onClick={() => mover(i, -1)}>
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button type="button" className="rounded border border-border p-1 text-muted-foreground hover:bg-muted disabled:opacity-30" title="Descer" aria-label="Descer bloco" disabled={i === itens.length - 1} onClick={() => mover(i, 1)}>
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
      <button type="button" className="rounded border border-border p-1 text-destructive hover:bg-muted" title="Remover bloco" aria-label="Remover bloco" onClick={() => remover(i)}>
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  const imagemDe = (id: string) => imagens.find((x) => x.id === id);

  return (
    <div className="space-y-2">
      {itens.length === 0 && <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">Nenhum bloco. Use os botões abaixo para adicionar parágrafo, lista, tabela ou imagem.</p>}

      <ListaOrdenavel itens={itens} idDe={chaveDe} onMover={(origem, destino) => onChange(moverNaLista(itens, origem, destino))} render={(item, i, alca) => (
        <div className="space-y-1.5 rounded-lg border border-border p-2">
          <div className="flex items-center justify-between gap-2">
            {alca}
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {item.tipo === "paragraph" ? "Parágrafo" : item.tipo === "bullets" ? "Lista (um item por linha)" : item.tipo === "tabela" ? "Tabela" : "Imagem"}
            </span>
            {acoes(i)}
          </div>

          {item.tipo === "paragraph" && (
            <>
              <CampoFormatavel
                valor={{ texto: item.texto, rico: item.rico, alinhamento: item.alinhamento, caixaAlta: item.caixaAlta }}
                onChange={(v: EstadoTexto) => trocar(i, { ...item, texto: v.texto, rico: v.rico, alinhamento: v.alinhamento, caixaAlta: v.caixaAlta })}
                placeholder="Digite o parágrafo… (use os botões de campo abaixo para dados do mapeamento)"
                registrarInserir={(f) => (inserirRef.current = f)}
              />
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <input type="checkbox" checked={!!item.destaque} onChange={(e) => trocar(i, { ...item, destaque: e.target.checked })} />
                Campo de revisão (fica amarelo só na tela do documento; o PDF sai normal)
              </label>
            </>
          )}

          {item.tipo === "bullets" && (
            <CampoFormatavel
              valor={{ texto: item.itens.join("\n"), rico: item.rico }}
              onChange={(v: EstadoTexto) => trocar(i, { ...item, itens: v.texto.split("\n").filter((l, k, todas) => l.trim() || k === todas.length - 1), rico: v.rico })}
              comAlinhamento={false}
              comCaixaAlta={false}
              comoLista
              placeholder="Um item por linha"
              registrarInserir={(f) => (inserirRef.current = f)}
            />
          )}

          {item.tipo === "tabela" && <EditorTabela item={item} onChange={(t) => trocar(i, t)} />}

          {item.tipo === "figura" && (
            <div className="flex items-center gap-3">
              <img src={FIGURAS_TEXTO[item.nome].url} alt={FIGURAS_TEXTO[item.nome].alt} className="h-16 w-24 rounded border border-border bg-white object-contain" />
              <div className="min-w-0 text-xs">
                <p className="font-medium">{FIGURAS_TEXTO[item.nome].legendaBase}</p>
                <p className="text-muted-foreground">Desenho do sistema (arquivo do próprio aplicativo; para trocar, copie-o para a biblioteca de imagens).</p>
              </div>
            </div>
          )}

          {item.tipo === "imagem" && (
            <div className="flex items-center gap-3">
              {imagemDe(item.id) ? (
                <>
                  <img src={imagemDe(item.id)?.url} alt={imagemDe(item.id)?.alt} className="h-16 w-24 rounded border border-border bg-white object-contain" />
                  <div className="min-w-0 text-xs">
                    <p className="font-medium">{imagemDe(item.id)?.nome}</p>
                    <p className="text-muted-foreground">{imagemDe(item.id)?.legenda || "Sem legenda"} · Biblioteca de imagens</p>
                  </div>
                </>
              ) : (
                <p className="text-xs text-destructive">Imagem removida da biblioteca. Apague este bloco ou escolha outra imagem.</p>
              )}
            </div>
          )}
        </div>
      )} />

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button variant="secondary" onClick={() => adicionar({ tipo: "paragraph", texto: "" })}>
          <Type className="mr-1.5 h-4 w-4" /> Parágrafo
        </Button>
        <Button variant="secondary" onClick={() => adicionar({ tipo: "bullets", itens: [""] })}>
          <List className="mr-1.5 h-4 w-4" /> Lista
        </Button>
        <Button variant="secondary" onClick={() => setEscolhendoTabela((v) => !v)}>
          <Table2 className="mr-1.5 h-4 w-4" /> Tabela
        </Button>
        <Button variant="secondary" onClick={() => setEscolhendoImagem((v) => !v)}>
          <ImagePlus className="mr-1.5 h-4 w-4" /> Imagem
        </Button>
      </div>

      {escolhendoTabela && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-xs font-medium">Qual tabela?</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(MODELOS_TABELA) as ModeloTabela[]).map((m) => (
              <button
                key={m}
                type="button"
                className="rounded-md border border-border bg-background px-3 py-2 text-left text-xs hover:border-primary"
                onClick={() => {
                  adicionar(novaTabela(m));
                  setEscolhendoTabela(false);
                }}
              >
                <span className="block font-medium">{MODELOS_TABELA[m].rotulo}</span>
                <span className="block text-[11px] text-muted-foreground">{MODELOS_TABELA[m].colunas.join(" · ")}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {escolhendoImagem && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-xs font-medium">Escolha a imagem</p>
          <p className="text-[11px] text-muted-foreground">Imagens novas são enviadas na ficha “Biblioteca de imagens”, nesta mesma tela.</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {(Object.keys(FIGURAS_TEXTO) as NomeFigura[]).map((n) => (
              <button key={n} type="button" className="overflow-hidden rounded-md border border-border bg-background text-left hover:border-primary" onClick={() => { adicionar({ tipo: "figura", nome: n }); setEscolhendoImagem(false); }}>
                <img src={FIGURAS_TEXTO[n].url} alt={FIGURAS_TEXTO[n].alt} className="h-20 w-full bg-white object-contain" />
                <span className="block p-1.5 text-[10px] leading-tight text-muted-foreground">{FIGURAS_TEXTO[n].legendaBase} <i>(sistema)</i></span>
              </button>
            ))}
            {imagens.map((im) => (
              <button key={im.id} type="button" className="overflow-hidden rounded-md border border-border bg-background text-left hover:border-primary" onClick={() => { adicionar({ tipo: "imagem", id: im.id }); setEscolhendoImagem(false); }}>
                <img src={im.url} alt={im.alt} className="h-20 w-full bg-white object-contain" />
                <span className="block p-1.5 text-[10px] leading-tight text-muted-foreground">{im.nome}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-[11px] text-muted-foreground">Inserir campo automático no parágrafo em edição:</span>
        {camposDoSlot(slot).map((c) => (
          <button key={c.chave} type="button" title={c.rotulo} onMouseDown={(e) => e.preventDefault()} onClick={() => inserirRef.current?.(`{{${c.chave}}}`)} className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px] hover:bg-muted">
            {`{{${c.chave}}}`}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Dica: selecione um trecho e use <b>N</b> (negrito), <i>I</i> (itálico) ou <u>S</u> (sublinhado); <b>Aa</b> deixa o parágrafo em caixa alta; os botões de alinhamento valem para o parágrafo todo.
      </p>
    </div>
  );
}

