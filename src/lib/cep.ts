export type EnderecoCep = {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
};

export function maskCep(v: string): string {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function onlyDigitsCep(v: string): string {
  return (v ?? "").replace(/\D/g, "").slice(0, 8);
}

export async function consultarCep(cep: string): Promise<EnderecoCep> {
  const d = onlyDigitsCep(cep);
  if (d.length !== 8) throw new Error("CEP deve ter 8 dígitos.");
  const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
  if (!res.ok) throw new Error("Falha ao consultar CEP.");
  const j = await res.json();
  if (j?.erro) throw new Error("CEP não encontrado.");
  return {
    cep: maskCep(d),
    logradouro: j.logradouro ?? "",
    bairro: j.bairro ?? "",
    cidade: j.localidade ?? "",
    estado: j.uf ?? "",
  };
}
