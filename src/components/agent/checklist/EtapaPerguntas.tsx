import { useMemo } from "react";

import type { Resposta } from "@/components/agent/FormFields";
import { ArvorePerguntas } from "@/components/escopo/ArvorePerguntas";
import { PerguntasDoGrupo } from "@/components/agent/checklist/PerguntasDoGrupo";
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

/** Visão por etapa (seção do formulário), com a árvore de entidades dentro de cada etapa. */
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

  const renderGrupo = (todas: ChecklistPerguntaDTO[]) => (
    <PerguntasDoGrupo
      etapa={etapa}
      perguntas={todas}
      state={state}
      update={update}
      casoId={casoId}
      token={token}
      destaque={destaque}
      siblings={siblings}
    />
  );

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
