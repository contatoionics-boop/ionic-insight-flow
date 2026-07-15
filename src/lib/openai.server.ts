import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Provider de IA usando a OpenAI diretamente (api.openai.com/v1)
 * com a chave OPENAI_API_KEY configurada no projeto.
 */
export function createOpenAIProvider(_key?: string) {
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
