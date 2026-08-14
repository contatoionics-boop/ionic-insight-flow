import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createOpenAIProvider } from "@/lib/openai.server";

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
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY ausente.");
  return createOpenAIProvider(key);
}

const ValidarFotoInput = z.object({
  token: z.string().min(1),
  casoId: z.string().uuid().optional(),
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
    // "preview" (editor) e "app" (sessão autenticada, identificada por casoId)
    // não usam link público; nesses casos não há token a validar.
    const semLink = data.token === "preview" || data.token === "app" || !!data.casoId;
    if (!semLink) {
      await validarToken(data.token);
    }


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
    const model = provider("gpt-4o-mini");

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
    if (data.token !== "preview" && data.token !== "app") {
      await validarToken(data.token);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY ausente.");

    try {
      const mime = data.mime.includes("wav")
        ? "audio/wav"
        : data.mime.includes("mp3") || data.mime.includes("mpeg")
        ? "audio/mpeg"
        : data.mime.includes("mp4") || data.mime.includes("m4a") || data.mime.includes("aac")
        ? "audio/mp4"
        : data.mime.includes("ogg") || data.mime.includes("opus")
        ? "audio/ogg"
        : "audio/wav";
      const ext = mime === "audio/wav" ? "wav" : mime === "audio/mpeg" ? "mp3" : mime === "audio/mp4" ? "m4a" : "ogg";

      const bin = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bin], { type: mime });
      const form = new FormData();
      form.append("file", blob, `audio.${ext}`);
      form.append("model", "whisper-1");
      form.append("language", "pt");
      form.append("response_format", "json");

      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      if (!res.ok) {
        const msg = await res.text();
        if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
        if (res.status === 402) throw new Error("Créditos de IA esgotados. Avise o administrador.");
        throw new Error(`Whisper ${res.status}: ${msg}`);
      }
      const json = (await res.json()) as { text?: string };
      return { transcricao: (json.text ?? "").trim() };
    } catch (e: any) {
      const msg = String(e?.message ?? e);
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
