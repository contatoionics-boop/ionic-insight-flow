import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SugestaoBloco = {
  secaoId: string;
  secaoTitulo: string;
  titulo: string;
  layout: "cartao" | "matriz" | "fotos";
  motivo: string;
  perguntas: { id: string; texto: string; tipo: string; linha: string | null; coluna: string | null }[];
};

function normalizar(v: string) {
  return v
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/** Divide "Bomba: marca" ou "Bomba - marca" em [prefixo, sufixo]. */
function separar(texto: string): { prefixo: string; sufixo: string } | null {
  const m = texto.match(/^(.{3,60}?)\s*[:\-–—]\s*(.{2,})$/);
  if (!m) return null;
  return { prefixo: m[1]!.trim(), sufixo: m[2]!.trim() };
}

type P = { id: string; secao_id: string; texto: string; tipo: string; ordem: number; bloco_id: string | null };

function agrupar(secaoId: string, secaoTitulo: string, perguntas: P[]): SugestaoBloco[] {
  const out: SugestaoBloco[] = [];
  const ordenadas = [...perguntas].sort((a, b) => a.ordem - b.ordem);
  const usadas = new Set<string>();

  // 1) Prefixo comum (ex.: "Bomba: tipo", "Bomba: marca")
  const porPrefixo = new Map<string, { prefixo: string; itens: { p: P; sufixo: string }[] }>();
  for (const p of ordenadas) {
    const s = separar(p.texto);
    if (!s) continue;
    const chave = normalizar(s.prefixo);
    const entry = porPrefixo.get(chave) ?? { prefixo: s.prefixo, itens: [] };
    entry.itens.push({ p, sufixo: s.sufixo });
    porPrefixo.set(chave, entry);
  }
  for (const { prefixo, itens } of porPrefixo.values()) {
    if (itens.length < 2) continue;
    // Matriz quando o mesmo conjunto de sufixos se repete por linha
    const sufixos = new Set(itens.map((i) => normalizar(i.sufixo)));
    const layout: SugestaoBloco["layout"] =
      itens.every((i) => i.p.tipo === "foto") ? "fotos" : sufixos.size < itens.length ? "matriz" : "cartao";
    out.push({
      secaoId,
      secaoTitulo,
      titulo: prefixo,
      layout,
      motivo: `Prefixo comum "${prefixo}" em ${itens.length} perguntas.`,
      perguntas: itens.map((i) => ({
        id: i.p.id,
        texto: i.p.texto,
        tipo: i.p.tipo,
        linha: layout === "matriz" ? i.sufixo : null,
        coluna: null,
      })),
    });
    for (const i of itens) usadas.add(i.p.id);
  }

  // 2) Sequência de fotos consecutivas (>= 3)
  let seq: P[] = [];
  const flushFotos = () => {
    if (seq.length >= 3) {
      out.push({
        secaoId,
        secaoTitulo,
        titulo: `Fotos — ${secaoTitulo}`,
        layout: "fotos",
        motivo: `${seq.length} fotos consecutivas podem ser enviadas em lote.`,
        perguntas: seq.map((p) => ({ id: p.id, texto: p.texto, tipo: p.tipo, linha: null, coluna: null })),
      });
      for (const p of seq) usadas.add(p.id);
    }
    seq = [];
  };
  for (const p of ordenadas) {
    if (usadas.has(p.id)) {
      flushFotos();
      continue;
    }
    if (p.tipo === "foto") seq.push(p);
    else flushFotos();
  }
  flushFotos();

  return out.filter((b) => b.perguntas.length >= 2);
}

/** Sugere agrupamentos de perguntas por heurística (prefixo comum e fotos em sequência). */
export const sugerirBlocos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ formularioId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<SugestaoBloco[]> => {
    const { supabase } = context;
    const { data: secoes, error: e1 } = await supabase
      .from("secoes")
      .select("id, titulo, ordem")
      .eq("formulario_id", data.formularioId)
      .order("ordem");
    if (e1) throw new Error(e1.message);
    const ids = (secoes ?? []).map((s) => s.id);
    if (ids.length === 0) return [];

    const { data: perguntas, error: e2 } = await supabase
      .from("perguntas")
      .select("id, secao_id, texto, tipo, ordem, bloco_id")
      .in("secao_id", ids)
      .order("ordem");
    if (e2) throw new Error(e2.message);

    const sugestoes: SugestaoBloco[] = [];
    for (const s of secoes ?? []) {
      const ps = ((perguntas ?? []) as P[]).filter((p) => p.secao_id === s.id && !p.bloco_id);
      if (ps.length < 2) continue;
      sugestoes.push(...agrupar(s.id, s.titulo as string, ps));
    }
    return sugestoes;
  });

const AplicarInput = z.object({
  blocos: z
    .array(
      z.object({
        secaoId: z.string().uuid(),
        titulo: z.string().min(1).max(200),
        descricao: z.string().max(500).nullable().optional(),
        layout: z.enum(["cartao", "matriz", "fotos"]),
        perguntas: z.array(
          z.object({
            id: z.string().uuid(),
            linha: z.string().max(120).nullable().optional(),
            coluna: z.string().max(120).nullable().optional(),
          }),
        ),
      }),
    )
    .max(80),
});

/** Cria os blocos aprovados e vincula as perguntas. */
export const aplicarBlocos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AplicarInput.parse(d))
  .handler(async ({ data, context }): Promise<{ criados: number }> => {
    const { supabase } = context;
    let criados = 0;
    for (const b of data.blocos) {
      const { data: bloco, error } = await supabase
        .from("pergunta_blocos")
        .insert({
          secao_id: b.secaoId,
          titulo: b.titulo,
          descricao: b.descricao ?? null,
          layout: b.layout,
          ordem: criados + 1,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      for (const p of b.perguntas) {
        const { error: eUpd } = await supabase
          .from("perguntas")
          .update({
            bloco_id: bloco.id,
            bloco_linha: p.linha ?? null,
            bloco_coluna: p.coluna ?? null,
          })
          .eq("id", p.id);
        if (eUpd) throw new Error(eUpd.message);
      }
      criados++;
    }
    return { criados };
  });

/** Desfaz um bloco, soltando suas perguntas. */
export const removerBloco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ blocoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase } = context;
    await supabase
      .from("perguntas")
      .update({ bloco_id: null, bloco_linha: null, bloco_coluna: null })
      .eq("bloco_id", data.blocoId);
    const { error } = await supabase.from("pergunta_blocos").delete().eq("id", data.blocoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
