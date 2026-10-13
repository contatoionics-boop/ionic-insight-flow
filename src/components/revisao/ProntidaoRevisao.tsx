import { AlertTriangle, CheckCircle2, Clock, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export type ProntidaoDados = {
  /** Status do caso é "aguardando_revisao" (agente já entregou). */
  entregue: boolean;
  statusRotulo: string;
  respondidas: number;
  total: number;
  /** Divergências proposta × campo ainda sem decisão do especialista. */
  divergencias: number;
  /** Divergências já decididas (aceitar campo / manter proposta). */
  divergenciasDecididas?: number;
  /** Diferenças entre a estrutura do agendamento e a proposta. */
  diferencasEstrutura: number;
  alertasTecnicos: number;
  /** Pontos do documento a confirmar; null = documento ainda não aberto nesta sessão. */
  pontosAConfirmar: number | null;
};

/** Pendências que merecem ciência do especialista antes de aprovar (não inclui a entrega). */
export function pendenciasDeRevisao(d: ProntidaoDados): string[] {
  const out: string[] = [];
  if (d.total - d.respondidas > 0) out.push(`${d.total - d.respondidas} pergunta(s) sem resposta`);
  if (d.divergencias > 0) out.push(`${d.divergencias} divergência(s) entre proposta e campo`);
  if (d.diferencasEstrutura > 0) out.push(`${d.diferencasEstrutura} diferença(s) entre estrutura e proposta`);
  if (d.alertasTecnicos > 0) out.push(`${d.alertasTecnicos} alerta(s) técnico(s)`);
  if ((d.pontosAConfirmar ?? 0) > 0) out.push(`${d.pontosAConfirmar} ponto(s) do documento a confirmar`);
  return out;
}

type Estado = "ok" | "atencao" | "espera";

function Linha({
  estado,
  titulo,
  detalhe,
  onClick,
}: {
  estado: Estado;
  titulo: string;
  detalhe?: ReactNode;
  onClick?: () => void;
}) {
  const Icone = estado === "ok" ? CheckCircle2 : estado === "atencao" ? AlertTriangle : Clock;
  const cor =
    estado === "ok"
      ? "text-emerald-600"
      : estado === "atencao"
        ? "text-amber-600"
        : "text-muted-foreground";
  const corpo = (
    <>
      <Icone className={`mt-0.5 h-4 w-4 shrink-0 ${cor}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="text-sm font-medium text-foreground">{titulo}</span>
        {detalhe ? <span className="block text-xs text-muted-foreground">{detalhe}</span> : null}
      </span>
      {onClick ? <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
    >
      {corpo}
    </button>
  ) : (
    <div className="flex w-full items-start gap-2 px-2 py-1.5">{corpo}</div>
  );
}

/**
 * Resumo único do que falta antes de aprovar. Substitui os chips soltos
 * (respondidas / divergências / alertas) e leva ao ponto certo ao clicar.
 */
export function ProntidaoRevisao({
  dados,
  onDivergencias,
  onDocumento,
  compacto = false,
}: {
  dados: ProntidaoDados;
  onDivergencias?: () => void;
  onDocumento?: () => void;
  compacto?: boolean;
}) {
  const faltam = dados.total - dados.respondidas;
  const pend = pendenciasDeRevisao(dados);
  const tudoOk = dados.entregue && pend.length === 0;

  return (
    <section
      className={`rounded-xl border bg-card ${
        tudoOk ? "border-emerald-300/50" : "border-border"
      } ${compacto ? "" : "shadow-sm"}`}
      aria-label="Pronto para aprovar?"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold text-foreground">Pronto para aprovar?</h2>
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-medium ${
            tudoOk ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-700"
          }`}
        >
          {!dados.entregue
            ? "Aguardando entrega"
            : pend.length === 0
              ? "Sem pendências"
              : `${pend.length} ponto(s) de atenção`}
        </span>
      </div>
      <div className="p-1.5">
        <Linha
          estado={dados.entregue ? "ok" : "espera"}
          titulo={dados.entregue ? "Entregue pelo agente" : "O agente ainda não entregou"}
          detalhe={
            dados.entregue
              ? undefined
              : `Status atual: ${dados.statusRotulo}. Aprovar e solicitar reenvio ficam disponíveis após a entrega.`
          }
        />
        <Linha
          estado={faltam === 0 ? "ok" : "atencao"}
          titulo={`${dados.respondidas} de ${dados.total} perguntas respondidas`}
          detalhe={faltam > 0 ? `${faltam} sem resposta` : undefined}
        />
        <Linha
          estado={dados.divergencias === 0 ? "ok" : "atencao"}
          titulo={
            dados.divergencias === 0
              ? (dados.divergenciasDecididas ?? 0) > 0
                ? `${dados.divergenciasDecididas} divergência(s) entre proposta e campo decidida(s)`
                : "Sem divergências entre proposta e campo"
              : `${dados.divergencias} divergência(s) a decidir entre proposta e campo`
          }
          detalhe={dados.divergencias > 0 ? "Compara o que foi vendido com o que o agente encontrou" : undefined}
          onClick={dados.divergencias > 0 ? onDivergencias : undefined}
        />
        {dados.diferencasEstrutura > 0 && (
          <Linha
            estado="atencao"
            titulo={`${dados.diferencasEstrutura} diferença(s) entre a estrutura do agendamento e a proposta`}
            detalhe="A estrutura definida ao agendar não bate com as quantidades da proposta"
            onClick={onDivergencias}
          />
        )}
        <Linha
          estado={dados.alertasTecnicos === 0 ? "ok" : "atencao"}
          titulo={
            dados.alertasTecnicos === 0
              ? "Sem alertas técnicos"
              : `${dados.alertasTecnicos} alerta(s) técnico(s)`
          }
          detalhe={
            dados.alertasTecnicos > 0
              ? "Achados da análise técnica do documento (aba Documento)"
              : undefined
          }
          onClick={dados.alertasTecnicos > 0 ? onDocumento : undefined}
        />
        <Linha
          estado={dados.pontosAConfirmar === null ? "espera" : dados.pontosAConfirmar === 0 ? "ok" : "atencao"}
          titulo={
            dados.pontosAConfirmar === null
              ? "Documento final ainda não revisado"
              : dados.pontosAConfirmar === 0
                ? "Documento sem pontos a confirmar"
                : `${dados.pontosAConfirmar} ponto(s) do documento a confirmar`
          }
          detalhe={dados.pontosAConfirmar === null ? "Abra a aba Documento para gerar e revisar o rascunho" : undefined}
          onClick={dados.pontosAConfirmar !== 0 ? onDocumento : undefined}
        />
      </div>
    </section>
  );
}
