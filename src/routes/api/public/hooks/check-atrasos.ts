import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/check-atrasos")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

        const { data: casos, error } = await supabaseAdmin
          .from("casos")
          .select("id, codigo, criado_por, data_execucao, data_entrega_agente")
          .not("data_execucao", "is", null)
          .is("data_entrega_agente", null)
          .lt("data_execucao", cutoff);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        let created = 0;
        for (const c of casos ?? []) {
          if (!c.criado_por) continue;
          const { data: existente } = await supabaseAdmin
            .from("notificacoes")
            .select("id")
            .eq("caso_id", c.id)
            .eq("tipo", "agente_atrasado")
            .limit(1)
            .maybeSingle();
          if (existente) continue;
          const { error: insErr } = await supabaseAdmin.from("notificacoes").insert({
            usuario_id: c.criado_por,
            caso_id: c.id,
            tipo: "agente_atrasado",
            titulo: "Mapeamento atrasado",
            mensagem: `Mapeamento ${c.codigo} pendente de entrega pelo agente.`,
          });
          if (!insErr) created += 1;
        }

        return new Response(JSON.stringify({ ok: true, created }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
