/**
 * Carrega, do banco, as entradas do resolver ÚNICO de metadados do FR-31-10.
 * Usado pelo PDF e pela folha WYSIWYG (via server function).
 */
import { resolverMetaLaudo, type MetaLaudo } from "@/lib/laudo/meta";
import type { VariaveisLaudo } from "@/lib/laudo/tipos";

const SELECT_CASO =
  "id, codigo, agendado_em, data_execucao, agente_nome_manual, formulario_id, agendamento_id, criado_por, laudo_variaveis, agente:profiles!agente_id(nome, email), unidade:unidades(nome, codigo_ionics, matriz:matrizes(nome, empresa:empresas(nome, codigo_ionics)))";

export async function carregarMetaLaudoDoCaso(
  supabase: any,
  casoId: string,
): Promise<{ meta: MetaLaudo; caso: any }> {
  const { data: caso, error } = await supabase
    .from("casos")
    .select(SELECT_CASO)
    .eq("id", casoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!caso) throw new Error("Mapeamento não encontrado.");

  // responsável interno: quem criou o agendamento; se não houver, quem criou o caso
  let criadorId: string | null = caso.criado_por ?? null;
  if (caso.agendamento_id) {
    const { data: ag } = await supabase
      .from("agendamentos")
      .select("criado_por")
      .eq("id", caso.agendamento_id)
      .maybeSingle();
    if (ag?.criado_por) criadorId = ag.criado_por;
  }

  let criadorAgendamento: string | null = null;
  if (criadorId) {
    const { data: perfil } = await supabase
      .from("profiles")
      .select("nome, email")
      .eq("id", criadorId)
      .maybeSingle();
    criadorAgendamento = perfil?.nome || perfil?.email || null;
  }

  // especialista em automação: perfil cadastrado do Pablo, quando existir
  let especialistaPerfil: string | null = null;
  const { data: pablo } = await supabase
    .from("profiles")
    .select("nome")
    .ilike("nome", "%pablo%")
    .limit(1);
  if (pablo?.[0]?.nome) especialistaPerfil = pablo[0].nome as string;

  let formulario: { nome: string | null; codigo: string | null; revisao: string | null } | null =
    null;
  if (caso.formulario_id) {
    const { data: f } = await supabase
      .from("formularios")
      .select("nome, codigo, revisao")
      .eq("id", caso.formulario_id)
      .maybeSingle();
    formulario = (f as any) ?? null;
  }

  const meta = resolverMetaLaudo({
    caso,
    variaveis: (caso.laudo_variaveis ?? {}) as VariaveisLaudo,
    criadorAgendamento,
    especialistaPerfil,
    formulario,
  });

  return { meta, caso };
}
