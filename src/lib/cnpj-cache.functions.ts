import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ cnpj: z.string().min(11).max(20) });

export type BuscarPorCnpjResult = {
  matriz: {
    id: string;
    empresa_id: string;
    nome: string | null;
    cnpj: string | null;
    razao_social: string | null;
  } | null;
  empresa: { id: string; nome: string } | null;
  unidades: Array<{
    id: string;
    nome: string;
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
  }>;
  ultimaVistoria: {
    caso_id: string;
    endereco_vistoria: string | null;
    unidade: {
      id: string;
      nome: string;
      cep: string | null;
      logradouro: string | null;
      numero: string | null;
      bairro: string | null;
      cidade: string | null;
      estado: string | null;
    } | null;
  } | null;
};

export const buscarPorCnpj = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data, context }): Promise<BuscarPorCnpjResult> => {
    const { supabase } = context;
    const digits = data.cnpj.replace(/\D/g, "");
    if (digits.length !== 14) {
      return { matriz: null, empresa: null, unidades: [], ultimaVistoria: null };
    }

    // matriz pode estar salva mascarada ou só dígitos — tentamos ambos
    const masked = digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

    const { data: matriz } = await supabase
      .from("matrizes")
      .select("id, empresa_id, nome, cnpj, razao_social")
      .or(`cnpj.eq.${digits},cnpj.eq.${masked}`)
      .maybeSingle();

    let empresa: BuscarPorCnpjResult["empresa"] = null;
    let unidades: BuscarPorCnpjResult["unidades"] = [];
    if (matriz) {
      const [{ data: emp }, { data: uns }] = await Promise.all([
        supabase.from("empresas").select("id, nome").eq("id", matriz.empresa_id).maybeSingle(),
        supabase
          .from("unidades")
          .select("id, nome, cep, logradouro, numero, bairro, cidade, estado")
          .eq("matriz_id", matriz.id)
          .order("nome"),
      ]);
      empresa = emp ?? null;
      unidades = (uns ?? []) as BuscarPorCnpjResult["unidades"];
    }

    // Última vistoria com esse CNPJ (via unidade -> matriz)
    let ultimaVistoria: BuscarPorCnpjResult["ultimaVistoria"] = null;
    if (matriz) {
      const { data: caso } = await supabase
        .from("casos")
        .select(
          "id, endereco_vistoria, unidade:unidades(id, nome, cep, logradouro, numero, bairro, cidade, estado, matriz_id)",
        )
        .order("criado_em", { ascending: false })
        .limit(20);
      const match = (caso ?? []).find(
        (c: any) => c?.unidade?.matriz_id === matriz.id,
      );
      if (match) {
        ultimaVistoria = {
          caso_id: match.id,
          endereco_vistoria: match.endereco_vistoria ?? null,
          unidade: match.unidade
            ? {
                id: match.unidade.id,
                nome: match.unidade.nome,
                cep: match.unidade.cep,
                logradouro: match.unidade.logradouro,
                numero: match.unidade.numero,
                bairro: match.unidade.bairro,
                cidade: match.unidade.cidade,
                estado: match.unidade.estado,
              }
            : null,
        };
      }
    }

    return { matriz: matriz ?? null, empresa, unidades, ultimaVistoria };
  });
