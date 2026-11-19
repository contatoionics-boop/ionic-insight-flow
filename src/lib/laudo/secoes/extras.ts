// Seções condicionais do Escopo (Fase 3 do documento mestre): Cartão RFID, DIV e Telemetria TX.
// Funções puras. Só entra o que o Escopo confirma; dado ausente vira [CONFIRMAR], nunca texto inventado.
// Chaves estáveis (`rfid:*`, `div:*`, `tx:*`): a edição manual sobrevive ao "Regerar rascunho".

import type { ContextoLaudo } from "@/lib/laudo/contexto";
import { pendencia, type BlocoLaudo } from "@/lib/laudo/tipos";

/** `texto`: blocos de uma versão cadastrada (Configurações › Textos do documento) no lugar do texto original da seção. */
type Entrada = { contexto: ContextoLaudo | null; id: (prefixo: string) => string; texto?: BlocoLaudo[] | null };

const meta = { origem: "dynamic", editavel: true, removivel: true } as const;

const titulo = (id: Entrada["id"], chave: string, numero: string, texto: string) =>
  ({ id: id("h"), chave, tipo: "heading", numero, texto, nivel: 2, ...meta }) as BlocoLaudo;
const paragrafo = (id: Entrada["id"], chave: string, texto: string, extra: Record<string, unknown> = {}) =>
  ({ id: id("p"), chave, tipo: "paragraph", texto, ...meta, ...extra }) as BlocoLaudo;

/** Campos `{{…}}` dos textos de RFID, DIV e TX (valor ausente = null, vira [CONFIRMAR] no texto). */
export function camposRfid(contexto: ContextoLaudo | null): Record<string, string | null> {
  const rfid = contexto?.escopo.rfid;
  const qtd = rfid?.quantidade ?? 0;
  return {
    rfid_quantidade: qtd ? `${qtd} ${qtd === 1 ? "cartão" : "cartões"} RFID` : null,
    rfid_tecnologia: rfid?.tecnologias.length ? rfid.tecnologias.join(" / ") : null,
  };
}
export const camposDiv = (contexto: ContextoLaudo | null): Record<string, string | null> => ({
  div_total: (contexto?.escopo.frota.totalDiv ?? 0) > 0 ? String(contexto?.escopo.frota.totalDiv) : null,
});
export const camposTx = (contexto: ContextoLaudo | null): Record<string, string | null> => ({
  tx_quantidade: (contexto?.escopo.tx.quantidade ?? 0) > 0 ? String(contexto?.escopo.tx.quantidade) : null,
});

/** Cartão RFID: quantidade e tecnologia vêm do Escopo; a tecnologia ausente é pendência. */
export function blocosRfid({ contexto, id, texto }: Entrada): BlocoLaudo[] | null {
  const rfid = contexto?.escopo.rfid;
  if (!rfid?.ativo) return null;
  if (texto) return [titulo(id, "rfid:titulo", "2.5", "Cartão RFID"), ...texto];
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
export function blocosDiv({ contexto, id, nivel2, texto }: Entrada & { nivel2: boolean }): BlocoLaudo[] | null {
  const frota = contexto?.escopo.frota;
  if (!nivel2 || !frota?.ativa) return null;
  const tipos = frota.tipos.filter((t) => t.modelo?.trim());
  const blocos: BlocoLaudo[] = [titulo(id, "div:titulo", "2.6", "DIV - Dispositivo de Identificação Veicular")];
  // versão cadastrada: o texto dela substitui o resumo; a tabela de tipos segue automática
  if (texto) {
    blocos.push(...texto);
    if (tipos.length)
      blocos.push({
        id: id("t"), chave: "div:tipos", tipo: "table", titulo: "DIV por tipo", colunas: ["Tipo de DIV", "QTD"],
        linhas: tipos.map((t) => ({ celulas: [t.modelo.trim(), String(t.quantidade)] })), ...meta,
      } as BlocoLaudo);
    return blocos;
  }
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
export function blocosTx({ contexto, id, texto }: Entrada): BlocoLaudo[] | null {
  const tx = contexto?.escopo.tx;
  if (!tx?.ativo) return null;
  if (texto) return [titulo(id, "tx:titulo", "2.7", "Telemetria (TX)"), ...texto];
  return [
    titulo(id, "tx:titulo", "2.7", "Telemetria (TX)"),
    paragrafo(id, "tx:texto", pendencia("tx_texto", "texto da Telemetria TX"), { destaque: "editavel" }),
  ];
}
