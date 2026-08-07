import { z } from "zod";

export const TIPOS_PERGUNTA = [
  "texto",
  "numero",
  "foto",
  "video",
  "audio",
  "checkbox",
  "data",
  "selecao_unica",
  "toggle",
] as const;

export const opcaoSchema = z.object({
  texto: z.string().min(1).max(200),
});

export const perguntaSchema = z.object({
  texto: z.string().min(1).max(500),
  tipo: z.enum(TIPOS_PERGUNTA),
  obrigatoria: z.boolean().default(true),
  contexto_ia: z.string().max(1000).nullable().optional(),
  opcoes: z.array(opcaoSchema).max(20).optional(),
});

export const secaoSchema = z.object({
  titulo: z.string().min(1).max(200),
  perguntas: z.array(perguntaSchema).min(1).max(50),
});

export const draftSchema = z.object({
  nome: z.string().min(1).max(200),
  descricao: z.string().max(1000).nullable().optional(),
  secoes: z.array(secaoSchema).min(1).max(20),
});

export type FormDraft = z.infer<typeof draftSchema>;
export type DraftSecao = z.infer<typeof secaoSchema>;
export type DraftPergunta = z.infer<typeof perguntaSchema>;
