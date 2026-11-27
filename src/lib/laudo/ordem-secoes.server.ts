import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { CONFIG_ORDEM_SECOES_ID, normalizarOrdemSecoes } from "./ordem-secoes";

export async function lerOrdemSecoes(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.from("blocos_padrao").select("escopo").eq("id", CONFIG_ORDEM_SECOES_ID).maybeSingle();
  if (error) throw new Error("Não foi possível carregar a ordem das seções do documento.");
  const escopo = data?.escopo;
  return escopo && typeof escopo === "object" && !Array.isArray(escopo) ? normalizarOrdemSecoes(escopo["ordem_secoes"]) : null;
}