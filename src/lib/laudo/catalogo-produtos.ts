// Catálogo fixo de produtos IONICS + regras de inclusão.
// Direção da regra: nivel_servico (entrada do formulário) DECIDE a inclusão do NLDIV.
// O nível nunca é inferido a partir do produto.

import { pendencia } from "./tipos";

export type LinhaProduto = {
  codigo: string;
  descricao: string;
  quantidade: number;
  nota?: string | null;
};

export type ContextoProduto = {
  nivel: string | null; // nivel_1 | nivel_2 | nivel_3
  bitola: string | null; // 1/2" | 3/4" | 1"
  tipoObjeto: string | null; // posto | pista | comboio | veiculo
  rfid: boolean | null;
  qtdBicos: number | null;
  terminalAtual: string | null;
  comunicacao: string; // texto livre normalizado
};

const NLDIV_POR_BITOLA: Record<string, { codigo: string; descricao: string }> = {
  '1/2"': { codigo: "2.0.03.01.025", descricao: 'NLDIV Wireless 1/2"' },
  '3/4"': { codigo: "2.0.03.01.026", descricao: 'NLDIV Wireless 3/4"' },
  '1"': { codigo: "2.0.03.01.027", descricao: 'NLDIV Wireless 1"' },
};

export function normalizarBitola(v: string | null): string | null {
  if (!v) return null;
  const s = v.replace(/\s|polegadas?|pol\.?/gi, "").replace(/["”]/g, '"');
  if (/^1\/2/.test(s)) return '1/2"';
  if (/^3\/4/.test(s)) return '3/4"';
  if (/^1(\b|")/.test(s)) return '1"';
  return null;
}

export function montarProdutos(ctx: ContextoProduto): LinhaProduto[] {
  const linhas: LinhaProduto[] = [];
  const rfid = ctx.rfid === true;
  const multiBico = (ctx.qtdBicos ?? 1) > 1;

  // Terminal
  if (rfid || multiBico) {
    linhas.push({
      codigo: "2.0.08.00.00V",
      descricao: "Terminal T1000 Multi BW",
      quantidade: 1,
      nota: rfid ? "T1000 compatível com leitura RFID." : null,
    });
  } else if ((ctx.tipoObjeto ?? "") === "veiculo" || (ctx.tipoObjeto ?? "") === "comboio") {
    linhas.push({ codigo: "2.0.08.00.00T", descricao: "Terminal T1000 GPS", quantidade: 1 });
  } else {
    linhas.push({ codigo: "2.0.08.00.00S", descricao: "Terminal T1000", quantidade: 1 });
  }

  // Comunicação
  const com = (ctx.comunicacao || "").toLowerCase();
  if (com.includes("4g") || com.includes("gsm")) {
    linhas.push({
      codigo: "2.0.02.02.004",
      descricao: "Módulo 4G WIFI com antena externa",
      quantidade: 1,
    });
  } else if (com.includes("wifi") || com.includes("wi-fi")) {
    linhas.push({ codigo: "2.0.02.02.001", descricao: "Módulo WIFI", quantidade: 1 });
  } else {
    linhas.push({
      codigo: "2.0.02.02.001",
      descricao: "Módulo WIFI",
      quantidade: 1,
      nota: `Meio de comunicação ${pendencia("comunicacao_tipos", "tipos de comunicação")}`,
    });
  }

  // NLDIV — somente quando o nível de serviço informado for nível 2
  if (ctx.nivel === "nivel_2") {
    const bitola = normalizarBitola(ctx.bitola);
    if (bitola && NLDIV_POR_BITOLA[bitola]) {
      const item = NLDIV_POR_BITOLA[bitola]!;
      linhas.push({
        codigo: item.codigo,
        descricao: item.descricao,
        quantidade: Math.max(1, ctx.qtdBicos ?? 1),
        nota:
          bitola === '1"'
            ? 'Bico 1": recomendada a redução para 3/4" com niple e luva de redução.'
            : null,
      });
    } else {
      linhas.push({
        codigo: pendencia("bitola_bico", "bitola do bico"),
        descricao: "NLDIV Wireless (bitola a confirmar)",
        quantidade: Math.max(1, ctx.qtdBicos ?? 1),
      });
    }
  }

  // Válvula solenoide — sempre
  linhas.push({
    codigo: "2.2.08.04.00F",
    descricao: 'Válvula solenoide 1" 12V TPL',
    quantidade: Math.max(1, ctx.qtdBicos ?? 1),
  });

  // Sensor
  const posto = ctx.tipoObjeto === "posto" || ctx.tipoObjeto === "pista";
  if (posto) {
    linhas.push({ codigo: "2.0.01.03.008", descricao: "Sensor industrial", quantidade: 1 });
  } else if (ctx.tipoObjeto === "comboio") {
    linhas.push({ codigo: "2.0.01.03.015", descricao: "Bloco medidor", quantidade: 1 });
  } else {
    linhas.push({
      codigo: pendencia("tipo_objeto", "tipo do objeto"),
      descricao: "Sensor (industrial ou bloco medidor, conforme o objeto)",
      quantidade: 1,
    });
  }

  // Infra elétrica / painel
  linhas.push({ codigo: "2.0.05.01.001", descricao: "Fonte chaveada 12V", quantidade: 1 });
  if (posto) {
    linhas.push({ codigo: "2.2.0D.02.01M", descricao: "Caixa de painel", quantidade: 1 });
    linhas.push({ codigo: "2.0.02.03.001", descricao: "Base modem", quantidade: 1 });
    linhas.push({ codigo: "2.0.02.04.001", descricao: "Repetidor de sinal", quantidade: 1 });
  }

  // Nota de upgrade quando já existe T850
  if ((ctx.terminalAtual ?? "").toUpperCase().includes("T850")) {
    linhas.push({
      codigo: "—",
      descricao: "Upgrade do terminal T850 existente para T1000 GPS",
      quantidade: 1,
      nota: "Terminal T850 não recebe GPS; substituição necessária para o recurso.",
    });
  }

  return linhas;
}
