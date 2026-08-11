import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MaterialCatalogo } from "@/lib/laudo/regras";

const RegraSchema = z.object({
  nivel: z.array(z.string()).optional(),
  bitola: z.array(z.string()).optional(),
  tipo_objeto: z.array(z.string()).optional(),
  area_classificada: z.boolean().optional(),
});

export const listarMateriais = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("catalogo_materiais")
      .select("id, codigo, descricao, aplicacao, unidade, quantidade_padrao, regra, ativo, ordem")
      .order("ordem", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as MaterialCatalogo[];
  });

export const salvarMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid().optional(),
        codigo: z.string().min(1),
        descricao: z.string().min(1),
        aplicacao: z.string().nullable().default(null),
        unidade: z.string().min(1).default("un"),
        quantidade_padrao: z.number().min(0).default(1),
        regra: RegraSchema.default({}),
        ativo: z.boolean().default(true),
        ordem: z.number().int().default(100),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      codigo: data.codigo,
      descricao: data.descricao,
      aplicacao: data.aplicacao,
      unidade: data.unidade,
      quantidade_padrao: data.quantidade_padrao,
      regra: data.regra as any,
      ativo: data.ativo,
      ordem: data.ordem,
    };
    const q = data.id
      ? context.supabase.from("catalogo_materiais").update(payload).eq("id", data.id)
      : context.supabase.from("catalogo_materiais").insert({ ...payload, criado_por: context.userId });
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("catalogo_materiais")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
