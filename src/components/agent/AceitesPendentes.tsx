import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, CalendarDays, CheckCircle2, MapPin, PartyPopper, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Botao, Meta, Rotulo } from "@/components/agent/ui";
import { Modal } from "@/components/ui-bits";
import {
  confirmarAgendamentoAgente,
  recusarAgendamentoAgente,
  type AceiteAgendamento,
} from "@/lib/agendamentos.functions";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Aba "A aceitar": agendamentos que o agente ainda precisa confirmar ou recusar. */
export function AceitesPendentes({
  pendentes,
  recusados,
  onMudou,
  onIrParaRoteiro,
}: {
  pendentes: AceiteAgendamento[];
  recusados: AceiteAgendamento[];
  /** Recarrega as listas depois de aceitar/recusar. */
  onMudou: () => Promise<void> | void;
  onIrParaRoteiro: () => void;
}) {
  const confirmar = useServerFn(confirmarAgendamentoAgente);
  const recusar = useServerFn(recusarAgendamentoAgente);
  const [recusando, setRecusando] = useState<AceiteAgendamento | null>(null);
  const [motivo, setMotivo] = useState("");
  const [working, setWorking] = useState(false);

  const handleConfirmar = async (ag: AceiteAgendamento) => {
    setWorking(true);
    try {
      await confirmar({ data: { agendamentoId: ag.id } });
      toast.success("Agendamento aceito. Ele já está no seu roteiro.");
      await onMudou();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível confirmar.");
    } finally {
      setWorking(false);
    }
  };

  const handleRecusar = async () => {
    if (!recusando || motivo.trim().length < 5) return;
    setWorking(true);
    try {
      await recusar({ data: { agendamentoId: recusando.id, motivo: motivo.trim() } });
      toast.success("Recusa enviada com o motivo.");
      setRecusando(null);
      setMotivo("");
      await onMudou();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível recusar o agendamento.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold leading-tight text-foreground">A aceitar</h1>
        <p className="text-sm text-muted-foreground">
          Confirme os agendamentos que você consegue cumprir. Depois de aceitos, eles entram no seu roteiro.
        </p>
      </div>

      {pendentes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-6 text-center">
          <PartyPopper className="h-8 w-8 text-emerald-600" aria-hidden />
          <b>Tudo em dia!</b>
          <p className="text-sm text-muted-foreground">Nenhum agendamento esperando a sua confirmação.</p>
          <div className="mt-2 w-full max-w-xs">
            <Botao variante="contorno" onClick={onIrParaRoteiro}>
              Ver meu roteiro
            </Botao>
          </div>
        </div>
      ) : (
        <section className="space-y-3">
          <Rotulo>
            {pendentes.length} {pendentes.length === 1 ? "aguardando sua confirmação" : "aguardando sua confirmação"}
          </Rotulo>
          {pendentes.map((ag) => (
            <article key={ag.id} className="flex flex-col gap-2 rounded-xl border border-[#f3e0bc] bg-[#f8f5f1] p-4">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <BellRing className="h-4 w-4 shrink-0" aria-hidden /> Novo agendamento — confirmar?
              </div>
              <div className="font-semibold text-foreground">
                {ag.cliente_nome ?? "Cliente"}
                {ag.unidade_nome ? <span className="font-normal text-muted-foreground"> · {ag.unidade_nome}</span> : null}
              </div>
              <Meta icone={<CalendarDays className="h-3.5 w-3.5" />}>{fmt(ag.agendado_em)}</Meta>
              {ag.endereco_vistoria && <Meta icone={<MapPin className="h-3.5 w-3.5" />}>{ag.endereco_vistoria}</Meta>}
              {ag.observacoes_agendamento && (
                <p className="whitespace-pre-line break-words text-xs italic leading-[17px] text-muted-foreground">
                  {ag.observacoes_agendamento}
                </p>
              )}
              <div className="mt-2 grid grid-cols-2 gap-3">
                <Botao
                  variante="contorno"
                  onClick={() => {
                    setRecusando(ag);
                    setMotivo("");
                  }}
                  disabled={working}
                >
                  <XCircle className="h-4 w-4" aria-hidden /> Recusar / Reagendar
                </Botao>
                <Botao variante="primario" onClick={() => handleConfirmar(ag)} disabled={working}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> Aceitar
                </Botao>
              </div>
            </article>
          ))}
        </section>
      )}

      {recusados.length > 0 && (
        <section className="space-y-2">
          <Rotulo>Recusados · aguardando reagendamento</Rotulo>
          {recusados.map((ag) => (
            <div key={ag.id} className="rounded-xl border border-border bg-card p-3 text-sm">
              <div className="font-semibold text-foreground">
                {ag.cliente_nome ?? "Cliente"}
                {ag.unidade_nome ? <span className="font-normal text-muted-foreground"> · {ag.unidade_nome}</span> : null}
              </div>
              <div className="text-xs text-muted-foreground">{fmt(ag.agendado_em)}</div>
              {ag.motivo_recusa && <p className="mt-1 text-xs italic text-muted-foreground">Seu motivo: {ag.motivo_recusa}</p>}
            </div>
          ))}
        </section>
      )}

      {/* folha inferior para a recusa (motivo obrigatório) */}
      <Modal open={!!recusando} onClose={() => setRecusando(null)} title="Recusar / Reagendar">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Explique o motivo para o IAM ou Especialista reagendar. A justificativa é obrigatória.
          </p>
          <label htmlFor="motivo-recusa" className="font-semibold">
            Motivo
          </label>
          <textarea
            id="motivo-recusa"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={4}
            className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
            placeholder="Ex.: estarei em outro cliente nesse horário"
          />
          <p className="text-xs text-muted-foreground" role="status">
            {motivo.trim().length >= 5 ? "Pronto para enviar." : "Escreva pelo menos 5 caracteres."}
          </p>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Botao variante="contorno" onClick={() => setRecusando(null)} disabled={working}>
              Cancelar
            </Botao>
            <Botao variante="primario" onClick={handleRecusar} disabled={working || motivo.trim().length < 5}>
              Enviar recusa
            </Botao>
          </div>
        </div>
      </Modal>
    </div>
  );
}
