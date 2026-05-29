export type DadosCnpj = {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  email: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
};

export function maskCnpj(v: string): string {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 14);
  const p1 = d.slice(0, 2);
  const p2 = d.slice(2, 5);
  const p3 = d.slice(5, 8);
  const p4 = d.slice(8, 12);
  const p5 = d.slice(12, 14);
  let out = p1;
  if (d.length > 2) out += `.${p2}`;
  if (d.length > 5) out += `.${p3}`;
  if (d.length > 8) out += `/${p4}`;
  if (d.length > 12) out += `-${p5}`;
  return out;
}

export function onlyDigitsCnpj(v: string): string {
  return (v ?? "").replace(/\D/g, "").slice(0, 14);
}

export async function consultarCnpj(cnpj: string): Promise<DadosCnpj> {
  const d = onlyDigitsCnpj(cnpj);
  if (d.length !== 14) throw new Error("CNPJ deve ter 14 dígitos.");
  const res = await fetch(`https://publica.cnpj.ws/cnpj/${d}`);
  if (res.status === 429) throw new Error("Muitas consultas. Tente novamente em instantes.");
  if (res.status === 404) throw new Error("CNPJ não encontrado.");
  if (!res.ok) throw new Error("Falha ao consultar CNPJ.");
  const j = await res.json();
  const est = j?.estabelecimento ?? {};
  const tel = Array.isArray(est?.telefones) && est.telefones[0]
    ? `(${est.telefones[0].ddd}) ${est.telefones[0].numero}`
    : "";
  return {
    cnpj: maskCnpj(d),
    razao_social: j?.razao_social ?? "",
    nome_fantasia: est?.nome_fantasia ?? "",
    email: est?.email ?? "",
    telefone: tel,
    cep: est?.cep ? est.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2") : "",
    logradouro: [est?.tipo_logradouro, est?.logradouro].filter(Boolean).join(" "),
    numero: est?.numero ?? "",
    bairro: est?.bairro ?? "",
    cidade: est?.cidade?.nome ?? "",
    estado: est?.estado?.sigla ?? "",
  };
}
