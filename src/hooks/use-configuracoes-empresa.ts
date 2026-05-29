import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ConfiguracoesEmpresa = {
  id: string;
  nome_empresa: string | null;
  logo_url: string | null;
  cnpj: string | null;
  telefone: string | null;
  email_contato: string | null;
  endereco: string | null;
  cidade_estado: string | null;
  site: string | null;
  texto_rodape: string | null;
};

export function useConfiguracoesEmpresa() {
  const [config, setConfig] = useState<ConfiguracoesEmpresa | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("configuracoes_empresa")
      .select("id, nome_empresa, logo_url, cnpj, telefone, email_contato, endereco, cidade_estado, site, texto_rodape")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setConfig((data as ConfiguracoesEmpresa) ?? null);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { config, loading };
}
