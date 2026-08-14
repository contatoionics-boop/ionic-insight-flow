import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui-bits";
import { perguntarAssistenteChecklist } from "@/lib/checklist-ia.functions";
import type { ChecklistPerguntaDTO } from "@/lib/vistoria-agent.functions";

type Turno = { pergunta: string; resposta: string; sugestao: string | null; usada?: boolean };

type Props = {
  aberto: boolean;
  onFechar: () => void;
  tokenLink?: string;
  casoIdAuth?: string;
  etapaTitulo: string;
  perguntaFoco: ChecklistPerguntaDTO | null;
  onUsarSugestao: (perguntaId: string, valor: string) => void;
};

export function AssistentePanel({
  aberto,
  onFechar,
  tokenLink,
  casoIdAuth,
  etapaTitulo,
  perguntaFoco,
  onUsarSugestao,
}: Props) {
  const perguntar = useServerFn(perguntarAssistenteChecklist);
  const [texto, setTexto] = useState("");
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!aberto) return null;

  const enviar = async () => {
    const q = texto.trim();
    if (!q || carregando) return;
    setTexto("");
    setCarregando(true);
    setErro(null);
    try {
      const r = await perguntar({
        data: {
          ...(tokenLink ? { token: tokenLink } : {}),
          ...(casoIdAuth ? { casoId: casoIdAuth } : {}),
          pergunta: q,
          etapaTitulo,
          perguntaAtual: perguntaFoco
            ? {
                id: perguntaFoco.id,
                texto: perguntaFoco.texto,
                tipo: perguntaFoco.tipo,
                obrigatoria: perguntaFoco.obrigatoria,
                opcoes: perguntaFoco.opcoes.map((o) => o.texto),
              }
            : null,
        },
      });
      setTurnos((t) => [...t, { pergunta: q, resposta: r.resposta, sugestao: r.sugestao }]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao consultar o assistente.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 max-h-[70vh] overflow-y-auto rounded-t-2xl border border-border bg-card p-4 shadow-xl lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-96 lg:rounded-none lg:rounded-l-2xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">Assistente</p>
            <p className="truncate text-xs text-muted-foreground">{etapaTitulo}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar assistente"
          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        {turnos.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Pergunte qualquer dúvida sobre o preenchimento. O assistente nunca grava respostas sem
            sua confirmação.
          </p>
        )}
        {turnos.map((t, i) => (
          <div key={i} className="space-y-1">
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">{t.pergunta}</p>
            <p className="rounded-lg border border-border px-3 py-2 text-sm text-foreground">
              {t.resposta}
            </p>
            {t.sugestao && perguntaFoco && !t.usada && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
                <p className="text-xs text-muted-foreground">Sugestão para “{perguntaFoco.texto}”</p>
                <p className="text-sm text-foreground">{t.sugestao}</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="primary"
                    onClick={() => {
                      onUsarSugestao(perguntaFoco.id, t.sugestao!);
                      setTurnos((arr) => arr.map((x, j) => (j === i ? { ...x, usada: true } : x)));
                    }}
                  >
                    Usar esta resposta
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setTurnos((arr) => arr.map((x, j) => (j === i ? { ...x, usada: true } : x)))
                    }
                  >
                    Não
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {erro && <p className="text-sm text-destructive">{erro}</p>}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <textarea
          rows={2}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void enviar();
            }
          }}
          placeholder="Tire uma dúvida sobre esta etapa..."
          className="min-h-[44px] w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
        <Button variant="primary" onClick={enviar} disabled={carregando || !texto.trim()}>
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
