// Server-only: extração híbrida das variáveis do laudo.
// 1) Determinístico — respostas cujas perguntas têm `chave_laudo` preenchida.
// 2) IA — apenas para as chaves que sobraram, com nível de confiança.
//    Confiança < LIMIAR_CONFIANCA nunca entra no texto: vira [CONFIRMAR: ...].

import { generateText } from "ai";
import { z } from "zod";
import { createOpenAIProvider } from "@/lib/openai.server";
import { CHAVES_LAUDO } from "@/lib/laudo/chaves";
import { LIMIAR_CONFIANCA, type VariaveisLaudo } from "@/lib/laudo/tipos";

export type RespostaBruta = {
  chave_laudo: string | null;
  pergunta: string;
  valor: string | null;
};

const SugestaoSchema = z.object({
  sugestoes: z.array(
    z.object({
      chave: z.string(),
      valor: z.string(),
      confianca: z.number().min(0).max(1),
    }),
  ),
});

function limpar(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s.length ? s : null;
}

export async function extrairVariaveis(
  respostas: RespostaBruta[],
  manuais: VariaveisLaudo = {},
  /** camadas complementares em ordem de prioridade (proposta, cadastro, ...) */
  camadas: VariaveisLaudo[] = [],
): Promise<VariaveisLaudo> {
  const vars: VariaveisLaudo = {};

  // 1) determinístico (respostas do formulário)
  for (const r of respostas) {
    const chave = limpar(r.chave_laudo);
    const valor = limpar(r.valor);
    if (!chave || !valor) continue;
    vars[chave] = { chave, valor, origem: "formulario", confianca: 1 };
  }

  // 1b) camadas complementares: proposta comercial, cadastro do agendamento
  for (const camada of camadas) {
    for (const [chave, item] of Object.entries(camada ?? {})) {
      if (!item?.valor) continue;
      if (vars[chave]?.valor) continue;
      vars[chave] = { ...item, chave };
    }
  }

  // 2) IA para as chaves faltantes
  const faltantes = CHAVES_LAUDO.filter((c) => !vars[c.chave] && !manuais[c.chave]);
  const corpus = respostas
    .map((r) => `- ${r.pergunta}: ${limpar(r.valor) ?? "(sem resposta)"}`)
    .join("\n")
    .slice(0, 24000);

  if (faltantes.length && corpus.trim()) {
    try {
      const provider = createOpenAIProvider();
      const lista = faltantes
        .map(
          (c) =>
            `- ${c.chave}: ${c.descricao}${c.exemplos?.length ? ` (valores esperados: ${c.exemplos.join(", ")})` : ""}`,
        )
        .join("\n");

      const { text } = await generateText({
        model: provider("gpt-4o-mini"),
        temperature: 0,
        system:
          "Você extrai variáveis técnicas de um mapeamento de campo. Responda SOMENTE com JSON válido " +
          '{"sugestoes":[{"chave":"","valor":"","confianca":0.0}]}. ' +
          "Não invente dados: se a informação não estiver claramente presente nas respostas, não inclua a chave. " +
          "A confiança deve refletir o quanto o valor está explícito no texto (1 = literal, 0.5 = inferido, 0.2 = palpite).",
        prompt: `Respostas do mapeamento:\n${corpus}\n\nChaves a extrair:\n${lista}`,
      });

      const jsonStr = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      const parsed = SugestaoSchema.safeParse(JSON.parse(jsonStr));
      if (parsed.success) {
        for (const s of parsed.data.sugestoes) {
          if (vars[s.chave] || manuais[s.chave]) continue;
          if (!CHAVES_LAUDO.some((c) => c.chave === s.chave)) continue;
          const valor = limpar(s.valor);
          if (!valor) continue;
          if (s.confianca >= LIMIAR_CONFIANCA) {
            vars[s.chave] = {
              chave: s.chave,
              valor,
              origem: "ia",
              confianca: s.confianca,
            };
          } else {
            // baixa confiança: sinaliza pendência mas guarda a sugestão para revisão
            vars[s.chave] = {
              chave: s.chave,
              valor: null,
              origem: "ausente",
              confianca: s.confianca,
              sugestao: valor,
            };
          }
        }
      }
    } catch {
      // IA indisponível: segue apenas com o determinístico
    }
  }

  // 3) valores confirmados manualmente sempre vencem
  for (const [chave, item] of Object.entries(manuais)) {
    if (!item?.valor) continue;
    vars[chave] = { ...item, chave, origem: "manual", confianca: 1 };
  }

  // 4) completa as chaves restantes como ausentes
  for (const c of CHAVES_LAUDO) {
    if (!vars[c.chave]) {
      vars[c.chave] = { chave: c.chave, valor: null, origem: "ausente", confianca: 0 };
    }
  }

  return vars;
}
