import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  GripVertical,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Table as TableIcon,
  Trash2,
} from "lucide-react";
import { Badge, Button, Card, Input, Textarea } from "@/components/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import {
  resolverConflitoLaudo,
  restaurarBlocoLaudo,
  salvarDocumentoLaudo,
} from "@/lib/laudo.functions";
import { BibliotecaModal } from "@/components/laudo/BibliotecaModal";
import { arvoreDocumento, fimDaSecao, renumerar } from "@/lib/laudo/numeracao";
import { comChaves, conteudoDoBloco, marcarEdicao } from "@/lib/laudo/mesclar";
import type { BlocoLaudo, LaudoConteudo, TipoBloco } from "@/lib/laudo/tipos";

const NOVOS: { tipo: TipoBloco; rotulo: string; nivel?: 1 | 2 | 3 | 4 }[] = [
  { tipo: "paragraph", rotulo: "Texto" },
  { tipo: "heading", rotulo: "Tópico", nivel: 1 },
  { tipo: "heading", rotulo: "Subtópico", nivel: 2 },
  { tipo: "heading", rotulo: "Subnível", nivel: 3 },
  { tipo: "table", rotulo: "Tabela" },
  { tipo: "image", rotulo: "Imagem" },
  { tipo: "observacao", rotulo: "Observação técnica" },
  { tipo: "bullets", rotulo: "Lista" },
  { tipo: "pagebreak", rotulo: "Quebra de página" },
];

function novoId() {
  return `m-${Math.random().toString(36).slice(2, 10)}`;
}

function criarBloco(tipo: TipoBloco, nivel?: 1 | 2 | 3 | 4): BlocoLaudo {
  const base = {
    id: novoId(),
    chave: `manual:${novoId()}`,
    origem: "manual" as const,
    editavel: true,
    removivel: true,
  };
  switch (tipo) {
    case "heading":
      return { ...base, tipo: "heading", numero: "", texto: "Novo tópico", nivel: nivel ?? 1 };
    case "bullets":
      return { ...base, tipo: "bullets", itens: ["Novo item"] };
    case "table":
      return {
        ...base,
        tipo: "table",
        titulo: "Nova tabela",
        colunas: ["Coluna 1", "Coluna 2"],
        linhas: [{ celulas: ["", ""] }],
      };
    case "image":
      return { ...base, tipo: "image", url: "", alt: "Imagem do documento", legenda: null };
    case "observacao":
      return { ...base, tipo: "observacao", titulo: "OBSERVAÇÃO TÉCNICA", texto: "" };
    case "pagebreak":
      return { ...base, tipo: "pagebreak" };
    default:
      return { ...base, tipo: "paragraph", texto: "" };
  }
}

