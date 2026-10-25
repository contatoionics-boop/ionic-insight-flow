import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/auth";

export type AuthProfile = {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
};

export type AuthState = {
  status: "loading" | "authenticated" | "unauthenticated";
  userId: string | null;
  email: string | null;
  profile: AuthProfile | null;
  role: Role | null;
};

const initial: AuthState = {
  status: "loading",
  userId: null,
  email: null,
  profile: null,
  role: null,
};

async function loadProfileAndRole(userId: string, email: string): Promise<Pick<AuthState, "profile" | "role">> {
  const [{ data: profile }, { data: roleData }] = await Promise.all([
    supabase.from("profiles").select("id, nome, email, ativo").eq("id", userId).maybeSingle(),
    supabase.rpc("current_user_role"),
  ]);
  return {
    profile: profile
      ? { id: profile.id, nome: profile.nome, email: profile.email, ativo: profile.ativo }
      : { id: userId, nome: "", email, ativo: true },
    role: (roleData as Role | null) ?? null,
  };
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(initial);

  useEffect(() => {
    let active = true;
    // Usuário já carregado. O Supabase repete o evento de login ao voltar o foco para a janela e a
    // cada renovação do token; recarregar a tela nesses casos desmontava a página e perdia o que
    // estava sendo editado (documento, desenho, formulário).
    let usuarioAtual: string | null = null;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (!session?.user) {
        usuarioAtual = null;
        setState({ status: "unauthenticated", userId: null, email: null, profile: null, role: null });
        return;
      }
      const { id, email } = session.user;
      if (usuarioAtual === id && event !== "USER_UPDATED") return;
      usuarioAtual = id;
      setState((prev) => ({ ...prev, status: "loading", userId: id, email: email ?? null }));
      loadProfileAndRole(id, email ?? "").then((extras) => {
        if (!active) return;
        setState({ status: "authenticated", userId: id, email: email ?? null, ...extras });
      });
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (!session?.user) {
        setState({ status: "unauthenticated", userId: null, email: null, profile: null, role: null });
        return;
      }
      const { id, email } = session.user;
      usuarioAtual = id;
      loadProfileAndRole(id, email ?? "").then((extras) => {
        if (!active) return;
        setState({ status: "authenticated", userId: id, email: email ?? null, ...extras });
      });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
