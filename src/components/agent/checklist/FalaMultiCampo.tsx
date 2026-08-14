import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Mic, Square, X } from "lucide-react";

import { Button } from "@/components/ui-bits";
import { useGravacaoVoz } from "@/components/agent/use-gravacao-voz";
import { extrairCamposDaFala, type CampoExtraido } from "@/lib/checklist-ia.functions";
import type { ChecklistPerguntaDTO } from "@/lib/vistoria-agent.functions";

type Props = {
  token: string;
  tokenLink?: string;
  casoIdAuth?: string;
  perguntas: ChecklistPerguntaDTO[];
  onAplicar: (valores: { perguntaId: string; valor: string }[]) => void;
};

export function FalaMultiCampo({ token, tokenLink, casoIdAuth, perguntas, onAplicar }: Props) {
  const extrair = useServerFn(extrairCamposDaFala);
  const [transcricao, setTranscricao] = useState<string | null>(null);
  const [campos, setCampos] = useState<CampoExtraido[] | null>(null);
  const [selecionados, setSelecionados] = useState<Record<string, string>>({});
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const voz = useGravacaoVoz({
    token,
    onTranscricao: async (texto) => {
      if (!texto) return;
      setTranscricao(texto);
      setProcessando(true);
      setErro(null);
      try {
        const r = await extrair({
          data: {
            ...(tokenLink ? { token: tokenLink } : {}),
            ...(casoIdAuth ? { casoId: casoIdAuth } : {}),
            transcricao: texto,
            perguntas: perguntas.map((p) => ({
              id: p.id,
              texto: p.texto,
              tipo: p.tipo,
              obrigatoria: p.obrigatoria,
              opcoes: p.opcoes.map((o) => o.texto),
            })),
          },
        });
        setCampos(r.campos);
        setSelecionados(Object.fromEntries(r.campos.map((c) => [c.perguntaId, c.valor])));
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao interpretar a fala.");
      } finally {
        setProcessando(false);
      }
    },
  });

  const limpar = () => {
    setCampos(null);
    setTranscricao(null);
    setSelecionados({});
    setErro(null);
  };

  const aplicar = () => {
    onAplicar(
      Object.entries(selecionados)
        .filter(([, v]) => v.trim())
        .map(([perguntaId, valor]) => ({ perguntaId, valor: valor.trim() })),
    );
    limpar();
  };

  const nomePergunta = (id: string) => perguntas.find((p) => p.id === id)?.texto ?? "Campo";

  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Ditar vários campos</p>
          <p className="text-xs text-muted-foreground">
            Fale naturalmente; o sistema sugere o preenchimento e você confirma.
          </p>
        </div>
        {voz.recording ? (
          <Button variant="danger" onClick={voz.stop}>
            <Square className="h-4 w-4" /> Parar {voz.mmss}
          </Button>
        ) : (
          <Button variant="secondary" onClick={voz.start} disabled={voz.transcrevendo || processando}>
            {voz.transcrevendo || processando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            Gravar fala
          </Button>
        )}
      </div>

      {(voz.erro || erro) && (
        <p className="mt-2 text-xs text-destructive">{voz.erro || erro}</p>
      )}

      {transcricao && (
        <p className="mt-2 rounded-md bg-card px-3 py-2 text-xs text-muted-foreground">
          “{transcricao}”
        </p>
      )}

      {campos && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Informações identificadas na fala
          </p>
          {campos.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum campo desta etapa foi identificado.</p>
          )}
          {campos.map((c) => (
            <div key={c.perguntaId} className="rounded-lg border border-border bg-card p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs font-medium text-foreground">
                  {nomePergunta(c.perguntaId)}
                </span>
                <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
                  confiança {c.confianca}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <input
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                  value={selecionados[c.perguntaId] ?? ""}
                  onChange={(e) => {
                    const valor = e.target.value;
                    setSelecionados((s) => ({ ...s, [c.perguntaId]: valor }));
                  }}
                />
                <button
                  type="button"
                  aria-label="Descartar campo"
                  className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    setSelecionados((s) => {
                      const { [c.perguntaId]: _drop, ...rest } = s;
                      return rest;
                    })
                  }
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={limpar}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={aplicar}
              disabled={Object.keys(selecionados).length === 0}
            >
              <Check className="h-4 w-4" /> Usar valores
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
