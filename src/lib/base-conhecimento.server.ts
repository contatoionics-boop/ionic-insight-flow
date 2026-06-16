// Server-only helpers for the knowledge base (text extraction, chunking, embeddings).

const EMBED_MODEL = "openai/text-embedding-3-small"; // 1536 dims
const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";

export async function extrairTexto(
  tipo: "pdf" | "docx" | "txt",
  buffer: ArrayBuffer,
): Promise<string> {
  const buf = Buffer.from(buffer);
  if (tipo === "txt") {
    return buf.toString("utf-8");
  }
  if (tipo === "docx") {
    const mammoth: any = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: buf });
    return String(result?.value ?? "");
  }
  if (tipo === "pdf") {
    const pdfParse: any = (await import("pdf-parse")).default;
    const result = await pdfParse(buf);
    return String(result?.text ?? "");
  }
  return "";
}

/** Chunk text by character count (≈4 chars per token) with overlap. */
export function chunkText(
  text: string,
  chunkChars = 2000,
  overlapChars = 200,
): string[] {
  const clean = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + chunkChars, clean.length);
    let slice = clean.slice(i, end);
    // try to break at a paragraph/sentence boundary near the end
    if (end < clean.length) {
      const lastBreak = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf(". "),
      );
      if (lastBreak > chunkChars * 0.5) {
        slice = slice.slice(0, lastBreak + 1);
      }
    }
    const trimmed = slice.trim();
    if (trimmed.length > 0) chunks.push(trimmed);
    i += Math.max(slice.length - overlapChars, 1);
  }
  return chunks;
}

export async function gerarEmbeddings(
  textos: string[],
  apiKey: string,
): Promise<number[][]> {
  if (!textos.length) return [];
  const out: number[][] = [];
  // Batch of 32 to stay safe on token limits
  const batchSize = 32;
  for (let i = 0; i < textos.length; i += batchSize) {
    const batch = textos.slice(i, i + batchSize);
    const res = await fetch(EMBED_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: batch }),
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Embeddings ${res.status}: ${msg}`);
    }
    const json: any = await res.json();
    for (const item of json.data ?? []) {
      out.push(item.embedding as number[]);
    }
  }
  return out;
}

export async function gerarEmbedding(texto: string, apiKey: string): Promise<number[]> {
  const [e] = await gerarEmbeddings([texto], apiKey);
  return e;
}
