// Converte o escopo PREVISTO da proposta comercial em variáveis do laudo.
// Puro e client-safe. Origem sempre "proposta" — o valor de campo (formulário)
// e as decisões do especialista continuam vencendo na montagem do FR-31-10.

import type { VariaveisLaudo } from "@/lib/laudo/tipos";
import { normalizarEscopo, type EscopoProposta } from "@/lib/proposta/tipos";
import { limparTexto, objetosValidos, pareceLixo, rotuloTipoAcao } from "@/lib/texto";

function add(
  vars: VariaveisLaudo,
  chave: string,
  valor: string | null | undefined,
  confianca: number,
) {
  const v = limparTexto(valor);
  if (!v) return;
  vars[chave] = { chave, valor: v, origem: "proposta", confianca: confianca || 0.8 };
}

export function variaveisDaProposta(escopoBruto: Partial<EscopoProposta>): VariaveisLaudo {
  const escopo = normalizarEscopo(escopoBruto);
  const vars: VariaveisLaudo = {};
  const c = (k: keyof EscopoProposta) => Number(escopo[k]?.confianca ?? 0);
  const val = <T,>(k: keyof EscopoProposta) => (escopo[k]?.valor ?? null) as T | null;

  const nivel = val<number>("nivel_automacao");
  if (nivel) add(vars, "nivel_servico", `nivel_${nivel}`, c("nivel_automacao"));

  const fase = val<number>("fase_automacao");
  if (fase) add(vars, "fase_automacao", `Fase ${fase}`, c("fase_automacao"));

  const bicos = val<number>("qtd_bicos");
  if (bicos !== null) add(vars, "qtd_bicos", String(bicos), c("qtd_bicos"));

  const bombas = val<number>("qtd_bombas");
  if (bombas !== null) add(vars, "qtd_bombas", String(bombas), c("qtd_bombas"));

  const postos = val<number>("qtd_postos");
  if (postos !== null) add(vars, "qtd_postos", String(postos), c("qtd_postos"));

  add(vars, "tipo_bomba", val<string>("tipo_bomba_previsto"), c("tipo_bomba_previsto"));

  const comboio = val<boolean>("tem_comboio");
  if (comboio !== null) add(vars, "comboio", comboio ? "sim" : "nao", c("tem_comboio"));

  const qtdComboios = val<number>("qtd_comboios");
  if (qtdComboios !== null) add(vars, "qtd_comboios", String(qtdComboios), c("qtd_comboios"));

  const pista = val<boolean>("tem_pista");
  if (pista !== null) add(vars, "tem_pista", pista ? "sim" : "nao", c("tem_pista"));

  const com = val<string>("comunicacao_prevista");
  if (com) {
    const rotulo = com === "wifi" ? "WiFi" : com === "4g" ? "4G/GSM" : "WiFi, 4G/GSM";
    add(vars, "comunicacao_tipos", rotulo, c("comunicacao_prevista"));
  }

  add(vars, "nome_cliente", val<string>("nome_cliente"), c("nome_cliente"));
  add(vars, "cnpj", val<string>("cnpj"), c("cnpj"));
  add(vars, "unidade", val<string>("unidade"), c("unidade"));
  add(vars, "cep", val<string>("cep"), c("cep"));
  add(vars, "endereco_vistoria", val<string>("endereco"), c("endereco"));
  add(vars, "nome_solucao", val<string>("nome_solucao"), c("nome_solucao"));
  add(vars, "tipo_acao", rotuloTipoAcao(val<string>("tipo_acao")), c("tipo_acao"));

  const objeto = limparTexto(val<string>("objeto_escopo"));
  if (objeto && !pareceLixo(objeto)) add(vars, "objeto_escopo", objeto, c("objeto_escopo"));

  add(vars, "tipo_objeto", val<string>("tipo_objeto"), c("tipo_objeto"));

  // só entram identificações reais de objeto (placa, prefixo, pista, tanque…);
  // listas com descrições do catálogo de produtos são descartadas.
  const ids = objetosValidos(val<string[]>("ids_objetos") ?? []);
  if (ids.length) add(vars, "ids_objetos", ids.join(", "), c("ids_objetos"));

  add(vars, "terminal_atual", val<string>("terminal"), c("terminal"));

  const rfid = val<boolean>("rfid");
  if (rfid !== null) add(vars, "rfid", rfid ? "sim" : "nao", c("rfid"));

  add(vars, "bitola_bico", val<string>("bitola_bico"), c("bitola_bico"));
  add(vars, "tensao_veiculo", val<string>("tensao"), c("tensao"));

  return vars;
}
