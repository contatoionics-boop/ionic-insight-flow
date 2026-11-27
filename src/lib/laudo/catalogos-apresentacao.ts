import { rotuloOpcao, type OpcaoAgendamento } from "@/lib/opcoes-agendamento";
import type { MaterialCatalogo } from "./regras";

type RegraCatalogo = MaterialCatalogo["regra"];

const lista = (texto: string) => texto.split(",").map((valor) => valor.trim()).filter(Boolean);

export function regraDeCampos({ nivel, bitola, tipo_objeto, area_classificada }: {
  nivel: string;
  bitola: string;
  tipo_objeto: string;
  area_classificada: boolean;
}): RegraCatalogo {
  return {
    ...(nivel ? { nivel: lista(nivel) } : {}),
    ...(bitola ? { bitola: lista(bitola) } : {}),
    ...(tipo_objeto ? { tipo_objeto: lista(tipo_objeto) } : {}),
    ...(area_classificada ? { area_classificada: true } : {}),
  };
}

const uniao = new Intl.ListFormat("pt-BR", { type: "disjunction" });
const rotuloObjeto = new Map([
  ["pista", "Pista"],
  ["posto", "Posto"],
  ["comboio", "Comboio"],
  ["veiculo", "Veículo"],
  ["veículo", "Veículo"],
]);

export function descricaoRegraCatalogo(
  regra: RegraCatalogo | null | undefined,
  ativo: boolean,
  sugerir: boolean,
  opcoes: OpcaoAgendamento[],
): string {
  if (!ativo) return "Sem sugestão automática enquanto estiver inativo.";
  if (!sugerir) return "Sugestão automática desativada.";

  const r = regra ?? {};
  const condicoes = [
    r.nivel?.length ? uniao.format(r.nivel.map((valor) => rotuloOpcao("nivel", valor, opcoes) ?? valor)) : null,
    r.bitola?.length ? "bitola " + uniao.format(r.bitola) : null,
    r.tipo_objeto?.length ? "tipo de objeto " + uniao.format(r.tipo_objeto.map((valor) => rotuloObjeto.get(valor) ?? valor)) : null,
    r.area_classificada === true ? "área classificada" : null,
  ].filter(Boolean);

  return condicoes.length ? condicoes.join(" + ") : "Em todos os mapeamentos.";
}

export function materialCorrespondeABusca(codigo: string, descricao: string, busca: string): boolean {
  const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const conteudo = normalizar(codigo + " " + descricao);
  return normalizar(busca).trim().split(/\s+/).every((termo) => conteudo.includes(termo));
}
