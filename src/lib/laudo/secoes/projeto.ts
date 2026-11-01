// Seção PROJETO do Resultado de Mapeamento (Fase 1 do documento mestre). Função pura.
//
// Escopo define o que existe (bombas, comboios, RFID, solução) e o mapeamento informa como é.
// Tabelas AUTOMÁTICAS: 1 linha por entidade, sem linhas em branco; cada linha guarda o `entidadeId`
// (a identidade da linha é a entidade, nunca o texto gerado). Dado ausente vira [CONFIRMAR], nunca é inventado.

import { SOLUCOES_ESCOPO } from "@/lib/escopo/tipos";
import type { BombaCtx, ComboioCtx, ContextoLaudo } from "@/lib/laudo/contexto";
import { pendencia, type BlocoLaudo, type VariaveisLaudo } from "@/lib/laudo/tipos";

type Tabela = Extract<BlocoLaudo, { tipo: "table" }>;
type Linha = Tabela["linhas"][number];

const CHAVE_TABELA = { origem: "dynamic", editavel: true, removivel: true } as const;

const ENTIDADES_DE_COMBOIO = "comboio";

function tabela(id: string, chave: string, titulo: string, colunas: string[], linhas: Linha[]): Tabela {
  return { id, chave, tipo: "table", titulo, colunas, linhas, ...CHAVE_TABELA } as Tabela;
}

const sim = (v: string | undefined) => ["sim", "s", "true", "1", "yes"].includes((v ?? "").trim().toLowerCase());
const nao = (v: string | undefined) => ["nao", "não", "n", "false", "0", "no"].includes((v ?? "").trim().toLowerCase());

/** Valores distintos, na ordem em que aparecem. */
const distintos = (lista: (string | undefined)[]) => [...new Set(lista.map((v) => (v ?? "").trim()).filter(Boolean))];

/** Bitola nominal do bico; sem ela, a da mangueira. Bicos com valores diferentes: todos listados. */
export function bitolaDosBicos(bicos: { atributos: Record<string, string> }[]): string[] {
  const nominais = distintos(bicos.map((b) => b.atributos.bitola_bico));
  return nominais.length ? nominais : distintos(bicos.map((b) => b.atributos.bitola_mangueira));
}

/** "120 L/min — Alta": o valor numérico nunca é trocado só pela classificação. */
export function vazaoDaBomba(a: Record<string, string>): string | null {
  const bruto = (a.vazao ?? "").trim();
  const valor = bruto ? (/^\d+([.,]\d+)?$/.test(bruto) ? `${bruto} L/min` : bruto) : "";
  const classe = sim(a.alta_vazao) ? "Alta" : nao(a.alta_vazao) ? "Baixa" : "";
  if (valor && classe) return `${valor} — ${classe}`;
  return valor || classe || null;
}

/** Rótulos das bombas; se o mesmo rótulo se repete em ilhas/postos diferentes, acrescenta o local. */
function rotulosDasBombas(bombas: BombaCtx[]): string[] {
  const repetidos = new Set(bombas.map((b) => b.rotulo).filter((r, i, todos) => todos.indexOf(r) !== i));
  const varios = (campo: "posto" | "ilha") => new Set(bombas.map((b) => b[campo])).size > 1;
  return bombas.map((b) => {
    if (!repetidos.has(b.rotulo)) return b.rotulo;
    const local = [varios("posto") ? b.posto : null, varios("ilha") ? b.ilha : null].filter(Boolean).join(" / ");
    return local ? `${b.rotulo} (${local})` : b.rotulo;
  });
}

/** "Bomba 01 — Wayne — Diesel S10": marca só quando existe; combustível ausente vira pendência. */
function identificacaoDaBomba(rotulo: string, b: BombaCtx): string {
  const partes = [rotulo];
  if (b.atributos.marca_bomba) partes.push(b.atributos.marca_bomba);
  partes.push(b.atributos.combustivel || pendencia("combustivel", "combustível"));
  return partes.join(" — ");
}

function linhaDeBomba(rotulo: string, b: BombaCtx): Linha {
  const semBico = sim(b.atributos.bico_ausente);
  const bitolas = bitolaDosBicos(b.bicos);
  return {
    entidadeId: b.id,
    celulas: [
      identificacaoDaBomba(rotulo, b),
      vazaoDaBomba(b.atributos) ?? pendencia("vazao", "vazão"),
      b.qtdBicos > 0 ? String(b.qtdBicos) : semBico ? "0 (sem bico)" : pendencia("qtd_bicos", "quantidade de bicos"),
      bitolas.length ? bitolas.join(" / ") : semBico ? "—" : pendencia("bitola_bico", "bitola do bico"),
    ],
  } as Linha;
}

function linhaDeComboio(c: ComboioCtx): Linha {
  const bitolas = bitolaDosBicos(c.bicos);
  const placa = c.atributos.placa_comboio;
  return {
    entidadeId: c.id,
    celulas: [
      placa ? `${c.identificacao} (${placa})` : c.identificacao,
      c.qtdBicos > 0 ? String(c.qtdBicos) : pendencia("qtd_bicos", "quantidade de bicos"),
      bitolas.length ? bitolas.join(" / ") : pendencia("bitola_bico", "bitola do bico"),
    ],
  } as Linha;
}

