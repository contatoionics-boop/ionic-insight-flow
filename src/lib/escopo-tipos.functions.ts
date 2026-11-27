import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CATALOGO_PADRAO,
  ehChaveValida,
  ehTipoDoSistema,
  mesclarCatalogo,
  podeOcultarTipo,
  slugDoNome,
  type TipoCatalogo,
} from "@/lib/escopo/catalogo-tipos";

export const FALTA_MIGRATION_TIPOS =
  "Os tipos de item ainda não foram atualizados no banco (falta aplicar a migration 20261127120000_escopo_tipos no Supabase).";

/** Tabela/coluna inexistente: a migration ainda não foi aplicada. */
const migrationAusente = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (["42P01", "42703", "PGRST205", "PGRST204"].includes(String(e.code)) || /does not exist|schema cache|could not find the/i.test(String(e.message ?? "")));

export type CatalogoTipos = { catalogo: TipoCatalogo[]; migracaoPendente: boolean };

/** Catálogo de tipos de item. Sem a migration devolve o padrão e avisa. */
export const listarTiposEscopo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CatalogoTipos> => {
    const { data, error } = await (context.supabase as any).from("escopo_tipos").select("chave, rotulo, plural, ativo, sistema, ordem");
    if (error) {
      if (migrationAusente(error)) return { catalogo: CATALOGO_PADRAO, migracaoPendente: true };
      throw new Error(error.message);
    }
    return { catalogo: mesclarCatalogo(data), migracaoPendente: false };
  });

const SalvarInput = z.object({
  /** tipo existente (renomear/ocultar); vazio cria um tipo novo */
  chave: z.string().max(41).optional(),
  rotulo: z.string().trim().min(2, "Informe o nome do item.").max(60),
  plural: z.string().trim().max(60).optional(),
  ativo: z.boolean().default(true),
  ordem: z.number().int().min(0).max(1000).optional(),
});

export const salvarTipoEscopo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SalvarInput.parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: linhas, error: eLer } = await sb.from("escopo_tipos").select("chave, rotulo, plural, ativo, sistema, ordem");
    if (eLer) throw new Error(migrationAusente(eLer) ? FALTA_MIGRATION_TIPOS : eLer.message);
    const catalogo = mesclarCatalogo(linhas);
    const rotulo = data.rotulo.trim();
    const plural = data.plural?.trim() || rotulo;

    let chave = data.chave?.trim() || "";
    const existente = chave ? catalogo.find((t) => t.chave === chave) : undefined;
    if (chave && !existente) throw new Error("Tipo de item não encontrado.");
    if (!chave) {
      // novo: o nome não pode repetir o de outro tipo
      const igual = catalogo.find((t) => t.rotulo.toLocaleLowerCase("pt-BR") === rotulo.toLocaleLowerCase("pt-BR"));
      if (igual) throw new Error(`Já existe um tipo chamado "${igual.rotulo}".`);
      chave = slugDoNome(rotulo, catalogo.map((t) => t.chave));
    } else if (!ehTipoDoSistema(chave) && !ehChaveValida(chave)) {
      throw new Error("Chave de tipo inválida.");
    }

    const sistema = ehTipoDoSistema(chave);
    const ativo = sistema && !podeOcultarTipo(chave) ? true : data.ativo;
    const ordem = data.ordem ?? existente?.ordem ?? Math.max(100, ...catalogo.filter((t) => !t.sistema).map((t) => t.ordem + 1));
    const { error } = await sb
      .from("escopo_tipos")
      .upsert({ chave, rotulo, plural, ativo, sistema, ordem, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
    if (error) throw new Error(migrationAusente(error) ? FALTA_MIGRATION_TIPOS : error.message);
    return { ok: true as const, chave };
  });

export const excluirTipoEscopo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ chave: z.string().min(2).max(41) }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    if (ehTipoDoSistema(data.chave)) throw new Error("Tipos do sistema não podem ser excluídos. Use Ocultar.");
    const uso: string[] = [];
    const conta = async (q: PromiseLike<{ count: number | null; error: any }>) => {
      const { count, error } = await q;
      if (error && !migrationAusente(error)) throw new Error(error.message);
      return count ?? 0;
    };
    const entidades = await conta(sb.from("escopo_entidades").select("id", { count: "exact", head: true }).eq("tipo", data.chave));
    if (entidades) uso.push(`${entidades} item(ns) já cadastrado(s) em escopos`);
    const perguntas = await conta(sb.from("perguntas").select("id", { count: "exact", head: true }).eq("entidade_tipo", data.chave));
    if (perguntas) uso.push(`${perguntas} pergunta(s) de formulário`);
    const forms = await conta(sb.from("formularios").select("id", { count: "exact", head: true }).contains("sugerir_quando", [data.chave]));
    if (forms) uso.push(`${forms} formulário(s) com sugestão automática`);
    if (uso.length) throw new Error(`Este tipo está em uso (${uso.join("; ")}). Oculte-o em vez de excluir.`);
    const { error } = await sb.from("escopo_tipos").delete().eq("chave", data.chave);
    if (error) throw new Error(migrationAusente(error) ? FALTA_MIGRATION_TIPOS : error.message);
    return { ok: true as const };
  });
