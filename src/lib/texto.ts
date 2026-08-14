// Helpers puros de saneamento de texto usados na proposta e no laudo.

// MacRoman 0x80..0xFF — usado para desfazer mojibake de PDFs cujo texto foi
// extraído com a codificação errada (ex.: "AutomatizaÁo" -> "Automatização").
const MACROMAN =
  "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü" +
  "†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø" +
  "¿¡¬√ƒ≈∆«»…\u00a0ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ" +
  "‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ\uf8ffÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ";

const REVERSO = new Map<string, string>();
for (let i = 0; i < MACROMAN.length; i++) {
  const byte = 0x80 + i;
  const latin1 = String.fromCharCode(byte);
  // só interessa quando o byte, lido como latin-1, vira letra acentuada
  if (/[À-ÖØ-öø-ÿ]/.test(latin1)) REVERSO.set(MACROMAN[i]!, latin1);
}



/** Corrige acentuação corrompida e normaliza espaços/aspas. */
export function limparTexto(input: string | null | undefined): string {
  const s = (input ?? "").toString();
  if (!s) return "";
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    const fix = REVERSO.get(ch);
    const anterior = s[i - 1] ?? "";
    const proximo = s[i + 1] ?? "";
    // só troca quando o caractere está no meio de uma palavra minúscula;
    // em palavras em CAIXA ALTA (ex.: "INTRODUÇÃO") o acento já está correto
    const vizinhoMinusculo = /[a-zà-öø-ÿ]/.test(anterior) || /[a-zà-öø-ÿ]/.test(proximo);
    const entreMaiusculas = /[A-ZÀ-ÖØ-Þ]/.test(anterior) && /[A-ZÀ-ÖØ-Þ]/.test(proximo);
    if (fix && vizinhoMinusculo && !entreMaiusculas) out += fix;
    else out += ch;
  }
  return out
    .normalize("NFC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Heurística simples para descartar valores digitados sem sentido ("AREWWE"). */
export function pareceLixo(valor: string | null | undefined): boolean {
  const s = (valor ?? "").trim();
  if (!s) return true;
  if (s.length < 2) return true;
  const letras = s.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "");
  if (!letras) return false; // só números/símbolos: pode ser código válido
  if (letras.length >= 3 && !/[aeiouáéíóúâêôãõà]/i.test(letras)) return true;
  if (/(.)\1{2,}/i.test(s)) return true;
  if (/(ww|qq|xz|zx|kw|wq|jj|vv)/i.test(letras)) return true;
  return false;
}

const ROTULO_TIPO_ACAO: Record<string, string> = {
  instalacao: "instalação",
  instalação: "instalação",
  upgrade: "upgrade",
};

const ROTULO_MODALIDADE: Record<string, string> = {
  presencial: "presencial",
  remoto: "remoto",
};

export function rotuloTipoAcao(v: string | null | undefined): string | null {
  const s = limparTexto(v).toLowerCase();
  return s ? (ROTULO_TIPO_ACAO[s] ?? s) : null;
}

export function rotuloModalidade(v: string | null | undefined): string | null {
  const s = limparTexto(v).toLowerCase();
  return s ? (ROTULO_MODALIDADE[s] ?? s) : null;
}

const PALAVRAS_CATALOGO =
  /(terminal|modem|m[oó]dulo|nldiv|antena|repetidor|sensor|v[aá]lvula|solenoide|fonte|caixa de painel|micro\s?terminal|mifare|rfid reader|kit\b|saaf|ape\b|apm\b|bloco medidor|prensa|cabo\b|contator|luva\b|cotovelo)/i;

/**
 * Aceita apenas identificações reais de objeto (placa, prefixo, pista, tanque,
 * frota). Descrições vindas do catálogo de produtos são descartadas.
 */
export function pareceIdentificacaoObjeto(valor: string): boolean {
  const s = limparTexto(valor);
  if (!s || s.length > 60) return false;
  if (PALAVRAS_CATALOGO.test(s)) return false;
  if (pareceLixo(s)) return false;
  if (/^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/i.test(s.replace(/\s/g, ""))) return true; // placa
  if (/^(pista|bomba|tanque|ilha|bico|frota|comboio|ve[ií]culo|prefixo|un(idade)?)\b/i.test(s))
    return true;
  if (/^[A-Za-z0-9][A-Za-z0-9\-/. ]{1,20}$/.test(s) && /\d/.test(s)) return true;
  return false;
}

/** Filtra, normaliza e deduplica uma lista de identificações de objetos. */
export function objetosValidos(itens: string[], limite = 20): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const item of itens) {
    const s = limparTexto(item);
    if (!pareceIdentificacaoObjeto(s)) continue;
    const k = s.toLowerCase();
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(s);
    if (out.length >= limite) break;
  }
  return out;
}
