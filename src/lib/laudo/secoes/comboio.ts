// Seção CAMINHÃO COMBOIO por unidade (Fase 2 do documento mestre). Função pura.
//
// Um comboio do Escopo = um grupo de blocos, com as respostas DAQUELE comboio (e dos bicos dele).
// Cada bloco tem chave estável pela entidade (`comboio:<id>:…`): a identidade nunca depende do
// texto gerado e a edição manual sobrevive ao "Regerar rascunho". Só entra texto deduzível dos
// dados; o que falta vira [CONFIRMAR]. Equipamentos e materiais nascem em branco (assistidas).

import type { ComboioCtx, ContextoLaudo } from "@/lib/laudo/contexto";
import { pendencia, type BlocoLaudo } from "@/lib/laudo/tipos";
import { bitolaDosBicos } from "./projeto";

const sim = (v: string | undefined) => ["sim", "s", "true", "1", "yes"].includes((v ?? "").trim().toLowerCase());
const nao = (v: string | undefined) => ["nao", "não", "n", "false", "0", "no"].includes((v ?? "").trim().toLowerCase());
const medida = (v: string | undefined, un: string) => (v && /^\d+([.,]\d+)?$/.test(v.trim()) ? `${v.trim()} ${un}` : (v ?? "").trim());

/** O veículo: marca, modelo, placa e tensão, só com o que foi respondido. */
function frasesDoVeiculo(c: ComboioCtx): string {
  const a = c.atributos;
  const veiculo = [a.marca_veiculo, a.modelo_veiculo].filter(Boolean).join(" ");
  const partes = [veiculo ? `um veículo ${veiculo}` : null, a.placa_comboio ? `placa ${a.placa_comboio}` : null].filter(Boolean);
  const base = partes.length ? partes.join(", ") : pendencia("marca_veiculo", "marca e modelo do veículo");
  const tensao = a.tensao_veiculo ? `, alimentado em ${a.tensao_veiculo}` : "";
  return `O comboio mapeado é ${base}${tensao}.`;
}

/** Bicos do comboio: quantidade vem das entidades do Escopo. */
function frasesDosBicos(c: ComboioCtx): string | null {
  if (!c.qtdBicos) return null;
  const partes = [`O comboio possui ${c.qtdBicos} bico${c.qtdBicos === 1 ? "" : "s"} de abastecimento`];
  const mangueira = [...new Set(c.bicos.map((k) => k.atributos.bitola_mangueira).filter(Boolean))];
  if (mangueira.length) partes.push(`com mangueira de ${mangueira.join(" / ")}`);
  const bitola = bitolaDosBicos(c.bicos);
  if (bitola.length) partes.push(`bitola do bico ${bitola.join(" / ")}`);
  return `${partes.join(", ")}.`;
}

/** Medição: blocos medidores e registrador, só com o que foi respondido. */
function frasesDaMedicao(c: ComboioCtx): string[] {
  const a = c.atributos;
  const frases: string[] = [];
  if (a.qtd_blocos_medidores) {
    const n = parseInt(a.qtd_blocos_medidores, 10);
    const sistemas = Number.isNaN(n) ? `${a.qtd_blocos_medidores} sistema(s)` : `${n} sistema${n === 1 ? "" : "s"}`;
    frases.push(`O comboio possui ${sistemas} de abastecimento (bloco medidor).`);
  }
  if (a.marca_registrador) {
    const altura = a.altura_registrador ? `, instalado a ${medida(a.altura_registrador, "m")} do piso` : "";
    frases.push(`Registrador existente ${a.marca_registrador}${a.modelo_registrador ? ` ${a.modelo_registrador}` : ""}${altura}.`);
  }
  if (a.marca_bloco_medidor) {
    const saida = a.diametro_saida_bloco ? `, com saída de ${a.diametro_saida_bloco}` : "";
    frases.push(`Bloco medidor ${a.marca_bloco_medidor}${a.modelo_bloco_medidor ? ` ${a.modelo_bloco_medidor}` : ""}${saida}.`);
  }
  return frases;
}

/** Folgas ao redor do bloco medidor, quando informadas. */
function frasesDoEspaco(c: ComboioCtx): string | null {
  const a = c.atributos;
  const lados = [["frente", a.distancia_frente], ["atrás", a.distancia_atras], ["direita", a.distancia_direita], ["esquerda", a.distancia_esquerda]]
    .filter(([, v]) => v)
    .map(([lado, v]) => `${lado} ${medida(v, "m")}`);
  return lados.length ? `Distância livre ao redor do bloco medidor: ${lados.join(", ")}.` : null;
}

