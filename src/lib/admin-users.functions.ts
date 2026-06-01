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

async function assertCanSelectAgents(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["super_admin", "admin"]);
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Apenas admins podem selecionar agentes técnicos.");
}

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        nome: z.string().min(1).max(120),
        email: z.string().email(),
        role: roleEnum,
        redirectTo: z.string().url().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    const tempPassword = crypto.randomUUID() + "Aa1!";
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (createError || !created?.user) {
      console.error("[adminCreateUser] createUser failed", createError);
      throw new Error(createError?.message ?? "Falha ao criar usuário.");
    }

    const userId = created.user.id;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, nome: data.nome, email: data.email }, { onConflict: "id" });
    if (profileError) {
      console.error("[adminCreateUser] profile update failed", profileError);
      throw new Error(profileError.message);
    }

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role });
    if (roleError) {
      console.error("[adminCreateUser] role insert failed", roleError);
      throw new Error(roleError.message);
    }

    let recoveryLink: string | null = null;
    try {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: data.email,
        options: data.redirectTo ? { redirectTo: data.redirectTo } : undefined,
      });
      if (linkError) {
        console.error("[adminCreateUser] generateLink failed", linkError);
      } else {
        recoveryLink = (linkData as any)?.properties?.action_link ?? null;
      }
    } catch (e) {
      console.error("[adminCreateUser] generateLink threw", e);
    }

    return { ok: true, userId, recoveryLink };
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

    return (profiles ?? []).map((p: any) => ({
      id: p.id,
      nome: p.nome,
      email: p.email,
      ativo: p.ativo,
      criado_em: p.criado_em,
      role: roleByUser.get(p.id) ?? null,
    }));
  });

export const adminGenerateRecoveryLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), redirectTo: z.string().url().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const email = userData?.user?.email;
    if (userError || !email) throw new Error(userError?.message ?? "Usuário sem e-mail cadastrado.");

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: data.redirectTo ? { redirectTo: data.redirectTo } : undefined,
    });
    if (linkError) throw new Error(linkError.message);

    return { ok: true, recoveryLink: (linkData as any)?.properties?.action_link ?? null };
  });

export const adminSetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        password: z.string().min(8).max(128),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTechnicalAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCanSelectAgents(context.supabase, context.userId);

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "agente_tecnico");
    if (rolesError) throw new Error(rolesError.message);

    const ids = [...new Set((roles ?? []).map((r: any) => r.user_id).filter(Boolean))];
    if (!ids.length) return [];

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, email, ativo")
      .in("id", ids)
      .eq("ativo", true)
      .order("nome", { ascending: true });
    if (profilesError) throw new Error(profilesError.message);

    return (profiles ?? []).map((p: any) => ({
      id: p.id,
      user_id: p.id,
      nome: p.nome || p.email || "(sem nome)",
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

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        nome: z.string().min(1).max(120),
        role: roleEnum,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ nome: data.nome })
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);

    // Substitui role: apaga as antigas e insere a nova
    const { error: delError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (delError) throw new Error(delError.message);

    const { error: insError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (insError) throw new Error(insError.message);

    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) {
      throw new Error("Você não pode excluir o próprio usuário.");
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
