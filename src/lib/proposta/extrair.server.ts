// Server-only: extrai o ESCOPO PRELIMINAR (previsto) da proposta comercial.
//
// Hierarquia de evidência:
//   A. cabeçalho/identificação
//   B. escopo específico do cliente (3.6/3.7 ou equivalentes)
//   C. observações / condições preliminares
//   D. seções institucionais — só interpretam Fase/Nível, nunca confirmam escopo
//
// A leitura determinística (regras) tem prioridade sobre a IA; a IA só
// complementa o que sobrou e nunca pode marcar Comboio.

import { generateText } from "ai";
import { z } from "zod";
import { createOpenAIProvider } from "@/lib/openai.server";
import { ESCOPO_VAZIO, normalizarEscopo, type EscopoProposta } from "@/lib/proposta/tipos";
import { escopoDeterministico, segmentarProposta } from "@/lib/proposta/secoes";

const LIMIAR = 0.45;

const Campo = z.object({
  valor: z.union([z.number(), z.string(), z.boolean(), z.array(z.string())]).nullable(),
  confianca: z.number().min(0).max(1).default(0),
  trecho: z.string().nullable().optional(),
});

const RespostaSchema = z.object({
  nome_cliente: Campo.optional(),
  cnpj: Campo.optional(),
  unidade: Campo.optional(),
  cidade_uf: Campo.optional(),
  cep: Campo.optional(),
  endereco: Campo.optional(),
  contato: Campo.optional(),
  responsavel_proposta: Campo.optional(),
  numero_proposta: Campo.optional(),
  data_proposta: Campo.optional(),
  nome_solucao: Campo.optional(),
  fase_automacao: Campo.optional(),
  nivel_automacao: Campo.optional(),
  tem_pista: Campo.optional(),
  qtd_postos: Campo.optional(),
  qtd_bombas: Campo.optional(),
  tipo_bomba_previsto: Campo.optional(),
  qtd_bicos: Campo.optional(),
  qtd_pistas: Campo.optional(),
  modalidade_nldiv: Campo.optional(),
  tipo_acao: Campo.optional(),
  objeto_escopo: Campo.optional(),
  tipo_objeto: Campo.optional(),
  ids_objetos: Campo.optional(),
  terminal: Campo.optional(),
  rfid: Campo.optional(),
  bitola_bico: Campo.optional(),
  tensao: Campo.optional(),
  comunicacao_prevista: Campo.optional(),
  regime_contratacao: Campo.optional(),
  itens_previstos: Campo.optional(),
  infra_prevista: Campo.optional(),
  itens_nao_inclusos: Campo.optional(),
});

function textoOuNull(x: unknown): string | null {
  if (typeof x === "number") return String(x);
  if (typeof x !== "string") return null;
  const s = x.trim();
  return s.length ? s : null;
}

export async function extrairTextoPdf(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n") : (text ?? "")).trim();
}

function numeroOuNull(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const m = x.replace(",", ".").match(/\d+(\.\d+)?/);
    if (m) return Number(m[0]);
  }
  return null;
}

function boolOuNull(x: unknown): boolean | null {
  if (typeof x === "boolean") return x;
  if (typeof x === "string") {
    const t = x.toLowerCase();
    if (/sim|inclui|possui|true/.test(t)) return true;
    if (/n[aã]o|sem|false/.test(t)) return false;
  }
  return null;
}

