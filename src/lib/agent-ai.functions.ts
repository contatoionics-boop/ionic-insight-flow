import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

async function validarToken(token: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("links_agente")
    .select("caso_id, expira_em")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error("Erro ao validar link.");
  if (!data) throw new Error("Link inválido.");
  if (data.expira_em && new Date(data.expira_em) < new Date()) {
    throw new Error("Link expirado.");
  }
  return data.caso_id;
}

function getProvider() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente.");
  return createLovableAiGatewayProvider(key);
}

const ValidarFotoInput = z.object({
  token: z.string().min(1),
  perguntaId: z.string().uuid(),
  imagemBase64: z.string().min(1),
  mime: z.string().min(1),
});

const FotoSchema = z.object({
  status: z.enum(["aprovada", "parcial", "incorreta"]),
  descricao_encontrada: z.string(),
  problemas: z.array(z.string()),
  orientacao: z.string(),
});

export const validarFoto = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ValidarFotoInput.parse(input))
  .handler(async ({ data }) => {
    await validarToken(data.token);

    const { data: pergunta, error } = await supabaseAdmin
      .from("perguntas")
      .select("texto, contexto_ia, instrucao_agente")
      .eq("id", data.perguntaId)
      .maybeSingle();
    if (error || !pergunta) throw new Error("Pergunta não encontrada.");

    const contexto =
      pergunta.contexto_ia?.trim() ||
      pergunta.instrucao_agente?.trim() ||
      pergunta.texto;

    const provider = getProvider();
    const model = provider("google/gemini-3-flash-preview");

    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: FotoSchema }),
        messages: [
          {
            role: "system",
            content:
              "Você valida fotos de vistorias técnicas. Compare a imagem ao contexto esperado e retorne JSON estrito. " +
              "status='aprovada' quando a foto atende totalmente o pedido; 'parcial' quando atende com ressalvas; " +
              "'incorreta' quando não atende. Seja objetivo em português.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  `Pergunta: ${pergunta.texto}\n` +
                  `Contexto esperado da foto: ${contexto}\n\n` +
                  `Avalie a imagem em anexo.`,
              },
              {
                type: "image",
                image: `data:${data.mime};base64,${data.imagemBase64}`,
              },
            ],
          },
        ],
      });
      return output;
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("429")) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
      if (msg.includes("402")) throw new Error("Créditos de IA esgotados. Avise o administrador.");
      throw new Error("Falha ao analisar a foto: " + msg);
    }
  });

const TranscreverInput = z.object({
  token: z.string().min(1),
  audioBase64: z.string().min(1),
  mime: z.string().min(1),
});

export const transcreverAudio = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TranscreverInput.parse(input))
  .handler(async ({ data }) => {
    await validarToken(data.token);

    const provider = getProvider();
    const model = provider("google/gemini-3-flash-preview");

    try {
      const { text } = await generateText({
        model,
        messages: [
          {
            role: "system",
            content:
              "Transcreva o áudio em português do Brasil. Responda APENAS com a transcrição, sem comentários.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcreva este áudio:" },
              {
                type: "file",
                data: `data:${data.mime};base64,${data.audioBase64}`,
                mediaType: data.mime,
              } as any,
            ],
          },
        ],
      });
      return { transcricao: text.trim() };
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("429")) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
      if (msg.includes("402")) throw new Error("Créditos de IA esgotados. Avise o administrador.");
      throw new Error("Falha ao transcrever o áudio: " + msg);
    }
  });

const FinalizarInput = z.object({ token: z.string().min(1) });

export const finalizarEnvio = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => FinalizarInput.parse(input))
  .handler(async ({ data }) => {
    const casoId = await validarToken(data.token);
    await supabaseAdmin
      .from("links_agente")
      .update({ utilizado_em: new Date().toISOString() })
      .eq("token", data.token);
    await supabaseAdmin
      .from("casos")
      .update({ status: "aguardando_revisao" })
      .eq("id", casoId);
    return { ok: true };
  });
