import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CHAVES_CAMPOS_FIXOS,
  OPCOES_PADRAO,
  SLUG_CAMPO,
  SLUG_OPCAO,
  chaveDoCampo,
  mesclarCampos,
  mesclarOpcoes,
  valorDoNome,
  type CampoAgendamento,
  type OpcaoAgendamento,
} from "@/lib/opcoes-agendamento";

export const FALTA_MIGRATION_OPCOES =
  "As opções do agendamento ainda não foram atualizadas no banco (falta aplicar a migration 20261128120000_opcoes_agendamento no Supabase).";

const migrationAusente = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (["42P01", "42883", "PGRST205", "PGRST202"].includes(String(e.code)) || /does not exist|schema cache|could not find/i.test(String(e.message ?? "")));

// chave de um campo fixo ou de um campo criado pelo gestor (a existência é conferida no banco)
const CampoSchema = z.string().regex(SLUG_CAMPO);

export type ListaOpcoes = {
  opcoes: OpcaoAgendamento[];
  /** os quatro fixos + os campos criados pelo gestor */
  campos: CampoAgendamento[];
  migracaoPendente: boolean;
  /** falta só a migration dos campos novos (as opções dos quatro fixos já funcionam) */
  camposPendentes: boolean;
};

const FALTA_MIGRATION_CAMPOS =
  "Os campos novos do agendamento ainda não foram atualizados no banco (falta aplicar a migration 20261128180000_campos_agendamento no Supabase).";

/** Lê os campos criados pelo gestor; tabela ausente = só os fixos (e avisa). */
async function lerCampos(sb: any): Promise<{ campos: CampoAgendamento[]; pendente: boolean }> {
  const { data, error } = await sb.from("campos_agendamento").select("chave, titulo, descricao, obrigatorio, ativo, ordem");
  if (error) {
    if (migrationAusente(error)) return { campos: mesclarCampos(), pendente: true };
    throw new Error(error.message);
  }
  return { campos: mesclarCampos(data), pendente: false };
}

export const listarOpcoesAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ListaOpcoes> => {
    const sb = context.supabase as any;
    const { data, error } = await sb.from("opcoes_agendamento").select("campo, valor, rotulo, ativo, ordem, sistema");
    if (error) {
      if (migrationAusente(error)) return { opcoes: mesclarOpcoes(), campos: mesclarCampos(), migracaoPendente: true, camposPendentes: true };
      throw new Error(error.message);
    }
    const { campos, pendente } = await lerCampos(sb);
    return { opcoes: mesclarOpcoes(data), campos, migracaoPendente: false, camposPendentes: pendente };
  });

/** Cria ou edita um campo novo do agendamento (título, obrigatório, visível, ordem). Os quatro fixos não passam por aqui. */
export const salvarCampoAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        /** vazio = cria um campo novo */
        chave: CampoSchema.optional(),
        titulo: z.string().trim().min(2, "Informe o nome do campo.").max(80),
        descricao: z.string().trim().max(300).optional(),
        obrigatorio: z.boolean(),
        ativo: z.boolean(),
        ordem: z.number().int().min(0).max(10000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { campos, pendente } = await lerCampos(sb);
    if (pendente) throw new Error(FALTA_MIGRATION_CAMPOS);
    const existente = data.chave ? campos.find((c) => c.campo === data.chave) : undefined;
    if (data.chave && (!existente || existente.sistema)) throw new Error("Campo não encontrado.");
    if (!data.chave) {
      const igual = campos.find((c) => c.titulo.toLocaleLowerCase("pt-BR") === data.titulo.toLocaleLowerCase("pt-BR"));
      if (igual) throw new Error(`Já existe um campo chamado "${igual.titulo}".`);
    }
    const chave = data.chave ?? chaveDoCampo(data.titulo, campos.map((c) => c.campo));
    const ordem = data.ordem ?? existente?.ordem ?? Math.max(100, ...campos.filter((c) => !c.sistema).map((c) => c.ordem + 10));
    const { error } = await sb
      .from("campos_agendamento")
      .upsert(
        { chave, titulo: data.titulo, descricao: data.descricao ?? existente?.descricao ?? "", obrigatorio: data.obrigatorio, ativo: data.ativo, ordem, atualizado_em: new Date().toISOString() },
        { onConflict: "chave" },
      );
    if (error) throw new Error(migrationAusente(error) ? FALTA_MIGRATION_CAMPOS : error.message);
    return { ok: true as const, chave };
  });