function listaOuNull(x: unknown): string[] | null {
  if (Array.isArray(x)) return x.map(String).filter(Boolean);
  if (typeof x === "string" && x.trim())
    return x
      .split(/;|\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  return null;
}

/** Extração puramente determinística (usada nos testes e como base). */
export function extrairEscopoDeterministico(texto: string): EscopoProposta {
  const escopo: EscopoProposta = JSON.parse(JSON.stringify(ESCOPO_VAZIO));
  const secoes = segmentarProposta(texto);
  Object.assign(escopo, escopoDeterministico(secoes));
  return sincronizarLegado(escopo);
}

/** Mantém as chaves legadas coerentes para código/dados antigos. */
function sincronizarLegado(escopo: EscopoProposta): EscopoProposta {
  escopo.comboio = { ...escopo.tem_comboio };
  escopo.comunicacao = { ...escopo.comunicacao_prevista };
  escopo.itens_inclusos = { ...escopo.itens_previstos };
  return escopo;
}

export async function extrairEscopoProposta(texto: string): Promise<EscopoProposta> {
  const escopo: EscopoProposta = JSON.parse(JSON.stringify(ESCOPO_VAZIO));
  if (!texto.trim()) return escopo;

  const secoes = segmentarProposta(texto);
  const deterministico = escopoDeterministico(secoes);
  Object.assign(escopo, deterministico);

  const contexto =
    `# CABEÇALHO / IDENTIFICAÇÃO\n${secoes.cabecalho}\n\n` +
    `# ESCOPO ESPECÍFICO DO CLIENTE\n${secoes.escopo}\n\n` +
    `# OBSERVAÇÕES\n${secoes.observacoes}`;

  try {
    const provider = createOpenAIProvider();
    const { text } = await generateText({
      model: provider("gpt-4o-mini"),
      temperature: 0,
      system:
        "Você lê propostas comerciais da IONICS (automação de abastecimento) e extrai APENAS o escopo " +
        "específico daquele cliente. Responda SOMENTE com JSON válido no formato " +
        '{"chave":{"valor":..., "confianca":0.0, "trecho":"..."}}. ' +
        "Chaves: nome_cliente, cnpj, unidade, cidade_uf, cep, endereco, contato, responsavel_proposta, " +
        "numero_proposta, data_proposta, nome_solucao (ex.: SAAF, SSG Frota), fase_automacao (1-4), " +
        "nivel_automacao (1-3), tem_pista (boolean), qtd_postos, qtd_bombas, tipo_bomba_previsto " +
        "(mecânica|elétrica|submersa), qtd_bicos, qtd_pistas, modalidade_nldiv, tipo_acao " +
        "('instalacao'|'upgrade'), objeto_escopo, tipo_objeto, ids_objetos (lista), terminal, rfid, " +
        "bitola_bico, tensao, comunicacao_prevista ('wifi'|'4g'|'ambos'), regime_contratacao, " +
        "itens_previstos (lista), infra_prevista (lista), itens_nao_inclusos (lista). " +
        "REGRAS OBRIGATÓRIAS: (1) textos institucionais que descrevem o portfólio da IONICS NÃO são " +
        "escopo do cliente; (2) títulos genéricos como 'AUTOMAÇÃO PARA OS POSTOS FIXOS E COMBOIOS' ou " +
        "nomes de kit como '(para bomba FIXA ou MÓVEL)' NÃO confirmam nada; (3) NUNCA responda sobre " +
        "comboio — essa chave não existe aqui; (4) se a informação não estiver explícita no escopo " +
        "específico, omita a chave. confianca 1 = literal, 0.5 = inferido.",
      prompt: contexto.slice(0, 24000),
    });

    const jsonStr = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = RespostaSchema.parse(JSON.parse(jsonStr));

    // a IA nunca sobrescreve o que foi provado deterministicamente
    const set = <K extends keyof EscopoProposta>(chave: K, valor: any, campo: any) => {
      if (valor === null || valor === undefined) return;
      if ((deterministico as any)[chave]?.valor !== undefined && (deterministico as any)[chave]?.valor !== null)
        return;
      const conf = Number(campo?.confianca ?? 0);
      if (conf < LIMIAR) return;
      (escopo[chave] as any) = {
        valor,
        confianca: conf,
        trecho: campo?.trecho ?? null,
        secao: "ia",
        origem: "proposta",
        status: "previsto",
      };
    };

    set("nome_cliente", textoOuNull(parsed.nome_cliente?.valor), parsed.nome_cliente);
    set("cnpj", textoOuNull(parsed.cnpj?.valor), parsed.cnpj);
    set("unidade", textoOuNull(parsed.unidade?.valor), parsed.unidade);
    set("cidade_uf", textoOuNull(parsed.cidade_uf?.valor), parsed.cidade_uf);
    set("cep", textoOuNull(parsed.cep?.valor), parsed.cep);
    set("endereco", textoOuNull(parsed.endereco?.valor), parsed.endereco);
    set("contato", textoOuNull(parsed.contato?.valor), parsed.contato);
    set(
      "responsavel_proposta",
      textoOuNull(parsed.responsavel_proposta?.valor),
      parsed.responsavel_proposta,
    );
    set("numero_proposta", textoOuNull(parsed.numero_proposta?.valor), parsed.numero_proposta);
    set("data_proposta", textoOuNull(parsed.data_proposta?.valor), parsed.data_proposta);
    set("nome_solucao", textoOuNull(parsed.nome_solucao?.valor), parsed.nome_solucao);

    const fase = numeroOuNull(parsed.fase_automacao?.valor);
    if (fase && fase >= 1 && fase <= 4) set("fase_automacao", fase, parsed.fase_automacao);
    const nivel = numeroOuNull(parsed.nivel_automacao?.valor);
    if (nivel && nivel >= 1 && nivel <= 3) set("nivel_automacao", nivel, parsed.nivel_automacao);

    set("tem_pista", boolOuNull(parsed.tem_pista?.valor), parsed.tem_pista);
    set("qtd_postos", numeroOuNull(parsed.qtd_postos?.valor), parsed.qtd_postos);
    set("qtd_bombas", numeroOuNull(parsed.qtd_bombas?.valor), parsed.qtd_bombas);
    set(
      "tipo_bomba_previsto",
      textoOuNull(parsed.tipo_bomba_previsto?.valor),
      parsed.tipo_bomba_previsto,
    );
    set("qtd_bicos", numeroOuNull(parsed.qtd_bicos?.valor), parsed.qtd_bicos);
    set("qtd_pistas", numeroOuNull(parsed.qtd_pistas?.valor), parsed.qtd_pistas);
    set("modalidade_nldiv", textoOuNull(parsed.modalidade_nldiv?.valor), parsed.modalidade_nldiv);

    const acao = String(parsed.tipo_acao?.valor ?? "").toLowerCase();
    const acaoNorm = /upgrade|atualiza/.test(acao)
      ? "upgrade"
      : /instala/.test(acao)
        ? "instalacao"
        : null;
    set("tipo_acao", acaoNorm, parsed.tipo_acao);

    set("objeto_escopo", textoOuNull(parsed.objeto_escopo?.valor), parsed.objeto_escopo);
    set(
      "tipo_objeto",
      (textoOuNull(parsed.tipo_objeto?.valor) ?? "").toLowerCase() || null,
      parsed.tipo_objeto,
    );
    set("ids_objetos", listaOuNull(parsed.ids_objetos?.valor), parsed.ids_objetos);
    set("terminal", textoOuNull(parsed.terminal?.valor), parsed.terminal);
    set("rfid", boolOuNull(parsed.rfid?.valor), parsed.rfid);
    set("bitola_bico", textoOuNull(parsed.bitola_bico?.valor), parsed.bitola_bico);
    set("tensao", textoOuNull(parsed.tensao?.valor), parsed.tensao);

    const com = String(parsed.comunicacao_prevista?.valor ?? "").toLowerCase();
    const comNorm = /ambos|wi-?fi.*4g|4g.*wi-?fi/.test(com)
      ? "ambos"
      : /4g|gsm|gprs/.test(com)
        ? "4g"
        : /wi-?fi/.test(com)
          ? "wifi"
          : null;
    set("comunicacao_prevista", comNorm, parsed.comunicacao_prevista);
    set(
      "regime_contratacao",
      textoOuNull(parsed.regime_contratacao?.valor),
      parsed.regime_contratacao,
    );
    set("itens_previstos", listaOuNull(parsed.itens_previstos?.valor), parsed.itens_previstos);
    set("infra_prevista", listaOuNull(parsed.infra_prevista?.valor), parsed.infra_prevista);
    set(
      "itens_nao_inclusos",
      listaOuNull(parsed.itens_nao_inclusos?.valor),
      parsed.itens_nao_inclusos,
    );
  } catch {
    // IA indisponível ou resposta inválida: segue com o determinístico
  }

  return normalizarEscopo(sincronizarLegado(escopo));
}
