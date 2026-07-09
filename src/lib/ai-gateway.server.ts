import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Provider de IA usando a OpenAI diretamente.
 * O nome da função é mantido para compatibilidade com os callers existentes,
 * mas internamente aponta para a API oficial da OpenAI usando OPENAI_API_KEY.
 * O parâmetro `_key` é ignorado (mantido por compatibilidade histórica).
 */
export function createLovableAiGatewayProvider(_key?: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY ausente.");
  return createOpenAICompatible({
    name: "openai",
    baseURL: "https://api.openai.com/v1",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}