/** Renomear, ocultar ou mudar a ordem de uma opção que já existe. */
export const salvarOpcaoAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        campo: CampoSchema,
        valor: z.string().regex(SLUG_OPCAO),
        rotulo: z.string().trim().min(1, "Informe o nome da opção.").max(80),
        ativo: z.boolean(),
        ordem: z.number().int().min(0).max(10000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: linhas, error: eLer } = await sb.from("opcoes_agendamento").select("campo, valor, rotulo, ativo, ordem, sistema");
    if (eLer) throw new Error(migrationAusente(eLer) ? FALTA_MIGRATION_OPCOES : eLer.message);
    const existente = mesclarOpcoes(linhas).find((x) => x.campo === data.campo && x.valor === data.valor);
    if (!existente) throw new Error("Opção não encontrada.");
    // não deixa o campo sem nenhuma opção ativa
    if (!data.ativo) {
      const ativas = mesclarOpcoes(linhas).filter((x) => x.campo === data.campo && x.ativo && x.valor !== data.valor);
      if (!ativas.length) throw new Error("O campo precisa ter pelo menos uma opção ativa.");
    }
    const { error } = await sb
      .from("opcoes_agendamento")
      .upsert(
        { campo: data.campo, valor: data.valor, rotulo: data.rotulo, ativo: data.ativo, ordem: data.ordem, sistema: existente.sistema, atualizado_em: new Date().toISOString() },
        { onConflict: "campo,valor" },
      );
    if (error) throw new Error(migrationAusente(error) ? FALTA_MIGRATION_OPCOES : error.message);
    return { ok: true as const };
  });

/** Cria uma opção nova (acrescenta o valor ao tipo do banco quando o campo usa um). */
export const adicionarOpcaoAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ campo: CampoSchema, rotulo: z.string().trim().min(1, "Informe o nome da opção.").max(80) }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: linhas, error: eLer } = await sb.from("opcoes_agendamento").select("campo, valor, rotulo, ativo, ordem, sistema");
    if (eLer) throw new Error(migrationAusente(eLer) ? FALTA_MIGRATION_OPCOES : eLer.message);
    // campo fixo ou criado pelo gestor
    if (!CHAVES_CAMPOS_FIXOS.includes(data.campo)) {
      const { campos } = await lerCampos(sb);
      if (!campos.some((c) => c.campo === data.campo)) throw new Error("Campo não encontrado.");
    }
    const doCampo = mesclarOpcoes(linhas).filter((x) => x.campo === data.campo);
    const igual = doCampo.find((x) => x.rotulo.toLocaleLowerCase("pt-BR") === data.rotulo.toLocaleLowerCase("pt-BR"));
    if (igual) throw new Error(`Já existe a opção "${igual.rotulo}" neste campo.`);
    // o valor é único entre todos os campos (a leitura de rótulos não depende do campo)
    const valor = valorDoNome(data.rotulo, mesclarOpcoes(linhas).map((x) => x.valor));
    const ordem = Math.max(0, ...doCampo.map((x) => x.ordem)) + 10;
    const { error } = await sb.rpc("adicionar_opcao_agendamento", { _campo: data.campo, _valor: valor, _rotulo: data.rotulo, _ordem: ordem });
    if (error) throw new Error(migrationAusente(error) ? FALTA_MIGRATION_OPCOES : error.message);
    return { ok: true as const, valor };
  });

export { OPCOES_PADRAO };
