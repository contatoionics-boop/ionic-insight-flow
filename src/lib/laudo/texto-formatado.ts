// Texto com formatação (negrito, itálico, sublinhado, caixa alta, alinhamento) do documento. Funções puras,
// usadas pelos editores (Configurações e aba Documento), pela folha na tela e pelo PDF.
//
// O texto guarda marcas inline — `**negrito**`, `*itálico*`, `++sublinhado++` — e só é interpretado quando o
// bloco é `rico` (blocos antigos com asterisco literal não mudam). A marca sem par fica como texto comum.
// Os campos `{{cliente}}` e as pendências `[CONFIRMAR: …]` passam intactos.

export type Alinhamento = "esquerda" | "centro" | "direita" | "justificado";
export const ALINHAMENTOS: { valor: Alinhamento; rotulo: string }[] = [
  { valor: "esquerda", rotulo: "Esquerda" },
  { valor: "centro", rotulo: "Centralizado" },
  { valor: "direita", rotulo: "Direita" },
  { valor: "justificado", rotulo: "Justificado" },
];

export type Marca = "negrito" | "italico" | "sublinhado";
const SIMBOLO: Record<Marca, string> = { negrito: "**", italico: "*", sublinhado: "++" };

export type Trecho = { texto: string; negrito?: boolean; italico?: boolean; sublinhado?: boolean };

type Ficha = { tipo: "texto"; texto: string } | { tipo: "marca"; marca: Marca };

/** Quebra o texto em fichas (texto e marcas). `\*` e `\+` escapam o símbolo. */
function fichas(s: string): Ficha[] {
  const out: Ficha[] = [];
  let atual = "";
  const solta = () => {
    if (atual) out.push({ tipo: "texto", texto: atual });
    atual = "";
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && (s[i + 1] === "*" || s[i + 1] === "+")) {
      atual += s[i + 1];
      i++;
    } else if (c === "*" && s[i + 1] === "*") {
      solta();
      out.push({ tipo: "marca", marca: "negrito" });
      i++;
    } else if (c === "*") {
      solta();
      out.push({ tipo: "marca", marca: "italico" });
    } else if (c === "+" && s[i + 1] === "+") {
      solta();
      out.push({ tipo: "marca", marca: "sublinhado" });
      i++;
    } else atual += c;
  }
  solta();
  return out;
}

/** Texto com marcas → trechos com estilo. Marca sem par vira texto comum. */
export function parseTexto(s: string): Trecho[] {
  const lista = fichas(s ?? "");
  // marca de abertura sem fechamento (número ímpar de ocorrências): a última volta a ser texto literal
  const contagem: Record<Marca, number[]> = { negrito: [], italico: [], sublinhado: [] };
  lista.forEach((f, i) => f.tipo === "marca" && contagem[f.marca].push(i));
  const literais = new Set<number>();
  for (const m of Object.keys(contagem) as Marca[]) if (contagem[m].length % 2 === 1) literais.add(contagem[m][contagem[m].length - 1]);

  const estado = { negrito: false, italico: false, sublinhado: false };
  const out: Trecho[] = [];
  const empurra = (texto: string) => {
    if (!texto) return;
    const ultimo = out[out.length - 1];
    const mesmo = ultimo && !!ultimo.negrito === estado.negrito && !!ultimo.italico === estado.italico && !!ultimo.sublinhado === estado.sublinhado;
    if (mesmo) ultimo.texto += texto;
    else out.push({ texto, ...(estado.negrito ? { negrito: true } : {}), ...(estado.italico ? { italico: true } : {}), ...(estado.sublinhado ? { sublinhado: true } : {}) });
  };
  lista.forEach((f, i) => {
    if (f.tipo === "texto") return empurra(f.texto);
    if (literais.has(i)) return empurra(SIMBOLO[f.marca]);
    estado[f.marca] = !estado[f.marca];
  });
  return out;
}

/** O texto sem as marcas (o que o leitor vê). */
export const semMarcas = (s: string): string => parseTexto(s).map((t) => t.texto).join("");

/** Escapa os símbolos de marca para texto que deve aparecer literal. */
export const escaparMarcas = (s: string): string => s.replace(/([*+])/g, "\\$1");

export type Selecao = { texto: string; ini: number; fim: number };

/**
 * Aplica ou tira uma marca na seleção. Já marcada (marcas coladas na seleção) → desfaz; seleção vazia →
 * insere o par de marcas com o cursor no meio.
 */
export function alternarMarca(texto: string, ini: number, fim: number, marca: Marca): Selecao {
  const sim = SIMBOLO[marca];
  const a = Math.max(0, Math.min(ini, fim));
  const b = Math.min(texto.length, Math.max(ini, fim));
  const antes = texto.slice(0, a);
  const meio = texto.slice(a, b);
  const depois = texto.slice(b);
  // marcas colando na seleção (negrito é "**"; para itálico "*" não pode ser parte de um "**")
  const colaAntes = antes.endsWith(sim) && (marca !== "italico" || !antes.endsWith("**") || antes.endsWith("***"));
  const colaDepois = depois.startsWith(sim) && (marca !== "italico" || !depois.startsWith("**") || depois.startsWith("***"));
  if (meio && colaAntes && colaDepois) {
    return { texto: antes.slice(0, antes.length - sim.length) + meio + depois.slice(sim.length), ini: a - sim.length, fim: b - sim.length };
  }
  // seleção que já começa e termina com a marca
  if (meio.length >= sim.length * 2 && meio.startsWith(sim) && meio.endsWith(sim)) {
    const interno = meio.slice(sim.length, meio.length - sim.length);
    return { texto: antes + interno + depois, ini: a, fim: a + interno.length };
  }
  return { texto: antes + sim + meio + sim + depois, ini: a + sim.length, fim: a + sim.length + meio.length };
}

