import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";

import { PerguntaBloco, type Resposta } from "@/components/agent/FormFields";
import { ArvorePerguntas } from "@/components/escopo/ArvorePerguntas";
import { montarArvore, type Contagem } from "@/lib/escopo/arvore-perguntas";
import type { EntidadeEscopo } from "@/lib/escopo/tipos";
import { toPerguntaUI } from "@/lib/vistoria-checklist";
import type { ChecklistEtapaDTO, ChecklistPerguntaDTO } from "@/lib/vistoria-agent.functions";

type Props = {
  etapa: ChecklistEtapaDTO;
  visiveis: ChecklistPerguntaDTO[];
  state: Record<string, Resposta>;
  update: (perguntaId: string, patch: Partial<Resposta>) => void;
  casoId: string;
  token: string;
  destaque?: string | null;
  /** Estrutura do Escopo e progresso por entidade (formulário inteiro). */
  entidades?: EntidadeEscopo[];
  contagem?: Map<string, Contagem>;
};

export function EtapaPerguntas({
  etapa,
  visiveis,
  state,
  update,
  casoId,
  token,
  destaque,
  entidades = [],
  contagem = new Map(),
}: Props) {
  const perguntasUI = useMemo(
    () => visiveis.map((p) => toPerguntaUI(p, etapa.id)),
    [visiveis, etapa.id],
  );

  const siblings = {
    perguntas: perguntasUI,
    state,
    updateById: update,
  };

  const renderCampo = (p: ChecklistPerguntaDTO) => {
    const ui = perguntasUI.find((x) => x.id === p.id)!;
    return (
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
          pergunta={ui}
          casoId={casoId}
          token={token}
          resposta={state[p.id] ?? {}}
          update={(patch) => update(p.id, patch)}
          mode="live"
          siblings={siblings}
        />
      </div>
    );
  };

  /** Perguntas soltas e blocos (cartão, matriz, fotos) de um conjunto de perguntas. */
  const renderGrupo = (todas: ChecklistPerguntaDTO[]) => {
    const soltas = todas.filter((p) => !p.blocoId);
    const blocos = etapa.blocos
      .map((b) => ({ bloco: b, perguntas: todas.filter((p) => p.blocoId === b.id) }))
      .filter((b) => b.perguntas.length > 0);

    return (
      <div className="space-y-4">
        {soltas.length > 0 && <div className="space-y-3">{soltas.map(renderCampo)}</div>}

        {blocos.map(({ bloco, perguntas }) => {
          const linhas =
            bloco.layout === "matriz"
              ? [
                  ...perguntas
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
                {bloco.descricao && (
                  <p className="mt-1 text-sm text-muted-foreground">{bloco.descricao}</p>
                )}
              </header>
              {linhas ? (
                <div className="space-y-5">
                  {linhas.map(([linha, ps]) => (
                    <div key={linha}>
                      <p className="mb-2 text-sm font-semibold text-foreground">{linha}</p>
                      <div className="grid gap-3 sm:grid-cols-2">{ps.map(renderCampo)}</div>
                    </div>
                  ))}
                </div>
              ) : bloco.layout === "fotos" ? (
                <div className="grid gap-3 sm:grid-cols-2">{perguntas.map(renderCampo)}</div>
              ) : (
                <div className="space-y-3">{perguntas.map(renderCampo)}</div>
              )}
            </section>
          );
        })}
      </div>
    );
  };

  // Gerais no topo; depois a árvore de entidades (posto › ilha › bomba › bico, comboios, frota).
  const { gerais, grupos } = useMemo(
    () => montarArvore(entidades, visiveis, (p) => p.entidadeId, contagem),
    [entidades, visiveis, contagem],
  );

  return (
    <div className="space-y-6">
      {gerais.length > 0 && renderGrupo(gerais)}
      <ArvorePerguntas grupos={grupos} renderPerguntas={renderGrupo} />
    </div>
  );
}
