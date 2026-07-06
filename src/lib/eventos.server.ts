import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type EventoTipo =
  | "mapeamento_criado"
  | "agendamento_criado"
  | "agente_atribuido"
  | "aceite_confirmado"
  | "aceite_recusado"
  | "reagendado"
  | "agendamento_cancelado"
  | "vistoria_iniciada"
  | "vistoria_finalizada"
  | "revisao_aprovada"
  | "revisao_reprovada"
  | "mapeamento_concluido"
  | "observacao_adicionada";

export type AtorPapel =
  | "super_admin"
  | "admin"
  | "especialista"
  | "agente_tecnico"
  | "sistema";

type AtorInfo = { id: string | null; nome: string | null; papel: AtorPapel };

async function resolverAtor(userId: string | null | undefined): Promise<AtorInfo> {
  if (!userId) return { id: null, nome: null, papel: "sistema" };
  const [{ data: perfil }, { data: roles }] = await Promise.all([
    supabaseAdmin.from("profiles").select("nome").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const roleList = ((roles ?? []) as { role: string }[]).map((r) => r.role);
  const prioridade: AtorPapel[] = ["super_admin", "admin", "especialista", "agente_tecnico"];
  const papel = (prioridade.find((p) => roleList.includes(p)) ?? "sistema") as AtorPapel;
  return { id: userId, nome: (perfil as any)?.nome ?? null, papel };
}

export async function registrarEvento(opts: {
  casoId?: string | null;
  casoIds?: string[];
  agendamentoId?: string | null;
  tipo: EventoTipo;
  atorId?: string | null;
  metadata?: Record<string, unknown>;
  ocorridoEm?: string;
}) {
  const ator = await resolverAtor(opts.atorId ?? null);
  const casos = opts.casoIds ?? (opts.casoId ? [opts.casoId] : []);
  if (casos.length === 0) return;
  const now = opts.ocorridoEm ?? new Date().toISOString();
  const rows = casos.map((casoId) => ({
    caso_id: casoId,
    agendamento_id: opts.agendamentoId ?? null,
    tipo: opts.tipo,
    ocorrido_em: now,
    ator_id: ator.id,
    ator_nome: ator.nome,
    ator_papel: ator.papel,
    metadata: opts.metadata ?? {},
  }));
  const { error } = await supabaseAdmin.from("mapeamento_eventos").insert(rows as any);
  if (error) console.error("[registrarEvento] falhou:", error.message);
}

export async function casosDoAgendamento(agendamentoId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("casos")
    .select("id")
    .eq("agendamento_id", agendamentoId);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}
