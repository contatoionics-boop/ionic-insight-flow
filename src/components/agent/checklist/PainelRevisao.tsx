import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

import type { ResumoGeral } from "@/lib/vistoria-checklist";

type Props = {
  resumo: ResumoGeral;
  onIrPara: (indiceEtapa: number, perguntaId: string) => void;
  compacto?: boolean;
};

export function PainelRevisao({ resumo, onIrPara, compacto = false }: Props) {
  const pendencias = resumo.etapas.flatMap((e, i) =>
    e.faltandoObrigatorias.map((p) => ({ indice: i, etapa: e.etapa.titulo, pergunta: p })),
  );
  const recomendacoes = resumo.etapas.flatMap((e, i) =>
    e.faltandoOpcionais.map((p) => ({ indice: i, etapa: e.etapa.titulo, pergunta: p })),
  );

  const lista = compacto ? pendencias.slice(0, 5) : pendencias;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Concluído
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {resumo.totalRespondidas} de {resumo.totalVisiveis} itens · {resumo.percentual}%
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Pendências obrigatórias ({pendencias.length})
        </div>
        {pendencias.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">Nenhuma pendência obrigatória.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {lista.map(({ indice, etapa, pergunta }) => (
              <li key={pergunta.id}>
                <button
                  type="button"
                  onClick={() => onIrPara(indice, pergunta.id)}
                  className="w-full rounded-md px-2 py-1 text-left text-sm text-foreground hover:bg-muted"
                >
                  <span className="block truncate">{pergunta.texto}</span>
                  <span className="block truncate text-xs text-muted-foreground">{etapa}</span>
                </button>
              </li>
            ))}
            {compacto && pendencias.length > lista.length && (
              <li className="px-2 text-xs text-muted-foreground">
                +{pendencias.length - lista.length} pendência(s)
              </li>
            )}
          </ul>
        )}
      </div>

      {!compacto && (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Info className="h-4 w-4 text-primary" />
            Recomendações ({recomendacoes.length})
          </div>
          {recomendacoes.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Tudo preenchido.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {recomendacoes.map(({ indice, etapa, pergunta }) => (
                <li key={pergunta.id}>
                  <button
                    type="button"
                    onClick={() => onIrPara(indice, pergunta.id)}
                    className="w-full rounded-md px-2 py-1 text-left text-sm text-muted-foreground hover:bg-muted"
                  >
                    <span className="block truncate">{pergunta.texto}</span>
                    <span className="block truncate text-xs">{etapa}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
