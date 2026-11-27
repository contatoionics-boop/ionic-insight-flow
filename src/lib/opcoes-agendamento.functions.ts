import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OPCOES_PADRAO, SLUG_OPCAO, mesclarOpcoes, valorDoNome, type OpcaoAgendamento } from "@/lib/opcoes-agendamento";

export const FALTA_MIGRATION_OPCOES =
  "As opções do agendamento ainda não foram atualizadas no banco (falta aplicar a migration 20261128120000_opcoes_agendamento no Supabase).";

const migrationAusente = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (["42P01", "42883", "PGRST205", "PGRST202"].includes(String(e.code)) || /does not exist|schema cache|could not find/i.test(String(e.message ?? "")));

const CampoSchema = z.enum(["tipo_solicitacao", "modalidade", "nivel", "solucao"]);

export type ListaOpcoes = { opcoes: OpcaoAgendamento[]; migracaoPendente: boolean };

export const listarOpcoesAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ListaOpcoes> => {
    const { data, error } = await (context.supabase as any).from("opcoes_agendamento").select("campo, valor, rotulo, ativo, ordem, sistema");
    if (error) {
      if (migrationAusente(error)) return { opcoes: mesclarOpcoes(), migracaoPendente: true };
      throw new Error(error.message);
    }
    return { opcoes: mesclarOpcoes(data), migracaoPendente: false };
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
