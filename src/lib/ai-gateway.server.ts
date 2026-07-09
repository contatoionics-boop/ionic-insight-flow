import { createOpenAI } from "@ai-sdk/openai";

/**
 * Provider de IA usando a OpenAI diretamente.
 * O nome da função é mantido para compatibilidade com os callers existentes,
 * mas internamente aponta para a API oficial da OpenAI usando OPENAI_API_KEY.
 * O parâmetro `key` é ignorado (mantido por compatibilidade histórica).
 */
export function createLovableAiGatewayProvider(_key?: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY ausente.");
  return createOpenAI({
    apiKey,
    compatibility: "strict",
  });
}
