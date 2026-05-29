import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Check, Loader2, Pencil, Send } from "lucide-react";

import { Button, Card } from "@/components/ui-bits";
import {
  PerguntaBloco,
  isComplete,
  type Pergunta,
  type Resposta,
} from "@/components/agent/FormFields";
import type { FormRunnerCtx } from "@/components/agent/FormRunner";
import { useConfiguracoesEmpresa } from "@/hooks/use-configuracoes-empresa";

type Item = { pergunta: Pergunta; secaoIdx: number; secaoTitulo: string };

export function FormChat({
  ctx,
  token,
  state,
  setState,
  onAdvanceSection,
  onSubmit,
  submitting,
  errorMessage,
}: {
  ctx: FormRunnerCtx;
  token: string;
  state: Record<string, Resposta>;
  setState: (updater: (s: Record<string, Resposta>) => Record<string, Resposta>) => void;
  onAdvanceSection?: (perguntas: Pergunta[]) => Promise<void> | void;
  onSubmit?: () => Promise<void> | void;
  submitting?: boolean;
  errorMessage?: string | null;
}) {
  const { config } = useConfiguracoesEmpresa();
  const nomeEmpresa = config?.nome_empresa || "Ionics";

  // Lista linear de perguntas com referência à seção
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    ctx.secoes.forEach((s, idx) => {
      const ps = ctx.perguntasPorSecao[s.id] ?? [];
      ps.forEach((p) => out.push({ pergunta: p, secaoIdx: idx, secaoTitulo: s.titulo }));
    });
    return out;
  }, [ctx]);

  // Cursor: primeira pergunta não completa (hidrata do rascunho).
  // Calculado uma vez na montagem; depois avança apenas via Confirmar.
  const [cursor, setCursor] = useState<number>(() => {
    const i = items.findIndex((it) => !isComplete(it.pergunta, state[it.pergunta.id] ?? {}, "live"));
    return i === -1 ? items.length : i;
  });
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll quando avança ou abre edição
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [cursor, editing]);

  const allDone = cursor >= items.length && editing === null;

  const update = (perguntaId: string, patch: Partial<Resposta>) => {
    setState((s) => ({ ...s, [perguntaId]: { ...s[perguntaId], ...patch } }));
  };

  const confirmar = async (idx: number) => {
    const it = items[idx];
    if (!it) return;
    const r = state[it.pergunta.id] ?? {};
    if (!isComplete(it.pergunta, r, "live")) return;
    setSavingIdx(idx);
    try {
      await onAdvanceSection?.([it.pergunta]);

      // Auto-preenchimento pós-CEP: se a pergunta atual é um CEP com endereço encontrado,
      // tenta preencher as próximas perguntas da mesma seção que correspondam a logradouro,
      // bairro, cidade, estado, cidade/estado. Para no primeiro item sem match (ex.: número).
      let autoAdvanced = 0;
      if (it.pergunta.tipo === "cep") {
        const endereco = parseEnderecoFromCepText(r.text ?? "");
        if (endereco) {
          for (let j = idx + 1; j < items.length; j++) {
            const next = items[j];
            if (next.secaoIdx !== it.secaoIdx) break;
            const ja = state[next.pergunta.id] ?? {};
            if ((ja.text ?? "").trim()) {
              autoAdvanced++;
              continue;
            }
            const valor = matchEnderecoCampo(next.pergunta.texto, endereco);
            if (!valor) break;
            setState((s) => ({ ...s, [next.pergunta.id]: { ...s[next.pergunta.id], text: valor } }));
            await onAdvanceSection?.([next.pergunta]);
            autoAdvanced++;
          }
        }
      }

      if (editing === idx) {
        setEditing(null);
      } else {
        setCursor((c) => Math.max(c, idx + 1 + autoAdvanced));
      }
    } finally {
      setSavingIdx(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="sticky top-0 z-20 border-b border-border bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {config?.logo_url && (
              <img src={config.logo_url} alt={nomeEmpresa} className="h-7 w-auto object-contain" />
            )}
            <div>
              <p className="text-base font-bold leading-tight text-primary">{nomeEmpresa}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Vistoria em andamento
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cliente</p>
            <p className="text-sm font-semibold text-foreground">{ctx.clienteNome || "—"}</p>
          </div>
        </div>
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{
              width: `${Math.round((Math.min(cursor, items.length) / Math.max(items.length, 1)) * 100)}%`,
            }}
          />
        </div>
      </header>

      <main ref={scrollerRef} className="mx-auto w-full max-w-2xl flex-1 px-3 py-4 pb-40 sm:px-4">
        {items.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Este formulário ainda não possui perguntas.
          </p>
        )}

        {items.map((it, idx) => {
          // Itens já respondidos (anteriores ao cursor) — mostrar histórico
          if (idx < cursor && editing !== idx) {
            const r = state[it.pergunta.id] ?? {};
            const showSecaoMarker = idx === 0 || items[idx - 1].secaoIdx !== it.secaoIdx;
            const isLastOfSecao = idx === items.length - 1 || items[idx + 1].secaoIdx !== it.secaoIdx;
            return (
              <div key={it.pergunta.id}>
                {showSecaoMarker && <SecaoDivider titulo={it.secaoTitulo} />}
                <AgentBubble>
                  <p className="text-sm">{it.pergunta.texto}</p>
                </AgentBubble>
                <UserBubble>
                  <ResumoResposta pergunta={it.pergunta} resposta={r} />
                </UserBubble>
                <div className="mb-2 ml-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Check className="h-3 w-3 text-success" />
                  Registrado
                  <button
                    type="button"
                    onClick={() => setEditing(idx)}
                    className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Pencil className="h-3 w-3" /> Corrigir
                  </button>
                </div>
                {isLastOfSecao && idx < cursor - 1 && (
                  <AgentBubble tone="success">
                    <p className="text-sm font-medium">
                      ✅ Seção "{it.secaoTitulo}" concluída.
                      {items[idx + 1] && (
                        <>
                          {" "}
                          Próxima: <strong>{items[idx + 1].secaoTitulo}</strong>.
                        </>
                      )}
                    </p>
                  </AgentBubble>
                )}
              </div>
            );
          }

          // Pergunta atual (cursor) ou item sendo editado
          if (idx === cursor || editing === idx) {
            const showSecaoMarker = idx === 0 || items[idx - 1].secaoIdx !== it.secaoIdx;
            const r = state[it.pergunta.id] ?? {};
            const podeConfirmar = isComplete(it.pergunta, r, "live");
            return (
              <div key={it.pergunta.id}>
                {showSecaoMarker && editing !== idx && <SecaoDivider titulo={it.secaoTitulo} />}
                {editing !== idx && (
                  <AgentBubble>
                    <p className="text-sm">{it.pergunta.texto}</p>
                    {it.pergunta.instrucao_agente && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {it.pergunta.instrucao_agente}
                      </p>
                    )}
                  </AgentBubble>
                )}
                <div className="ml-0 sm:ml-8">
                  <PerguntaBloco
                    pergunta={it.pergunta}
                    casoId={ctx.casoId}
                    token={token}
                    resposta={r}
                    update={(patch) => update(it.pergunta.id, patch)}
                    mode="live"
                  />
                  <div className="mt-2 flex items-center justify-end gap-2">
                    {editing === idx && (
                      <Button
                        variant="outline"
                        onClick={() => setEditing(null)}
                        disabled={savingIdx === idx}
                      >
                        Cancelar
                      </Button>
                    )}
                    <Button
                      onClick={() => confirmar(idx)}
                      disabled={!podeConfirmar || savingIdx === idx || !!submitting}
                    >
                      {savingIdx === idx ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4" /> Confirmar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            );
          }

          return null;
        })}

        {allDone && (
          <>
            <AgentBubble tone="success">
              <p className="text-sm font-medium">
                ✅ Você respondeu todas as perguntas! Revise abaixo e envie ao especialista.
              </p>
            </AgentBubble>
            <ReviewCards ctx={ctx} state={state} onEditar={(i) => setEditing(i)} items={items} />
          </>
        )}

        {errorMessage && <p className="mt-4 text-sm text-destructive">{errorMessage}</p>}
        <div ref={bottomRef} />
      </main>

      {allDone && (
        <footer className="fixed bottom-0 left-0 right-0 border-t border-border bg-white">
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
            <Button
              onClick={() => onSubmit?.()}
              disabled={!!submitting}
              className="h-12 flex-1 text-base"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4" /> Confirmar e enviar ao especialista
                </>
              )}
            </Button>
          </div>
        </footer>
      )}

      {!allDone && cursor < items.length && (
        <button
          type="button"
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="fixed bottom-4 right-4 z-10 rounded-full border border-border bg-white p-2 shadow-md hover:bg-muted"
          aria-label="Ir para pergunta atual"
        >
          <ArrowDown className="h-4 w-4 text-foreground" />
        </button>
      )}
    </div>
  );
}

