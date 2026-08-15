import { describe, expect, it } from "vitest";
import { compararCasoProposta } from "@/lib/proposta/processar.server";

/** Stub mínimo do client Supabase para o caminho "sem proposta". */
function supabaseStub(registro: { divergencias_proposta?: unknown }) {
  const updates: any[] = [];
  return {
    updates,
    from(tabela: string) {
      if (tabela === "propostas_comerciais") {
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          order: () => chain,
          limit: async () => ({ data: [] }),
        };
        return chain;
      }
      const chain: any = {
        select: () => chain,
        eq: (_c: string, _v: string) => chain,
        maybeSingle: async () => ({ data: registro }),
        update: (payload: any) => {
          updates.push(payload);
          return { eq: async () => ({ data: null }) };
        },
      };
      return chain;
    },
  };
}

describe("caso sem proposta comercial", () => {
  it("não retorna comparação e limpa divergências stale", async () => {
    const sb = supabaseStub({
      divergencias_proposta: { divergencias: [{ codigo: "comboio_divergente" }], pendencias: [] },
    });
    const r = await compararCasoProposta(sb as any, "caso-1", null);
    expect(r.comparacao).toBeNull();
    expect(sb.updates).toEqual([{ divergencias_proposta: {} }]);
  });
});
