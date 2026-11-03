// Seção TRANSFERÊNCIA DE DADOS do Resultado de Mapeamento (Fase 2 do documento mestre). Funções puras.
//
// Wi-Fi/GSM seguem as conclusões já derivadas em `analise/achados.ts`; aqui entram o que faltava:
// as velocidades de conexão medidas no local e o nome da aplicação conforme a solução do Escopo.

import type { ContextoLaudo } from "@/lib/laudo/contexto";
import { pendencia, type BlocoLaudo, type VariaveisLaudo } from "@/lib/laudo/tipos";

type Paragrafo = Extract<BlocoLaudo, { tipo: "paragraph" }>;

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

/**
 * Velocidade medida no local. Havendo Wi-Fi, a ausência de medida vira [CONFIRMAR];
 * sem Wi-Fi o parágrafo só aparece se o agente mediu mesmo assim.
 */
export function blocoVelocidades(entrada: {
  vars: VariaveisLaudo;
  contexto: ContextoLaudo | null;
  wifi: boolean;
  id: string;
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
  const texto =
    `Velocidade de conexão medida no local: download ${download ? emMbps(download) : pendencia("velocidade_download_mbps", "velocidade de download")}` +
    ` e upload ${upload ? emMbps(upload) : pendencia("velocidade_upload_mbps", "velocidade de upload")}.`;
  return { id, chave: "dados:velocidades", tipo: "paragraph", texto, origem: "dynamic", editavel: true } as Paragrafo;
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
