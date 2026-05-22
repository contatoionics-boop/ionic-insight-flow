import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const roleEnum = z.enum(["super_admin", "admin", "especialista", "agente_tecnico"]);

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas super admins podem executar esta ação.");
}

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        nome: z.string().min(1).max(120),
        email: z.string().email(),
        role: roleEnum,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    // Envia convite por e-mail (primeiro acesso). O usuário define a senha pelo link.
    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      { data: { nome: data.nome } },
    );
    if (inviteError || !invited?.user) {
      throw new Error(inviteError?.message ?? "Falha ao convidar usuário.");
    }

    const userId = invited.user.id;

    // Atualiza profile (trigger já criou um registro básico)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ nome: data.nome })
      .eq("id", userId);
    if (profileError) throw new Error(profileError.message);

    // Atribui role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role });
    if (roleError) throw new Error(roleError.message);

    return { ok: true, userId };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, email, ativo, criado_em")
      .order("criado_em", { ascending: false });
    if (profilesError) throw new Error(profilesError.message);

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rolesError) throw new Error(rolesError.message);

    const roleByUser = new Map<string, string>();
    for (const r of roles ?? []) roleByUser.set(r.user_id, r.role);

    return (profiles ?? []).map((p) => ({
      id: p.id,
      nome: p.nome,
      email: p.email,
      ativo: p.ativo,
      criado_em: p.criado_em,
      role: roleByUser.get(p.id) ?? null,
    }));
  });

export const adminToggleActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), ativo: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ ativo: data.ativo })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
