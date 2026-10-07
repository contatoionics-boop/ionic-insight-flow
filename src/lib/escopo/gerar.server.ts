// Motor de geração do Escopo: transforma uma `ArvoreEscopo` em entidades
// persistentes e versionadas. Regras:
//  - entidades existentes mantêm o UUID; só o que falta é criado;
//  - nada é apagado: o que sai do escopo é desativado (ativo=false);
//  - remover algo que já tem respostas exige confirmação explícita;
//  - reexecutar com a mesma árvore não cria versão nem entidades (idempotente).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  arvoreDeEntidades,
  entidadesDesejadas,
  normalizarArvore,
  type ArvoreEscopo,
  type EntidadeEscopo,
  type FrotaItemArvore,
  type TipoEntidade,
} from "./tipos";

// As tabelas do escopo ainda não estão no types.ts gerado.
const db = supabaseAdmin as any;

type Dono = { unidadeId: string | null; casoOrigemId: string };

type VersaoRow = {
  id: string;
  numero: number;
  tipo: string;
  config: Record<string, unknown>;
  base_versao_id: string | null;
};

type EntidadeRow = EntidadeEscopo & {
  criada_na_versao_id: string | null;
  desativada_na_versao_id: string | null;
  ativo: boolean;
};

async function resolverDono(casoId: string): Promise<Dono> {
  const { data, error } = await db
    .from("casos")
    .select("unidade_id, escopo_versao_id")
    .eq("id", casoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.unidade_id && data?.escopo_versao_id) {
    const { data: v } = await db
      .from("escopo_versoes")
      .select("caso_origem_id")
      .eq("id", data.escopo_versao_id)
      .maybeSingle();
    if (v?.caso_origem_id) return { unidadeId: null, casoOrigemId: v.caso_origem_id };
  }
  return { unidadeId: data?.unidade_id ?? null, casoOrigemId: casoId };
}

function filtrarDono<T extends { eq: (c: string, v: string) => T }>(q: T, dono: Dono): T {
  return dono.unidadeId ? q.eq("unidade_id", dono.unidadeId) : q.eq("caso_origem_id", dono.casoOrigemId);
}

