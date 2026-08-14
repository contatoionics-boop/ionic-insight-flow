// Mesclagem entre o documento recém-gerado e o documento já revisado (client-safe).
//
// Princípio: a automação atualiza o que não foi tocado; edições do especialista
// são preservadas. Conflitos ficam registrados no bloco para decisão humana.

import { renumerar } from "./numeracao";
import type { BlocoLaudo, MetaBloco } from "./tipos";

const META: (keyof MetaBloco)[] = [
  "chave",
  "origem",
  "editado_manualmente",
  "conteudo_original",
  "conflito",
  "editavel",
  "removivel",
  "oculto",
];

function slug(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\[CONFIRMAR:[^\]]*\]/g, "x")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 48);
}

function assinatura(b: BlocoLaudo): string {
  switch (b.tipo) {
    case "heading":
      return `heading:${b.nivel}:${slug(b.texto)}`;
    case "paragraph":
      return `paragraph:${slug(b.texto.slice(0, 60))}`;
    case "bullets":
      return `bullets:${slug((b.itens[0] ?? "").slice(0, 40))}`;
    case "table":
      return `table:${slug(b.titulo ?? b.colunas.join("-"))}`;
    case "notes":
      return `notes:${slug((b.itens[0] ?? "").slice(0, 40))}`;
    case "alert":
      return `alert:${b.codigo}`;
    case "image":
      return `image:${slug(b.alt || b.url.slice(-40))}`;
    case "observacao":
      return `observacao:${slug(b.texto.slice(0, 40))}`;
    case "pagebreak":
      return "pagebreak";
  }
}

/** Conteúdo do bloco sem os metadados de edição. */
export function conteudoDoBloco(b: BlocoLaudo): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(b)) {
    if (k === "id" || (META as string[]).includes(k)) continue;
    out[k] = v;
  }
  return out;
}

function mesmoConteudo(a: BlocoLaudo, b: BlocoLaudo): boolean {
  return JSON.stringify(conteudoDoBloco(a)) === JSON.stringify(conteudoDoBloco(b));
}

/** Aplica chaves estáveis (derivadas do conteúdo) e defaults de metadados. */
export function comChaves(blocos: BlocoLaudo[], origemPadrao: "automatic" | "manual" = "automatic") {
  const usados = new Map<string, number>();
  const reservar = (base: string) => {
    const n = (usados.get(base) ?? 0) + 1;
    usados.set(base, n);
    return n > 1 ? `${base}#${n}` : base;
  };
  return blocos.map((b) => {
    if (b.chave) {
      // reserva a chave existente para que um bloco novo com a mesma
      // assinatura não colida (e acabe duplicando na mescla)
      usados.set(b.chave, (usados.get(b.chave) ?? 0) + 1);
      return b;
    }
    return {
      ...b,
      chave: reservar(assinatura(b)),
      origem: b.origem ?? origemPadrao,
      editavel: b.editavel ?? true,
      // nesta fase final o especialista pode remover qualquer bloco (inclusive alertas)
      removivel: true,
    } as BlocoLaudo;
  });
}


export type ResultadoMescla = {
  blocos: BlocoLaudo[];
  conflitos: number;
  /** blocos manuais preservados */
  manuais: number;
};

/**
 * Mescla o documento gerado (`novos`) sobre o documento salvo (`salvos`).
 * - bloco automático não tocado → recebe o conteúdo novo;
 * - bloco editado manualmente → mantém a edição (registra conflito se o gerado mudou);
 * - bloco criado pelo especialista → preservado na posição relativa;
 * - bloco removido (oculto) → continua oculto.
 */
export function mesclarDocumento(salvos: BlocoLaudo[], novos: BlocoLaudo[]): ResultadoMescla {
  const base = comChaves(salvos ?? []);
  const gerados = comChaves(novos ?? []);
  if (!base.length) return { blocos: renumerar(gerados), conflitos: 0, manuais: 0 };

  const porChave = new Map(gerados.map((b) => [b.chave as string, b]));
  const resultado: BlocoLaudo[] = [];
  const usados = new Set<string>();
  let conflitos = 0;
  let manuais = 0;

  for (const s of base) {
    if (s.origem === "manual") {
      resultado.push(s);
      manuais++;
      continue;
    }
    const n = porChave.get(s.chave as string);
    if (!n) continue; // deixou de ser gerado pelas regras
    usados.add(s.chave as string);

    if (s.editado_manualmente) {
      const original = (s.conteudo_original ?? null) as Record<string, any> | null;
      const geradoMudou = original
        ? JSON.stringify(original) !== JSON.stringify(conteudoDoBloco(n))
        : false;
      if (geradoMudou) conflitos++;
      resultado.push({
        ...s,
        conflito: geradoMudou ? conteudoDoBloco(n) : null,
      } as BlocoLaudo);
      continue;
    }

    resultado.push({
      ...(n as any),
      id: s.id,
      chave: s.chave,
      origem: s.origem ?? "automatic",
      editavel: s.editavel ?? true,
      removivel: s.removivel ?? true,
      oculto: s.oculto ?? false,
      conteudo_original: null,
      conflito: null,
    } as BlocoLaudo);
  }

  // blocos novos que ainda não existiam entram após o vizinho anterior já posicionado
  for (let i = 0; i < gerados.length; i++) {
    const n = gerados[i];
    if (usados.has(n.chave as string)) continue;
    let idx = resultado.length;
    for (let j = i - 1; j >= 0; j--) {
      const p = resultado.findIndex((r) => r.chave === gerados[j].chave);
      if (p >= 0) {
        idx = p + 1;
        break;
      }
    }
    resultado.splice(idx, 0, n);
    usados.add(n.chave as string);
  }

  return { blocos: renumerar(resultado), conflitos, manuais };
}

/** Marca um bloco como editado manualmente, guardando o conteúdo original. */
export function marcarEdicao(anterior: BlocoLaudo, novo: BlocoLaudo): BlocoLaudo {
  if (mesmoConteudo(anterior, novo)) return novo;
  return {
    ...(novo as any),
    editado_manualmente: anterior.origem === "manual" ? false : true,
    conteudo_original:
      anterior.conteudo_original ??
      (anterior.origem === "manual" ? null : conteudoDoBloco(anterior)),
  } as BlocoLaudo;
}
