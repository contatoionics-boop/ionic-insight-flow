export type Role = "super_admin" | "admin" | "especialista" | "agente_tecnico";

export const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin Comercial",
  especialista: "Especialista",
  agente_tecnico: "Agente Técnico",
};

export function routeForRole(role: Role | null): string {
  if (role === "especialista") return "/app/review-queue";
  // super_admin e admin → dashboard. admin não tem dashboard na nav, mas pode ver clients.
  if (role === "admin") return "/app/clients";
  if (role === "super_admin") return "/app/dashboard";
  return "/";
}