function AgentBubble({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success";
}) {
  return (
    <div className="mb-3 flex items-start gap-2">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          tone === "success"
            ? "bg-success/15 text-success"
            : "bg-primary/15 text-primary"
        }`}
      >
        IA
      </div>
      <div
        className={`max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-foreground ${
          tone === "success"
            ? "border border-success/30 bg-success/10"
            : "border border-border bg-white"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
        {children}
      </div>
    </div>
  );
}

function SecaoDivider({ titulo }: { titulo: string }) {
  return (
    <div className="my-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {titulo}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function ResumoResposta({ pergunta, resposta }: { pergunta: Pergunta; resposta: Resposta }) {
  if (pergunta.tipo === "foto") {
    return (
      <div className="flex items-center gap-2">
        {resposta.filePreview && (
          <img
            src={resposta.filePreview}
            alt=""
            className="h-14 w-14 rounded object-cover"
          />
        )}
        <span className="text-xs">
          {resposta.ia?.status === "aprovada"
            ? "Foto aprovada"
            : resposta.ia?.status === "parcial"
            ? "Foto enviada (revisar)"
            : "Foto enviada"}
        </span>
      </div>
    );
  }
  if (pergunta.tipo === "audio") {
    return <p className="text-sm">{resposta.transcription || "Áudio enviado"}</p>;
  }
  if (pergunta.tipo === "toggle") {
    return (
      <p className="text-sm">
        {resposta.text === "sim" ? "Sim" : resposta.text === "nao" ? "Não" : "—"}
      </p>
    );
  }
  return <p className="text-sm">{resposta.text?.trim() || "—"}</p>;
}

function ReviewCards({
  ctx,
  state,
  items,
  onEditar,
}: {
  ctx: FormRunnerCtx;
  state: Record<string, Resposta>;
  items: Item[];
  onEditar: (idx: number) => void;
}) {
  return (
    <div className="mt-4 space-y-3">
      {ctx.secoes.map((s, sIdx) => {
        const perguntas = ctx.perguntasPorSecao[s.id] ?? [];
        return (
          <Card key={s.id}>
            <h3 className="mb-2 text-sm font-semibold text-foreground">{s.titulo}</h3>
            <ul className="divide-y divide-border">
              {perguntas.map((p) => {
                const r = state[p.id] ?? {};
                const idx = items.findIndex((it) => it.pergunta.id === p.id);
                return (
                  <li key={p.id} className="py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-muted-foreground">{p.texto}</p>
                        <div className="mt-1">
                          <ResumoResposta pergunta={p} resposta={r} />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onEditar(idx)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <Pencil className="h-3 w-3" /> Editar
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {sIdx === ctx.secoes.length - 1 && perguntas.length === 0 && (
              <p className="text-xs text-muted-foreground">Sem perguntas nesta seção.</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function normalizar(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

type EnderecoParsed = { logradouro: string; bairro: string; cidade: string; estado: string };

function parseEnderecoFromCepText(text: string): EnderecoParsed | null {
  if (!text) return null;
  // Formato gravado por CampoCep: "00000-000 — Logradouro, Bairro — Cidade/UF"
  const m = text.match(/^\s*\d{5}-\d{3}\s*[—-]\s*(.+?),\s*(.+?)\s*[—-]\s*(.+?)\/([A-Za-z]{2})\s*$/);
  if (!m) return null;
  return {
    logradouro: m[1].trim(),
    bairro: m[2].trim(),
    cidade: m[3].trim(),
    estado: m[4].trim().toUpperCase(),
  };
}

function matchEnderecoCampo(perguntaTexto: string, e: EnderecoParsed): string | null {
  const n = normalizar(perguntaTexto);
  // Não preencher número / complemento — são do agente.
  if (/\b(numero|n[º°.]|nro|complemento)\b/.test(n)) return null;
  if (/(cidade.*estado|cidade\s*\/\s*estado|cidade\s*e\s*estado|municipio.*uf)/.test(n)) {
    return `${e.cidade}/${e.estado}`;
  }
  if (/\b(logradouro|endereco|rua|avenida|av\.?)\b/.test(n)) return e.logradouro;
  if (/\bbairro\b/.test(n)) return e.bairro;
  if (/\bcidade\b|\bmunicipio\b/.test(n)) return e.cidade;
  if (/\bestado\b|\buf\b/.test(n)) return e.estado;
  return null;
}

