// Seções condicionais do Escopo (Fase 3 do documento mestre): Cartão RFID, DIV e Telemetria TX.
// Funções puras. Só entra o que o Escopo confirma; dado ausente vira [CONFIRMAR], nunca texto inventado.
// Chaves estáveis (`rfid:*`, `div:*`, `tx:*`): a edição manual sobrevive ao "Regerar rascunho".

import type { ContextoLaudo } from "@/lib/laudo/contexto";
import { pendencia, type BlocoLaudo } from "@/lib/laudo/tipos";

type Entrada = { contexto: ContextoLaudo | null; id: (prefixo: string) => string };

const meta = { origem: "dynamic", editavel: true, removivel: true } as const;

const titulo = (id: Entrada["id"], chave: string, numero: string, texto: string) =>
  ({ id: id("h"), chave, tipo: "heading", numero, texto, nivel: 2, ...meta }) as BlocoLaudo;
const paragrafo = (id: Entrada["id"], chave: string, texto: string, extra: Record<string, unknown> = {}) =>
  ({ id: id("p"), chave, tipo: "paragraph", texto, ...meta, ...extra }) as BlocoLaudo;

/** Cartão RFID: quantidade e tecnologia vêm do Escopo; a tecnologia ausente é pendência. */
export function blocosRfid({ contexto, id }: Entrada): BlocoLaudo[] | null {
  const rfid = contexto?.escopo.rfid;
  if (!rfid?.ativo) return null;
  const qtd = rfid.quantidade;
  const tecnologia = rfid.tecnologias.length ? rfid.tecnologias.join(" / ") : pendencia("rfid_tecnologia", "tecnologia do cartão RFID (Mifare ou Melexis)");
  const cartoes = qtd ? `${qtd} ${qtd === 1 ? "cartão" : "cartões"} RFID` : pendencia("rfid_quantidade", "quantidade de cartões RFID");
  return [
    titulo(id, "rfid:titulo", "2.5", "Cartão RFID"),
    paragrafo(id, "rfid:resumo", `As liberações de abastecimento contarão com identificação por cartão: ${cartoes}, tecnologia ${tecnologia}.`),
    paragrafo(id, "rfid:compatibilidade", "O terminal T1000 deverá ser compatível com a tecnologia do cartão RFID utilizado pelo cliente."),
  ];
}

/** DIV: só no Nível 2 e com frota no Escopo; a tabela (automática) tem uma linha por tipo, sem linhas em branco. */
export function blocosDiv({ contexto, id, nivel2 }: Entrada & { nivel2: boolean }): BlocoLaudo[] | null {
  const frota = contexto?.escopo.frota;
  if (!nivel2 || !frota?.ativa) return null;
  const tipos = frota.tipos.filter((t) => t.modelo?.trim());
  const blocos: BlocoLaudo[] = [titulo(id, "div:titulo", "2.6", "DIV - Dispositivo de Identificação Veicular")];
  if (!tipos.length) {
    blocos.push(paragrafo(id, "div:resumo", `Tipos e quantidades de DIV: ${pendencia("div_tipos", "tipos e quantidades de DIV")}.`));
    return blocos;
  }
  const total = frota.totalDiv;
  blocos.push(paragrafo(id, "div:resumo", `${total === 1 ? "Está previsto 1 DIV" : `Estão previstos ${total} DIV`} para a identificação dos veículos e equipamentos abastecidos, conforme a tabela a seguir.`));
  blocos.push({
    id: id("t"), chave: "div:tipos", tipo: "table", titulo: "DIV por tipo", colunas: ["Tipo de DIV", "QTD"],
    linhas: tipos.map((t) => ({ celulas: [t.modelo.trim(), String(t.quantidade)] })), ...meta,
  } as BlocoLaudo);
  return blocos;
}

/** Telemetria TX: só a estrutura do bloco condicional; o texto técnico é do especialista (pendência até preencher). */
export function blocosTx({ contexto, id }: Entrada): BlocoLaudo[] | null {
  const tx = contexto?.escopo.tx;
  if (!tx?.ativo) return null;
  return [
    titulo(id, "tx:titulo", "2.7", "Telemetria (TX)"),
    paragrafo(id, "tx:texto", pendencia("tx_texto", "texto da Telemetria TX"), { destaque: "editavel" }),
  ];
}