async function listarVersoes(dono: Dono): Promise<VersaoRow[]> {
  const { data, error } = await filtrarDono(
    db.from("escopo_versoes").select("id, numero, tipo, config, base_versao_id"),
    dono,
  ).order("numero", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as VersaoRow[];
}

async function listarEntidades(dono: Dono): Promise<EntidadeRow[]> {
  const { data, error } = await filtrarDono(
    db
      .from("escopo_entidades")
      .select("id, tipo, parent_id, ordem, rotulo, ativo, criada_na_versao_id, desativada_na_versao_id"),
    dono,
  ).order("ordem", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as EntidadeRow[];
}

/** Entidades que existiam na versão informada (histórico preservado). */
export function entidadesNaVersao(
  entidades: EntidadeRow[],
  versoes: VersaoRow[],
  versaoId: string,
): EntidadeRow[] {
  const numero = new Map(versoes.map((v) => [v.id, v.numero]));
  const alvo = numero.get(versaoId);
  if (alvo == null) return [];
  return entidades.filter((e) => {
    const criada = e.criada_na_versao_id ? numero.get(e.criada_na_versao_id) ?? 0 : 0;
    const desat = e.desativada_na_versao_id ? numero.get(e.desativada_na_versao_id) : undefined;
    return criada <= alvo && (desat == null || desat > alvo);
  });
}

export type EstruturaCarregada = {
  versaoId: string | null;
  numero: number | null;
  versaoAtualId: string | null;
  entidades: EntidadeEscopo[];
  arvore: ArvoreEscopo;
};

async function carregarFrota(versaoId: string): Promise<FrotaItemArvore[]> {
  const { data } = await db
    .from("escopo_frota_itens")
    .select("modelo_veiculo, quantidade, info, ordem")
    .eq("versao_id", versaoId)
    .order("ordem", { ascending: true });
  return (data ?? []).map((r: any) => ({
    modelo: r.modelo_veiculo,
    quantidade: r.quantidade,
    info: r.info?.texto ?? undefined,
  }));
}

/** Estrutura usada por um caso (a versão do caso, ou a mais recente da unidade). */
export async function carregarEstruturaDoCaso(casoId: string): Promise<EstruturaCarregada> {
  const vazio: EstruturaCarregada = {
    versaoId: null,
    numero: null,
    versaoAtualId: null,
    entidades: [],
    arvore: normalizarArvore({ postos: [], comboios: 0, frota: { ativo: false, itens: [] }, config: {} }),
  };
  try {
    const { data: caso } = await db
      .from("casos")
      .select("escopo_versao_id, unidade_id")
      .eq("id", casoId)
      .maybeSingle();
    let dono: Dono = { unidadeId: caso?.unidade_id ?? null, casoOrigemId: casoId };
    if (caso?.escopo_versao_id) {
      // O dono vem da versão apontada (cobre casos sem unidade que compartilham o escopo).
      const { data: v } = await db
        .from("escopo_versoes")
        .select("unidade_id, caso_origem_id")
        .eq("id", caso.escopo_versao_id)
        .maybeSingle();
      if (v) dono = { unidadeId: v.unidade_id ?? null, casoOrigemId: v.caso_origem_id ?? casoId };
    }
    const versoes = await listarVersoes(dono);
    if (!versoes.length) return vazio;
    const atual = versoes[versoes.length - 1];
    const versaoId: string = caso?.escopo_versao_id ?? atual.id;
    const versao = versoes.find((v) => v.id === versaoId) ?? atual;
    const todas = await listarEntidades(dono);
    const ativas = entidadesNaVersao(todas, versoes, versao.id);
    const frota = await carregarFrota(versao.id);
    return {
      versaoId: versao.id,
      numero: versao.numero,
      versaoAtualId: atual.id,
      entidades: ativas,
      arvore: arvoreDeEntidades(ativas, frota, (versao.config ?? {}) as any),
    };
  } catch (e) {
    // Migration ainda não aplicada: o fluxo legado continua funcionando.
    console.warn("[escopo] estrutura indisponível:", (e as Error).message);
    return vazio;
  }
}

export type ResultadoAplicar =
  | {
      status: "ok";
      criada: boolean;
      versaoId: string;
      numero: number;
      adicionadas: number;
      desativadas: number;
      reativadas: number;
    }
  | {
      status: "precisa_confirmacao";
      comRespostas: { id: string; rotulo: string; tipo: TipoEntidade; respostas: number }[];
    };

function iguais<T>(a: T, b: T) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Aplica a árvore ao escopo da unidade dos casos informados. Cria nova versão
 * somente se algo mudou e aponta os casos para a versão resultante.
 */
export async function aplicarArvore(opts: {
  casoIds: string[];
  arvore: ArvoreEscopo;
  userId: string | null;
  tipo?: "implantacao" | "upgrade" | "expansao" | "alteracao";
  descricao?: string | null;
  confirmarRemocao?: boolean;
}): Promise<ResultadoAplicar> {
  if (!opts.casoIds.length) throw new Error("Informe ao menos um caso.");
  const arvore = normalizarArvore(opts.arvore);
  const dono = await resolverDono(opts.casoIds[0]);

  const versoes = await listarVersoes(dono);
  const atual = versoes[versoes.length - 1] ?? null;
  const todas = await listarEntidades(dono);
  const ativas = atual ? entidadesNaVersao(todas, versoes, atual.id) : [];
  const frotaAtual = atual ? await carregarFrota(atual.id) : [];

  const desejadas = entidadesDesejadas(arvore);

  // Mapeia cada entidade existente (qualquer estado) para a chave de caminho.
  const porId = new Map(todas.map((e) => [e.id, e]));
  const chaveDe = (e: EntidadeRow): string => {
    const seg = `${e.tipo}:${e.ordem}`;
    const pai = e.parent_id ? porId.get(e.parent_id) : null;
    return pai ? `${chaveDe(pai)}/${seg}` : seg;
  };
  const existentePorChave = new Map<string, EntidadeRow>();
  for (const e of todas) existentePorChave.set(chaveDe(e), e);
  const ativasIds = new Set(ativas.map((e) => e.id));

  const desejadasChaves = new Set(desejadas.map((d) => d.chave));
  const aCriar = desejadas.filter((d) => !existentePorChave.has(d.chave));
  const aReativar = desejadas.filter((d) => {
    const ex = existentePorChave.get(d.chave);
    return ex && !ativasIds.has(ex.id);
  });
  const aDesativar = ativas.filter((e) => !desejadasChaves.has(chaveDe(e)));

  // Remover algo respondido exige confirmação (as respostas nunca são apagadas).
  if (aDesativar.length && !opts.confirmarRemocao) {
    const ids = aDesativar.map((e) => e.id);
    const { data: resp } = await db
      .from("respostas_agente")
      .select("entidade_id")
      .in("entidade_id", ids);
    const contagem = new Map<string, number>();
    for (const r of resp ?? []) contagem.set(r.entidade_id, (contagem.get(r.entidade_id) ?? 0) + 1);
    const comRespostas = aDesativar
      .filter((e) => contagem.has(e.id))
      .map((e) => ({
        id: e.id,
        rotulo: e.rotulo,
        tipo: e.tipo,
        respostas: contagem.get(e.id) ?? 0,
      }));
    if (comRespostas.length) return { status: "precisa_confirmacao", comRespostas };
  }

  const configNova = arvore.config ?? {};
  const configMudou = !iguais(configNova, (atual?.config ?? {}) as any);
  const frotaMudou = !iguais(arvore.frota.itens, frotaAtual);
  const mudou =
    !atual || aCriar.length || aReativar.length || aDesativar.length || configMudou || frotaMudou;

  if (!mudou && atual) {
    await vincularCasos(opts.casoIds, atual.id);
    return {
      status: "ok",
      criada: false,
      versaoId: atual.id,
      numero: atual.numero,
      adicionadas: 0,
      desativadas: 0,
      reativadas: 0,
    };
  }

  // Nova versão
  const numero = (atual?.numero ?? 0) + 1;
  const { data: nova, error: vErr } = await db
    .from("escopo_versoes")
    .insert({
      unidade_id: dono.unidadeId,
      caso_origem_id: dono.casoOrigemId,
      numero,
      tipo: numero === 1 ? "implantacao" : (opts.tipo ?? "alteracao"),
      descricao: opts.descricao ?? null,
      base_versao_id: atual?.id ?? null,
      config: configNova,
      criado_por: opts.userId,
    })
    .select("id")
    .single();
  if (vErr || !nova) throw new Error(vErr?.message ?? "Falha ao criar versão do escopo.");
  const versaoId: string = nova.id;
  const log: any[] = [];

  // Criação respeitando pais antes dos filhos (desejadas já vêm nessa ordem).
  const idPorChave = new Map<string, string>();
  for (const [chave, e] of existentePorChave) idPorChave.set(chave, e.id);
  for (const d of aCriar) {
    const { data: ins, error } = await db
      .from("escopo_entidades")
      .insert({
        unidade_id: dono.unidadeId,
        caso_origem_id: dono.casoOrigemId,
        tipo: d.tipo,
        parent_id: d.paiChave ? idPorChave.get(d.paiChave) ?? null : null,
        ordem: d.ordem,
        rotulo: d.rotulo,
        criada_na_versao_id: versaoId,
      })
      .select("id")
      .single();
    if (error || !ins) throw new Error(error?.message ?? "Falha ao criar entidade.");
    idPorChave.set(d.chave, ins.id);
    log.push({ versao_id: versaoId, entidade_id: ins.id, acao: "adicionada", depois: { rotulo: d.rotulo } });
  }

  for (const d of aReativar) {
    const ex = existentePorChave.get(d.chave)!;
    await db
      .from("escopo_entidades")
      .update({ ativo: true, desativada_na_versao_id: null })
      .eq("id", ex.id);
    log.push({ versao_id: versaoId, entidade_id: ex.id, acao: "reativada", antes: { ativo: false } });
  }

  for (const e of aDesativar) {
    await db
      .from("escopo_entidades")
      .update({ ativo: false, desativada_na_versao_id: versaoId })
      .eq("id", e.id);
    log.push({ versao_id: versaoId, entidade_id: e.id, acao: "desativada", antes: { rotulo: e.rotulo } });
  }

  if (log.length) await db.from("escopo_alteracoes").insert(log);

  if (arvore.frota.itens.length) {
    await db.from("escopo_frota_itens").insert(
      arvore.frota.itens.map((it, i) => ({
        versao_id: versaoId,
        modelo_veiculo: it.modelo,
        quantidade: it.quantidade,
        info: it.info ? { texto: it.info } : {},
        ordem: i + 1,
      })),
    );
  }

  await vincularCasos(opts.casoIds, versaoId);

  return {
    status: "ok",
    criada: true,
    versaoId,
    numero,
    adicionadas: aCriar.length,
    desativadas: aDesativar.length,
    reativadas: aReativar.length,
  };
}

async function vincularCasos(casoIds: string[], versaoId: string) {
  const { error } = await db.from("casos").update({ escopo_versao_id: versaoId }).in("id", casoIds);
  if (error) throw new Error(error.message);
}
