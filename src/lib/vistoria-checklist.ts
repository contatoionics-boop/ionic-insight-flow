// Cálculo puro (client-safe) de visibilidade, status de etapa e pendências
// para o modo Checklist Guiado. Espelha as regras do servidor.
import { avaliarCondicional } from "@/lib/perguntas-mapeamento";
import { isComplete, type Pergunta, type Resposta, type TipoPergunta } from "@/components/agent/FormFields";
import type {
  ChecklistEtapaDTO,
  ChecklistPerguntaDTO,
  ChecklistVistoriaDTO,
} from "@/lib/vistoria-agent.functions";

export type StatusEtapa = "nao_iniciada" | "incompleta" | "pendente" | "concluida";

export function toPerguntaUI(p: ChecklistPerguntaDTO, secaoId: string): Pergunta {
  return {
    id: p.id,
    secao_id: secaoId,
    texto: p.texto,
    tipo: p.tipo as TipoPergunta,
    obrigatoria: p.obrigatoria,
    ordem: p.ordem,
    instrucao_agente: p.instrucao_agente,
    contexto_ia: p.contexto_ia,
    opcoes: p.opcoes,
    condicional_pergunta_id: p.condicional_pergunta_id,
    condicional_operador: p.condicional_operador,
    condicional_valor: p.condicional_valor,
  };
}

/** Converte as respostas já gravadas no formato usado pelos campos do formulário. */
export function estadoInicial(dados: ChecklistVistoriaDTO): Record<string, Resposta> {
  const state: Record<string, Resposta> = {};
  for (const etapa of dados.etapas) {
    for (const p of etapa.perguntas) {
      const r = p.resposta;
      if (!r) continue;
      const resposta: Resposta = {};
      if (r.texto) resposta.text = r.texto;
      if (r.arquivos.length) {
        if (p.tipo === "audio") resposta.audioPath = r.arquivos[0];
        else resposta.filePath = r.arquivos[0];
      }
      if (r.transcricao) {
        resposta.transcription = r.transcricao;
        resposta.transcriptionConfirmed = true;
      }
      if (resposta.filePath) resposta.iaConfirmada = true;
      state[p.id] = resposta;
    }
  }
  return state;
}

function adaptar(state: Record<string, Resposta>) {
  const adapted: Record<string, { text?: string; transcription?: string }> = {};
  for (const [k, v] of Object.entries(state)) {
    adapted[k] = { text: v.text, transcription: v.transcription };
  }
  return adapted;
}

export function perguntasVisiveisEtapa(
  etapa: ChecklistEtapaDTO,
  state: Record<string, Resposta>,
): ChecklistPerguntaDTO[] {
  const adapted = adaptar(state);
  return etapa.perguntas.filter((p) =>
    avaliarCondicional(
      {
        condicional_pergunta_id: p.condicional_pergunta_id,
        condicional_operador: p.condicional_operador,
        condicional_valor: p.condicional_valor,
      },
      adapted as never,
    ),
  );
}

export function respondida(p: ChecklistPerguntaDTO, r: Resposta | undefined): boolean {
  if (!r) return false;
  return !!(
    r.text?.trim() ||
    r.filePath ||
    r.audioPath ||
    r.transcription?.trim()
  );
}

export type ResumoEtapa = {
  etapa: ChecklistEtapaDTO;
  visiveis: ChecklistPerguntaDTO[];
  respondidas: number;
  faltandoObrigatorias: ChecklistPerguntaDTO[];
  faltandoOpcionais: ChecklistPerguntaDTO[];
  status: StatusEtapa;
};

export function resumirEtapa(
  etapa: ChecklistEtapaDTO,
  state: Record<string, Resposta>,
): ResumoEtapa {
  const visiveis = perguntasVisiveisEtapa(etapa, state);
  const respondidas = visiveis.filter((p) => respondida(p, state[p.id])).length;
  const faltandoObrigatorias = visiveis.filter(
    (p) => p.obrigatoria && !isComplete(toPerguntaUI(p, etapa.id), state[p.id] ?? {}, "live"),
  );
  const faltandoOpcionais = visiveis.filter(
    (p) => !p.obrigatoria && !respondida(p, state[p.id]),
  );

  let status: StatusEtapa;
  if (respondidas === 0) status = "nao_iniciada";
  else if (faltandoObrigatorias.length > 0) status = "pendente";
  else if (faltandoOpcionais.length > 0) status = "incompleta";
  else status = "concluida";

  return { etapa, visiveis, respondidas, faltandoObrigatorias, faltandoOpcionais, status };
}

export type ResumoGeral = {
  etapas: ResumoEtapa[];
  totalVisiveis: number;
  totalRespondidas: number;
  percentual: number;
  obrigatoriasFaltando: number;
  podeFinalizar: boolean;
};

export function resumirVistoria(
  dados: ChecklistVistoriaDTO,
  state: Record<string, Resposta>,
): ResumoGeral {
  const etapas = dados.etapas.map((e) => resumirEtapa(e, state));
  const totalVisiveis = etapas.reduce((a, e) => a + e.visiveis.length, 0);
  const totalRespondidas = etapas.reduce((a, e) => a + e.respondidas, 0);
  const obrigatoriasFaltando = etapas.reduce((a, e) => a + e.faltandoObrigatorias.length, 0);
  return {
    etapas,
    totalVisiveis,
    totalRespondidas,
    percentual: totalVisiveis ? Math.round((totalRespondidas / totalVisiveis) * 100) : 0,
    obrigatoriasFaltando,
    podeFinalizar: totalVisiveis > 0 && obrigatoriasFaltando === 0,
  };
}

export const rotuloStatus: Record<StatusEtapa, string> = {
  nao_iniciada: "Não iniciada",
  incompleta: "Incompleta",
  pendente: "Com pendência",
  concluida: "Concluída",
};
