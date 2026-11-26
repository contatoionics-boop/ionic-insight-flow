import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, ImagePlus, Loader2, Pencil, Trash2 } from "lucide-react";
import { Badge, Button, Card, Input, Modal } from "@/components/ui-bits";
import type { BlocoPadrao } from "@/lib/blocos-padrao.functions";
import { excluirImagemBiblioteca, salvarImagemBiblioteca } from "@/lib/biblioteca-imagens.functions";
import { LIMITE_FOTO_BYTES, prepararImagem } from "@/lib/midia-upload";
import { FIGURAS_TEXTO, lerSlot, type ImagemBiblioteca, type NomeFigura } from "@/lib/laudo/textos-padrao";

/** Imagens da biblioteca (linhas de `blocos_padrao` com categoria "imagem"), prontas para uso nos editores. */
export function imagensDaLista(lista: BlocoPadrao[]): ImagemBiblioteca[] {
  return lista
    .filter((b) => b.categoria === "imagem")
    .flatMap((b) => {
      const bloco = (b.blocos ?? []).find((x: any) => x?.tipo === "image" && x.url) as any;
      return bloco ? [{ id: b.id, nome: b.nome, url: bloco.url, alt: bloco.alt ?? "", legenda: bloco.legenda ?? "", larguraMax: bloco.larguraMax ?? 360 }] : [];
    })
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

/** Nomes das versões de texto que usam a imagem (para avisar antes de excluir). */
export function usosDaImagem(id: string, lista: BlocoPadrao[]): string[] {
  return lista.filter((b) => lerSlot(b.escopo).slot && (b.blocos ?? []).some((x: any) => x?.bibliotecaId === id)).map((b) => b.nome);
}

const LARGURAS = [
  { valor: 240, rotulo: "Pequena" },
  { valor: 360, rotulo: "Média" },
  { valor: 480, rotulo: "Grande" },
];

const paraBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    r.readAsDataURL(blob);
  });

type Form = { id?: string; nome: string; legenda: string; alt: string; larguraMax: number; arquivo?: File; previa?: string; urlAtual?: string };

/**
 * Biblioteca de imagens dos textos do documento: envio, nome, legenda, largura, troca do arquivo e exclusão.
 * As imagens do sistema (bico, ponteira, suporte) ficam listadas à parte e podem ser copiadas para a biblioteca.
 */
