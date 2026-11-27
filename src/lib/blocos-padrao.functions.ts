import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BlocoLaudo } from "@/lib/laudo/tipos";
import { POSICOES_BLOCO, regraParaEscopo } from "@/lib/laudo/blocos-padrao-regras";
import { SLOTS_TEXTO, corpoParaItens, escopoDaVersao, itensParaBlocos, type ItemTexto } from "@/lib/laudo/textos-padrao";
import { CONFIG_ORDEM_SECOES_ID, CATEGORIA_ORDEM_SECOES } from "@/lib/laudo/ordem-secoes";

export type BlocoPadrao = {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  escopo: Record<string, any>;
  blocos: BlocoLaudo[];
  ativo: boolean;
  ordem: number;
};

export const listarBlocosPadrao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("blocos_padrao")
      .select("id, nome, descricao, categoria, escopo, blocos, ativo, ordem")
      .neq("categoria", CATEGORIA_ORDEM_SECOES)
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as BlocoPadrao[];
  });

/** Conteúdo estruturado de uma versão de texto (parágrafos com formatação, listas, desenhos e imagens da biblioteca). */
const ItemSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("paragraph"),
    texto: z.string().max(20000),
    destaque: z.boolean().optional(),
    rico: z.boolean().optional(),
    alinhamento: z.enum(["esquerda", "centro", "direita", "justificado"]).optional(),
    caixaAlta: z.boolean().optional(),
  }),
  z.object({ tipo: z.literal("bullets"), itens: z.array(z.string().max(5000)).max(100), rico: z.boolean().optional() }),
  z.object({ tipo: z.literal("figura"), nome: z.enum(["bico", "ponteira", "suporte"]) }),
  z.object({ tipo: z.literal("imagem"), id: z.string().min(1).max(100) }),
]);

const SalvarInput = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(2, "Informe o nome do bloco."),
  descricao: z.string().optional().nullable(),
  categoria: z.string().min(1).default("geral"),
  /** conteúdo em texto: cada linha vira parágrafo; linhas iniciadas por "- " viram lista */
  corpo: z.string().default(""),
  /** versão de texto: conteúdo estruturado (tem prioridade sobre `corpo`) */
  itens: z.array(ItemSchema).max(200).optional(),
  titulo_secao: z.string().optional().nullable(),
  ativo: z.boolean().default(true),
  ordem: z.number().int().default(0),
  /** versão de um texto do documento (Introdução, Instruções gerais…): substitui o texto original; ver textos-padrao.ts */
  slot: z.enum(SLOTS_TEXTO).optional().nullable(),
  /** versão de texto usada automaticamente quando as condições são atendidas */
  padrao: z.boolean().optional(),
  /** quando o bloco entra sozinho no documento (vazio/ausente = só inserção manual) */
  regra: z
    .object({
      automatico: z.boolean(),
      solucao: z.array(z.string()).default([]),
      nivel: z.array(z.string()).default([]),
      /** itens fixos (pista, comboio, rfid, tx, frota) ou chave de um tipo novo do escopo */
      exige: z.array(z.string().regex(/^[a-z][a-z0-9_]{1,40}$/)).default([]),
      /** condições dos campos criados em Opções do agendamento: campo → opções aceitas */
      extras: z.record(z.string().regex(/^[a-z][a-z0-9_]{1,39}$/), z.array(z.string().regex(/^[a-z][a-z0-9_]{0,39}$/))).default({}),
      /** onde o bloco adicional automático entra (padrão: antes das Instruções gerais) */
      posicao: z.enum(POSICOES_BLOCO).default("antes_instrucoes"),
    })
    .optional(),
});

/** Converte o texto do editor em blocos do laudo. */
export function corpoParaBlocos(corpo: string, tituloSecao?: string | null): BlocoLaudo[] {
  const out: BlocoLaudo[] = [];
  const rnd = () => Math.random().toString(36).slice(2, 10);
  if (tituloSecao?.trim()) {
    out.push({
      id: `bp-h-${rnd()}`,
      tipo: "heading",
      numero: null,
      texto: tituloSecao.trim(),
      nivel: 3,
    });
  }
  const linhas = corpo.split(/\n/).map((l) => l.trim());
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      out.push({ id: `bp-bl-${rnd()}`, tipo: "bullets", itens: bullets });
      bullets = [];
    }
  };
  for (const l of linhas) {
    if (!l) {
      flush();
      continue;
    }
    if (l.startsWith("- ") || l.startsWith("• ")) {
      bullets.push(l.slice(2).trim());
      continue;
    }
    flush();
    out.push({ id: `bp-p-${rnd()}`, tipo: "paragraph", texto: l });
  }
  flush();
  return out;
}

export const salvarBlocoPadrao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SalvarInput.parse(i))
  .handler(async ({ data, context }) => {
    if (!data.itens?.length && !data.corpo.trim()) throw new Error("Informe o conteúdo do bloco.");
    const regra = data.regra ?? { automatico: false, solucao: [], nivel: [], exige: [], posicao: "antes_instrucoes" as const };
    const versaoDeTexto = !!data.slot;
    const payload = {
      nome: data.nome.trim(),
      descricao: data.descricao?.trim() || null,
      categoria: versaoDeTexto ? "texto" : data.categoria,
      // versão de texto: só parágrafos e listas, com os {{campos}} (o título da seção é do documento)
      blocos: (versaoDeTexto ? itensParaBlocos((data.itens as ItemTexto[] | undefined) ?? corpoParaItens(data.corpo)) : corpoParaBlocos(data.corpo, data.titulo_secao)) as any,
      escopo: (data.slot ? escopoDaVersao(data.slot, data.padrao ?? false, regra) : regraParaEscopo(regra)) as any,
      ativo: data.ativo,
      ordem: data.ordem,
      criado_por: context.userId,
    };
    const q = data.id
      ? context.supabase.from("blocos_padrao").update(payload).eq("id", data.id)
      : context.supabase.from("blocos_padrao").insert(payload);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirBlocoPadrao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("blocos_padrao").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const ordenarBlocosPadrao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ ids: z.array(z.string().uuid()).min(1).max(1000).refine((ids) => new Set(ids).size === ids.length, "A lista contém blocos repetidos.") }).parse(i))
  .handler(async ({ data, context }) => {
    const resultados = await Promise.all(data.ids.map((id, ordem) => context.supabase.from("blocos_padrao").update({ ordem }).eq("id", id).select("id").single()));
    const falha = resultados.find((resultado) => resultado.error);
    if (falha?.error) throw new Error("Não foi possível salvar toda a ordem dos blocos. Recarregue a lista e tente novamente.");
    return { ok: true };
  });

export const carregarOrdemSecoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { lerOrdemSecoes } = await import("@/lib/laudo/ordem-secoes.server");
    return await lerOrdemSecoes(context.supabase);
  });

export const salvarOrdemSecoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ slots: z.array(z.enum(SLOTS_TEXTO)).length(SLOTS_TEXTO.length).refine((slots) => new Set(slots).size === SLOTS_TEXTO.length, "Informe cada seção uma única vez.") }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("blocos_padrao").upsert({
      id: CONFIG_ORDEM_SECOES_ID, nome: "Ordem das seções do documento", categoria: CATEGORIA_ORDEM_SECOES,
      ativo: false, ordem: 0, blocos: [], escopo: { ordem_secoes: data.slots }, criado_por: context.userId,
    }).select("id").single();
    if (error) throw new Error("Não foi possível salvar a ordem das seções. Verifique seu acesso e tente novamente.");
    return { ok: true };
  });
