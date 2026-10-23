import { useState } from "react";
import { AlertTriangle, Pencil } from "lucide-react";

import { PerguntaBloco, type Pergunta, type Resposta } from "@/components/agent/FormFields";
import { toPerguntaUI } from "@/lib/vistoria-checklist";
import type { ChecklistEtapaDTO, ChecklistPerguntaDTO } from "@/lib/vistoria-agent.functions";

export type SiblingsCampos = {
  perguntas: Pergunta[];
  state: Record<string, Resposta>;
  updateById: (perguntaId: string, patch: Partial<Resposta>) => void;
};

type Props = {
  /** Etapa (seção) das perguntas: de onde vêm os blocos (cartão, matriz, fotos). */
  etapa: ChecklistEtapaDTO;
  perguntas: ChecklistPerguntaDTO[];
  state: Record<string, Resposta>;
  update: (perguntaId: string, patch: Partial<Resposta>) => void;
  casoId: string;
  token: string;
  destaque?: string | null;
  siblings: SiblingsCampos;
};

/**
 * Renderiza um conjunto de perguntas de UMA etapa: dados do agendamento como linhas
 * de conferência, campos soltos e blocos (cartão, matriz, fotos). Usado tanto pela
 * visão por etapa quanto pela visão por equipamento.
 */
export function PerguntasDoGrupo({ etapa, perguntas, state, update, casoId, token, destaque, siblings }: Props) {
  // Dados que já vieram do agendamento (cliente, data, responsável...) aparecem como
  // linhas de conferência, não como campos em branco para digitar de novo.
  const [editandoCadastro, setEditandoCadastro] = useState<Record<string, boolean>>({});
  const ehDadoDoCadastro = (p: ChecklistPerguntaDTO) =>
    !!p.resposta?.doCadastro && !["foto", "audio", "video"].includes(p.tipo);

  const formatarValor = (v: string) => {
    const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
  };

  const renderLinhaCadastro = (p: ChecklistPerguntaDTO) => {
    const valor = (state[p.id]?.text ?? "").trim();
    return (
      <div key={p.id} id={`pergunta-${p.id}`} className="flex items-start justify-between gap-3 py-2.5">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{p.texto}</p>
          <p className="mt-0.5 whitespace-pre-line break-words text-sm font-medium text-foreground">
            {valor ? formatarValor(valor) : <span className="font-normal text-muted-foreground">Não informado</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditandoCadastro((e) => ({ ...e, [p.id]: true }))}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-primary hover:bg-muted"
          aria-label={`Editar ${p.texto}`}
        >
          <Pencil className="h-3 w-3" /> Editar
        </button>
      </div>
    );
  };

  const renderCampo = (p: ChecklistPerguntaDTO) => (
    <div
      key={p.id}
      id={`pergunta-${p.id}`}
      className={destaque === p.id ? "rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}
    >
      {p.condicaoAviso && (
        <p className="mb-1 flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {p.condicaoAviso}
        </p>
      )}
      <PerguntaBloco
        pergunta={toPerguntaUI(p, etapa.id)}
        casoId={casoId}
        token={token}
        resposta={state[p.id] ?? {}}
        update={(patch) => update(p.id, patch)}
        mode="live"
        siblings={siblings}
      />
    </div>
  );

  /** Lista de campos: dados do agendamento como linhas de conferência, depois os campos normais. */
  const renderCampos = (ps: ChecklistPerguntaDTO[]) => {
    const doCadastro = ps.filter((p) => ehDadoDoCadastro(p) && !editandoCadastro[p.id]);
    const demais = ps.filter((p) => !doCadastro.includes(p));
    return (
      <div className="space-y-3">
        {doCadastro.length > 0 && (
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-semibold text-foreground">Dados do agendamento</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Já informados ao agendar. Confira e toque em Editar só se algo estiver diferente.
            </p>
            <div className="mt-2 divide-y divide-border">{doCadastro.map(renderLinhaCadastro)}</div>
          </div>
        )}
        {demais.map(renderCampo)}
      </div>
    );
  };

  const soltas = perguntas.filter((p) => !p.blocoId);
  const blocos = etapa.blocos
    .map((b) => ({ bloco: b, perguntas: perguntas.filter((p) => p.blocoId === b.id) }))
    .filter((b) => b.perguntas.length > 0);

  return (
    <div className="space-y-4">
      {soltas.length > 0 && renderCampos(soltas)}

      {blocos.map(({ bloco, perguntas: ps }) => {
        const linhas =
          bloco.layout === "matriz"
            ? [
                ...ps
                  .reduce((map, p) => {
                    const chave = p.bloco_linha ?? "—";
                    map.set(chave, [...(map.get(chave) ?? []), p]);
                    return map;
                  }, new Map<string, ChecklistPerguntaDTO[]>())
                  .entries(),
              ]
            : null;

        return (
          <section key={bloco.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <header className="mb-3">
              <h3 className="text-base font-semibold text-foreground">{bloco.titulo}</h3>
              {bloco.descricao && <p className="mt-1 text-sm text-muted-foreground">{bloco.descricao}</p>}
            </header>
            {linhas ? (
              <div className="space-y-5">
                {linhas.map(([linha, linhaPs]) => (
                  <div key={linha}>
                    <p className="mb-2 text-sm font-semibold text-foreground">{linha}</p>
                    <div className="grid gap-3 sm:grid-cols-2">{linhaPs.map(renderCampo)}</div>
                  </div>
                ))}
              </div>
            ) : bloco.layout === "fotos" ? (
              <div className="grid gap-3 sm:grid-cols-2">{ps.map(renderCampo)}</div>
            ) : (
              renderCampos(ps)
            )}
          </section>
        );
      })}
    </div>
  );
}
