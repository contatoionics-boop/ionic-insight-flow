// Sugestão de materiais de infraestrutura a partir das regras do catálogo (client-safe, funções puras).
// Nunca insere sozinho: a lista é só uma sugestão, o especialista escolhe o que entra na tabela.

import { normalizarBitola } from "./catalogo-produtos";
import { materiaisAplicaveis, type ContextoRegras, type MaterialCatalogo } from "./regras";
import type { VariaveisLaudo } from "./tipos";

type Linha = { celulas: string[] };

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

const valor = (vars: VariaveisLaudo, chave: string): string | null => (vars[chave]?.valor ?? "").trim() || null;
const booleano = (v: string | null): boolean | null => {
  const s = (v ?? "").toLowerCase().trim();
  if (["sim", "s", "true", "yes", "1"].includes(s)) return true;
  if (["nao", "não", "n", "false", "no", "0"].includes(s)) return false;
  return null;
};

/** Contexto das regras do catálogo, lido das variáveis do laudo (mesma leitura do template). */
export function contextoRegrasDeVariaveis(vars: VariaveisLaudo): ContextoRegras {
  return {
    nivel: valor(vars, "nivel_servico"),
    bitola: normalizarBitola(valor(vars, "bitola_bico")),
    tipoObjeto: (valor(vars, "tipo_objeto") ?? "").toLowerCase() || null,
    areaClassificada: booleano(valor(vars, "area_classificada")),
    usaConversor: booleano(valor(vars, "usa_conversor_24_12")),
    terminalAtual: valor(vars, "terminal_atual"),
    rfid: booleano(valor(vars, "rfid")),
  };
}

/** Por que o item é sugerido (mostrado ao especialista ao lado do item). */
export function motivoDaSugestao(m: MaterialCatalogo): string {
  const r = m.regra ?? {};
  const partes: string[] = [];
  if (r.nivel?.length) partes.push(`nível ${r.nivel.map((n) => n.replace("nivel_", "")).join("/")}`);
  if (r.bitola?.length) partes.push(`bitola ${r.bitola.join(" ou ")}`);
  if (r.tipo_objeto?.length) partes.push(r.tipo_objeto.join("/"));
  if (r.area_classificada) partes.push("área classificada");
  return partes.length ? `Regra: ${partes.join(", ")}` : "Aplica-se a todos os mapeamentos";
}

/** Materiais que as regras indicam para o caso e que ainda não estão na tabela (comparação por código). */
export function sugerirMateriais(
  catalogo: MaterialCatalogo[],
  ctx: ContextoRegras,
  linhasAtuais: Linha[],
  colunas: string[],
): MaterialCatalogo[] {
  const iCodigo = colunas.findIndex((c) => /^codigo/.test(norm(c)));
  const jaTem = new Set(
    linhasAtuais.map((l) => norm(l.celulas[iCodigo] ?? "")).filter(Boolean),
  );
  return materiaisAplicaveis(catalogo, ctx).filter((m) => !jaTem.has(norm(m.codigo)));
}

/** Linha da tabela para o material: código, descrição, aplicação, unidade e quantidade padrão do catálogo. */
export function linhaDoMaterial(colunas: string[], m: MaterialCatalogo): Linha {
  return {
    celulas: colunas.map((c) => {
      const n = norm(c);
      if (/^codigo/.test(n)) return m.codigo;
      if (/^descri/.test(n)) return m.descricao;
      if (/^aplic/.test(n)) return m.aplicacao ?? "";
      if (/^un/.test(n)) return m.unidade;
      if (/^(qtd|quant)/.test(n)) return String(m.quantidade_padrao);
      return "";
    }),
  };
}

/** Acrescenta os materiais escolhidos; se a tabela só tem a linha em branco de preenchimento, ela é substituída. */
export function inserirMateriais(linhas: Linha[], colunas: string[], escolhidos: MaterialCatalogo[]): Linha[] {
  if (!escolhidos.length) return linhas;
  const novas = escolhidos.map((m) => linhaDoMaterial(colunas, m));
  const soEmBranco = linhas.every((l) => l.celulas.every((c) => !c.trim()));
  return soEmBranco ? novas : [...linhas, ...novas];
}

/** Equipamento do catálogo de produtos visto como item sugerível (mesmas regras dos materiais). */
export function equipamentoComoMaterial(e: {
  codigo: string;
  nome: string;
  categoria?: string | null;
  unidade?: string | null;
  quantidade_padrao?: number | string | null;
  regra?: MaterialCatalogo["regra"] | null;
  ativo?: boolean;
}): MaterialCatalogo {
  const qtd = Number(e.quantidade_padrao);
  return {
    id: e.codigo,
    codigo: e.codigo,
    descricao: e.nome,
    aplicacao: e.categoria ?? null,
    unidade: e.unidade || "un",
    quantidade_padrao: Number.isFinite(qtd) && qtd > 0 ? qtd : 1,
    regra: e.regra ?? {},
    ativo: e.ativo !== false,
    ordem: 100,
  };
}
