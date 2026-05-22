export type Role = "super_admin" | "admin" | "specialist";

export type Session = {
  name: string;
  email: string;
  role: Role;
};

const KEY = "ionics_session";

export const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin Comercial",
  specialist: "Especialista",
};

export const mockUsers: Record<Role, { name: string; email: string }> = {
  super_admin: { name: "Cledir", email: "cledir@ionics.com.br" },
  admin: { name: "Yan Silva", email: "yan@ionics.com.br" },
  specialist: { name: "Pablo Costa", email: "pablo@ionics.com.br" },
};

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setSession(s: Session) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
