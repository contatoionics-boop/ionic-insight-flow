import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATALOGO_PADRAO, mesclarCatalogo, type TipoCatalogo } from "@/lib/escopo/catalogo-tipos";

/**
 * Catálogo de tipos de item do Escopo (nomes configurados, tipos novos). Lê direto do banco (leitura liberada
 * para todos os usuários autenticados, inclusive o agente). Sem a tabela (migration pendente) vale o padrão.
 * Cache simples por sessão: `recarregarTiposEscopo()` depois de salvar em Configurações.
 */
let cache: TipoCatalogo[] | null = null;
let carregando: Promise<TipoCatalogo[]> | null = null;
const ouvintes = new Set<(c: TipoCatalogo[]) => void>();

async function ler(): Promise<TipoCatalogo[]> {
  try {
    const { data, error } = await (supabase as any).from("escopo_tipos").select("chave, rotulo, plural, ativo, sistema, ordem");
    if (error) return CATALOGO_PADRAO;
    return mesclarCatalogo(data);
  } catch {
    return CATALOGO_PADRAO;
  }
}

export function recarregarTiposEscopo(): Promise<TipoCatalogo[]> {
  carregando = ler().then((c) => {
    cache = c;
    ouvintes.forEach((f) => f(c));
    return c;
  });
  return carregando;
}

export function useTiposEscopo(): TipoCatalogo[] {
  const [catalogo, setCatalogo] = useState<TipoCatalogo[]>(cache ?? CATALOGO_PADRAO);
  useEffect(() => {
    ouvintes.add(setCatalogo);
    if (!cache) void (carregando ?? recarregarTiposEscopo());
    else setCatalogo(cache);
    return () => {
      ouvintes.delete(setCatalogo);
    };
  }, []);
  return catalogo;
}
