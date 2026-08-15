import { useMemo, useState } from "react";
import { Badge, Card } from "@/components/ui-bits";
import { ImagemLightbox } from "@/components/revisao/ImagemLightbox";
import {
  Check,
  ChevronDown,
  Copy,
  FileText,
  ImageOff,
  Minus,
  X,
} from "lucide-react";
import { toast } from "sonner";

export type LeituraSecao = { id: string; titulo: string; ordem: number };
export type LeituraPergunta = {
  id: string;
  secao_id: string;
  texto: string;
  tipo: string;
  ordem: number;
  instrucao_agente: string | null;
};
export type LeituraResposta = {
  pergunta_id: string;
  valor_texto: string | null;
  arquivo_path: string | null;
  arquivos_paths: string[] | null;
  transcricao: string | null;
};

function arquivosDe(r?: LeituraResposta): string[] {
  if (!r) return [];
  if (Array.isArray(r.arquivos_paths) && r.arquivos_paths.length) return r.arquivos_paths;
  return r.arquivo_path ? [r.arquivo_path] : [];
}

function ehCaminhoArquivo(v: string) {
  return /^casos\//.test(v) || /\.(jpe?g|png|webp|heic|mp4|mov|webm|m4a|ogg)$/i.test(v.trim());
}

function formatarData(v: string) {
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return v;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function valoresMultiplos(v: string): string[] {
  const t = v.trim();
  if (t.startsWith("[")) {
    try {
      const arr = JSON.parse(t);
      if (Array.isArray(arr)) return arr.map((x) => String(x)).filter(Boolean);
    } catch {
      /* ignora */
    }
  }
  return t
    .split(/[;,]|\s\|\s/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function respondida(p: LeituraPergunta, r?: LeituraResposta) {
  if (!r) return false;
  if (["foto", "video", "audio"].includes(p.tipo)) {
    return arquivosDe(r).length > 0 || !!r.transcricao?.trim() || !!r.valor_texto?.trim();
  }
  return !!r.valor_texto?.trim();
}

function SemResposta() {
  return (
    <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
      <Minus className="h-3.5 w-3.5" /> Não respondido
    </p>
  );
}

/** true quando a pergunta precisa da largura total da grade */
function larga(p: LeituraPergunta, r?: LeituraResposta) {
  if (["foto", "video", "audio", "tabela", "table", "assinatura"].includes(p.tipo)) return true;
  const texto = (r?.valor_texto ?? "").trim();
  const transcricao = (r?.transcricao ?? "").trim();
  if (texto.length > 140 || transcricao.length > 140) return true;
  if (texto.includes("\n") || transcricao.includes("\n")) return true;
  return false;
}

function BotaoCopiar({ texto }: { texto: string }) {
  return (
    <button
      type="button"
      title="Copiar resposta"
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(texto)
          .then(() => toast.success("Resposta copiada."))
          .catch(() => toast.error("Não foi possível copiar."));
      }}
    >
      <Copy className="h-3 w-3" /> Copiar
    </button>
  );
}

function Resposta({
  p,
  r,
  urls,
  onAbrirImagem,
}: {
  p: LeituraPergunta;
  r?: LeituraResposta;
  urls: Record<string, string>;
  onAbrirImagem: (url: string, legenda: string) => void;
}) {
  const arquivos = arquivosDe(r);
  const bruto = (r?.valor_texto ?? "").trim();
  const texto = bruto && !ehCaminhoArquivo(bruto) ? bruto : "";

  if (p.tipo === "foto") {
    return (
      <div className="mt-2 space-y-2">
        {arquivos.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-muted-foreground">
            <ImageOff className="mr-2 h-5 w-5" /> Sem imagem enviada
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {arquivos.map((path, i) => {
              const url = urls[path];
              return url ? (
                <button
                  key={path + i}
                  type="button"
                  onClick={() => onAbrirImagem(url, p.texto)}
                  title="Ampliar imagem"
                  className="group cursor-zoom-in overflow-hidden rounded-lg border border-border bg-muted"
                >
                  <img
                    src={url}
                    alt={`${p.texto} — imagem ${i + 1}`}
                    loading="lazy"
                    className="h-28 w-full object-cover transition-transform group-hover:scale-[1.02]"
                  />
                </button>
              ) : (
                <div
                  key={path + i}
                  className="flex h-28 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground"
                >
                  <ImageOff className="h-5 w-5" />
                </div>
              );
            })}
          </div>
        )}
        {texto && (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-foreground">{texto}</p>
        )}
      </div>
    );
  }

  if (p.tipo === "video") {
    const url = arquivos[0] ? urls[arquivos[0]] : undefined;
    return (
      <div className="mt-2 space-y-2">
        {url ? (
          <video
            controls
            preload="metadata"
            src={url}
            className="w-full max-w-2xl rounded-lg border border-border"
          />
        ) : (
          <SemResposta />
        )}
        {texto && <p className="text-sm text-foreground">{texto}</p>}
      </div>
    );
  }

  if (p.tipo === "audio") {
    const url = arquivos[0] ? urls[arquivos[0]] : undefined;
    const transcricao = (r?.transcricao ?? "").trim() || texto;
    return (
      <div className="mt-2 space-y-2">
        {url && <audio controls src={url} className="w-full max-w-lg" />}
        {transcricao ? (
          <div className="rounded-lg border-l-4 border-primary/50 bg-muted/50 px-4 py-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Transcrição
            </p>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
              {transcricao}
            </p>
            <div className="mt-2">
              <BotaoCopiar texto={transcricao} />
            </div>
          </div>
        ) : (
          !url && <SemResposta />
        )}
      </div>
    );
  }

  if (!texto) return <SemResposta />;

  if (p.tipo === "multipla_escolha") {
    const itens = valoresMultiplos(texto);
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {itens.map((v, i) => (
          <Badge key={v + i} className="bg-muted px-2.5 py-0.5 text-sm font-medium text-foreground">
            {v}
          </Badge>
        ))}
      </div>
    );
  }

  if (p.tipo === "selecao_unica") {
    return (
      <div className="mt-2">
        <Badge className="bg-muted px-2.5 py-0.5 text-sm font-medium text-foreground">{texto}</Badge>
      </div>
    );
  }

  if (p.tipo === "toggle" || p.tipo === "checkbox") {
    const sim = /^(sim|true|1|ok)$/i.test(texto);
    return (
      <div className="mt-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-semibold ${
            sim
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {sim ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          {sim ? "Sim" : "Não"}
        </span>
      </div>
    );
  }

  if (p.tipo === "numero") {
    return (
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{texto}</p>
    );
  }

  if (p.tipo === "data") {
    return <p className="mt-1 text-base font-semibold text-foreground">{formatarData(texto)}</p>;
  }

  const longo = texto.length > 90 || texto.includes("\n");
  return (
    <div className="mt-2 space-y-2">
      <div
        className={
          longo
            ? "whitespace-pre-wrap rounded-lg border-l-4 border-primary/40 bg-muted/50 px-4 py-3 text-[15px] leading-relaxed text-foreground"
            : "text-base font-semibold text-foreground"
        }
      >
        {texto}
      </div>
      {longo && <BotaoCopiar texto={texto} />}
    </div>
  );
}

