// Organização dos mapeamentos do agente técnico: o que falta aceitar, o que foi recusado e o
// roteiro (ordem de execução) do que já foi aceito. Código puro (client-safe).

export type StatusAceite = "aguardando_aceite" | "confirmado" | "recusado_pelo_agente";

/** O que o roteiro precisa saber de cada caso. */
export type CasoBase = {
  id: string;
  codigo: string;
  status: string;
  agendado_em: string | null;
  agendamento_id: string;
};

const JA_ANDAMENTO_OU_ENTREGUE = ["em_andamento", "aguardando_revisao", "aprovado", "concluido"];
export const STATUS_FINALIZADOS = ["aguardando_revisao", "aprovado", "concluido"];

/**
 * Separa os casos pelo aceite do agendamento. Caso já iniciado ou entregue conta como aceito
 * (dados antigos podem não ter o aceite registrado).
 */
export function separarPorAceite<T extends CasoBase>(
  casos: T[],
  aceites: ReadonlyMap<string, StatusAceite | string>,
): { aceitos: T[]; aguardando: T[]; recusados: T[] } {
  const aceitos: T[] = [];
  const aguardando: T[] = [];
  const recusados: T[] = [];
  for (const c of casos) {
    if (c.status === "cancelado") continue;
    if (JA_ANDAMENTO_OU_ENTREGUE.includes(c.status)) {
      aceitos.push(c);
      continue;
    }
    const aceite = aceites.get(c.agendamento_id);
    if (aceite === "confirmado") aceitos.push(c);
    else if (aceite === "recusado_pelo_agente") recusados.push(c);
    else aguardando.push(c);
  }
  return { aceitos, aguardando, recusados };
}

export const finalizado = (c: Pick<CasoBase, "status">) => STATUS_FINALIZADOS.includes(c.status);

/** Uma visita: os formulários do mesmo agendamento no mesmo horário. */
export type Parada<T extends CasoBase> = {
  chave: string;
  agendamentoId: string;
  quando: Date | null;
  casos: T[];
  /** Formulário a executar agora (o em andamento, senão o primeiro pendente); null se tudo entregue. */
  atual: T | null;
  entregue: boolean;
  emAndamento: boolean;
};

const minutoDe = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "sem-data");

export function montarParadas<T extends CasoBase>(aceitos: T[]): { ativas: Parada<T>[]; entregues: Parada<T>[] } {
  const grupos = new Map<string, T[]>();
  for (const c of aceitos) {
    const chave = `${c.agendamento_id}|${minutoDe(c.agendado_em)}`;
    const arr = grupos.get(chave) ?? [];
    arr.push(c);
    grupos.set(chave, arr);
  }
  const paradas: Parada<T>[] = [...grupos.entries()].map(([chave, casos]) => {
    const ordenados = [...casos].sort((a, b) => a.codigo.localeCompare(b.codigo));
    const emAndamento = ordenados.find((c) => c.status === "em_andamento") ?? null;
    const pendente = ordenados.find((c) => !finalizado(c)) ?? null;
    return {
      chave,
      agendamentoId: ordenados[0]!.agendamento_id,
      quando: ordenados[0]!.agendado_em ? new Date(ordenados[0]!.agendado_em) : null,
      casos: ordenados,
      atual: emAndamento ?? pendente,
      entregue: ordenados.every(finalizado),
      emAndamento: !!emAndamento,
    };
  });
  const porData = (a: Parada<T>, b: Parada<T>) =>
    (a.quando?.getTime() ?? Infinity) - (b.quando?.getTime() ?? Infinity) || a.chave.localeCompare(b.chave);
  return {
    // O que está em andamento vem primeiro; o resto segue a data.
    ativas: paradas
      .filter((p) => !p.entregue)
      .sort((a, b) => Number(b.emAndamento) - Number(a.emAndamento) || porData(a, b)),
    entregues: paradas.filter((p) => p.entregue).sort((a, b) => porData(b, a)),
  };
}

export type GrupoDia<T extends CasoBase> = { chave: string; rotulo: string; atrasado: boolean; paradas: Parada<T>[] };

const diaIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Rótulo de um dia em relação a "agora": Atrasados, Hoje, Amanhã ou "ter, 28/10". */
export function rotuloDoDia(quando: Date | null, agora: Date): { chave: string; rotulo: string; atrasado: boolean } {
  if (!quando) return { chave: "sem-data", rotulo: "Sem data", atrasado: false };
  const hoje = inicioDoDia(agora);
  const dia = inicioDoDia(quando);
  const diff = Math.round((dia.getTime() - hoje.getTime()) / 86400000);
  if (diff < 0) return { chave: "atrasados", rotulo: "Atrasados", atrasado: true };
  if (diff === 0) return { chave: diaIso(dia), rotulo: "Hoje", atrasado: false };
  if (diff === 1) return { chave: diaIso(dia), rotulo: "Amanhã", atrasado: false };
  const semana = dia.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return {
    chave: diaIso(dia),
    rotulo: `${semana}, ${String(dia.getDate()).padStart(2, "0")}/${String(dia.getMonth() + 1).padStart(2, "0")}`,
    atrasado: false,
  };
}

/** Agrupa as paradas ativas por dia, mantendo a ordem de execução. */
export function agruparPorDia<T extends CasoBase>(paradas: Parada<T>[], agora: Date): GrupoDia<T>[] {
  const grupos: GrupoDia<T>[] = [];
  for (const p of paradas) {
    // Em andamento sempre aparece no dia de hoje (é o que o agente está fazendo agora).
    const r = p.emAndamento ? rotuloDoDia(agora, agora) : rotuloDoDia(p.quando, agora);
    let g = grupos.find((x) => x.chave === r.chave);
    if (!g) {
      g = { chave: r.chave, rotulo: r.rotulo, atrasado: r.atrasado, paradas: [] };
      grupos.push(g);
    }
    g.paradas.push(p);
  }
  return grupos;
}
