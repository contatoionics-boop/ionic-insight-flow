import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createOpenAIProvider } from "@/lib/openai.server";

type Body = { messages: UIMessage[] };

type FonteAgente = {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: string;
  classificacao: string;
  tags: string[];
  fonte: string | null;
  similarity: number | null;
  origem: "semantica" | "literal";
};

function extractText(msg: UIMessage): string {
  const parts = (msg as any).parts;
  if (Array.isArray(parts)) {
    return parts.filter((p: any) => p?.type === "text").map((p: any) => p.text).join(" ");
  }
  return typeof (msg as any).content === "string" ? (msg as any).content : "";
}

function trechoRelevante(conteudo: string, pergunta: string, max = 360): string {
  const termos = pergunta
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .match(/[A-Z0-9]{4,}/g) ?? [];
  const conteudoNormalizado = conteudo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  const posicoes = termos.map((t) => conteudoNormalizado.indexOf(t)).filter((i) => i >= 0);
  const start = Math.max(0, (posicoes.length ? Math.min(...posicoes) : 0) - 80);
  const trecho = conteudo.slice(start, start + max).trim();
  return `${start > 0 ? "..." : ""}${trecho}${start + max < conteudo.length ? "..." : ""}`;
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

        const lastUserMessage = [...body.messages].reverse().find((m) => m.role === "user");
        const lastUserText = lastUserMessage ? extractText(lastUserMessage) : "";

        const key = process.env.OPENAI_API_KEY;
        if (!key) return new Response("OPENAI_API_KEY ausente", { status: 500 });

        let fontes: FonteAgente[] = [];
        let system =
          "Você é um assistente de IA da plataforma de mapeamentos técnicos. " +
          "Responda de forma clara e objetiva, em português do Brasil. " +
          "Você deve priorizar a base de conhecimento fornecida abaixo. " +
          "Se houver registros encontrados, use-os antes de qualquer conhecimento geral e não diga que a base não possui informação específica. " +
          "Quando a pergunta pedir OK, ATENÇÃO ou BLOQUEIO, use a classificação do registro mais relevante. " +
          "Ao final, inclua uma seção 'Fontes usadas' listando título, categoria, classificação e trecho citado. " +
          "Se a base não tiver informação suficiente, diga isso explicitamente em vez de inventar.";

        // RAG: busca contexto na base de conhecimento usando a última mensagem do usuário
        try {
          if (lastUserText.trim()) {
            const { buscarKnowledgeBaseParaAgente } = await import("@/lib/knowledge-base.functions");
            fontes = await buscarKnowledgeBaseParaAgente(lastUserText, 8);
            if (fontes.length) {
              const bloco = fontes
                .map((c, i) => {
                  const trecho = trechoRelevante(c.conteudo, lastUserText, 700);
                  return `[${i + 1}]\nTítulo: ${c.titulo}\nCategoria: ${c.categoria}\nClassificação: ${c.classificacao}\nFonte: ${c.fonte ?? "não informada"}\nOrigem da busca: ${c.origem}\nTrecho: ${trecho}`;
                })
                .join("\n\n---\n\n");
              system +=
                "\n\n## Base de conhecimento\n" +
                "Os registros abaixo foram encontrados para a pergunta. A resposta deve ser baseada neles, citando os números [1], [2] etc. " +
                "A classificação final deve seguir o registro mais específico/relevante encontrado.\n---\n" +
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
          const provider = createOpenAIProvider(key);
          const model = provider("gpt-4o-mini");
          const result = streamText({
            model,
            system,
            messages: await convertToModelMessages(body.messages),
          });
          return result.toUIMessageStreamResponse({
            originalMessages: body.messages,
            messageMetadata: ({ part }) => {
              if (part.type !== "finish") return undefined;
              return {
                fontes: fontes.map((f, i) => ({
                  numero: i + 1,
                  id: f.id,
                  titulo: f.titulo,
                  categoria: f.categoria,
                  classificacao: f.classificacao,
                  fonte: f.fonte,
                  trecho: trechoRelevante(f.conteudo, lastUserText, 320),
                  similarity: f.similarity,
                  origem: f.origem,
                })),
              };
            },
          });
        } catch (e: any) {
          const msg = String(e?.message ?? e);
          const status = msg.includes("429") ? 429 : msg.includes("402") ? 402 : 500;
          return new Response(msg, { status });
        }
      },
    },
  },
});
