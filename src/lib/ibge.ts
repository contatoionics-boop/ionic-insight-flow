// IBGE Localidades — UFs e Municípios (sem chave, com cache em memória)

export type UF = { sigla: string; nome: string };
export type Municipio = { id: number; nome: string };

let ufsCache: Promise<UF[]> | null = null;
const municipiosCache = new Map<string, Promise<Municipio[]>>();

export function fetchUFs(): Promise<UF[]> {
  if (!ufsCache) {
    ufsCache = fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome")
      .then((r) => {
        if (!r.ok) throw new Error("Falha ao consultar estados.");
        return r.json();
      })
      .then((arr: any[]) =>
        (arr ?? []).map((e) => ({ sigla: e.sigla as string, nome: e.nome as string })),
      )
      .catch((err) => {
        ufsCache = null;
        throw err;
      });
  }
  return ufsCache;
}

export function fetchMunicipios(uf: string): Promise<Municipio[]> {
  const key = uf.toUpperCase();
  if (!key) return Promise.resolve([]);
  let p = municipiosCache.get(key);
  if (!p) {
    p = fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${key}/municipios?orderBy=nome`)
      .then((r) => {
        if (!r.ok) throw new Error("Falha ao consultar municípios.");
        return r.json();
      })
      .then((arr: any[]) => (arr ?? []).map((m) => ({ id: m.id as number, nome: m.nome as string })))
      .catch((err) => {
        municipiosCache.delete(key);
        throw err;
      });
    municipiosCache.set(key, p);
  }
  return p;
}
