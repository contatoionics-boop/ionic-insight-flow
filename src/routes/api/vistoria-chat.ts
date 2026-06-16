import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { z } from "zod";
import {
  buildSystemPrompt,
  execSalvarResposta,
  execValidarFoto,
  loadAgentContext,
  validarTokenAcesso,
  validarUsuarioCaso,
  type AgentContext,
} from "@/lib/vistoria-agent.server";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type Body = {
  messages: UIMessage[];
  token?: string;
  casoId?: string;
  accessToken?: string;
};

async function resolveAccess(body: Body, request: Request): Promise<string> {
  if (body.token) return validarTokenAcesso(body.token);
  if (body.casoId) {
    // Validate via bearer token from authenticated user
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : body.accessToken;
    if (!accessToken) {
      throw new Error("Não autenticado.");
    }
    const { createClient } = await import("@supabase/supabase-js");
    const supa = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await supa.auth.getClaims(accessToken);
    if (error || !data?.claims?.sub) throw new Error("Sessão inválida.");
    await validarUsuarioCaso(body.casoId, data.claims.sub);
    return body.casoId;
  }
  throw new Error("Informe token ou casoId.");
}

export const Route = createFileRoute("/api/vistoria-chat")({
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

        let casoId: string;
        try {
          casoId = await resolveAccess(body, request);
        } catch (e: any) {
          return new Response(e?.message ?? "Sem acesso", { status: 401 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("LOVABLE_API_KEY ausente", { status: 500 });

        const ctx: AgentContext = await loadAgentContext(casoId);
        let system = buildSystemPrompt(ctx);

        // Inject RAG context based on the last user message
        try {
          const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
          const queryText = (() => {
            if (!lastUser) return "";
            const parts = (lastUser as any).parts;
            if (Array.isArray(parts)) {
              return parts
                .filter((p: any) => p?.type === "text")
                .map((p: any) => p.text)
                .join(" ");
            }
            return typeof (lastUser as any).content === "string"
              ? (lastUser as any).content
              : "";
          })();
          if (queryText.trim()) {
            const { buscarContextoRelevante } = await import(
              "@/lib/base-conhecimento.functions"
            );
            const chunks = await buscarContextoRelevante(queryText, 5, 0.5);
            if (chunks.length) {
              const bloco = chunks
                .map((c, i) => `[${i + 1}] ${c.conteudo}`)
                .join("\n\n---\n\n");
              system +=
                "\n\n## Base de conhecimento\nUse as seguintes informações da base de conhecimento para embasar sua resposta, quando relevantes:\n---\n" +
                bloco +
                "\n---";
            }
          }
        } catch (e) {
          console.error("[RAG] falha ao buscar contexto:", e);
        }

        const provider = createLovableAiGatewayProvider(key);
        const model = provider("google/gemini-3-flash-preview");

        const tools = {
          salvar_resposta: tool({
            description:
              "Salva a resposta do vistoriador para uma pergunta específica. Use SEMPRE antes de avançar. Para batch, chame múltiplas vezes. Para fotos múltiplas no mesmo item, passe arquivos_paths com a lista.",
            inputSchema: z.object({
              pergunta_id: z.string().uuid(),
              valor_texto: z.string().optional(),
              opcao_id: z.string().uuid().optional(),
              arquivo_path: z.string().optional(),
              arquivos_paths: z.array(z.string()).optional(),
              transcricao: z.string().optional(),
            }),
            execute: async (input) => execSalvarResposta(casoId, ctx, input),
          }),
          validar_foto: tool({
            description:
              "Valida uma foto anexada pelo vistoriador contra o contexto esperado. Use quando o usuário anexar [ANEXO_FOTO].",
            inputSchema: z.object({
              pergunta_id: z.string().uuid(),
              arquivo_path: z.string(),
            }),
            execute: async (input) => execValidarFoto(ctx, input),
          }),
        };

        try {
          const result = streamText({
            model,
            system,
            tools,
            stopWhen: stepCountIs(50),
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
