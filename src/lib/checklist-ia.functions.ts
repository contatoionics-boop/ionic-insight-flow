import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

const PerguntaCtx = z.object({
  id: z.string().uuid(),
  texto: z.string(),
  tipo: z.string(),
  obrigatoria: z.boolean(),
  opcoes: z.array(z.string()).default([]),
});

const AssistenteInput = z.object({
  token: z.string().min(1).optional(),
  casoId: z.string().uuid().optional(),
  pergunta: z.string().min(1),
  etapaTitulo: z.string().default(""),
  perguntaAtual: PerguntaCtx.nullable().default(null),
});

const AssistenteSchema = z.object({
  resposta: z.string(),
  sugestao: z.string().nullable(),
});

/**
 * Assistente contextual do checklist. NÃO grava nada: devolve texto de apoio e,
 * quando fizer sentido, um valor sugerido para o agente confirmar.
 */
export const perguntarAssistenteChecklist = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AssistenteInput.parse(input))
  .handler(async ({ data }) => {
    const { createOpenAIProvider } = await import("@/lib/openai.server");
    const model = createOpenAIProvider()("gpt-4o-mini");

    const atual = data.perguntaAtual;
    const contexto = atual
      ? `Etapa atual: ${data.etapaTitulo}\nCampo atual: ${atual.texto} (tipo ${atual.tipo}${
          atual.obrigatoria ? ", obrigatório" : ""
        })${atual.opcoes.length ? `\nOpções: ${atual.opcoes.join(", ")}` : ""}`
      : `Etapa atual: ${data.etapaTitulo}`;

    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: AssistenteSchema }),
        messages: [
          {
            role: "system",
            content:
              "Você é o assistente de um agente técnico preenchendo um mapeamento técnico de infraestrutura. " +
              "Responda em português, de forma curta e prática. Nunca invente dados do cliente. " +
              "Se conseguir propor um valor pronto para o campo atual, coloque-o em 'sugestao'; caso contrário, use null.",
          },
          { role: "user", content: `${contexto}\n\nPergunta do agente: ${data.pergunta}` },
        ],
      });
      return output;
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (msg.includes("429")) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
      throw new Error("Falha ao consultar o assistente: " + msg);
    }
  });

const FalaInput = z.object({
  token: z.string().min(1).optional(),
  casoId: z.string().uuid().optional(),
  transcricao: z.string().min(1),
  perguntas: z.array(PerguntaCtx).min(1).max(60),
});

const FalaSchema = z.object({
  campos: z.array(
    z.object({
      perguntaId: z.string(),
      valor: z.string(),
      confianca: z.enum(["alta", "media", "baixa"]),
    }),
  ),
});

export type CampoExtraido = { perguntaId: string; valor: string; confianca: "alta" | "media" | "baixa" };

/**
 * Extrai vários campos de uma única fala. Não grava nada — o agente confirma
 * cada valor antes de aplicar.
 */
export const extrairCamposDaFala = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => FalaInput.parse(input))
  .handler(async ({ data }): Promise<{ campos: CampoExtraido[] }> => {
    const { createOpenAIProvider } = await import("@/lib/openai.server");
    const model = createOpenAIProvider()("gpt-4o-mini");

    const lista = data.perguntas
      .filter((p) => !["foto", "video", "audio"].includes(p.tipo))
      .map(
        (p) =>
          `- id=${p.id} | ${p.texto} | tipo=${p.tipo}${p.opcoes.length ? ` | opções: ${p.opcoes.join(" / ")}` : ""}`,
      )
      .join("\n");

    if (!lista) return { campos: [] };

    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: FalaSchema }),
        messages: [
          {
            role: "system",
            content:
              "Você extrai valores de campos de formulário a partir da fala de um agente técnico em campo. " +
              "Só retorne campos realmente mencionados na fala. Use exatamente os ids fornecidos. " +
              "Para campos com opções, escolha exatamente uma das opções. Nunca invente informação.",
          },
          { role: "user", content: `Campos disponíveis:\n${lista}\n\nFala transcrita:\n"${data.transcricao}"` },
        ],
      });
      const ids = new Set(data.perguntas.map((p) => p.id));
      return {
        campos: output.campos.filter((c) => ids.has(c.perguntaId) && c.valor.trim()),
      };
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (msg.includes("429")) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
      throw new Error("Falha ao interpretar a fala: " + msg);
    }
  });
