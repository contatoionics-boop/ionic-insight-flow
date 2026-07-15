import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { z } from "zod";
import { createOpenAIProvider } from "@/lib/openai.server";
import { draftSchema } from "@/lib/form-assistant-schema";

const SYSTEM = `Você é um assistente que ajuda administradores a criar formulários de vistoria técnica em um sistema brasileiro.

Estrutura do formulário:
- Um formulário tem várias seções (etapas da vistoria).
- Cada seção tem várias perguntas.
- Tipos de pergunta permitidos:
  - "texto": resposta textual livre
  - "numero": valor numérico
  - "data": data
  - "selecao_unica": uma alternativa dentre opções (deve ter campo "opcoes")
  - "toggle": Sim/Não
  - "checkbox": confirmação simples
  - "foto": foto que será analisada por IA — use "contexto_ia" para descrever o que a IA deve verificar
  - "audio": áudio que será transcrito

Seu fluxo:
1. Faça poucas perguntas para entender o tipo de vistoria (imóvel, veículo, equipamento, obra, etc.), o objetivo e as etapas.
2. Se o usuário enviar imagens ou PDFs de formulários existentes, extraia a estrutura deles.
3. Quando tiver contexto suficiente, chame a ferramenta "propose_form" com o rascunho COMPLETO do formulário.
4. Depois de propor, peça ao usuário se quer ajustar algo. Se ele pedir mudanças, chame "propose_form" novamente com a versão atualizada COMPLETA (não incremental).
5. Sempre escreva em português do Brasil. Seja conciso e direto.`;

export const Route = createFileRoute("/api/forms-assistant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages?: UIMessage[] };
        if (!Array.isArray(body.messages)) {
          return new Response("Messages required", { status: 400 });
        }
        const key = process.env.OPENAI_API_KEY;
        if (!key) return new Response("OPENAI_API_KEY missing", { status: 500 });

        const gateway = createOpenAIProvider(key);
        const model = gateway("gpt-4o-mini");

        const tools = {
          propose_form: tool({
            description:
              "Propõe um rascunho completo de formulário de vistoria para o usuário revisar. Sempre envie a estrutura inteira (não incremental).",
            inputSchema: draftSchema,
            execute: async () => ({ ok: true }),
          }),
        };

        const result = streamText({
          model,
          system: SYSTEM,
          tools,
          stopWhen: stepCountIs(50),
          messages: await convertToModelMessages(body.messages),
        });

        return result.toUIMessageStreamResponse({ originalMessages: body.messages });
      },
    },
  },
});
