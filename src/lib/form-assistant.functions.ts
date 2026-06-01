import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { draftSchema, type FormDraft } from "./form-assistant-schema";

const inputSchema = z.object({
  draft: draftSchema,
  cliente_id: z.string().uuid().nullable().optional(),
});

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r) => r.role);
  if (!roles.includes("admin") && !roles.includes("super_admin")) {
    throw new Error("Apenas admin pode criar formulários");
  }
}

export const createFormFromDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    await assertAdmin(userId);

    const draft: FormDraft = data.draft;

    const { data: form, error: e1 } = await supabaseAdmin
      .from("formularios")
      .insert({
        nome: draft.nome,
        descricao: draft.descricao ?? null,
        cliente_id: data.cliente_id ?? null,
        criado_por: userId,
        ativo: true,
      })
      .select("id")
      .single();
    if (e1 || !form) throw new Error(e1?.message ?? "Falha ao criar formulário");

    for (let si = 0; si < draft.secoes.length; si++) {
      const sec = draft.secoes[si];
      const { data: secao, error: e2 } = await supabaseAdmin
        .from("secoes")
        .insert({
          formulario_id: form.id,
          titulo: sec.titulo,
          ordem: si,
        })
        .select("id")
        .single();
      if (e2 || !secao) throw new Error(e2?.message ?? "Falha ao criar seção");

      for (let pi = 0; pi < sec.perguntas.length; pi++) {
        const perg = sec.perguntas[pi];
        const { data: pergunta, error: e3 } = await supabaseAdmin
          .from("perguntas")
          .insert({
            secao_id: secao.id,
            texto: perg.texto,
            tipo: perg.tipo,
            obrigatoria: perg.obrigatoria ?? true,
            ordem: pi,
            contexto_ia: perg.contexto_ia ?? null,
          })
          .select("id")
          .single();
        if (e3 || !pergunta) throw new Error(e3?.message ?? "Falha ao criar pergunta");

        if (perg.opcoes && perg.opcoes.length) {
          const rows = perg.opcoes.map((o, i) => ({
            pergunta_id: pergunta.id,
            texto: o.texto,
            ordem: i,
          }));
          const { error: e4 } = await supabaseAdmin.from("opcoes_pergunta").insert(rows);
          if (e4) throw new Error(e4.message);
        }
      }
    }

    return { id: form.id };
  });
