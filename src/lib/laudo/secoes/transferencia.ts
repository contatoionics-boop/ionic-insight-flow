// Seção TRANSFERÊNCIA DE DADOS do Resultado de Mapeamento (Fase 2 do documento mestre). Funções puras.
//
// Wi-Fi/GSM seguem as conclusões já derivadas em `analise/achados.ts`; aqui entram o que faltava:
// as velocidades de conexão medidas no local e o nome da aplicação conforme a solução do Escopo.

import type { ContextoLaudo } from "@/lib/laudo/contexto";
import { pendencia, type BlocoLaudo, type VariaveisLaudo } from "@/lib/laudo/tipos";
import { rotulosDasBombas } from "./projeto";

type Paragrafo = Extract<BlocoLaudo, { tipo: "paragraph" }>;
type Tabela = Extract<BlocoLaudo, { tipo: "table" }>;

const lido = (vars: VariaveisLaudo, contexto: ContextoLaudo | null, chave: string): string | null => {
  const proprio = (vars[chave]?.valor ?? "").toString().trim();
  return proprio || contexto?.gerais[chave]?.trim() || null;
};

/** "92" e "92,5 Mbps" viram "92 Mbps" / "92,5 Mbps"; texto sem número fica como está. */
const emMbps = (valor: string): string => (/^\d+([.,]\d+)?$/.test(valor) ? `${valor} Mbps` : valor);

/** Wi-Fi faz parte da comunicação: pelo Escopo; sem ele, pelas respostas (conclusão de Wi-Fi já derivada). */
export function usaWifi(contexto: ContextoLaudo | null, temAchadoWifi: boolean): boolean {
  const escopo = (contexto?.escopo.comunicacao ?? "").toLowerCase();
  if (escopo === "wifi" || escopo === "ambos") return true;
  if (escopo === "4g") return false;
  return temAchadoWifi;
}

/**
 * Wi-Fi aparece quando o Escopo o contempla; Escopo só 4G esconde a seção, a menos que o
 * campo tenha encontrado Wi-Fi. Sem comunicação no Escopo, a seção fica (comportamento anterior).
 */
export function mostrarWifi(contexto: ContextoLaudo | null, temAchadoWifi: boolean): boolean {
  const escopo = (contexto?.escopo.comunicacao ?? "").toLowerCase();
  return escopo === "4g" ? temAchadoWifi : true;
}

/**
 * GSM/4G aparece quando o Escopo o contempla (4G ou ambos) ou há comboio (veículo em movimento,
 * sem rede fixa); também quando o campo encontrou cobertura. Sem comunicação no Escopo, vale o que
 * as respostas indicam (`comunicacao_tipos`).
 */
export function mostrarGsm(entrada: { contexto: ContextoLaudo | null; temAchadoGsm: boolean; tiposRespondidos: string }): boolean {
  const { contexto, temAchadoGsm, tiposRespondidos } = entrada;
  const escopo = (contexto?.escopo.comunicacao ?? "").toLowerCase();
  if (escopo === "4g" || escopo === "ambos" || contexto?.escopo.temComboio || temAchadoGsm) return true;
  if (escopo === "wifi") return false;
  return /4g|gsm|gprs/i.test(tiposRespondidos);
}

/** Velocidades mínimas recomendadas para a comunicação da automação (documento oficial FR-31-10). */
const DOWNLOAD_RECOMENDADO_MBPS = 10;
const UPLOAD_RECOMENDADO_MBPS = 2;

/** "9.67" / "9,67 Mbps" → 9.67; sem número → null. */
const numeroDe = (valor: string): number | null => {
  const m = valor.match(/\d+(?:[.,]\d+)?/);
  return m ? parseFloat(m[0].replace(",", ".")) : null;
};

/**
 * Velocidade medida no local, comparada com a recomendada (10 Mbps de download, 2 Mbps de upload).
 * Havendo Wi-Fi, a ausência de medida vira [CONFIRMAR]; sem Wi-Fi o parágrafo só aparece se o agente mediu mesmo assim.
 * Se o agente informou só a velocidade qualitativa (tabela de condições), a medida em Mbps não é exigida.
 */
export function blocoVelocidades(entrada: {
  vars: VariaveisLaudo;
  contexto: ContextoLaudo | null;
  wifi: boolean;
  id: string;
  /** a tabela de condições já traz a velocidade de conexão informada no formulário */
  faixaInformada?: boolean;
}): Paragrafo | null {
  const { vars, contexto, wifi, id } = entrada;
  // velocidade é número: texto sem dígito (resposta fora do campo) conta como não medida
  const medida = (chave: string) => {
    const valor = lido(vars, contexto, chave);
    return valor && /\d/.test(valor) ? valor : null;
  };
  const download = medida("velocidade_download_mbps");
  const upload = medida("velocidade_upload_mbps");
  if (!wifi && !download && !upload) return null;
  if (!download && !upload && entrada.faixaInformada) return null;

  const nDownload = download ? numeroDe(download) : null;
  const nUpload = upload ? numeroDe(upload) : null;
  const cmpDownload =
    nDownload === null ? "" : nDownload >= DOWNLOAD_RECOMENDADO_MBPS
      ? `, atendendo ao recomendado, que é de ${DOWNLOAD_RECOMENDADO_MBPS} Mbps`
      : `, abaixo do recomendado, que é de ${DOWNLOAD_RECOMENDADO_MBPS} Mbps`;
  const cmpUpload =
    nUpload === null ? "" : nUpload >= UPLOAD_RECOMENDADO_MBPS
      ? `, o que atende plenamente, já que a velocidade recomendada é de ${UPLOAD_RECOMENDADO_MBPS} Mbps`
      : `, abaixo da recomendada, que é de ${UPLOAD_RECOMENDADO_MBPS} Mbps`;
  const texto =
    `Segundo informado no formulário, a velocidade de download medida no local é de ${download ? emMbps(download) : pendencia("velocidade_download_mbps", "velocidade de download")}${cmpDownload}. ` +
    `A velocidade de upload é de ${upload ? emMbps(upload) : pendencia("velocidade_upload_mbps", "velocidade de upload")}${cmpUpload}.`;
  return { id, chave: "dados:velocidades", tipo: "paragraph", texto, origem: "dynamic", editavel: true } as Paragrafo;
}