// ------------------------------------------------------------------ layout em trechos (PDF)

export type Fonte = "normal" | "negrito" | "italico" | "negritoItalico";
export type Segmento = { texto: string; fonte: Fonte; sublinhado: boolean };
export type Palavra = { segmentos: Segmento[] };

export const fonteDe = (t: Trecho): Fonte => (t.negrito && t.italico ? "negritoItalico" : t.negrito ? "negrito" : t.italico ? "italico" : "normal");

/** Trechos → palavras (separadas por espaço/quebra), cada uma com os segmentos de estilo que a compõem. */
export function palavrasDe(trechos: Trecho[], opcoes: { caixaAlta?: boolean } = {}): Palavra[] {
  const palavras: Palavra[] = [];
  let atual: Segmento[] = [];
  const fecha = () => {
    if (atual.length) palavras.push({ segmentos: atual });
    atual = [];
  };
  for (const t of trechos) {
    const texto = opcoes.caixaAlta ? t.texto.toLocaleUpperCase("pt-BR") : t.texto;
    const pedacos = texto.split(/(\s+)/);
    for (const p of pedacos) {
      if (!p) continue;
      if (/^\s+$/.test(p)) fecha();
      else atual.push({ texto: p, fonte: fonteDe(t), sublinhado: !!t.sublinhado });
    }
  }
  fecha();
  return palavras;
}

export type Medidor = (texto: string, fonte: Fonte) => number;
export type LinhaRica = { palavras: Palavra[]; largura: number; ultima: boolean };

export const larguraDaPalavra = (p: Palavra, medir: Medidor): number => p.segmentos.reduce((a, s) => a + medir(s.texto, s.fonte), 0);

/** Quebra as palavras em linhas (a primeira pode ter largura própria, por causa do recuo). */
export function quebrarRico(palavras: Palavra[], medir: Medidor, larguraPrimeira: number, larguraDemais: number): LinhaRica[] {
  const espaco = medir(" ", "normal");
  const linhas: LinhaRica[] = [];
  let atual: Palavra[] = [];
  let largura = 0;
  for (const p of palavras) {
    const w = larguraDaPalavra(p, medir);
    const limite = linhas.length === 0 ? larguraPrimeira : larguraDemais;
    if (atual.length && largura + espaco + w > limite) {
      linhas.push({ palavras: atual, largura, ultima: false });
      atual = [p];
      largura = w;
    } else {
      largura = atual.length ? largura + espaco + w : w;
      atual.push(p);
    }
  }
  if (atual.length) linhas.push({ palavras: atual, largura, ultima: false });
  if (linhas.length) linhas[linhas.length - 1].ultima = true;
  return linhas;
}

/** Posição x e espaço entre palavras de uma linha, conforme o alinhamento. */
export function posicionarLinha(
  linha: LinhaRica,
  alinhamento: Alinhamento,
  x0: number,
  larguraDisponivel: number,
  espacoNormal: number,
): { x: number; espaco: number } {
  const n = linha.palavras.length;
  if (alinhamento === "justificado" && !linha.ultima && n > 1 && linha.largura < larguraDisponivel) {
    const semEspacos = linha.largura - espacoNormal * (n - 1);
    return { x: x0, espaco: (larguraDisponivel - semEspacos) / (n - 1) };
  }
  if (alinhamento === "centro") return { x: x0 + (larguraDisponivel - linha.largura) / 2, espaco: espacoNormal };
  if (alinhamento === "direita") return { x: x0 + larguraDisponivel - linha.largura, espaco: espacoNormal };
  return { x: x0, espaco: espacoNormal };
}

/** O bloco precisa do desenho com formatação? (os demais seguem o desenho de sempre) */
export function usaTextoRico(b: { rico?: boolean; alinhamento?: Alinhamento; caixaAlta?: boolean }): boolean {
  return !!b.rico || !!b.caixaAlta || (!!b.alinhamento && b.alinhamento !== "justificado");
}

/**
 * Botão de formatação sobre um texto: se o texto ainda não era `rico`, os `*` e `+` que ele já tinha são
 * escapados (continuam literais) antes de aplicar a marca; o resultado é sempre `rico`.
 */
export function aplicarMarcaNoTexto(texto: string, rico: boolean, ini: number, fim: number, marca: Marca): Selecao {
  if (rico) return alternarMarca(texto, ini, fim, marca);
  const a = Math.min(ini, fim);
  const b = Math.max(ini, fim);
  const antes = escaparMarcas(texto.slice(0, a));
  const meio = escaparMarcas(texto.slice(a, b));
  const depois = escaparMarcas(texto.slice(b));
  return alternarMarca(antes + meio + depois, antes.length, antes.length + meio.length, marca);
}

/** Classes do parágrafo na folha/prévia (recuo de 1ª linha só em texto à esquerda ou justificado). */
export function classeAlinhamento(alinhamento: Alinhamento | undefined): string {
  switch (alinhamento) {
    case "centro":
      return "text-center";
    case "direita":
      return "text-right";
    case "esquerda":
      return "indent-8 text-left";
    default:
      return "indent-8 text-justify";
  }
}
