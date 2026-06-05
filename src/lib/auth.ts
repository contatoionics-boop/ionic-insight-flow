export type Role = "super_admin" | "admin" | "especialista" | "agente_tecnico";

export const roleLabels: Record<Role, string> = {
  super_admin: "Especialista",
  admin: "IAN",
  especialista: "Especialista (revisor)",
  agente_tecnico: "Agente Técnico",
};


export function routeForRole(role: Role | null): string {
  if (role === "especialista") return "/app/review-queue";
  if (role === "admin") return "/app/agenda";
  if (role === "super_admin") return "/app/dashboard";
  if (role === "agente_tecnico") return "/app/minhas-vistorias";
  return "/";
}