const nao = (v: string | undefined) => ["nao", "não", "n", "false", "0", "no"].includes((v ?? "").trim().toLowerCase());

/**
 * Condições do Wi-Fi informadas no formulário (frequência, potência, estabilidade e velocidade de conexão),
 * uma linha por bomba/comboio que respondeu. O valor ausente aparece como "—"; sem nenhuma resposta, não há tabela.
 */
export function blocoCondicoesWifi(entrada: { contexto: ContextoLaudo | null; id: string }): Tabela | null {
  const { contexto, id } = entrada;
  if (!contexto) return null;
  const rotulos = rotulosDasBombas(contexto.bombas);
  const locais = [
    ...contexto.bombas.map((b, i) => ({ entidadeId: b.id, nome: rotulos[i], a: b.atributos })),
    ...contexto.comboios.map((c) => ({ entidadeId: c.id, nome: c.identificacao, a: c.atributos })),
  ];
  const linhas = locais.flatMap(({ entidadeId, nome, a }) => {
    if (nao(a.wifi_disponivel)) return [{ entidadeId, celulas: [nome, "Sem sinal Wi-Fi", "—", "—", "—"] }];
    const valores = [a.frequencia_wifi, a.qualidade_wifi, a.estabilidade_wifi, a.velocidade_conexao_faixa].map((v) => (v ?? "").trim());
    if (!valores.some(Boolean)) return [];
    return [{ entidadeId, celulas: [nome, ...valores.map((v) => v || "—")] }];
  });
  if (!linhas.length) return null;
  return {
    id, chave: "dados:wifi_condicoes", tipo: "table", titulo: "CONDIÇÕES DO WI-FI NO LOCAL",
    colunas: ["Local", "Frequência", "Potência do sinal", "Estabilidade", "Velocidade de conexão"],
    linhas, origem: "dynamic", editavel: true, removivel: true,
  } as Tabela;
}

/** Prints do "Registro fotográfico – Transferência de dados" que entram no documento. */
export type TipoFotoTransferencia = "wifi_detalhes" | "wifi_grafico" | "gsm_sinal";
export type FotoTransferencia = { tipo: TipoFotoTransferencia; url: string };

const LEGENDA_FOTO: Record<TipoFotoTransferencia, string> = {
  wifi_detalhes: "Rede Wi-Fi no local: SSID, intensidade do sinal e detalhes da rede",
  wifi_grafico: "Rede Wi-Fi no local: gráfico das redes",
  gsm_sinal: "Intensidade do sinal da operadora no local",
};

/** Qual print é, pelo texto da pergunta do formulário (as perguntas de foto não têm chave semântica). */
export function tipoDaFotoTransferencia(textoPergunta: string): TipoFotoTransferencia | null {
  const t = textoPergunta.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!/print/.test(t)) return null;
  if (/grafico/.test(t)) return "wifi_grafico";
  if (/wifi network analyzer|ssid e detalhes/.test(t)) return "wifi_detalhes";
  if (/sinal da operadora/.test(t)) return "gsm_sinal";
  return null;
}

/** Imagens dos prints pedidos (na ordem pedida), cada uma com "Figura N" para a numeração automática. */
export function blocosFotosTransferencia(
  fotos: FotoTransferencia[],
  tipos: TipoFotoTransferencia[],
  gerarId: (prefixo: string) => string,
  proximaFigura: () => number,
): BlocoLaudo[] {
  return tipos.flatMap((tipo) => {
    const f = fotos.find((x) => x.tipo === tipo && x.url);
    if (!f) return [];
    return [{
      id: gerarId("img"), chave: `dados:foto_${tipo}`, tipo: "image", url: f.url, alt: LEGENDA_FOTO[tipo],
      legenda: `Figura ${proximaFigura()} — ${LEGENDA_FOTO[tipo]}`, larguraMax: 420, origem: "dynamic", editavel: true, removivel: true,
    } as BlocoLaudo];
  });
}

/** Nome da aplicação nos textos de comunicação: SSGFrota quando é a solução do Escopo; senão o padrão SAAF. */
export function nomeDaAplicacao(contexto: ContextoLaudo | null): string {
  return contexto?.escopo.solucao === "ssg_frota" ? "SSGFrota" : "SAAF";
}

/** Troca "aplicação SAAF" pelo nome da aplicação da solução contratada (só os textos de comunicação). */
export function ajustarAplicacao(blocos: BlocoLaudo[], aplicacao: string): BlocoLaudo[] {
  if (aplicacao === "SAAF") return blocos;
  const troca = (s: string) => s.replace(/aplicação SAAF/g, `aplicação ${aplicacao}`);
  return blocos.map((b) => {
    if (b.tipo === "paragraph") return { ...b, texto: troca(b.texto) };
    if (b.tipo === "bullets") return { ...b, itens: b.itens.map(troca) };
    return b;
  });
}