const COMUNICACAO: Record<string, string> = {
  wifi: "Comunicação via Wi-Fi",
  "4g": "Comunicação via 4G (GPRS/GSM)",
  ambos: "Comunicação via Wi-Fi e 4G (GPRS/GSM)",
};

/** Tipo de comunicação: o Escopo manda; sem ele, a derivada das respostas (`comunicacao_tipos`). */
export function textoComunicacao(contexto: ContextoLaudo, vars: VariaveisLaudo): string {
  const escopo = (contexto.escopo.comunicacao ?? "").toLowerCase();
  if (COMUNICACAO[escopo]) return COMUNICACAO[escopo];
  // do próprio mapeamento ou, na falta, de outro da mesma visita (contexto mesclado)
  const derivada = (vars.comunicacao_tipos?.valor || contexto.gerais.comunicacao_tipos || "").toLowerCase();
  const wifi = /wi-?fi/.test(derivada);
  const movel = /4g|gsm|gprs/.test(derivada);
  if (wifi && movel) return COMUNICACAO.ambos;
  if (wifi) return COMUNICACAO.wifi;
  if (movel) return COMUNICACAO["4g"];
  return pendencia("comunicacao", "tipo de comunicação");
}

function rotuloNivel(nivel: string | null, contexto: ContextoLaudo): string {
  const n = (nivel ?? "").match(/(\d)/)?.[1];
  if (!n) return pendencia("nivel_servico", "nível de automação");
  const { temPista, temComboio } = contexto.escopo;
  const onde = temPista && temComboio ? " (Posto e Comboio)" : temPista ? " (Posto)" : temComboio ? " (Comboio)" : "";
  return `Nível ${n}${onde}`;
}

export function blocosProjeto(entrada: {
  contexto: ContextoLaudo | null;
  vars: VariaveisLaudo;
  nivel: string | null;
  id: (prefixo: string) => string;
}): BlocoLaudo[] {
  const { contexto, vars, nivel, id } = entrada;
  // sem estrutura de escopo (mapeamento antigo) a seção não é montada
  if (!contexto) return [];
  const e = contexto.escopo;
  const blocos: BlocoLaudo[] = [{ id: id("h"), chave: "projeto:titulo", tipo: "heading", numero: "2", texto: "Projeto", nivel: 1, ...CHAVE_TABELA } as BlocoLaudo];

  const solucao = e.solucao ? (SOLUCOES_ESCOPO.find((s) => s.value === e.solucao)?.label ?? e.solucao) : pendencia("solucao", "solução contratada (SSGFrota ou On-premise)");
  blocos.push(tabela(id("t"), "projeto:solucao", "SOLUÇÃO", ["Solução"], [{ celulas: [solucao] } as Linha]));

  const comunicacao = textoComunicacao(contexto, vars);
  if (e.temPista) {
    const rotulos = rotulosDasBombas(contexto.bombas);
    const linhas = contexto.bombas.map((b, i) => linhaDeBomba(rotulos[i], b));
    blocos.push(
      tabela(id("t"), "projeto:posto", "POSTO", ["Bomba", "Vazão", "QTD de bicos", "Bitola do bico"],
        linhas.length ? linhas : [{ celulas: [pendencia("bombas", "bombas do posto"), "", "", ""] } as Linha]),
    );
    blocos.push(tabela(id("t"), "projeto:comunicacao_pista", "COMUNICAÇÃO (POSTO)", ["Comunicação"], [{ celulas: [comunicacao] } as Linha]));
  }

  if (e.temComboio) {
    blocos.push(tabela(id("t"), "projeto:comboio", "COMBOIO", ["Frota", "QTD de bicos", "Bitola do bico"], contexto.comboios.map(linhaDeComboio)));
    blocos.push(tabela(id("t"), `projeto:comunicacao_${ENTIDADES_DE_COMBOIO}`, "COMUNICAÇÃO (COMBOIO)", ["Comunicação"], [{ celulas: [comunicacao] } as Linha]));
  }

  // Tecnologia de identificação só vem do dado estruturado do Escopo; sem ele, fica a confirmar (regra a validar com o Robson).
  const tecnologia = e.rfid.tecnologias.length ? e.rfid.tecnologias.join(" / ") : pendencia("tecnologia_identificacao", "tecnologia de identificação");
  const qtd = e.rfid.quantidade > 0 ? `${e.rfid.quantidade} ${e.rfid.quantidade === 1 ? "unidade" : "unidades"}` : pendencia("qtd_identificacao", "quantidade de dispositivos de identificação");
  blocos.push(tabela(id("t"), "projeto:nivel", "NÍVEL DE AUTOMAÇÃO", ["Nível", "Tecnologia", "QTD"], [{ celulas: [rotuloNivel(nivel, contexto), tecnologia, qtd] } as Linha]));
  return blocos;
}
