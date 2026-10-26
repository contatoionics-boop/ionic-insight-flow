import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProdutoCatalogo = { codigo: string; nome: string };

/** Tira acento e os caracteres que quebrariam o filtro do PostgREST. */
const limparTermo = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[%*,()\\"']/g, " ")
    .trim();

/**
 * Busca no catálogo de produtos ativos por código ou nome. Cada palavra digitada precisa aparecer
 * no código ou no nome (ex.: "niple 3/4" acha "NIPLE DUPLO 3/4"…). Sem texto, devolve os primeiros por nome.
 */
export const buscarProdutosCatalogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ q: z.string().max(80).default(""), limite: z.number().int().min(1).max(50).default(30) }).parse(i))
  .handler(async ({ data, context }) => {
    let q = (context.supabase as any).from("produtos_catalogo").select("codigo, nome").eq("ativo", true);
    for (const termo of limparTermo(data.q).split(/\s+/).filter(Boolean)) {
      q = q.or(`codigo.ilike.%${termo}%,nome.ilike.%${termo}%`);
    }
    const { data: linhas, error } = await q.order("nome", { ascending: true }).limit(data.limite);
    if (error) {
      if (/produtos_catalogo/.test(error.message) && /(does not exist|schema cache)/.test(error.message)) {
        throw new Error("O catálogo de produtos ainda não foi carregado no banco (falta rodar a migration de produtos).");
      }
      throw new Error(error.message);
    }
    return (linhas ?? []) as ProdutoCatalogo[];
  });
