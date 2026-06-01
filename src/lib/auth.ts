export type Role = "super_admin" | "admin" | "especialista" | "agente_tecnico";

export const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin Comercial",
  especialista: "Especialista",
  agente_tecnico: "Vistoriador",
};

export function routeForRole(role: Role | null): string {
  if (role === "especialista") return "/app/review-queue";
  if (role === "admin") return "/app/agenda";
  if (role === "super_admin") return "/app/dashboard";
  if (role === "agente_tecnico") return "/app/minhas-vistorias";
  return "/";
}
