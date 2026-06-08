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
};

async function resolveAccess(body: Body, request: Request): Promise<string> {
  if (body.token) return validarTokenAcesso(body.token);
  if (body.casoId) {
    // Validate via bearer token from authenticated user
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Não autenticado.");
    }
    const accessToken = authHeader.replace("Bearer ", "");
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
        const system = buildSystemPrompt(ctx);

        const provider = createLovableAiGatewayProvider(key);
        const model = provider("google/gemini-3-flash-preview");

        const tools = {
          salvar_resposta: tool({
            description:
              "Salva a resposta do vistoriador para uma pergunta específica. Use SEMPRE antes de avançar. Para batch, chame múltiplas vezes.",
            inputSchema: z.object({
              pergunta_id: z.string().uuid(),
              valor_texto: z.string().optional(),
              opcao_id: z.string().uuid().optional(),
              arquivo_path: z.string().optional(),
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
