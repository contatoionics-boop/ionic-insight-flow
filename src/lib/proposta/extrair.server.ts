// Server-only: extrai o escopo vendido do PDF da proposta comercial.
import { generateText } from "ai";
import { z } from "zod";
import { createOpenAIProvider } from "@/lib/openai.server";
import { ESCOPO_VAZIO, type EscopoProposta } from "@/lib/proposta/tipos";

const LIMIAR = 0.45;

const Campo = z.object({
  valor: z.union([z.number(), z.string(), z.boolean(), z.array(z.string())]).nullable(),
  confianca: z.number().min(0).max(1).default(0),
  trecho: z.string().nullable().optional(),
});

const RespostaSchema = z.object({
  nivel_automacao: Campo.optional(),
  qtd_bicos: Campo.optional(),
  comboio: Campo.optional(),
  qtd_comboios: Campo.optional(),
  comunicacao: Campo.optional(),
  fase_automacao: Campo.optional(),
  itens_inclusos: Campo.optional(),
  itens_nao_inclusos: Campo.optional(),
  nome_cliente: Campo.optional(),
  nome_solucao: Campo.optional(),
  tipo_acao: Campo.optional(),
  objeto_escopo: Campo.optional(),
  tipo_objeto: Campo.optional(),
  ids_objetos: Campo.optional(),
  terminal: Campo.optional(),
  rfid: Campo.optional(),
  bitola_bico: Campo.optional(),
  tensao: Campo.optional(),
  qtd_pistas: Campo.optional(),
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
  return (Array.isArray(text) ? text.join("\n") : text ?? "").trim();
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
  if (typeof x === "string" && x.trim()) return x.split(/;|\n/).map((s) => s.trim()).filter(Boolean);
  return null;
}

export async function extrairEscopoProposta(texto: string): Promise<EscopoProposta> {
  const escopo: EscopoProposta = JSON.parse(JSON.stringify(ESCOPO_VAZIO));
  const corpus = texto.slice(0, 30000);
  if (!corpus.trim()) return escopo;

  const provider = createOpenAIProvider();
  const { text } = await generateText({
    model: provider("gpt-4o-mini"),
    temperature: 0,
    system:
      "Você lê propostas comerciais da IONICS (automação de abastecimento) e extrai o escopo vendido. " +
      "Responda SOMENTE com JSON válido no formato " +
      '{"chave":{"valor":..., "confianca":0.0, "trecho":"..."}}. ' +
      "Chaves possíveis: nivel_automacao (1,2 ou 3), qtd_bicos (número), comboio (boolean), " +
      "qtd_comboios (número), comunicacao ('wifi'|'4g'|'ambos'), fase_automacao (1 a 4), " +
      "itens_inclusos (lista), itens_nao_inclusos (lista), nome_cliente (texto), " +
      "nome_solucao (texto, ex.: SAAF), tipo_acao ('instalacao'|'upgrade'), objeto_escopo (texto curto), " +
      "tipo_objeto ('posto'|'pista'|'comboio'|'veiculo'|'frota'), ids_objetos (lista de placas/prefixos), " +
      "terminal (ex.: T850, T1000), rfid (boolean), bitola_bico (ex.: 3/4\", 1\"), tensao (ex.: 12V, 24V), " +
      "qtd_pistas (número). " +
      "Nunca invente: se a informação não estiver explícita, omita a chave. " +
      "confianca 1 = literal no texto, 0.5 = inferido, 0.2 = palpite. trecho = citação curta do PDF.",
    prompt: `Proposta comercial:\n${corpus}`,
  });

  const jsonStr = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  let parsed: z.infer<typeof RespostaSchema>;
  try {
    parsed = RespostaSchema.parse(JSON.parse(jsonStr));
  } catch {
    return escopo;
  }

  const set = <K extends keyof EscopoProposta>(chave: K, valor: any, campo: any) => {
    if (valor === null || valor === undefined) return;
    const conf = Number(campo?.confianca ?? 0);
    (escopo[chave] as any) = {
      valor: conf >= LIMIAR ? valor : null,
      confianca: conf,
      trecho: campo?.trecho ?? null,
    };
  };

  const nivel = numeroOuNull(parsed.nivel_automacao?.valor);
  if (nivel && nivel >= 1 && nivel <= 3) set("nivel_automacao", nivel, parsed.nivel_automacao);
  set("qtd_bicos", numeroOuNull(parsed.qtd_bicos?.valor), parsed.qtd_bicos);
  set("comboio", boolOuNull(parsed.comboio?.valor), parsed.comboio);
  set("qtd_comboios", numeroOuNull(parsed.qtd_comboios?.valor), parsed.qtd_comboios);

  const com = String(parsed.comunicacao?.valor ?? "").toLowerCase();
  const comNorm = /ambos|wi-?fi.*4g|4g.*wi-?fi/.test(com)
    ? "ambos"
    : /4g|gsm|gprs/.test(com)
      ? "4g"
      : /wi-?fi/.test(com)
        ? "wifi"
        : null;
  set("comunicacao", comNorm, parsed.comunicacao);

  const fase = numeroOuNull(parsed.fase_automacao?.valor);
  if (fase && fase >= 1 && fase <= 4) set("fase_automacao", fase, parsed.fase_automacao);
  set("itens_inclusos", listaOuNull(parsed.itens_inclusos?.valor), parsed.itens_inclusos);
  set("itens_nao_inclusos", listaOuNull(parsed.itens_nao_inclusos?.valor), parsed.itens_nao_inclusos);

  set("nome_cliente", textoOuNull(parsed.nome_cliente?.valor), parsed.nome_cliente);
  set("nome_solucao", textoOuNull(parsed.nome_solucao?.valor), parsed.nome_solucao);

  const acao = String(parsed.tipo_acao?.valor ?? "").toLowerCase();
  const acaoNorm = /upgrade|atualiza/.test(acao)
    ? "upgrade"
    : /instala/.test(acao)
      ? "instalacao"
      : null;
  set("tipo_acao", acaoNorm, parsed.tipo_acao);

  set("objeto_escopo", textoOuNull(parsed.objeto_escopo?.valor), parsed.objeto_escopo);
  set("tipo_objeto", textoOuNull(parsed.tipo_objeto?.valor)?.toLowerCase() ?? null, parsed.tipo_objeto);
  set("ids_objetos", listaOuNull(parsed.ids_objetos?.valor), parsed.ids_objetos);
  set("terminal", textoOuNull(parsed.terminal?.valor), parsed.terminal);
  set("rfid", boolOuNull(parsed.rfid?.valor), parsed.rfid);
  set("bitola_bico", textoOuNull(parsed.bitola_bico?.valor), parsed.bitola_bico);
  set("tensao", textoOuNull(parsed.tensao?.valor), parsed.tensao);
  set("qtd_pistas", numeroOuNull(parsed.qtd_pistas?.valor), parsed.qtd_pistas);

  return escopo;
}
