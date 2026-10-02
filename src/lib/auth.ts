export type Role = "super_admin" | "admin" | "especialista" | "agente_tecnico";

export const roleLabels: Record<Role, string> = {
  super_admin: "Especialista",
  admin: "IAM",
  especialista: "Especialista",
  agente_tecnico: "Agente Técnico",
};


export function routeForRole(role: Role | null): string {
  if (role === "especialista") return "/app/review-queue";
  if (role === "admin") return "/app/agenda";
  if (role === "super_admin") return "/app/dashboard";
  if (role === "agente_tecnico") return "/app/minhas-vistorias";
  return "/";
}

const ERROS_AUTH: [RegExp, string][] = [
  [/invalid login credentials/i, "E-mail ou senha incorretos."],
  [/email not confirmed/i, "E-mail ainda não confirmado. Verifique sua caixa de entrada."],
  [/user not found/i, "Usuário não encontrado."],
  [/rate limit|too many requests|security purposes/i, "Muitas tentativas. Aguarde um instante e tente novamente."],
  [/password should be at least/i, "A senha deve ter pelo menos 6 caracteres."],
  [/same password|different from the old/i, "A nova senha deve ser diferente da atual."],
  [/weak password|password is too weak/i, "Senha muito fraca. Escolha uma senha mais forte."],
  [/token has expired|otp.*expired|link.*expired|invalid.*token/i, "Link expirado ou inválido. Solicite um novo."],
  [/failed to fetch|network|load failed/i, "Falha de conexão. Verifique sua internet e tente novamente."],
  [/user.*banned|signups not allowed/i, "Acesso não permitido para este usuário."],
];

/** Traduz mensagens de erro do Supabase Auth (em inglês) para pt-BR. */
export function traduzirErroAuth(mensagem: string | null | undefined, padrao = "Não foi possível concluir. Tente novamente."): string {
  if (!mensagem) return padrao;
  for (const [padraoRegex, texto] of ERROS_AUTH) if (padraoRegex.test(mensagem)) return texto;
  return /[ãõçáéíóúâêô]/i.test(mensagem) ? mensagem : padrao;
}
