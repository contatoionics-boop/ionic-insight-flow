import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Biblioteca de imagens dos textos do documento (Configurações › Blocos padrão).
 * Cada imagem é uma linha de `blocos_padrao` (categoria "imagem") com um bloco de imagem; o arquivo fica no
 * bucket público dos laudos, em `biblioteca/`. A permissão de gravar vem da própria tabela (RLS): a linha é
 * criada/alterada com a sessão do usuário ANTES do envio do arquivo, que só então usa a chave de serviço.
 */
const BUCKET = "empresa-logos";
const PASTA = "biblioteca";

const SalvarInput = z.object({
  /** sem id = imagem nova (exige o arquivo) */
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2, "Informe o nome da imagem.").max(80),
  legenda: z.string().trim().max(200).default(""),
  alt: z.string().trim().max(300).default(""),
  larguraMax: z.number().int().min(120).max(600).default(360),
  arquivo: z
    .object({
      contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      base64: z.string().min(1).max(14_000_000),
    })
    .optional(),
});

const extensao = (tipo: string) => (tipo === "image/png" ? "png" : tipo === "image/webp" ? "webp" : "jpg");

/** Caminho do arquivo dentro do bucket, a partir da URL pública (para apagar o arquivo antigo). */
function caminhoDaUrl(url: string | null | undefined): string | null {
  const m = (url ?? "").match(new RegExp(`/${BUCKET}/(${PASTA}/[^?#]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export const salvarImagemBiblioteca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SalvarInput.parse(i))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    let id = data.id ?? null;
    let blocoAtual: any = null;

    if (id) {
      const { data: linha, error } = await db.from("blocos_padrao").select("id, blocos").eq("id", id).eq("categoria", "imagem").maybeSingle();
      if (error) throw new Error(error.message);
      if (!linha) throw new Error("Imagem não encontrada na biblioteca.");
      blocoAtual = (linha.blocos ?? []).find((b: any) => b?.tipo === "image") ?? null;
    } else {
      if (!data.arquivo) throw new Error("Envie o arquivo da imagem.");
      const { data: nova, error } = await db
        .from("blocos_padrao")
        .insert({ nome: data.nome, categoria: "imagem", escopo: {}, blocos: [], ativo: true, ordem: 0, criado_por: context.userId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = nova.id as string;
    }

    let url: string = blocoAtual?.url ?? "";
    if (data.arquivo) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const caminho = `${PASTA}/${id}-${Date.now()}.${extensao(data.arquivo.contentType)}`;
      const { error: erroUp } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(caminho, Buffer.from(data.arquivo.base64, "base64"), { upsert: true, contentType: data.arquivo.contentType });
      if (erroUp) {
        // imagem nova sem arquivo não fica na lista: desfaz a linha criada
        if (!data.id) await db.from("blocos_padrao").delete().eq("id", id);
        throw new Error(erroUp.message);
      }
      const antigo = caminhoDaUrl(url);
      url = supabaseAdmin.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
      if (antigo) void supabaseAdmin.storage.from(BUCKET).remove([antigo]);
    }

    const bloco = { id: blocoAtual?.id ?? `img-${id}`, tipo: "image", url, alt: data.alt || data.nome, legenda: data.legenda || null, larguraMax: data.larguraMax };
    const { error: erroSalvar } = await db.from("blocos_padrao").update({ nome: data.nome, blocos: [bloco] }).eq("id", id);
    if (erroSalvar) throw new Error(erroSalvar.message);
    return { id: id as string, url };
  });

export const excluirImagemBiblioteca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { data: linha } = await db.from("blocos_padrao").select("blocos").eq("id", data.id).eq("categoria", "imagem").maybeSingle();
    const { error } = await db.from("blocos_padrao").delete().eq("id", data.id).eq("categoria", "imagem");
    if (error) throw new Error(error.message);
    const caminho = caminhoDaUrl((linha?.blocos ?? []).find((b: any) => b?.tipo === "image")?.url);
    if (caminho) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from(BUCKET).remove([caminho]);
    }
    return { ok: true };
  });
