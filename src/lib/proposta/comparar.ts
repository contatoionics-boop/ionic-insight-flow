// Comparador puro: escopo vendido (proposta) x variáveis do mapeamento (campo).

import type { VariaveisLaudo } from "@/lib/laudo/tipos";
import type { Divergencia, EscopoProposta, ResultadoComparacao } from "@/lib/proposta/tipos";

function v(vars: VariaveisLaudo, chave: string): string | null {
  const item = vars[chave];
  // só vale como "campo" o que veio do mapeamento ou foi confirmado manualmente:
  // valores herdados da própria proposta não podem gerar divergência consigo mesmos.
  if (!item || (item.origem !== "formulario" && item.origem !== "manual" && item.origem !== "ia")) {
    return null;
  }
  const s = item.valor;
  return s && String(s).trim() ? String(s).trim() : null;
}

function num(s: string | null): number | null {
  if (!s) return null;
  const m = s.replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function bool(s: string | null): boolean | null {
  if (!s) return null;
  const t = s.toLowerCase();
  if (/^(sim|s|true|1|possui|tem)\b/.test(t)) return true;
  if (/^(n[aã]o|n|false|0|ausente|inexistente)\b/.test(t)) return false;
  return null;
}

function nivelDoCampo(vars: VariaveisLaudo): number | null {
  const s = v(vars, "nivel_servico");
  return s ? num(s.replace("nivel_", "")) : null;
}

export function compararPropostaCampo(
  escopo: EscopoProposta,
  vars: VariaveisLaudo,
): ResultadoComparacao {
  const divergencias: Divergencia[] = [];
  const pendencias: string[] = [];

  // ---------- Nível contratado x viabilidade em campo ----------
  const nivelProposta = escopo.nivel_automacao?.valor ?? null;
  const nivelCampo = nivelDoCampo(vars);
  const comunicacaoCampo = (v(vars, "comunicacao_tipos") ?? "").toLowerCase();
  const sinal = (v(vars, "qualidade_sinal") ?? "").toLowerCase();
  const semRede =
    comunicacaoCampo.length > 0 &&
    !/wi-?fi|wifi|gprs|4g|3g|gsm|r[aá]dio|rede/.test(comunicacaoCampo);
  const sinalFraco = /fraco|ruim|inst[aá]vel|intermitente|sem sinal|ausente/.test(sinal);

  if (nivelProposta === null) {
    pendencias.push("Nível de automação não identificado na proposta.");
  } else if (nivelCampo === null) {
    pendencias.push("Nível do serviço não informado no mapeamento.");
  } else if (nivelProposta !== nivelCampo) {
    divergencias.push({
      codigo: "nivel_divergente",
      titulo: "Nível contratado diferente do nível do mapeamento",
      proposta: `Nível ${nivelProposta}`,
      campo: `Nível ${nivelCampo}`,
      severidade: "alta",
      recomendacao:
        "Confirmar com o comercial qual nível será executado e reajustar a proposta se necessário.",
    });
  }

  if (nivelProposta !== null && nivelProposta >= 2 && (semRede || sinalFraco)) {
    divergencias.push({
      codigo: "nivel2_sem_infra",
      titulo: "Nível 2 contratado sem infraestrutura de rede compatível",
      proposta: `Nível ${nivelProposta}`,
      campo: sinalFraco
        ? `Sinal ${sinal || "fraco"} no local`
        : `Comunicação disponível: ${comunicacaoCampo || "não identificada"}`,
      severidade: "alta",
      recomendacao:
        "Nível 2 exige módulo bico wireless + sensor de abastecimento na bomba com enlace estável. Prever antena/4G adicional ou rebaixar o escopo.",
    });
  }

  if (nivelProposta === 3 || nivelCampo === 3) {
    divergencias.push({
      codigo: "nivel3_hardware_veicular",
      titulo: "Nível 3 (telemetria) exige hardware adicional no veículo",
      proposta: nivelProposta ? `Nível ${nivelProposta}` : "não identificado",
      campo: nivelCampo ? `Nível ${nivelCampo}` : "não informado",
      severidade: "atencao",
      recomendacao: "Conferir se o kit veicular de telemetria está previsto no investimento.",
    });
  }

  // ---------- Quantidade de bicos ----------
  const bicosProposta = escopo.qtd_bicos?.valor ?? null;
  const bicosCampo = num(v(vars, "qtd_bicos"));
  if (bicosProposta === null) pendencias.push("Quantidade de bicos não identificada na proposta.");
  else if (bicosCampo === null) pendencias.push("Quantidade de bicos não informada no mapeamento.");
  else if (bicosProposta !== bicosCampo) {
    const delta = bicosCampo - bicosProposta;
    const tensao = (v(vars, "tensao_veiculo") ?? "").includes("24") ? "24V (CMB)" : "12V (T1000)";
    divergencias.push({
      codigo: "qtd_bicos_divergente",
      titulo: "Quantidade de bicos vendida diferente da mapeada",
      proposta: `${bicosProposta} bico(s)`,
      campo: `${bicosCampo} bico(s)`,
      severidade: "alta",
      recomendacao:
        `Diferença de ${delta > 0 ? "+" : ""}${delta} bico(s). Ajustar proporcionalmente as válvulas solenoides ${tensao} e os módulos por bico na proposta.`,
    });
  }

  // ---------- Comboio ----------
  const comboioProposta = escopo.comboio?.valor ?? null;
  const tipoObjeto = (v(vars, "tipo_objeto") ?? "").toLowerCase();
  const objetoEscopo = (v(vars, "objeto_escopo") ?? "").toLowerCase();
  const comboioCampoDireto = bool(v(vars, "comboio"));
  const comboioCampo =
    comboioCampoDireto ?? (tipoObjeto || objetoEscopo ? /comboio/.test(`${tipoObjeto} ${objetoEscopo}`) : null);
  if (comboioProposta === null) pendencias.push("Comboio não identificado na proposta.");
  else if (comboioCampo === null) pendencias.push("Presença de comboio não informada no mapeamento.");
  else if (comboioProposta !== comboioCampo) {
    divergencias.push({
      codigo: "comboio_divergente",
      titulo: comboioProposta ? "Comboio vendido não encontrado em campo" : "Comboio encontrado em campo sem previsão na proposta",
      proposta: comboioProposta ? "com comboio" : "sem comboio",
      campo: comboioCampo ? "com comboio" : "sem comboio",
      severidade: "alta",
      recomendacao: comboioProposta
        ? "Rever o escopo: item de comboio pode sair do investimento."
        : "Incluir o comboio no investimento (solução CMB, válvulas 24V).",
    });
  }

  // ---------- Comunicação ----------
  const comProposta = escopo.comunicacao?.valor ?? null;
  if (comProposta && comunicacaoCampo) {
    const temWifi = /wi-?fi|wifi/.test(comunicacaoCampo);
    const tem4g = /4g|3g|gsm|gprs/.test(comunicacaoCampo);
    const conflito =
      (comProposta === "wifi" && !temWifi) ||
      (comProposta === "4g" && !tem4g) ||
      (comProposta === "ambos" && !(temWifi && tem4g));
    if (conflito) {
      divergencias.push({
        codigo: "comunicacao_divergente",
        titulo: "Módulo de comunicação previsto diferente do encontrado",
        proposta: comProposta === "wifi" ? "Wi-Fi (comodato)" : comProposta === "4g" ? "4G (adicional)" : "Wi-Fi + 4G",
        campo: comunicacaoCampo,
        severidade: "atencao",
        recomendacao: "Ajustar o módulo de comunicação na proposta (Wi-Fi comodato x 4G adicional).",
      });
    }
  } else if (!comProposta) {
    pendencias.push("Módulo de comunicação não identificado na proposta.");
  }

  // ---------- Tipo de bomba ----------
  const bomba = (v(vars, "tipo_bomba") ?? "").toLowerCase();
  if (/el[eé]trica/.test(bomba)) {
    divergencias.push({
      codigo: "bomba_eletrica_sem_pulso",
      titulo: "Bomba elétrica não aceita adaptação de pulso",
      proposta: "padrão com adaptação de pulso",
      campo: bomba,
      severidade: "alta",
      recomendacao:
        "Prever solução alternativa de medição (kit específico) — a adaptação padrão assumida na proposta não se aplica.",
    });
  }

  // ---------- Bitola ----------
  const bitola = (v(vars, "bitola_bico") ?? "").toLowerCase();
  if (/1\s*"|1\s*pol|25\s*mm/.test(bitola)) {
    divergencias.push({
      codigo: "bitola_1pol_47mm",
      titulo: 'Bico de 1" automatizado passa a 47 mm de diâmetro',
      proposta: "bitola padrão",
      campo: bitola,
      severidade: "atencao",
      recomendacao:
        'Verificar o bocal dos veículos; havendo risco de não encaixe, recomendar bico 3/4" e registrar o ajuste na proposta.',
    });
  }

  // ---------- Fase de automação ----------
  if (escopo.fase_automacao?.valor === null) {
    pendencias.push("Fase de automação não identificada na proposta.");
  }

  return {
    calculado_em: new Date().toISOString(),
    divergencias,
    pendencias,
  };
}
