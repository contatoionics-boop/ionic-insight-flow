import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUpRight,
  BoxSelect,
  BringToFront,
  ImagePlus,
  Loader2,
  MessageSquare,
  Minus,
  MousePointer2,
  Redo2,
  RefreshCw,
  Ruler,
  SendToBack,
  Trash2,
  Type,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui-bits";
import { enviarImagemLaudo, listarFotosLaudo } from "@/lib/laudo.functions";
import { BIBLIOTECA, GRUPOS_BIBLIOTECA, PECAS, urlDaPeca } from "@/lib/marcacao/biblioteca";
import { FONTE_UI, canvasParaBlob, carregarImagem, carregarPecas, fotoComoBlobUrl, medirEtiqueta, renderizarDesenho } from "@/lib/marcacao/exportar";
import {
  LIMITES,
  PONTOS_POR_TIPO,
  anguloDoGiro,
  anotacaoDoItem,
  anotacaoVazia,
  clamp,
  ladoPorArraste,
  moverPontos,
  novaAnotacao,
  novaPeca,
  numeracaoDosItens,
  ordemDeDesenho,
  primitivasDaAnotacao,
  proximoZ,
} from "@/lib/marcacao/geometria";
import type { Anotacao, DesenhoProjeto, ItemPeca, TipoAnotacao } from "@/lib/marcacao/tipos";

const FERRAMENTAS: { tipo: TipoAnotacao; nome: string; dica: string; Icone: LucideIcon; vazio: string }[] = [
  { tipo: "balao", nome: "Balão", dica: "Clique no ponto a indicar; depois arraste o balão e escreva o texto.", Icone: MessageSquare, vazio: "Texto…" },
  { tipo: "cota", nome: "Cota", dica: "Arraste de uma ponta à outra e escreva a medida.", Icone: Ruler, vazio: "0,00 m" },
  { tipo: "caixa", nome: "Área", dica: "Arraste para desenhar a área tracejada (texto opcional).", Icone: BoxSelect, vazio: "" },
  { tipo: "seta", nome: "Seta", dica: "Arraste do início até a ponta da seta.", Icone: ArrowUpRight, vazio: "" },
  { tipo: "linha", nome: "Linha", dica: "Eletroduto ou cabo: arraste do início ao fim.", Icone: Minus, vazio: "" },
  { tipo: "texto", nome: "Texto", dica: "Clique onde quer o texto livre e escreva.", Icone: Type, vazio: "Texto…" },
];
const FERRAMENTA = Object.fromEntries(FERRAMENTAS.map((f) => [f.tipo, f])) as Record<TipoAnotacao, (typeof FERRAMENTAS)[number]>;

type Instantaneo = { itens: ItemPeca[]; anotacoes: Anotacao[] };

type FotoMapeamento = { path: string; url: string; legenda: string };
type FotoAtual = {
  /** endereço usado na tela e na exportação (blob: local) */
  src: string;
  largura: number;
  altura: number;
  /** origem para reabrir depois */
  path?: string;
  url?: string;
  /** arquivo enviado agora, ainda não gravado no armazenamento */
  arquivo?: File;
};

function paraBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    leitor.onload = () => resolve(String(leitor.result).split(",")[1] ?? "");
    leitor.readAsDataURL(blob);
  });
}

const novoId = () => Math.random().toString(36).slice(2, 10);

export type ResultadoMarcacao = { url: string; desenho: DesenhoProjeto };

/**
 * Editor de desenho técnico sobre foto (uso do especialista, na revisão do resultado).
 * Carimba peças da biblioteca na foto, numera, escreve a instrução de cada item e gera a imagem
 * final (foto + peças + legenda), guardando também o projeto para poder reabrir e ajustar.
 */
