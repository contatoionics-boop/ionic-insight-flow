import { useMemo } from "react";

import { PerguntaBloco, type Resposta } from "@/components/agent/FormFields";
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
};

/** Agrupa por instância do Escopo (null = pergunta geral), mantendo a ordem. */
function agruparPorEntidade(ps: ChecklistPerguntaDTO[]) {
  const grupos = new Map<string | null, ChecklistPerguntaDTO[]>();
  for (const p of ps) {
    const k = p.entidadeRotulo ?? null;
    grupos.set(k, [...(grupos.get(k) ?? []), p]);
  }
  return [...grupos.entries()].sort((a, b) => (a[0] === null ? -1 : b[0] === null ? 1 : 0));
}

export function EtapaPerguntas({
  etapa,
  visiveis,
  state,
  update,
  casoId,
  token,
  destaque,
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

  const soltas = visiveis.filter((p) => !p.blocoId);
  const blocos = etapa.blocos
    .map((b) => ({ bloco: b, perguntas: visiveis.filter((p) => p.blocoId === b.id) }))
    .filter((b) => b.perguntas.length > 0);

  return (
    <div className="space-y-4">
      {agruparPorEntidade(soltas).map(([rotulo, ps]) => (
        <div key={rotulo ?? "geral"} className="space-y-3">
          {rotulo && (
            <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">{rotulo}</p>
          )}
          {ps.map(renderCampo)}
        </div>
      ))}

      {blocos.flatMap(({ bloco, perguntas: todas }) =>
        agruparPorEntidade(todas).map(([rotuloEnt, perguntas]) => ({ bloco, perguntas, rotuloEnt })),
      ).map(({ bloco, perguntas, rotuloEnt }) => {
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
          <section key={`${bloco.id}:${rotuloEnt ?? ""}`} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <header className="mb-3">
              {rotuloEnt && <p className="mb-1 text-xs font-semibold text-primary">{rotuloEnt}</p>}
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
}
