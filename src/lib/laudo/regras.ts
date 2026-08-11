// Regras condicionais e alertas do laudo.

import type { BlocoLaudo } from "./tipos";

export type MaterialCatalogo = {
  id: string;
  codigo: string;
  descricao: string;
  aplicacao: string | null;
  unidade: string;
  quantidade_padrao: number;
  regra: {
    nivel?: string[];
    bitola?: string[];
    tipo_objeto?: string[];
    area_classificada?: boolean;
  };
  ativo: boolean;
  ordem: number;
};

export type ContextoRegras = {
  nivel: string | null;
  bitola: string | null;
  tipoObjeto: string | null;
  areaClassificada: boolean | null;
  usaConversor: boolean | null;
  terminalAtual: string | null;
  rfid: boolean | null;
};

export function materiaisAplicaveis(
  catalogo: MaterialCatalogo[],
  ctx: ContextoRegras,
): MaterialCatalogo[] {
  return catalogo
    .filter((m) => m.ativo)
    .filter((m) => {
      const r = m.regra ?? {};
      if (r.nivel?.length && (!ctx.nivel || !r.nivel.includes(ctx.nivel))) return false;
      if (r.bitola?.length && (!ctx.bitola || !r.bitola.includes(ctx.bitola))) return false;
      if (r.tipo_objeto?.length && (!ctx.tipoObjeto || !r.tipo_objeto.includes(ctx.tipoObjeto)))
        return false;
      if (r.area_classificada === true && ctx.areaClassificada !== true) return false;
      return true;
    })
    .sort((a, b) => a.ordem - b.ordem);
}

/** Alertas técnicos — bloqueantes travam a geração do PDF até confirmação explícita. */
export function alertasDoContexto(ctx: ContextoRegras): Extract<BlocoLaudo, { tipo: "alert" }>[] {
  const out: Extract<BlocoLaudo, { tipo: "alert" }>[] = [];

  if (ctx.usaConversor === true) {
    out.push({
      id: "alert-conversor",
      tipo: "alert",
      severidade: "bloqueante",
      codigo: "conversor_24_12",
      texto:
        "Uso de conversor 24/12VCC identificado. Essa configuração não é homologada pela IONICS e compromete a garantia do equipamento. Corrija a especificação ou registre ciência do risco antes de emitir o laudo.",
    });
  }

  if ((ctx.terminalAtual ?? "").toUpperCase().includes("T850")) {
    out.push({
      id: "alert-t850",
      tipo: "alert",
      severidade: "info",
      codigo: "upgrade_t850",
      texto:
        "O terminal T850 existente não suporta GPS. Para o recurso de rastreamento é necessário o upgrade para T1000 GPS.",
    });
  }

  if (ctx.rfid === true) {
    out.push({
      id: "alert-rfid",
      tipo: "alert",
      severidade: "info",
      codigo: "rfid_t1000",
      texto: "Operação com RFID: utilizar terminal T1000 compatível com leitura RFID.",
    });
  }

  if (ctx.areaClassificada === true) {
    out.push({
      id: "alert-area",
      tipo: "alert",
      severidade: "info",
      codigo: "area_classificada",
      texto:
        "Instalação em área classificada: obrigatório uso de componentes EX (luvas e prensa-cabos certificados).",
    });
  }

  return out;
}