/** Pontos de atenção deduzíveis só dos dados do comboio. */
function pontosDeAtencao(c: ComboioCtx): string[] {
  const a = c.atributos;
  const pontos: string[] = [];
  if (sim(a.possui_carretel)) pontos.push("Mangueira em carretel: confirmar o posicionamento do suporte do bico.");
  if (nao(a.possui_compartimento)) pontos.push("O comboio não possui compartimento para o dispositivo de abastecimento: definir o local de instalação do terminal.");
  if (nao(a.retorno_area_cobertura)) pontos.push("O comboio não retorna à área com cobertura Wi-Fi: a comunicação depende da rede GSM/4G.");
  else if (sim(a.retorno_area_cobertura))
    pontos.push(`O comboio retorna à área com cobertura Wi-Fi${a.periodicidade_retorno ? ` (${a.periodicidade_retorno})` : ""}.`);
  return pontos;
}

/**
 * Blocos do caminhão comboio, um grupo por comboio do Escopo; `null` quando o Escopo não tem comboios
 * (a seção não aparece).
 */
export function blocosComboio(entrada: { contexto: ContextoLaudo | null; id: (prefixo: string) => string; remoto?: boolean }): BlocoLaudo[] | null {
  const { contexto, id } = entrada;
  if (!contexto?.escopo.temComboio || !contexto.comboios.length) return null;
  const varios = contexto.comboios.length > 1;
  const meta = { origem: "dynamic", editavel: true, removivel: true } as const;
  const blocos: BlocoLaudo[] = [{ id: id("h"), chave: "comboio:titulo", tipo: "heading", numero: "2.4", texto: "Caminhão comboio", nivel: 2, ...meta } as BlocoLaudo];

  // texto fixo do documento de referência: o T1000 é o terminal da solução On-premise (SAAF);
  // sem solução definida, ou em SSGFrota, não se afirma nada sobre o terminal
  if (contexto.escopo.solucao === "on_premise")
    blocos.push({
      id: id("p"), chave: "comboio:espaco_terminal", tipo: "paragraph", ...meta,
      texto: "Para instalação do T1000 será necessário que o compartimento no qual estão alocados os dispositivos de abastecimento (Bloco Medidor/Carretel da Mangueira) disponha minimamente de 0,55x0,55x0,25 m.",
    } as BlocoLaudo);
  // mapeamento remoto: as listas vêm só do que o cliente informou e fotografou
  if (entrada.remoto)
    blocos.push({
      id: id("o"), chave: "comboio:aviso_listas", tipo: "observacao", titulo: "Listas sujeitas a alteração", ...meta,
      texto: "As listas de equipamentos IONICS e de materiais de infraestrutura abaixo foram elaboradas a partir das informações e dos registros fotográficos enviados pelo cliente no mapeamento remoto; podem sofrer alterações (inclusões, exclusões ou ajustes de quantidade) após a validação das condições reais de cada comboio.",
    } as BlocoLaudo);

  contexto.comboios.forEach((c, i) => {
    const chave = (sufixo: string) => `comboio:${c.id}:${sufixo}`;
    const paragrafo = (sufixo: string, texto: string) => blocos.push({ id: id("p"), chave: chave(sufixo), tipo: "paragraph", texto, ...meta } as BlocoLaudo);
    blocos.push({ id: id("h"), chave: chave("titulo"), tipo: "heading", numero: varios ? `2.4.${i + 1}` : null, texto: c.identificacao, nivel: 3, ...meta } as BlocoLaudo);

    paragrafo("resumo", frasesDoVeiculo(c));
    const bicos = frasesDosBicos(c);
    if (bicos) paragrafo("bicos", bicos);
    const medicao = frasesDaMedicao(c);
    if (medicao.length) paragrafo("medicao", medicao.join(" "));
    const espaco = frasesDoEspaco(c);
    if (espaco) paragrafo("espaco", espaco);
    const itens = pontosDeAtencao(c);
    if (itens.length) blocos.push({ id: id("bl"), chave: chave("pontos_atencao"), tipo: "bullets", itens, ...meta } as BlocoLaudo);

    // layout do comboio: espaço reservado; o especialista cria o desenho técnico (sem vínculo dinâmico)
    blocos.push({
      id: id("img"), chave: chave("layout"), tipo: "image", url: "", alt: `Layout do ${c.identificacao}`, legenda: `Layout — ${c.identificacao}`, larguraMax: 480, ...meta,
    } as BlocoLaudo);

    // tabelas assistidas: nascem com 3 linhas em branco; o especialista inclui só o que se aplica
    blocos.push({
      id: id("t"), chave: chave("equipamentos"), tipo: "table", titulo: `Equipamentos IONICS — ${c.identificacao}`,
      colunas: ["Código", "Descrição", "Qtd."], linhas: Array.from({ length: 3 }, () => ({ celulas: ["", "", ""] })), ...meta,
    } as BlocoLaudo);
    blocos.push({
      id: id("t"), chave: chave("materiais"), tipo: "table", titulo: `Materiais de infraestrutura — ${c.identificacao}`,
      colunas: ["Código", "Descrição", "Aplicação", "Un.", "Qtd."], linhas: Array.from({ length: 3 }, () => ({ celulas: ["", "", "", "", ""] })), ...meta,
    } as BlocoLaudo);
  });
  return blocos;
}
