import { supabase } from "@/integrations/supabase/client";

export type LinkMode = "stepper" | "chat";

export async function criarCasoELink(opts: {
  clienteId: string;
  formId: string;
  agenteId: string;
  userId: string;
  mode: LinkMode;
}): Promise<string> {
  const { data: caso, error: casoErr } = await supabase
    .from("casos")
    .insert({
      cliente_id: opts.clienteId,
      formulario_id: opts.formId,
      agente_id: opts.agenteId,
      criado_por: opts.userId,
      status: "rascunho",
    })
    .select("id")
    .single();
  if (casoErr || !caso) throw casoErr ?? new Error("Falha ao criar caso");

  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const { error: linkErr } = await supabase
    .from("links_agente")
    .insert({ token, caso_id: caso.id });
  if (linkErr) throw linkErr;

  const qs = opts.mode === "chat" ? "?mode=chat" : "";
  return `${window.location.origin}/agent/${token}${qs}`;
}
