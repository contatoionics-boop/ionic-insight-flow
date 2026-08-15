// Corrige a semântica das chaves vinculadas às perguntas do formulário.
// Perguntas antigas apontam para chaves erradas (ex.: um toggle "dispõe de
// Wi-Fi?" ligado a `comunicacao_tipos`, ou "tipos de veículos" ligado a
// `tipo_objeto`). Aqui a resposta é redirecionada para a chave correta antes
// de entrar nas variáveis do laudo. Puro e client-safe.

import { ehRespostaBooleana } from "@/lib/laudo/comunicacao";

function norm(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const CLASSES_VEICULO = /\b(leve|leves|pesado|pesados|utilitario|utilitarios|maquina|maquinas|implemento|implementos|onibus|moto|motos)\b/;
const OBJETO_ESTRUTURA = /\b(pista|posto|comboio|tanque|ilha|bomba)\b/;

/**
 * Retorna a chave semanticamente correta para a resposta, ou `null` quando a
 * resposta não deve alimentar nenhuma variável.
 */
export function chaveCorrigida(
  chave: string,
  pergunta: string | null | undefined,
  valor: string | null | undefined,
): string | null {
  const p = norm(pergunta);
  const v = norm(valor);

  if (chave === "comunicacao_tipos") {
    // booleano puro nunca descreve a tecnologia de comunicação
    if (ehRespostaBooleana(valor)) {
      if (/wi fi|wifi|internet/.test(p)) return "wifi_disponivel";
      if (/gsm|gprs|4g|3g|movel|celular/.test(p)) return "gsm_4g_disponivel";
      return null;
    }
    if (/wi fi|wifi/.test(p) && !/tipo|meio|comunicacao/.test(p)) return "wifi_disponivel";
    return "comunicacao_tipos";
  }

  if (chave === "tipo_objeto") {
    // "tipos de veículos que abastece" descreve a frota, não o objeto do escopo
    if (/tipos? de veiculos|veiculos que abastece|frota atendida/.test(p))
      return "tipos_veiculos_abastecidos";
    if (CLASSES_VEICULO.test(v) && !OBJETO_ESTRUTURA.test(v)) return "tipos_veiculos_abastecidos";
    return "tipo_objeto";
  }

  return chave;
}
