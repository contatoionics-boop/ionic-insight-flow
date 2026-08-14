import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BlocoLaudo } from "@/lib/laudo/tipos";

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
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as BlocoPadrao[];
  });

const SalvarInput = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(2, "Informe o nome do bloco."),
  descricao: z.string().optional().nullable(),
  categoria: z.string().min(1).default("geral"),
  /** conteúdo em texto: cada linha vira parágrafo; linhas iniciadas por "- " viram lista */
  corpo: z.string().min(1, "Informe o conteúdo do bloco."),
  titulo_secao: z.string().optional().nullable(),
  ativo: z.boolean().default(true),
  ordem: z.number().int().default(0),
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
    const payload = {
      nome: data.nome.trim(),
      descricao: data.descricao?.trim() || null,
      categoria: data.categoria,
      blocos: corpoParaBlocos(data.corpo, data.titulo_secao) as any,
      escopo: {} as any,
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
