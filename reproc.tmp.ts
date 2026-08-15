import { createClient } from "@supabase/supabase-js";
import { montarESalvarLaudo } from "./src/lib/laudo/montar.server";
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data } = await sb.from("casos").select("id").eq("codigo", "CS-0049").maybeSingle();
const r = await montarESalvarLaudo(sb, data!.id);
const keys = ["comunicacao_tipos","wifi_disponivel","gsm_4g_disponivel","frequencia_wifi","qualidade_wifi","qualidade_sinal","qtd_bicos","tipo_objeto","tipos_veiculos_abastecidos","comboio"];
for (const k of keys) console.log(k, JSON.stringify(r.variaveis[k] ?? null));
const { data: c2 } = await sb.from("casos").select("divergencias_proposta").eq("id", data!.id).maybeSingle();
console.log(JSON.stringify(c2, null, 1));