export function EditorMarcacao({
  casoId,
  inicial,
  onFechar,
  onSalvar,
}: {
  casoId: string;
  /** projeto salvo anteriormente, quando for edição */
  inicial?: DesenhoProjeto | null;
  onFechar: () => void;
  onSalvar: (r: ResultadoMarcacao) => void;
}) {
  const fnFotos = useServerFn(listarFotosLaudo);
  const fnEnviar = useServerFn(enviarImagemLaudo);
  const [fotos, setFotos] = useState<FotoMapeamento[] | null>(null);
  const [foto, setFoto] = useState<FotoAtual | null>(null);
  const [itens, setItens] = useState<ItemPeca[]>(() => (inicial?.itens ?? []).filter((i) => i.tipo === "peca"));
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>(() => inicial?.anotacoes ?? []);
  const [armada, setArmada] = useState<string | null>(null);
  const [ferramenta, setFerramenta] = useState<TipoAnotacao | null>(null);
  const [tamPalco, setTamPalco] = useState({ w: 0, h: 0 });
  const [focarAnot, setFocarAnot] = useState<string | null>(null);
  const passado = useRef<Instantaneo[]>([]);
  const futuro = useRef<Instantaneo[]>([]);
  const atual = useRef<Instantaneo>({ itens: [], anotacoes: [] });
  const chaveEdicao = useRef<string | null>(null);
  const [, redesenhar] = useState(0);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const palcoRef = useRef<HTMLDivElement | null>(null);
  const arquivoRef = useRef<HTMLInputElement | null>(null);

  const proporcaoFoto = foto ? foto.largura / foto.altura : 1;
  atual.current = { itens, anotacoes };
  const numeros = numeracaoDosItens(itens);
  /** itens em modo "balão": viram balões na foto, ligados à peça */
  const baloesDosItens = itens
    .filter((i) => i.modo === "balao")
    .map((i) => anotacaoDoItem(i, i.nota.trim() || PECAS[i.pecaId]?.completo || "Equipamento"));

  /** Guarda o estado atual para o "desfazer" (chamar antes de alterar). */
  const registrar = useCallback(() => {
    passado.current.push(atual.current);
    if (passado.current.length > 100) passado.current.shift();
    futuro.current = [];
    redesenhar((n) => n + 1);
  }, []);
  /** Uma digitação seguida vira um único passo do "desfazer". */
  const registrarEdicao = (chave: string) => {
    if (chaveEdicao.current !== chave) {
      chaveEdicao.current = chave;
      registrar();
    }
  };
  const desfazer = useCallback(() => {
    const s = passado.current.pop();
    if (!s) return;
    futuro.current.push(atual.current);
    setItens(s.itens);
    setAnotacoes(s.anotacoes);
    setSelecionado(null);
    redesenhar((n) => n + 1);
  }, []);
  const refazer = useCallback(() => {
    const s = futuro.current.pop();
    if (!s) return;
    passado.current.push(atual.current);
    setItens(s.itens);
    setAnotacoes(s.anotacoes);
    setSelecionado(null);
    redesenhar((n) => n + 1);
  }, []);

  // tamanho da foto na tela (as anotações são desenhadas em pixels)
  useEffect(() => {
    const el = palcoRef.current;
    if (!el) return;
    const medir = () => setTamPalco({ w: el.clientWidth, h: el.clientHeight });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [foto]);

  // Fotos do mapeamento (agente) + reabertura do projeto salvo
  useEffect(() => {
    let vivo = true;
    (async () => {
      let lista: FotoMapeamento[] = [];
      try {
        lista = ((await fnFotos({ data: { casoId } })) as FotoMapeamento[]) ?? [];
      } catch (e: any) {
        toast.error(e?.message ?? "Não foi possível carregar as fotos do mapeamento.");
      }
      if (!vivo) return;
      setFotos(lista);
      if (inicial) {
        const origem = inicial.foto.path ? lista.find((f) => f.path === inicial.foto.path)?.url : inicial.foto.url;
        if (!origem) {
          toast.error("A foto original não está mais disponível. Escolha outra foto; as marcações foram mantidas.");
          return;
        }
        await abrirFoto(origem, { path: inicial.foto.path, url: inicial.foto.url });
      }
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casoId]);

  const abrirFoto = useCallback(async (origem: string, extra: Partial<FotoAtual> = {}) => {
    setCarregando(true);
    try {
      const src = extra.arquivo ? URL.createObjectURL(extra.arquivo) : await fotoComoBlobUrl(origem);
      const img = await carregarImagem(src);
      setFoto({ src, largura: img.naturalWidth, altura: img.naturalHeight, ...extra });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível abrir a foto.");
    } finally {
      setCarregando(false);
    }
  }, []);

  // ponteiro → fração da foto
  const ponto = (ev: { clientX: number; clientY: number }) => {
    const r = palcoRef.current!.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height, r };
  };

  const atualizar = (id: string, patch: Partial<ItemPeca>) =>
    setItens((cur) => cur.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const remover = useCallback(
    (id: string) => {
      registrar();
      setItens((cur) => cur.filter((i) => i.id !== id));
      setAnotacoes((cur) => cur.filter((a) => a.id !== id));
      setSelecionado((s) => (s === id ? null : s));
    },
    [registrar],
  );

  const atualizarAnotacao = (id: string, patch: Partial<Anotacao>) =>
    setAnotacoes((cur) => cur.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  function aoClicarNaFoto(ev: React.MouseEvent) {
    if ((ev.target as Element).closest("[data-carimbo],[data-anot]")) return;
    if (!armada) {
      setSelecionado(null);
      return;
    }
    const p = ponto(ev);
    const peca = PECAS[armada]!;
    const item = novaPeca(novoId(), armada, peca.proporcao, proporcaoFoto, { x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1) }, peca.alturaInicial);
    registrar();
    setItens((cur) => [...cur, item]);
    setSelecionado(item.id);
  }

  // Delete remove o item selecionado; Esc solta a peça armada
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      const digitando = alvo?.tagName === "TEXTAREA" || alvo?.tagName === "INPUT";
      if (e.key === "Escape") {
        setArmada(null);
        setFerramenta(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selecionado && !digitando) remover(selecionado);
      if ((e.ctrlKey || e.metaKey) && !digitando && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) refazer();
        else desfazer();
      }
      if ((e.ctrlKey || e.metaKey) && !digitando && e.key.toLowerCase() === "y") {
        e.preventDefault();
        refazer();
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [selecionado, remover, desfazer, refazer]);

  async function salvar() {
    if (!foto) return;
    setSalvando(true);
    try {
      const [pecas, img] = await Promise.all([carregarPecas(), carregarImagem(foto.src)]);
      const canvas = renderizarDesenho({ foto: img, itens, anotacoes, pecas });
      const blob = await canvasParaBlob(canvas, "image/jpeg", 0.92);

      // foto enviada agora: guarda o original para poder reabrir o desenho depois
      let origem: { path?: string; url?: string } = { path: foto.path, url: foto.url };
      if (foto.arquivo) {
        const tipo = foto.arquivo.type === "image/png" || foto.arquivo.type === "image/webp" ? foto.arquivo.type : "image/jpeg";
        const ext = tipo === "image/png" ? "png" : tipo === "image/webp" ? "webp" : "jpg";
        const { url } = await fnEnviar({
          data: { casoId, nome: `foto-${novoId()}.${ext}`, contentType: tipo, base64: await paraBase64(foto.arquivo) },
        });
        origem = { url };
      }

      const { url } = await fnEnviar({
        data: { casoId, nome: `desenho-${novoId()}.jpg`, contentType: "image/jpeg", base64: await paraBase64(blob) },
      });

      onSalvar({
        url,
        desenho: { versao: 1, foto: { ...origem, largura: foto.largura, altura: foto.altura }, itens, anotacoes },
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar o desenho.");
      setSalvando(false);
    }
  }

  // ----- arraste (mover, tamanho, giro) -----
  type Alca = "corpo" | "prop" | "larg" | "alt" | "giro";
  function iniciarArraste(ev: React.PointerEvent, item: ItemPeca, alca: Alca) {
    ev.preventDefault();
    ev.stopPropagation();
    setSelecionado(item.id);
    const alvo = ev.currentTarget as HTMLElement;
    alvo.setPointerCapture(ev.pointerId);
    const inicio = { x: ev.clientX, y: ev.clientY };
    let moveu = alca !== "corpo";
    let registrou = false;
    const razao = item.w / item.h;

    const mover = (e: PointerEvent) => {
      if (!moveu && Math.abs(e.clientX - inicio.x) + Math.abs(e.clientY - inicio.y) <= 3) return;
      moveu = true;
      if (!registrou) {
        registrou = true;
        registrar();
      }
      const p = ponto(e);
      if (alca === "corpo") atualizar(item.id, { cx: clamp(p.x, 0, 1), cy: clamp(p.y, 0, 1) });
      else if (alca === "prop") {
        const h = clamp(Math.abs(item.cy - p.y) * 2, 0.04, LIMITES.maxAlt);
        atualizar(item.id, { h, w: h * razao });
      } else if (alca === "larg") atualizar(item.id, { w: ladoPorArraste(item.cx, p.x, LIMITES.minLado, LIMITES.maxLarg) });
      else if (alca === "alt") atualizar(item.id, { h: ladoPorArraste(item.cy, p.y, LIMITES.minLado, LIMITES.maxAlt) });
      else {
        const centro = { x: p.r.left + item.cx * p.r.width, y: p.r.top + item.cy * p.r.height };
        atualizar(item.id, { rot: anguloDoGiro(centro, { x: e.clientX, y: e.clientY }, e.shiftKey) });
      }
    };
    const soltar = () => {
      alvo.removeEventListener("pointermove", mover);
      alvo.removeEventListener("pointerup", soltar);
      alvo.removeEventListener("pointercancel", soltar);
    };
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerup", soltar);
    alvo.addEventListener("pointercancel", soltar);
  }

  // ----- anotações: arrastar um ponto (ou a anotação toda) -----
  function arrastarAnotacao(ev: React.PointerEvent, a: Anotacao, indice: number | "todos") {
    ev.preventDefault();
    ev.stopPropagation();
    const idItem = a.id.startsWith("b:") ? a.id.slice(2) : null;
    setSelecionado(idItem ?? a.id);
    if (idItem && indice === 0) return; // o alvo do balão é a própria peça
    const alvo = ev.currentTarget as Element;
    alvo.setPointerCapture(ev.pointerId);
    const p0 = ponto(ev);
    const origem = a.pts.map((q) => ({ ...q }));
    let registrou = false;
    const mover = (e: Event) => {
      const pe = e as PointerEvent;
      if (!registrou) {
        if (Math.abs(pe.clientX - ev.clientX) + Math.abs(pe.clientY - ev.clientY) <= 2) return;
        registrou = true;
        registrar();
      }
      const p = ponto(pe);
      if (idItem) {
        // balão de um item: só a posição do balão se move; o alvo continua na peça
        const base = indice === "todos" ? moverPontos([origem[1]], p.x - p0.x, p.y - p0.y)[0] : { x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1) };
        atualizar(idItem, { bal: base });
        return;
      }
      if (indice === "todos") atualizarAnotacao(a.id, { pts: moverPontos(origem, p.x - p0.x, p.y - p0.y) });
      else atualizarAnotacao(a.id, { pts: origem.map((q, i) => (i === indice ? { x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1) } : q)) });
    };
    const soltar = () => {
      alvo.removeEventListener("pointermove", mover);
      alvo.removeEventListener("pointerup", soltar);
      alvo.removeEventListener("pointercancel", soltar);
    };
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerup", soltar);
    alvo.addEventListener("pointercancel", soltar);
  }

  // ----- anotações: criar com a ferramenta ativa (uso único) -----
  function criarAnotacao(ev: React.PointerEvent) {
    if (!ferramenta) return;
    ev.preventDefault();
    ev.stopPropagation();
    const tipo = ferramenta;
    const alvo = ev.currentTarget as HTMLElement;
    alvo.setPointerCapture(ev.pointerId);
    const p = ponto(ev);
    const nova = novaAnotacao(novoId(), tipo, { x: p.x, y: p.y });
    registrar();
    setAnotacoes((cur) => [...cur, nova]);
    setSelecionado(nova.id);

    const dois = PONTOS_POR_TIPO[tipo] === 2 && tipo !== "balao";
    const fim = (e: PointerEvent) => {
      const q = ponto(e);
      return { x: clamp(q.x, 0, 1), y: clamp(q.y, 0, 1) };
    };
    const mover = (e: Event) => {
      if (!dois) return;
      const f = fim(e as PointerEvent);
      setAnotacoes((cur) => cur.map((a) => (a.id === nova.id ? { ...a, pts: [a.pts[0], f] } : a)));
    };
    const soltar = (e: Event) => {
      alvo.removeEventListener("pointermove", mover);
      alvo.removeEventListener("pointerup", soltar);
      alvo.removeEventListener("pointercancel", soltar);
      setFerramenta(null);
      const final = dois ? fim(e as PointerEvent) : null;
      if (final) setAnotacoes((cur) => cur.map((a) => (a.id === nova.id ? { ...a, pts: [a.pts[0], final] } : a)));
      if (final && anotacaoVazia({ ...nova, pts: [nova.pts[0], final] })) {
        // clique sem arraste: descarta a anotação e o passo do "desfazer"
        setAnotacoes((cur) => cur.filter((a) => a.id !== nova.id));
        passado.current.pop();
        setSelecionado(null);
        redesenhar((n) => n + 1);
        return;
      }
      if (tipo === "balao" || tipo === "texto" || tipo === "cota" || tipo === "caixa") setFocarAnot(nova.id);
    };
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerup", soltar);
    alvo.addEventListener("pointercancel", soltar);
  }

  const escolherFerramenta = (t: TipoAnotacao | null) => {
    setArmada(null);
    setFerramenta((f) => (f === t ? null : t));
  };

  const grupos = useMemo(
    () => GRUPOS_BIBLIOTECA.map((g) => ({ nome: g, pecas: BIBLIOTECA.filter((p) => p.grupo === g) })),
    [],
  );

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div className="mr-auto min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Resultado de mapeamento técnico</p>
          <h2 className="text-lg font-bold leading-tight text-foreground">Desenho técnico sobre foto</h2>
        </div>
        {foto && (
          <Button variant="outline" onClick={() => setFoto(null)} disabled={salvando}>
            <RefreshCw className="h-4 w-4" /> Trocar foto
          </Button>
        )}
        {(itens.length > 0 || anotacoes.length > 0) && (
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Remover todas as marcações?")) {
                registrar();
                setItens([]);
                setAnotacoes([]);
                setSelecionado(null);
              }
            }}
            disabled={salvando}
          >
            <Trash2 className="h-4 w-4" /> Limpar
          </Button>
        )}
        <Button variant="outline" onClick={onFechar} disabled={salvando}>
          <X className="h-4 w-4" /> Cancelar
        </Button>
        <Button onClick={() => void salvar()} disabled={!foto || salvando}>
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salvar no documento
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[14.5rem_minmax(0,1fr)_21rem]">
        {/* Biblioteca */}
        <aside className="min-h-0 overflow-y-auto rounded-xl border border-border bg-card p-2.5">
          <h3 className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Equipamentos</h3>
          {grupos.map((g) => (
            <section key={g.nome} className="mb-3">
              <h4 className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{g.nome}</h4>
              <div className="grid grid-cols-2 gap-1.5">
                {g.pecas.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    title={p.completo}
                    disabled={!foto}
                    onClick={() => {
                      setFerramenta(null);
                      setArmada((a) => (a === p.id ? null : p.id));
                    }}
                    className={`flex min-h-24 flex-col items-center gap-1 rounded-lg border p-1.5 text-center transition disabled:opacity-40 ${
                      armada === p.id ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-muted/30 hover:border-foreground/30"
                    }`}
                  >
                    <img src={urlDaPeca(p)} alt="" className="h-14 w-auto max-w-[92%] object-contain" draggable={false} />
                    <span className={`text-[10px] leading-tight ${armada === p.id ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                      {p.curto}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </aside>

        {/* Foto */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-muted/30">
          {!foto ? (
            <EscolherFoto
              fotos={fotos}
              carregando={carregando}
              onEscolher={(f) => void abrirFoto(f.url, { path: f.path })}
              onArquivo={(arquivo) => void abrirFoto("", { arquivo })}
              arquivoRef={arquivoRef}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-card px-2.5 py-2">
                <button
                  type="button"
                  onClick={() => escolherFerramenta(null)}
                  aria-pressed={!ferramenta}
                  className={`flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium ${
                    !ferramenta ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MousePointer2 className="h-4 w-4" /> Selecionar
                </button>
                {FERRAMENTAS.map(({ tipo, nome, Icone }) => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => escolherFerramenta(tipo)}
                    aria-pressed={ferramenta === tipo}
                    className={`flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium ${
                      ferramenta === tipo ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icone className="h-4 w-4" /> {nome}
                  </button>
                ))}
                <span className="ml-auto flex gap-1">
                  <button
                    type="button"
                    onClick={desfazer}
                    disabled={!passado.current.length}
                    aria-label="Desfazer"
                    title="Desfazer (Ctrl+Z)"
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    <Undo2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={refazer}
                    disabled={!futuro.current.length}
                    aria-label="Refazer"
                    title="Refazer (Ctrl+Y)"
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    <Redo2 className="h-4 w-4" />
                  </button>
                </span>
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3">
                <div
                  ref={palcoRef}
                  className={`relative inline-block max-w-full select-none leading-none ${armada || ferramenta ? "cursor-crosshair" : ""}`}
                  onClick={aoClicarNaFoto}
                >
                  <img
                    src={foto.src}
                    alt="Foto do local"
                    draggable={false}
                    className="block h-auto max-h-[66vh] w-auto max-w-full rounded-md shadow-md"
                  />
                  <div className="absolute inset-0">
                    {ordemDeDesenho(itens).map((it) => (
                      <Carimbo
                        key={it.id}
                        item={it}
                        numero={numeros.get(it.id)}
                        selecionado={selecionado === it.id}
                        onArraste={iniciarArraste}
                      />
                    ))}
                  </div>
                  {tamPalco.w > 0 && (
                    <CamadaAnotacoes
                      anotacoes={[...baloesDosItens, ...anotacoes]}
                      largura={tamPalco.w}
                      altura={tamPalco.h}
                      selecionado={selecionado}
                      onArraste={arrastarAnotacao}
                    />
                  )}
                  {ferramenta && <div data-anot className="absolute inset-0 touch-none cursor-crosshair" onPointerDown={criarAnotacao} />}
                </div>
              </div>
              <p className="border-t border-border px-3 py-2 text-center text-xs text-muted-foreground">
                {ferramenta
                  ? `${FERRAMENTA[ferramenta].nome}: ${FERRAMENTA[ferramenta].dica} (Esc cancela)`
                  : armada
                  ? `Clique na foto para posicionar: ${PECAS[armada]?.curto}. (Esc cancela)`
                  : "Escolha um equipamento à esquerda e clique na foto. Arraste para mover · canto = tamanho · lado = largura · base = altura · ⟳ gira (Shift = 15°)."}
                {"  "}
                <span className="font-mono">
                  {foto.largura}×{foto.altura}
                </span>
              </p>
            </>
          )}
        </section>

        {/* Itens do serviço */}
        <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Itens do serviço</h3>
            <span className="rounded-full bg-muted px-2 font-mono text-xs text-muted-foreground">{itens.length}</span>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
            {itens.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Nenhum equipamento marcado ainda. Os itens aparecem aqui, numerados.
              </p>
            ) : (
              itens.map((it, idx) => (
                <div
                  key={it.id}
                  onClick={() => setSelecionado(it.id)}
                  className={`grid cursor-pointer grid-cols-[auto_1fr_auto] items-start gap-x-2 gap-y-1.5 rounded-lg border p-2 ${
                    selecionado === it.id ? "border-primary bg-primary/10" : "border-border bg-muted/30"
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">
                    {numeros.get(it.id) ?? <MessageSquare className="h-3.5 w-3.5" aria-label="Balão" />}
                  </span>
                  <span className="min-w-0 text-[13px] font-semibold leading-tight text-foreground">{PECAS[it.pecaId]?.completo}</span>
                  <button
                    type="button"
                    aria-label={`Excluir item ${idx + 1}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      remover(it.id);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <textarea
                    value={it.nota}
                    onFocus={() => setSelecionado(it.id)}
                    onBlur={() => (chaveEdicao.current = null)}
                    onChange={(e) => {
                      registrarEdicao(`nota-${it.id}`);
                      atualizar(it.id, { nota: e.target.value });
                    }}
                    placeholder="O que fazer aqui? (instalar, trocar, revisar…)"
                    rows={2}
                    className="col-span-3 w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  />
                  <div className="col-span-3 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {(["numero", "balao"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={(it.modo ?? "numero") === m}
                        onClick={() => {
                          if ((it.modo ?? "numero") === m) return;
                          registrar();
                          atualizar(it.id, { modo: m });
                        }}
                        className={`min-h-8 rounded-md border px-2 text-[11px] font-medium ${
                          (it.modo ?? "numero") === m ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {m === "numero" ? "Número + legenda" : "Balão na foto"}
                      </button>
                    ))}
                    <span className="ml-auto flex gap-1">
                      <button
                        type="button"
                        aria-label="Trazer para a frente"
                        title="Trazer para a frente"
                        onClick={() => {
                          registrar();
                          atualizar(it.id, { z: proximoZ(itens, "frente") });
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
                      >
                        <BringToFront className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Enviar para trás"
                        title="Enviar para trás"
                        onClick={() => {
                          registrar();
                          atualizar(it.id, { z: proximoZ(itens, "tras") });
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
                      >
                        <SendToBack className="h-4 w-4" />
                      </button>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          {anotacoes.length > 0 && (
            <div className="max-h-[40%] shrink-0 space-y-1.5 overflow-y-auto border-t border-border p-2">
              <h3 className="px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Anotações na foto</h3>
              {anotacoes.map((a) => {
                const f = FERRAMENTA[a.tipo];
                const comTexto = a.tipo !== "seta" && a.tipo !== "linha";
                return (
                  <div
                    key={a.id}
                    onClick={() => setSelecionado(a.id)}
                    className={`flex items-center gap-2 rounded-lg border p-1.5 ${selecionado === a.id ? "border-primary bg-primary/10" : "border-border bg-muted/30"}`}
                  >
                    <f.Icone className="h-4 w-4 shrink-0 text-muted-foreground" aria-label={f.nome} />
                    {comTexto ? (
                      <input
                        ref={(el) => {
                          if (el && focarAnot === a.id) {
                            el.focus();
                            setFocarAnot(null);
                          }
                        }}
                        value={a.texto}
                        placeholder={f.vazio || f.nome}
                        onFocus={() => setSelecionado(a.id)}
                        onBlur={() => (chaveEdicao.current = null)}
                        onChange={(e) => {
                          registrarEdicao(`anot-${a.id}`);
                          atualizarAnotacao(a.id, { texto: e.target.value });
                        }}
                        className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
                      />
                    ) : (
                      <span className="flex-1 text-sm text-foreground">{f.nome}</span>
                    )}
                    <button
                      type="button"
                      aria-label={`Excluir ${f.nome}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        remover(a.id);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <p className="border-t border-border px-3 py-2 text-[11px] leading-snug text-muted-foreground">
            Cada equipamento pode levar número (nome e instrução na legenda) ou balão escrito na própria foto. Cota, balão e texto também ficam na foto.
          </p>
        </aside>
      </div>
    </div>
  );
}

/** Anotações por cima da foto (SVG em pixels; as formas vêm de `primitivasDaAnotacao`, as mesmas da exportação). */
function CamadaAnotacoes({
  anotacoes,
  largura,
  altura,
  selecionado,
  onArraste,
}: {
  anotacoes: Anotacao[];
  largura: number;
  altura: number;
  selecionado: string | null;
  onArraste: (ev: React.PointerEvent, a: Anotacao, indice: number | "todos") => void;
}) {
  return (
    <svg
      width={largura}
      height={altura}
      viewBox={`0 0 ${largura} ${altura}`}
      className="pointer-events-none absolute left-0 top-0 touch-none overflow-visible"
    >
      {anotacoes.map((a) => {
        const prims = primitivasDaAnotacao(a, largura, altura, medirEtiqueta, { minTam: 11, vazio: FERRAMENTA[a.tipo].vazio });
        const sel = selecionado === a.id || (a.id.startsWith("b:") && selecionado === a.id.slice(2));
        return (
          <g key={a.id} data-anot>
            {prims.map((p, i) => {
              const toque = { onPointerDown: (e: React.PointerEvent) => onArraste(e, a, "todos"), style: { cursor: "grab" } };
              if (p.k === "linha")
                return (
                  <g key={i}>
                    <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.cor} strokeWidth={p.lw} strokeLinecap="round" />
                    <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke="transparent" strokeWidth={Math.max(18, p.lw + 12)} strokeLinecap="round" pointerEvents="stroke" {...toque} />
                  </g>
                );
              if (p.k === "rect")
                return (
                  <g key={i}>
                    <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="none" stroke={p.cor} strokeWidth={p.lw} strokeDasharray={`${p.lw * 2.5} ${p.lw * 2}`} />
                    <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="none" stroke="transparent" strokeWidth={16} pointerEvents="stroke" {...toque} />
                  </g>
                );
              if (p.k === "circ")
                return <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.fundo} stroke={p.cor} strokeWidth={p.lw} pointerEvents="all" {...toque} />;
              return (
                <g key={i} pointerEvents="all" {...toque}>
                  {sel && (
                    <rect x={p.cx - p.w / 2 - 3} y={p.cy - p.h / 2 - 3} width={p.w + 6} height={p.h + 6} rx={p.raio + 2} fill="none" stroke="#2F6FED" strokeWidth={1.5} strokeDasharray="4 3" />
                  )}
                  <rect x={p.cx - p.w / 2} y={p.cy - p.h / 2} width={p.w} height={p.h} rx={p.raio} fill={p.fundo} stroke={p.borda} strokeWidth={Math.max(1.5, p.tam * 0.1)} />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={p.tam} fontWeight={600} fill={p.cor} style={{ fontFamily: FONTE_UI }}>
                    {p.linhas.map((ln, k) => (
                      <tspan key={k} x={p.cx} y={p.cy - (p.linhas.length * p.tam * 1.25) / 2 + p.tam * 0.625 + k * p.tam * 1.25}>
                        {ln}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            })}
            {sel &&
              a.pts.map((q, i) => (
                <circle
                  key={`h${i}`}
                  cx={q.x * largura}
                  cy={q.y * altura}
                  r={8}
                  fill="#fff"
                  stroke="#2F6FED"
                  strokeWidth={2.5}
                  pointerEvents="all"
                  style={{ cursor: "move" }}
                  onPointerDown={(e) => onArraste(e, a, i)}
                />
              ))}
          </g>
        );
      })}
    </svg>
  );
}

/** Uma peça sobre a foto, com as alças de tamanho e giro quando selecionada. */
function Carimbo({
  item,
  numero,
  selecionado,
  onArraste,
}: {
  item: ItemPeca;
  numero?: number;
  selecionado: boolean;
  onArraste: (ev: React.PointerEvent, item: ItemPeca, alca: "corpo" | "prop" | "larg" | "alt" | "giro") => void;
}) {
  const peca = PECAS[item.pecaId];
  if (!peca) return null;
  const alca = "absolute border-2 border-primary bg-card shadow-sm";
  return (
    <div
      data-carimbo
      onPointerDown={(e) => onArraste(e, item, "corpo")}
      className={`absolute touch-none cursor-grab ${selecionado ? "rounded-sm outline outline-2 outline-offset-4 outline-dashed outline-primary" : ""}`}
      style={{
        left: `${item.cx * 100}%`,
        top: `${item.cy * 100}%`,
        width: `${item.w * 100}%`,
        height: `${item.h * 100}%`,
        transform: `translate(-50%,-50%) rotate(${item.rot}deg)`,
      }}
    >
      <img
        src={urlDaPeca(peca)}
        alt=""
        draggable={false}
        className="pointer-events-none block h-full w-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.28)]"
        style={{ objectFit: "fill" }}
      />
      {numero !== undefined && (
        <span className="absolute -right-3 -top-3 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-primary px-1 font-mono text-[11px] font-bold text-primary-foreground">
          {numero}
        </span>
      )}
      {selecionado && (
        <>
          <span onPointerDown={(e) => onArraste(e, item, "prop")} className={`${alca} -left-2.5 -top-2.5 h-4 w-4 cursor-nwse-resize rounded`} />
          <span
            onPointerDown={(e) => onArraste(e, item, "larg")}
            className={`${alca} -right-2.5 top-1/2 h-6 w-3.5 -translate-y-1/2 cursor-ew-resize rounded`}
          />
          <span
            onPointerDown={(e) => onArraste(e, item, "alt")}
            className={`${alca} -bottom-2.5 left-1/2 h-3.5 w-6 -translate-x-1/2 cursor-ns-resize rounded`}
          />
          <span className="absolute -top-4 left-1/2 h-4 w-0.5 -translate-x-1/2 bg-primary" />
          <span
            onPointerDown={(e) => onArraste(e, item, "giro")}
            className="absolute -top-8 left-1/2 flex h-[18px] w-[18px] -translate-x-1/2 cursor-grab items-center justify-center rounded-full border-2 border-primary bg-card text-[11px] text-primary shadow-sm"
            aria-label="Girar"
          >
            ⟳
          </span>
        </>
      )}
    </div>
  );
}

const ehPanoramica = (f: FotoMapeamento) => /panor/i.test(f.legenda);

function EscolherFoto({
  fotos,
  carregando,
  onEscolher,
  onArquivo,
  arquivoRef,
}: {
  fotos: FotoMapeamento[] | null;
  carregando: boolean;
  onEscolher: (f: FotoMapeamento) => void;
  onArquivo: (f: File) => void;
  arquivoRef: React.MutableRefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="text-center">
          <h3 className="text-base font-semibold text-foreground">Comece por uma foto</h3>
          <p className="text-sm text-muted-foreground">
            Escolha uma foto do mapeamento (as panorâmicas do local aparecem primeiro) ou envie outra do seu computador.
          </p>
        </div>
        <input
          ref={arquivoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onArquivo(f);
            e.target.value = "";
          }}
        />
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => arquivoRef.current?.click()} disabled={carregando}>
            <ImagePlus className="h-4 w-4" /> Enviar foto do computador
          </Button>
        </div>
        {carregando && (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Abrindo a foto…
          </p>
        )}
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Fotos do mapeamento</p>
          {fotos === null ? (
            <p className="text-sm text-muted-foreground">Carregando fotos…</p>
          ) : fotos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este mapeamento não tem fotos do agente. Envie uma foto.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[...fotos.filter(ehPanoramica), ...fotos.filter((f) => !ehPanoramica(f))].map((f) => (
                <button
                  key={f.path}
                  type="button"
                  disabled={carregando}
                  onClick={() => onEscolher(f)}
                  className="relative overflow-hidden rounded-lg border border-border bg-card text-left transition hover:border-primary disabled:opacity-50"
                >
                  {ehPanoramica(f) && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
                      Sugerida
                    </span>
                  )}
                  <img src={f.url} alt={f.legenda} loading="lazy" className="h-28 w-full object-cover" />
                  <span className="line-clamp-2 block px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">{f.legenda}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
