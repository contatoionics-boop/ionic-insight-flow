import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type Body = { messages: UIMessage[] };

function extractText(msg: UIMessage): string {
  const parts = (msg as any).parts;
  if (Array.isArray(parts)) {
    return parts.filter((p: any) => p?.type === "text").map((p: any) => p.text).join(" ");
  }
  return typeof (msg as any).content === "string" ? (msg as any).content : "";
}

export const Route = createFileRoute("/api/agente-ia")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (!Array.isArray(body.messages)) {
          return new Response("messages required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("LOVABLE_API_KEY ausente", { status: 500 });

        let system =
          "Você é um assistente de IA da plataforma de mapeamentos técnicos. " +
          "Responda de forma clara e objetiva, em português do Brasil. " +
          "Sempre que possível, fundamente suas respostas na base de conhecimento fornecida abaixo. " +
          "Se a base não tiver informação suficiente, diga isso explicitamente em vez de inventar.";

        // RAG: busca contexto na base de conhecimento usando a última mensagem do usuário
        try {
          const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
          const queryText = lastUser ? extractText(lastUser) : "";
          if (queryText.trim()) {
            const { buscarContextoRelevante } = await import(
              "@/lib/base-conhecimento.functions"
            );
            const chunks = await buscarContextoRelevante(queryText, 6, 0.4);
            if (chunks.length) {
              const bloco = chunks
                .map((c, i) => `[${i + 1}] ${c.conteudo}`)
                .join("\n\n---\n\n");
              system +=
                "\n\n## Base de conhecimento\n" +
                "Use as informações abaixo como fonte principal. Cite os trechos por número quando útil ([1], [2]...).\n---\n" +
                bloco +
                "\n---";
            } else {
              system +=
                "\n\n## Base de conhecimento\n(Nenhum trecho relevante foi encontrado para esta pergunta.)";
            }
          }
        } catch (e) {
          console.error("[agente-ia RAG]", e);
        }

        try {
          const provider = createLovableAiGatewayProvider(key);
          const model = provider("google/gemini-3-flash-preview");
          const result = streamText({
            model,
            system,
            messages: await convertToModelMessages(body.messages),
          });
          return result.toUIMessageStreamResponse({ originalMessages: body.messages });
        } catch (e: any) {
          const msg = String(e?.message ?? e);
          const status = msg.includes("429") ? 429 : msg.includes("402") ? 402 : 500;
          return new Response(msg, { status });
        }
      },
    },
  },
});