export function RespostasLeitura({
  secoes,
  perguntasPorSecao,
  respostas,
  urls,
  agente,
  data,
}: {
  secoes: LeituraSecao[];
  perguntasPorSecao: Map<string, LeituraPergunta[]>;
  respostas: Record<string, LeituraResposta>;
  urls: Record<string, string>;
  agente?: string | null;
  data?: string | null;
}) {
  const [lightbox, setLightbox] = useState<{ url: string; legenda: string } | null>(null);
  const [sumarioAberto, setSumarioAberto] = useState(false);

  const stats = useMemo(() => {
    let total = 0;
    let ok = 0;
    const porSecao = new Map<string, { total: number; ok: number }>();
    for (const s of secoes) {
      const ps = perguntasPorSecao.get(s.id) ?? [];
      let sok = 0;
      for (const p of ps) if (respondida(p, respostas[p.id])) sok++;
      porSecao.set(s.id, { total: ps.length, ok: sok });
      total += ps.length;
      ok += sok;
    }
    return { total, ok, porSecao };
  }, [secoes, perguntasPorSecao, respostas]);

  const irPara = (id: string) => {
    setSumarioAberto(false);
    document.getElementById(`secao-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const sumario = (
    <nav className="space-y-0.5">
      {secoes.map((s, i) => {
        const st = stats.porSecao.get(s.id);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => irPara(s.id)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
          >
            <span className="shrink-0 text-muted-foreground">{i + 1}.</span>
            <span className="min-w-0 flex-1 truncate text-foreground">{s.titulo}</span>
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {st?.ok ?? 0}/{st?.total ?? 0}
            </span>
          </button>
        );
      })}
    </nav>
  );

  if (secoes.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">
          Este mapeamento não possui seções/perguntas configuradas no formulário.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            Respostas do mapeamento em campo
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {agente ? `Agente: ${agente}` : "Agente não informado"}
            {data ? ` · Preenchido em ${new Date(data).toLocaleString("pt-BR")}` : ""}
          </p>
        </div>
        <Badge
          className={
            stats.ok === stats.total
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
          }
        >
          {stats.ok}/{stats.total} respondidas
        </Badge>
      </Card>

      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setSumarioAberto((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium"
        >
          Seções do formulário
          <ChevronDown
            className={`h-4 w-4 transition-transform ${sumarioAberto ? "rotate-180" : ""}`}
          />
        </button>
        {sumarioAberto && (
          <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-border bg-card p-2">
            {sumario}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden h-fit rounded-lg border border-border bg-card p-3 lg:sticky lg:top-4 lg:block">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Seções do formulário
          </p>
          {sumario}
        </aside>

        <div className="min-w-0 space-y-6">
          {secoes.map((s, si) => {
            const ps = perguntasPorSecao.get(s.id) ?? [];
            const st = stats.porSecao.get(s.id);
            return (
              <section
                key={s.id}
                id={`secao-${s.id}`}
                className="scroll-mt-24 rounded-xl border border-border bg-card"
              >
                <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Seção {si + 1} de {secoes.length}
                    </p>
                    <h3 className="truncate text-lg font-semibold text-foreground">{s.titulo}</h3>
                  </div>
                  <Badge className="shrink-0 bg-muted text-muted-foreground">
                    {st?.ok ?? 0}/{st?.total ?? 0}
                  </Badge>
                </header>

                <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-2">
                  {ps.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sem perguntas nesta seção.</p>
                  )}
                  {ps.map((p, pi) => {
                    const r = respostas[p.id];
                    return (
                      <article
                        key={p.id}
                        className={`rounded-lg border border-border bg-background/40 px-4 py-3 ${
                          larga(p, r) ? "lg:col-span-2" : ""
                        }`}
                      >
                        <div className="flex gap-2">
                          <span className="mt-0.5 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                            {si + 1}.{pi + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {p.texto}
                            </h4>
                            {p.instrucao_agente && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                                {p.instrucao_agente}
                              </p>
                            )}
                            <Resposta
                              p={p}
                              r={r}
                              urls={urls}
                              onAbrirImagem={(url, legenda) => setLightbox({ url, legenda })}
                            />
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <ImagemLightbox imagem={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