function Pendencia({ texto }: { texto: string }) {
  const partes = texto.split(/(\[CONFIRMAR:[^\]]*\])/g);
  return (
    <>
      {partes.map((p, i) =>
        p.startsWith("[CONFIRMAR:") ? (
          <span
            key={i}
            className="rounded bg-amber-100 px-1 font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
          >
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function Visual({ bloco }: { bloco: BlocoLaudo }) {
  switch (bloco.tipo) {
    case "heading": {
      const cls =
        bloco.nivel === 1
          ? "mt-6 text-base font-semibold"
          : bloco.nivel === 2
            ? "mt-4 text-sm font-semibold"
            : "mt-3 text-sm font-medium";
      return (
        <h3 id={`bloco-${bloco.id}`} className={`${cls} text-foreground`}>
          {bloco.numero ? `${bloco.numero}. ` : ""}
          {bloco.texto}
        </h3>
      );
    }
    case "paragraph":
      return (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          <Pendencia texto={bloco.texto} />
        </p>
      );
    case "bullets":
      return (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {bloco.itens.map((i, k) => (
            <li key={k}>
              <Pendencia texto={i} />
            </li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          {bloco.titulo ? (
            <div className="border-b border-border bg-muted/40 px-3 py-2 text-xs font-semibold">
              {bloco.titulo}
            </div>
          ) : null}
          <table className="w-full text-xs">
            <thead className="bg-muted/20 text-muted-foreground">
              <tr>
                {bloco.colunas.map((c, i) => (
                  <th key={i} className="px-3 py-2 text-left font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloco.linhas.map((l, i) => (
                <tr key={i} className="border-t border-border">
                  {l.celulas.map((c, j) => (
                    <td key={j} className="px-3 py-2 align-top">
                      <Pendencia texto={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "notes":
      return (
        <ul className="mt-2 space-y-1 text-xs italic text-muted-foreground">
          {bloco.itens.map((i, k) => (
            <li key={k}>Obs.: {i}</li>
          ))}
        </ul>
      );
    case "alert":
      return (
        <div
          className={`mt-3 flex gap-2 rounded-lg border p-3 text-sm ${
            bloco.severidade === "bloqueante"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          }`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{bloco.texto}</span>
        </div>
      );
    case "observacao":
      return (
        <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <p className="text-xs font-semibold tracking-wide text-foreground">
            {bloco.titulo || "OBSERVAÇÃO TÉCNICA"}
          </p>
          <p className="mt-1 text-muted-foreground">
            <Pendencia texto={bloco.texto} />
          </p>
        </div>
      );
    case "pagebreak":
      return (
        <div className="my-4 border-t border-dashed border-border text-center text-[10px] uppercase tracking-widest text-muted-foreground">
          quebra de página
        </div>
      );
    case "image":
      return (
        <figure className="mt-4 flex flex-col items-center gap-2">
          {bloco.url ? (
            <img
              src={bloco.url}
              alt={bloco.alt}
              loading="lazy"
              className="w-full rounded-lg border border-border bg-background object-contain p-2"
              style={{ maxWidth: bloco.larguraMax ?? 360 }}
            />
          ) : (
            <div className="w-full rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              Nenhuma imagem selecionada
            </div>
          )}
          {bloco.legenda ? (
            <figcaption className="text-center text-xs text-muted-foreground">
              {bloco.legenda}
            </figcaption>
          ) : null}
        </figure>
      );
  }
}

function EditorBloco({
  bloco,
  onChange,
  casoId,
}: {
  bloco: BlocoLaudo;
  onChange: (b: BlocoLaudo) => void;
  casoId: string;
}) {
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function upload(file: File) {
    setEnviando(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `laudos/${casoId}/${novoId()}.${ext}`;
      const { error } = await supabase.storage
        .from("empresa-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("empresa-logos").getPublicUrl(path);
      onChange({ ...(bloco as any), url: data.publicUrl });
      toast.success("Imagem adicionada ao documento.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar a imagem.");
    } finally {
      setEnviando(false);
    }
  }

  switch (bloco.tipo) {
    case "heading":
      return (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
            value={bloco.nivel}
            onChange={(e) =>
              onChange({ ...bloco, nivel: Number(e.target.value) as 1 | 2 | 3 | 4 })
            }
          >
            <option value={1}>Tópico</option>
            <option value={2}>Subtópico</option>
            <option value={3}>Subnível</option>
            <option value={4}>Subnível 4</option>
          </select>
          <Input
            className="flex-1"
            value={bloco.texto}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ ...bloco, texto: v });
            }}
          />
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={bloco.numero !== null}
              onChange={(e) => onChange({ ...bloco, numero: e.target.checked ? "" : null })}
            />
            numerar
          </label>
        </div>
      );
    case "paragraph":
      return (
        <Textarea
          rows={4}
          value={bloco.texto}
          onChange={(e) => {
            const v = e.target.value;
            onChange({ ...bloco, texto: v });
          }}
        />
      );
    case "observacao":
      return (
        <div className="space-y-2">
          <Input
            value={bloco.titulo ?? ""}
            placeholder="OBSERVAÇÃO TÉCNICA"
            onChange={(e) => {
              const v = e.target.value;
              onChange({ ...bloco, titulo: v });
            }}
          />
          <Textarea
            rows={3}
            value={bloco.texto}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ ...bloco, texto: v });
            }}
          />
        </div>
      );
    case "bullets":
    case "notes":
      return (
        <div className="space-y-2">
          {bloco.itens.map((it, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={it}
                onChange={(e) => {
                  const v = e.target.value;
                  const itens = [...bloco.itens];
                  itens[i] = v;
                  onChange({ ...bloco, itens });
                }}
              />
              <Button
                variant="secondary"
                onClick={() => onChange({ ...bloco, itens: bloco.itens.filter((_, k) => k !== i) })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="secondary" onClick={() => onChange({ ...bloco, itens: [...bloco.itens, ""] })}>
            <Plus className="mr-2 h-4 w-4" /> Item
          </Button>
        </div>
      );
    case "table":
      return (
        <div className="space-y-2">
          <Input
            value={bloco.titulo ?? ""}
            placeholder="Título da tabela"
            onChange={(e) => {
              const v = e.target.value;
              onChange({ ...bloco, titulo: v });
            }}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {bloco.colunas.map((c, j) => (
                    <th key={j} className="p-1">
                      <Input
                        value={c}
                        onChange={(e) => {
                          const v = e.target.value;
                          const colunas = [...bloco.colunas];
                          colunas[j] = v;
                          onChange({ ...bloco, colunas });
                        }}
                      />
                    </th>
                  ))}
                  <th className="p-1">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        onChange({
                          ...bloco,
                          colunas: bloco.colunas.slice(0, -1),
                          linhas: bloco.linhas.map((l) => ({
                            ...l,
                            celulas: l.celulas.slice(0, -1),
                          })),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {bloco.linhas.map((l, i) => (
                  <tr key={i}>
                    {bloco.colunas.map((_, j) => (
                      <td key={j} className="p-1">
                        <Input
                          value={l.celulas[j] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            const linhas = bloco.linhas.map((row, k) => {
                              if (k !== i) return row;
                              const celulas = [...row.celulas];
                              celulas[j] = v;
                              return { ...row, celulas };
                            });
                            onChange({ ...bloco, linhas });
                          }}
                        />
                      </td>
                    ))}
                    <td className="p-1">
                      <Button
                        variant="secondary"
                        onClick={() =>
                          onChange({ ...bloco, linhas: bloco.linhas.filter((_, k) => k !== i) })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                onChange({
                  ...bloco,
                  linhas: [...bloco.linhas, { celulas: bloco.colunas.map(() => "") }],
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" /> Linha
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                onChange({
                  ...bloco,
                  colunas: [...bloco.colunas, `Coluna ${bloco.colunas.length + 1}`],
                  linhas: bloco.linhas.map((l) => ({ ...l, celulas: [...l.celulas, ""] })),
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" /> Coluna
            </Button>
          </div>
        </div>
      );
    case "image":
      return (
        <div className="space-y-2">
          {bloco.url ? (
            <img
              src={bloco.url}
              alt={bloco.alt}
              className="max-h-48 rounded-lg border border-border object-contain p-2"
            />
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={enviando}>
              {enviando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="mr-2 h-4 w-4" />
              )}
              {bloco.url ? "Substituir imagem" : "Enviar imagem"}
            </Button>
            {bloco.url ? (
              <Button variant="secondary" onClick={() => onChange({ ...bloco, url: "" })}>
                <Trash2 className="mr-2 h-4 w-4" /> Remover imagem
              </Button>
            ) : null}
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-xs"
              value={bloco.larguraMax ?? 360}
              onChange={(e) => onChange({ ...bloco, larguraMax: Number(e.target.value) })}
            >
              <option value={240}>Pequena</option>
              <option value={360}>Média</option>
              <option value={480}>Grande</option>
            </select>
          </div>
          <Input
            value={bloco.legenda ?? ""}
            placeholder="Legenda"
            onChange={(e) => {
              const v = e.target.value;
              onChange({ ...bloco, legenda: v });
            }}
          />
          <Input
            value={bloco.alt}
            placeholder="Descrição técnica"
            onChange={(e) => {
              const v = e.target.value;
              onChange({ ...bloco, alt: v });
            }}
          />
        </div>
      );
    case "alert":
      return (
        <Textarea
          rows={3}
          value={bloco.texto}
          onChange={(e) => {
            const v = e.target.value;
            onChange({ ...bloco, texto: v });
          }}
        />
      );
    case "pagebreak":
      return <p className="text-xs text-muted-foreground">Quebra de página (sem conteúdo).</p>;
  }
}

function MenuAdicionar({
  onAdd,
  onBlocoPadrao,
  onFoto,
}: {
  onAdd: (tipo: TipoBloco, nivel?: 1 | 2 | 3 | 4) => void;
  onBlocoPadrao?: () => void;
  onFoto?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="relative flex justify-center py-1">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground opacity-40 transition hover:opacity-100"
        title="Adicionar conteúdo"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      {aberto && (
        <div className="absolute top-8 z-20 w-56 rounded-lg border border-border bg-background p-1 shadow-lg">
          {NOVOS.map((n) => (
            <button
              key={n.rotulo}
              type="button"
              className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
              onClick={() => {
                onAdd(n.tipo, n.nivel);
                setAberto(false);
              }}
            >
              {n.rotulo}
            </button>
          ))}
          {onBlocoPadrao && (
            <button
              type="button"
              className="block w-full rounded px-2 py-1.5 text-left text-xs font-medium hover:bg-muted"
              onClick={() => {
                onBlocoPadrao();
                setAberto(false);
              }}
            >
              Inserir bloco padrão…
            </button>
          )}
          {onFoto && (
            <button
              type="button"
              className="block w-full rounded px-2 py-1.5 text-left text-xs font-medium hover:bg-muted"
              onClick={() => {
                onFoto();
                setAberto(false);
              }}
            >
              Inserir foto do mapeamento…
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function DocumentoEditor({
  casoId,
  conteudo,
  onConteudo,
  onDirtyChange,
  modo: modoProp,
  onModoChange,
  onArvoreChange,
  registrarSalvar,
  semChrome = false,
}: {
  casoId: string;
  conteudo: LaudoConteudo | null;
  onConteudo: (c: LaudoConteudo) => void;
  /** avisa o pai quando há edição do DOCUMENTO ainda não salva */
  onDirtyChange?: (sujo: boolean) => void;
  /** modo controlado pelo pai (segmented control da tela de revisão) */
  modo?: "editar" | "visualizar";
  onModoChange?: (m: "editar" | "visualizar") => void;
  /** publica o sumário do documento para a navegação lateral do pai */
  onArvoreChange?: (arvore: ReturnType<typeof arvoreDocumento>) => void;
  /** expõe o salvar do documento para o botão principal do cabeçalho */
  registrarSalvar?: (fn: (() => Promise<void>) | null) => void;
  /** esconde sumário e barra internos (usados pelo layout da revisão) */
  semChrome?: boolean;
}) {
  const fnSalvar = useServerFn(salvarDocumentoLaudo);
  const fnConflito = useServerFn(resolverConflitoLaudo);
  const fnRestaurar = useServerFn(restaurarBlocoLaudo);

  const [modoInterno, setModoInterno] = useState<"editar" | "visualizar">("visualizar");
  const modo = modoProp ?? modoInterno;
  const setModo = (m: "editar" | "visualizar") => {
    setModoInterno(m);
    onModoChange?.(m);
  };
  const [blocos, setBlocos] = useState<BlocoLaudo[]>(() =>
    renumerar(comChaves(conteudo?.blocos ?? [])),
  );
  const [editando, setEditando] = useState<string | null>(null);
  const [sujo, setSujo] = useState(false);
  useEffect(() => {
    onDirtyChange?.(sujo);
  }, [sujo, onDirtyChange]);
  const [salvando, setSalvando] = useState(false);
  const arrastando = useRef<number | null>(null);
  const [biblioteca, setBiblioteca] = useState<"padrao" | "foto" | null>(null);
  const [alvoInsercao, setAlvoInsercao] = useState(0);
  const idAtual = useRef(conteudo?.gerado_em ?? "");

  // recarrega quando o documento é regerado no servidor
  if (conteudo && conteudo.gerado_em !== idAtual.current && !sujo) {
    idAtual.current = conteudo.gerado_em;
    const novos = renumerar(comChaves(conteudo.blocos ?? []));
    if (JSON.stringify(novos) !== JSON.stringify(blocos)) setBlocos(novos);
  }


  const visiveis = useMemo(() => blocos.filter((b) => !b.oculto), [blocos]);
  const arvore = useMemo(() => arvoreDocumento(blocos), [blocos]);
  const pendencias = useMemo(
    () => visiveis.filter((b) => JSON.stringify(b).includes("[CONFIRMAR:")).length,
    [visiveis],
  );
  const conflitos = useMemo(() => blocos.filter((b) => b.conflito), [blocos]);

  useEffect(() => {
    onArvoreChange?.(arvore);
  }, [arvore, onArvoreChange]);

  const salvarRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    registrarSalvar?.(() => salvarRef.current());
    return () => registrarSalvar?.(null);
  }, [registrarSalvar]);



  function atualizar(next: BlocoLaudo[]) {
    setBlocos(renumerar(next));
    setSujo(true);
  }

  function editarBloco(indice: number, novo: BlocoLaudo) {
    const anterior = blocos[indice];
    const next = [...blocos];
    next[indice] = marcarEdicao(anterior, novo);
    atualizar(next);
  }

  function inserirBlocos(indice: number, novos: BlocoLaudo[]) {
    if (!novos.length) return;
    const marcados = novos.map((b) => ({
      ...(b as any),
      id: novoId(),
      chave: `manual:${novoId()}`,
      origem: "manual",
      editavel: true,
      removivel: true,
    })) as BlocoLaudo[];
    const next = [...blocos];
    next.splice(indice, 0, ...marcados);
    atualizar(next);
    setModo("editar");
  }

  function inserir(indice: number, tipo: TipoBloco, nivel?: 1 | 2 | 3 | 4) {
    const next = [...blocos];
    next.splice(indice, 0, criarBloco(tipo, nivel));
    atualizar(next);
    setModo("editar");
  }

  function mover(indice: number, direcao: -1 | 1) {
    const fim = fimDaSecao(blocos, indice);
    const trecho = blocos.slice(indice, blocos[indice].tipo === "heading" ? fim : indice + 1);
    const resto = [...blocos.slice(0, indice), ...blocos.slice(indice + trecho.length)];
    const destino = direcao === -1 ? Math.max(0, indice - 1) : Math.min(resto.length, indice + 1);
    resto.splice(destino, 0, ...trecho);
    atualizar(resto);
  }

  function soltar(destino: number) {
    const origem = arrastando.current;
    arrastando.current = null;
    if (origem === null || origem === destino) return;
    const fim = fimDaSecao(blocos, origem);
    const trecho = blocos.slice(origem, blocos[origem].tipo === "heading" ? fim : origem + 1);
    const resto = [...blocos.slice(0, origem), ...blocos.slice(origem + trecho.length)];
    const idx = destino > origem ? destino - trecho.length : destino;
    resto.splice(Math.max(0, Math.min(resto.length, idx)), 0, ...trecho);
    atualizar(resto);
  }

  function remover(indice: number) {
    const b = blocos[indice];
    const next = [...blocos];
    if (b.origem === "manual") next.splice(indice, 1);
    else next[indice] = { ...(b as any), oculto: true } as BlocoLaudo;
    atualizar(next);
  }

  function duplicar(indice: number) {
    const b = blocos[indice];
    const copia = {
      ...(JSON.parse(JSON.stringify(conteudoDoBloco(b))) as any),
      tipo: b.tipo,
      id: novoId(),
      chave: `manual:${novoId()}`,
      origem: "manual",
      editavel: true,
      removivel: true,
    } as BlocoLaudo;
    const next = [...blocos];
    next.splice(indice + 1, 0, copia);
    atualizar(next);
  }

  async function salvar() {
    setSalvando(true);
    try {
      const r = await fnSalvar({ data: { casoId, blocos: blocos as any } });
      setBlocos(r.conteudo.blocos as BlocoLaudo[]);
      idAtual.current = r.conteudo.gerado_em;
      setSujo(false);
      onConteudo(r.conteudo as LaudoConteudo);
      toast.success("Documento salvo.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar o documento.");
    } finally {
      setSalvando(false);
    }
  }

  async function resolver(chave: string, decisao: "manter_edicao" | "atualizar_formulario") {
    try {
      const r = await fnConflito({ data: { casoId, chave, decisao } });
      setBlocos(r.conteudo.blocos as BlocoLaudo[]);
      idAtual.current = r.conteudo.gerado_em;
      setSujo(false);
      onConteudo(r.conteudo as LaudoConteudo);
      toast.success("Conflito resolvido.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao resolver o conflito.");
    }
  }

  async function restaurar(chave: string) {
    try {
      const r = await fnRestaurar({ data: { casoId, chave } });
      setBlocos(r.conteudo.blocos as BlocoLaudo[]);
      idAtual.current = r.conteudo.gerado_em;
      setSujo(false);
      onConteudo(r.conteudo as LaudoConteudo);
      toast.success("Conteúdo original restaurado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao restaurar o bloco.");
    }
  }

  if (!conteudo?.blocos?.length) {
    return (
      <Card className="p-5">
        <p className="text-sm text-muted-foreground">
          Clique em “Gerar laudo” para montar o documento a partir das respostas.
        </p>
      </Card>
    );
  }

  return (
    <div className={semChrome ? "" : "grid gap-4 lg:grid-cols-[220px_1fr]"}>
      {!semChrome && (
        <Card className="h-fit p-3 lg:sticky lg:top-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Documento
          </p>
          <nav className="space-y-0.5 text-xs">
            {arvore.map((n) => (
              <button
                key={n.id}
                type="button"
                className="block w-full truncate rounded px-1 py-1 text-left hover:bg-muted"
                style={{ paddingLeft: 4 + (n.nivel - 1) * 10 }}
                onClick={() =>
                  document
                    .getElementById(`bloco-${n.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" })
                }
              >
                {n.numero ? `${n.numero}. ` : ""}
                {n.texto}
              </button>
            ))}
          </nav>
        </Card>
      )}

      <div className="space-y-3">
        {!semChrome && (
          <Card className="flex flex-wrap items-center justify-between gap-2 p-3">
            <div className="flex items-center gap-2">
              <Button
                variant={modo === "editar" ? "primary" : "secondary"}
                onClick={() => setModo("editar")}
              >
                <Pencil className="mr-2 h-4 w-4" /> Editar documento
              </Button>
              <Button
                variant={modo === "visualizar" ? "primary" : "secondary"}
                onClick={() => {
                  setModo("visualizar");
                  setEditando(null);
                }}
              >
                <Eye className="mr-2 h-4 w-4" /> Visualizar
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {pendencias > 0 && (
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  {pendencias} pendência(s) de confirmação
                </Badge>
              )}
              <Button onClick={salvar} disabled={!sujo || salvando}>
                {salvando ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar documento
              </Button>
            </div>
          </Card>
        )}


        {conflitos.length > 0 && (
          <Card className="space-y-3 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" /> {conflitos.length} conteúdo(s) alterado(s)
              manualmente divergem do formulário
            </p>
            {conflitos.map((b) => (
              <div key={b.chave} className="rounded-lg border border-border p-3 text-xs">
                <p className="font-medium">Conteúdo atual (edição manual)</p>
                <pre className="mt-1 whitespace-pre-wrap text-muted-foreground">
                  {JSON.stringify(conteudoDoBloco(b), null, 1)}
                </pre>
                <p className="mt-2 font-medium">Valor do formulário</p>
                <pre className="mt-1 whitespace-pre-wrap text-muted-foreground">
                  {JSON.stringify(b.conflito, null, 1)}
                </pre>
                <div className="mt-2 flex gap-2">
                  <Button variant="secondary" onClick={() => resolver(b.chave!, "manter_edicao")}>
                    Manter edição
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => resolver(b.chave!, "atualizar_formulario")}
                  >
                    Atualizar com formulário
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        )}

        <Card className="p-5">
          {modo === "editar" && (
            <MenuAdicionar
              onAdd={(t, n) => inserir(0, t, n)}
              onBlocoPadrao={() => {
                setAlvoInsercao(0);
                setBiblioteca("padrao");
              }}
              onFoto={() => {
                setAlvoInsercao(0);
                setBiblioteca("foto");
              }}
            />
          )}
          {blocos.map((b, i) => {
            if (b.oculto) {
              if (modo !== "editar") return null;
              return (
                <div
                  key={b.id}
                  className="my-1 flex items-center justify-between rounded border border-dashed border-border px-2 py-1 text-xs text-muted-foreground"
                >
                  <span>Bloco removido ({b.tipo})</span>
                  <Button variant="secondary" onClick={() => restaurar(b.chave!)}>
                    <RotateCcw className="mr-2 h-3.5 w-3.5" /> Restaurar
                  </Button>
                </div>
              );
            }
            if (modo === "visualizar") return <Visual key={b.id} bloco={b} />;
            return (
              <div key={b.id}>
                <div
                  draggable
                  onDragStart={() => (arrastando.current = i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => soltar(i)}
                  className="group relative rounded-lg border border-transparent px-2 py-1 transition hover:border-border hover:bg-muted/20"
                >
                  <div className="absolute right-1 top-1 z-10 hidden gap-1 group-hover:flex">
                    <button
                      type="button"
                      className="rounded border border-border bg-background p-1 text-muted-foreground"
                      title="Arrastar"
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="rounded border border-border bg-background p-1 text-muted-foreground"
                      title="Editar"
                      onClick={() => setEditando(editando === b.id ? null : b.id)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="rounded border border-border bg-background p-1 text-muted-foreground"
                      title="Mover para cima"
                      onClick={() => mover(i, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="rounded border border-border bg-background p-1 text-muted-foreground"
                      title="Mover para baixo"
                      onClick={() => mover(i, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="rounded border border-border bg-background p-1 text-muted-foreground"
                      title="Duplicar"
                      onClick={() => duplicar(i)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    {b.removivel !== false && (
                      <button
                        type="button"
                        className="rounded border border-border bg-background p-1 text-destructive"
                        title="Excluir"
                        onClick={() => remover(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {editando === b.id ? (
                    <div className="space-y-2 py-2">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        {b.tipo === "table" ? <TableIcon className="h-3.5 w-3.5" /> : null}
                        <span>Editando: {b.tipo}</span>
                        {b.editado_manualmente && (
                          <button
                            type="button"
                            className="underline"
                            onClick={() => restaurar(b.chave!)}
                          >
                            restaurar original
                          </button>
                        )}
                      </div>
                      <EditorBloco
                        bloco={b}
                        casoId={casoId}
                        onChange={(novo) => editarBloco(i, novo)}
                      />
                    </div>
                  ) : (
                    <Visual bloco={b} />
                  )}
                </div>
                <MenuAdicionar
                  onAdd={(t, n) => inserir(i + 1, t, n)}
                  onBlocoPadrao={() => {
                    setAlvoInsercao(i + 1);
                    setBiblioteca("padrao");
                  }}
                  onFoto={() => {
                    setAlvoInsercao(i + 1);
                    setBiblioteca("foto");
                  }}
                />
              </div>
            );
          })}
        </Card>
      </div>

      <BibliotecaModal
        casoId={casoId}
        tipo={biblioteca}
        onClose={() => setBiblioteca(null)}
        onInserir={(novos: BlocoLaudo[]) => {
          inserirBlocos(alvoInsercao, novos);
          setBiblioteca(null);
        }}
      />
    </div>
  );
}