export function BibliotecaImagens({ lista, onAlterou }: { lista: BlocoPadrao[]; onAlterou: () => void | Promise<void> }) {
  const fnSalvar = useServerFn(salvarImagemBiblioteca);
  const fnExcluir = useServerFn(excluirImagemBiblioteca);
  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [copiando, setCopiando] = useState<string | null>(null);
  const arquivoRef = useRef<HTMLInputElement | null>(null);
  const imagens = imagensDaLista(lista);

  function nova() {
    setForm({ nome: "", legenda: "", alt: "", larguraMax: 360 });
  }
  function editar(im: ImagemBiblioteca) {
    setForm({ id: im.id, nome: im.nome, legenda: im.legenda, alt: im.alt, larguraMax: im.larguraMax, urlAtual: im.url });
  }

  function escolherArquivo(f: File | undefined) {
    if (!f || !form) return;
    if (!f.type.startsWith("image/")) return void toast.error("Escolha um arquivo de imagem (JPG, PNG ou WebP).");
    if (f.size > LIMITE_FOTO_BYTES) return void toast.error("A imagem deve ter no máximo 25 MB.");
    if (form.previa) URL.revokeObjectURL(form.previa);
    setForm({ ...form, arquivo: f, previa: URL.createObjectURL(f), nome: form.nome || f.name.replace(/\.[^.]+$/, "") });
  }

  async function enviar(f: Form, arquivo: File | Blob | undefined, tipoArquivo?: string) {
    let arquivoDados: { contentType: "image/jpeg" | "image/png" | "image/webp"; base64: string } | undefined;
    if (arquivo) {
      // reduz e converte (HEIC, fotos enormes) para JPEG; PNG/WebP leves seguem como estão
      const prep = await prepararImagem(arquivo as File, { maxLado: 1800 });
      const ct = /png/i.test(prep.tipo) ? "image/png" : /webp/i.test(prep.tipo) ? "image/webp" : "image/jpeg";
      if (prep.blob.size > 9_000_000) throw new Error("A imagem ficou grande demais depois de reduzida. Use uma imagem menor.");
      arquivoDados = { contentType: tipoArquivo ? (tipoArquivo as typeof ct) : ct, base64: await paraBase64(prep.blob) };
    }
    return fnSalvar({
      data: { id: f.id, nome: f.nome, legenda: f.legenda, alt: f.alt, larguraMax: f.larguraMax, ...(arquivoDados ? { arquivo: arquivoDados } : {}) },
    });
  }

  async function salvar() {
    if (!form) return;
    if (!form.id && !form.arquivo) return void toast.error("Escolha o arquivo da imagem.");
    setSalvando(true);
    try {
      await enviar(form, form.arquivo);
      toast.success(form.id ? "Imagem atualizada." : "Imagem adicionada à biblioteca.");
      if (form.previa) URL.revokeObjectURL(form.previa);
      setForm(null);
      await onAlterou();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar a imagem.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(im: ImagemBiblioteca) {
    const usos = usosDaImagem(im.id, lista);
    const aviso = usos.length ? `\n\nEla é usada em: ${usos.join(", ")}. Nesses textos o espaço da imagem passará a pedir confirmação.` : "";
    if (!confirm(`Excluir a imagem "${im.nome}" da biblioteca?${aviso}`)) return;
    try {
      await fnExcluir({ data: { id: im.id } });
      toast.success("Imagem excluída.");
      await onAlterou();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir.");
    }
  }

  async function copiarDoSistema(nome: NomeFigura) {
    const fig = FIGURAS_TEXTO[nome];
    setCopiando(nome);
    try {
      const resp = await fetch(fig.url);
      if (!resp.ok) throw new Error("Não foi possível ler a imagem do sistema.");
      const blob = await resp.blob();
      const arquivo = new File([blob], `${nome}.png`, { type: blob.type || "image/png" });
      await enviar({ nome: `${fig.legendaBase} (cópia)`, legenda: fig.legendaBase, alt: fig.alt, larguraMax: fig.larguraMax ?? 360 }, arquivo);
      toast.success("Copiada para a biblioteca. Agora você pode trocar o arquivo, mudar a legenda ou excluir.");
      await onAlterou();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao copiar.");
    } finally {
      setCopiando(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Biblioteca de imagens</h2>
          <p className="text-xs text-muted-foreground">
            Imagens que podem ser colocadas nos textos do documento (botão “Imagem” no editor do texto). Aqui você envia, renomeia, troca o arquivo e exclui.
          </p>
        </div>
        <Button onClick={nova}>
          <ImagePlus className="mr-2 h-4 w-4" /> Enviar imagem
        </Button>
      </div>

      {imagens.length === 0 ? (
        <Card className="p-4 text-xs text-muted-foreground">Nenhuma imagem na biblioteca ainda.</Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {imagens.map((im) => {
            const usos = usosDaImagem(im.id, lista);
            return (
              <Card key={im.id} className="flex gap-3 p-3">
                <img src={im.url} alt={im.alt} className="h-20 w-28 shrink-0 rounded border border-border bg-white object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{im.nome}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{im.legenda || "Sem legenda"}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                    <Badge className="bg-muted text-muted-foreground">{LARGURAS.find((l) => l.valor === im.larguraMax)?.rotulo ?? `${im.larguraMax}px`}</Badge>
                    {usos.length > 0 ? `Usada em ${usos.length} texto(s)` : "Não usada em nenhum texto"}
                  </p>
                  <div className="mt-2 flex gap-1">
                    <Button variant="secondary" onClick={() => editar(im)} aria-label="Editar imagem">
                      <Pencil className="mr-1.5 h-4 w-4" /> Editar
                    </Button>
                    <Button variant="secondary" onClick={() => excluir(im)} aria-label="Excluir imagem">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <details className="rounded-lg border border-border p-3 text-xs">
        <summary className="cursor-pointer font-medium">Imagens do sistema (bico, ponteira, suporte)</summary>
        <p className="mt-2 text-muted-foreground">
          Essas três ficam dentro do próprio aplicativo e não podem ser trocadas nem apagadas por aqui. Para usar uma versão sua, copie-a para a biblioteca: a cópia
          é uma imagem normal, que você pode substituir, renomear e excluir.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {(Object.keys(FIGURAS_TEXTO) as NomeFigura[]).map((n) => (
            <div key={n} className="rounded-md border border-border p-2">
              <img src={FIGURAS_TEXTO[n].url} alt={FIGURAS_TEXTO[n].alt} className="h-24 w-full rounded bg-white object-contain" />
              <p className="mt-1 text-[11px] font-medium">{FIGURAS_TEXTO[n].legendaBase}</p>
              <Button variant="secondary" className="mt-1" onClick={() => void copiarDoSistema(n)} disabled={copiando !== null}>
                {copiando === n ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Copy className="mr-1.5 h-4 w-4" />} Copiar para a biblioteca
              </Button>
            </div>
          ))}
        </div>
      </details>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Editar imagem" : "Enviar imagem"}>
        {form && (
          <div className="space-y-3">
            <input ref={arquivoRef} type="file" accept="image/jpeg,image/png,image/webp,image/*" className="hidden" onChange={(e) => { escolherArquivo(e.target.files?.[0]); e.target.value = ""; }} />
            <div className="flex items-center gap-3">
              {(form.previa || form.urlAtual) && <img src={form.previa ?? form.urlAtual} alt="" className="h-24 w-32 rounded border border-border bg-white object-contain" />}
              <Button variant="secondary" onClick={() => arquivoRef.current?.click()}>
                <ImagePlus className="mr-2 h-4 w-4" /> {form.id ? "Trocar o arquivo" : "Escolher arquivo"}
              </Button>
            </div>
            <div>
              <label className="text-xs font-medium">Nome (aparece na lista de imagens)</label>
              <Input value={form.nome} placeholder="Ex.: Esquema do painel elétrico" onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })} />
            </div>
            <div>
              <label className="text-xs font-medium">Legenda no documento (opcional)</label>
              <Input value={form.legenda} placeholder="Ex.: Esquema do painel elétrico" onChange={(e) => setForm({ ...form, legenda: e.currentTarget.value })} />
              <p className="mt-1 text-[11px] text-muted-foreground">No documento ela sai como “Figura N — legenda”, numerada automaticamente.</p>
            </div>
            <div>
              <label className="text-xs font-medium">Descrição da imagem (opcional)</label>
              <Input value={form.alt} onChange={(e) => setForm({ ...form, alt: e.currentTarget.value })} />
            </div>
            <div>
              <label className="text-xs font-medium">Tamanho no documento</label>
              <select className="h-10 w-full rounded-md border border-input bg-card px-2 text-sm" value={form.larguraMax} onChange={(e) => setForm({ ...form, larguraMax: Number(e.target.value) })}>
                {LARGURAS.map((l) => (
                  <option key={l.valor} value={l.valor}>
                    {l.rotulo}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setForm(null)}>
                Cancelar
              </Button>
              <Button onClick={() => void salvar()} disabled={salvando || form.nome.trim().length < 2 || (!form.id && !form.arquivo)}>
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
