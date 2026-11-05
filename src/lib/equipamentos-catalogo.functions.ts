import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EquipamentoCatalogo = {
  codigo: string;
  nome: string;
  ativo: boolean;
  origem: string;
  categoria: string | null;
  unidade: string;
  quantidade_padrao: number;
  sugerir: boolean;
  regra: { nivel?: string[]; bitola?: string[]; tipo_objeto?: string[]; area_classificada?: boolean };
};

const RegraSchema = z.object({
  nivel: z.array(z.string()).optional(),
  bitola: z.array(z.string()).optional(),
  tipo_objeto: z.array(z.string()).optional(),
  area_classificada: z.boolean().optional(),
});

const limparTermo = (t: string) =>
  t.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[%*,()\\"']/g, " ").trim();

const FALTA_MIGRATION = "O catálogo de equipamentos ainda não foi atualizado no banco (falta aplicar a migration 20261105120000_equipamentos_catalogo).";
const faltaColuna = (msg: string) => /(column|schema cache)/i.test(msg) && /(sugerir|regra|categoria|quantidade_padrao|unidade)/.test(msg);

/** Lista para a tela de manutenção: busca por código/nome; novos (cadastrados à mão) primeiro. */
export const listarEquipamentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ q: z.string().max(80).default(""), somenteManuais: z.boolean().default(false) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    let q = (context.supabase as any)
      .from("produtos_catalogo")
      .select("codigo, nome, ativo, origem, categoria, unidade, quantidade_padrao, sugerir, regra");
    for (const termo of limparTermo(data.q).split(/\s+/).filter(Boolean)) {
      q = q.or(`codigo.ilike.%${termo}%,nome.ilike.%${termo}%`);
    }
    if (data.somenteManuais) q = q.eq("origem", "manual");
    const { data: linhas, error } = await q.order("origem", { ascending: false }).order("nome", { ascending: true }).limit(100);
    if (error) throw new Error(faltaColuna(error.message) ? FALTA_MIGRATION : error.message);
    return ((linhas ?? []) as any[]).map((l) => ({ ...l, quantidade_padrao: Number(l.quantidade_padrao ?? 1) })) as EquipamentoCatalogo[];
  });

const SalvarInput = z.object({
  codigo: z.string().trim().min(2, "Informe o código.").max(40),
  nome: z.string().trim().min(2, "Informe o nome do equipamento.").max(200),
  categoria: z.string().trim().max(60).nullable().default(null),
  unidade: z.string().trim().min(1).max(10).default("un"),
  quantidade_padrao: z.number().min(0).default(1),
  ativo: z.boolean().default(true),
  sugerir: z.boolean().default(false),
  regra: RegraSchema.default({}),
  /** true = cadastro rápido de equipamento novo: não pode sobrescrever um código que já existe */
  somenteNovo: z.boolean().default(false),
});

/** Cria um equipamento novo (origem manual) ou atualiza um existente (a origem original é mantida). */
export const salvarEquipamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SalvarInput.parse(i))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { data: existente, error: e0 } = await db.from("produtos_catalogo").select("codigo").eq("codigo", data.codigo).maybeSingle();
    if (e0) throw new Error(faltaColuna(e0.message) ? FALTA_MIGRATION : e0.message);
    if (existente && data.somenteNovo) throw new Error(`O código ${data.codigo} já existe no catálogo. Use a busca para escolhê-lo.`);
    const campos = {
      nome: data.nome,
      categoria: data.categoria || null,
      unidade: data.unidade,
      quantidade_padrao: data.quantidade_padrao,
      ativo: data.ativo,
      sugerir: data.sugerir,
      regra: data.regra as any,
      atualizado_em: new Date().toISOString(),
    };
    const { error } = existente
      ? await db.from("produtos_catalogo").update(campos).eq("codigo", data.codigo)
      : await db.from("produtos_catalogo").insert({ codigo: data.codigo, origem: "manual", criado_por: context.userId, ...campos });
    if (error) throw new Error(faltaColuna(error.message) ? FALTA_MIGRATION : error.message);
    return { ok: true, codigo: data.codigo, nome: data.nome, novo: !existente };
  });
