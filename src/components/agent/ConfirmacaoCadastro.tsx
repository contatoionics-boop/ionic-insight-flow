import { useState } from "react";
import { Check, Loader2, Pencil } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui-bits";
import { confirmarCadastroVistoria, type EstadoVistoria } from "@/lib/vistoria-agent.functions";

type Props = {
  estado: EstadoVistoria;
  token?: string;
  casoId?: string;
  onConfirmado: (resumo: string) => Promise<void> | void;
};

/**
 * Cartão exibido no início do mapeamento com os dados que já vieram do
 * cadastro/agendamento. O agente confere, corrige o que estiver errado e
 * confirma — só então o mapeamento é marcado como iniciado.
 */
export function ConfirmacaoCadastro({ estado, token, casoId, onConfirmado }: Props) {
  const confirmar = useServerFn(confirmarCadastroVistoria);
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(estado.cadastroPendente.map((c) => [c.perguntaId, c.valor])),
  );
  const [editando, setEditando] = useState<Record<string, boolean>>({});
  const [salvando, setSalvando] = useState(false);

  const handleConfirmar = async () => {
    setSalvando(true);
    try {
      await confirmar({
        data: {
          token,
          casoId,
          correcoes: estado.cadastroPendente.map((c) => ({
            perguntaId: c.perguntaId,
            valor: (valores[c.perguntaId] ?? c.valor).trim(),
          })),
        },
      });
      const resumo = estado.cadastroPendente
        .map((c) => `${c.perguntaTexto}: ${(valores[c.perguntaId] ?? c.valor).trim()}`)
        .join(" · ");
      await onConfirmado(resumo);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível confirmar os dados.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg animate-fade-in rounded-2xl border border-border bg-card p-5 text-left shadow-sm">
      <h2 className="text-base font-semibold text-foreground">Confira os dados do atendimento</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Já preenchemos o que veio do cadastro e do agendamento. Corrija o que estiver
        diferente e confirme para começar.
      </p>

      {estado.resumoCadastro.length > 0 && (
        <dl className="mt-4 grid gap-1.5 rounded-lg bg-muted/40 p-3 text-xs">
          {estado.resumoCadastro.map((f) => (
            <div key={f.label} className="flex gap-2">
              <dt className="shrink-0 text-muted-foreground">{f.label}:</dt>
              <dd className="min-w-0 flex-1 text-foreground">{f.valor}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-4 space-y-3">
        {estado.cadastroPendente.map((c) => {
          const val = valores[c.perguntaId] ?? c.valor;
          const emEdicao = !!editando[c.perguntaId];
          return (
            <div key={c.perguntaId} className="rounded-lg border border-border/70 px-3 py-2">
              <p className="text-xs text-muted-foreground">{c.perguntaTexto}</p>
              {emEdicao ? (
                c.opcoes.length > 0 ? (
                  <select
                    value={val}
                    onChange={(e) =>
                      setValores((v) => ({ ...v, [c.perguntaId]: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  >
                    {c.opcoes.map((o) => (
                      <option key={o.id} value={o.texto}>
                        {o.texto}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={val}
                    onChange={(e) =>
                      setValores((v) => ({ ...v, [c.perguntaId]: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  />
                )
              ) : (
                <div className="mt-0.5 flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{val}</p>
                  <button
                    type="button"
                    onClick={() => setEditando((s) => ({ ...s, [c.perguntaId]: true }))}
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Pencil className="h-3 w-3" /> Corrigir
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button onClick={handleConfirmar} disabled={salvando} className="mt-4 w-full">
        {salvando ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Check className="mr-1 h-4 w-4" />
        )}
        Confirmar e iniciar mapeamento
      </Button>
    </div>
  );
}
