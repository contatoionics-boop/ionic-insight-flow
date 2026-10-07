import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ArvoreEscopo } from "@/lib/escopo/tipos";

const ArvoreSchema = z.object({
  postos: z
    .array(
      z.object({
        ilhas: z.array(
          z.object({
            bombas: z.array(z.object({ bicos: z.number().int().min(0).max(50) })).max(50),
          }),
        ).max(50),
      }),
    )
    .max(50),
  comboios: z.number().int().min(0).max(100),
  frota: z.object({
    ativo: z.boolean(),
    itens: z
      .array(
        z.object({
          modelo: z.string().max(200),
          quantidade: z.number().int().min(1).max(100000),
          info: z.string().max(500).optional(),
        }),
      )
      .max(200),
  }),
  config: z.object({
    solucao: z.string().max(100).nullable().optional(),
    comunicacao: z.enum(["wifi", "4g", "ambos"]).nullable().optional(),
  }),
});

const CarregarInput = z.object({ casoId: z.string().uuid() });

const SalvarInput = z.object({
  casoIds: z.array(z.string().uuid()).min(1).max(20),
  arvore: ArvoreSchema,
  tipo: z.enum(["upgrade", "expansao", "alteracao"]).optional(),
  descricao: z.string().max(500).optional().nullable(),
  confirmarRemocao: z.boolean().optional(),
});

/** Estrutura (árvore) do Escopo usada pelo caso. */
export const carregarEscopoEstrutura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CarregarInput.parse(i))
  .handler(async ({ data }) => {
    const { carregarEstruturaDoCaso } = await import("@/lib/escopo/gerar.server");
    const e = await carregarEstruturaDoCaso(data.casoId);
    return {
      versaoId: e.versaoId,
      numero: e.numero,
      versaoAtualId: e.versaoAtualId,
      arvore: e.arvore,
      entidades: e.entidades,
    };
  });

/**
 * Grava a árvore do Escopo (cria nova versão só se algo mudou) e vincula os
 * casos informados. Apenas gestores (super_admin/admin/especialista).
 */
export const salvarEscopoEstrutura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SalvarInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["super_admin", "admin", "especialista"]);
    if (!roles?.length) throw new Error("Sem permissão para editar o escopo.");

    const { aplicarArvore } = await import("@/lib/escopo/gerar.server");
    return aplicarArvore({
      casoIds: data.casoIds,
      arvore: data.arvore as ArvoreEscopo,
      userId,
      tipo: data.tipo,
      descricao: data.descricao ?? null,
      confirmarRemocao: data.confirmarRemocao,
    });
  });
