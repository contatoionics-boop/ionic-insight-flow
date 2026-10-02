// Utilitários client-side para fotos, vídeos e áudios do agente em campo:
// compressão de imagem, envio com progresso e fila offline (IndexedDB) com
// nova tentativa automática quando a conexão volta.
import { useSyncExternalStore } from "react";

import { supabase } from "@/integrations/supabase/client";

const BUCKET = "agente-uploads";
const DB_NOME = "ionics-uploads";
const STORE = "fila";

/* ------------------------------------------------------------------ */
/* Erros                                                               */
/* ------------------------------------------------------------------ */

export class ErroRede extends Error {
  constructor(msg = "Sem conexão com a internet.") {
    super(msg);
    this.name = "ErroRede";
  }
}

export function ehErroDeRede(e: unknown): boolean {
  if (e instanceof ErroRede) return true;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = String((e as { message?: string })?.message ?? e ?? "");
  return /failed to fetch|load failed|networkerror|network request failed|fetch failed|timeout|timed out|abort/i.test(
    msg,
  );
}

/** Mensagem amigável em pt-BR para erros de rede/armazenamento. */
export function traduzirErroRede(e: unknown, padrao = "Não foi possível concluir. Tente novamente."): string {
  if (ehErroDeRede(e)) return "Sem conexão estável. O que foi preenchido fica salvo no aparelho e será reenviado.";
  const msg = String((e as { message?: string })?.message ?? e ?? "");
  if (/exceeded the maximum allowed size|payload too large|413/i.test(msg))
    return "Arquivo grande demais para envio. Reduza o tamanho ou a qualidade e tente de novo.";
  if (/mime type|not supported|invalid.*type/i.test(msg)) return "Formato de arquivo não aceito.";
  if (/row-level security|unauthorized|jwt|not authorized|403|401/i.test(msg))
    return "Sem permissão para enviar. Entre novamente e tente de novo.";
  if (/[ãõçáéíóúâêô]/i.test(msg)) return msg;
  return padrao;
}

/* ------------------------------------------------------------------ */
/* Imagem: redimensiona e converte para JPEG (resolve HEIC e tamanho)  */
/* ------------------------------------------------------------------ */

export const LIMITE_FOTO_BYTES = 25 * 1024 * 1024;
export const LIMITE_VIDEO_BYTES = 150 * 1024 * 1024;

export type ImagemPreparada = { blob: Blob; nome: string; tipo: string; reduzida: boolean };

function nomeComExt(nome: string, ext: string) {
  const base = nome.replace(/\.[^.]+$/, "") || "foto";
  return `${base}.${ext}`;
}

export async function prepararImagem(
  file: File,
  { maxLado = 1800, qualidade = 0.85 }: { maxLado?: number; qualidade?: number } = {},
): Promise<ImagemPreparada> {
  const original: ImagemPreparada = {
    blob: file,
    nome: file.name || "foto.jpg",
    tipo: file.type || "image/jpeg",
    reduzida: false,
  };
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const escala = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * escala));
    const h = Math.max(1, Math.round(bmp.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", qualidade));
    if (!blob) return original;
    // Se já era um JPEG leve, mantém o original.
    if (blob.size >= file.size && /jpe?g/i.test(file.type)) return original;
    return { blob, nome: nomeComExt(original.nome, "jpg"), tipo: "image/jpeg", reduzida: true };
  } catch {
    // Formato não decodificável no navegador (ex.: HEIC fora do Safari): envia como veio.
    return original;
  }
}

/* ------------------------------------------------------------------ */
/* Envio com progresso                                                  */
/* ------------------------------------------------------------------ */

async function credenciais() {
  const url = (import.meta.env.VITE_SUPABASE_URL as string) || "";
  const anon = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || "";
  const { data } = await supabase.auth.getSession();
  return { url, anon, bearer: data.session?.access_token ?? anon };
}

async function xhrUpload(
  path: string,
  blob: Blob,
  contentType: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const { url, anon, bearer } = await credenciais();
  const alvo = `${url}/storage/v1/object/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", alvo);
    xhr.setRequestHeader("apikey", anon);
    xhr.setRequestHeader("Authorization", `Bearer ${bearer}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", contentType || "application/octet-stream");
    xhr.timeout = 15 * 60 * 1000;
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress?.(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      if (xhr.status === 409) return resolve(); // já enviado numa tentativa anterior
      let msg = `Falha no envio (${xhr.status}).`;
      try {
        const j = JSON.parse(xhr.responseText);
        msg = j.message || j.error || msg;
      } catch {
        /* resposta não-JSON */
      }
      const err = new Error(msg) as Error & { status?: number };
      err.status = xhr.status;
      // 5xx e 429 são transitórios: vale reenfileirar
      if (xhr.status >= 500 || xhr.status === 429) return reject(new ErroRede(msg));
      reject(err);
    };
    xhr.onerror = () => reject(new ErroRede());
    xhr.ontimeout = () => reject(new ErroRede("Tempo esgotado no envio."));
    xhr.onabort = () => reject(new ErroRede("Envio interrompido."));
    xhr.send(blob);
  });
}

/* ------------------------------------------------------------------ */
/* Fila offline                                                         */
/* ------------------------------------------------------------------ */

type ItemFila = { path: string; blob: Blob; contentType: string; criadoEm: number };

const memoria = new Map<string, ItemFila>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function abrirDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NOME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "path" });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

async function idb<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  const db = await abrirDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const req = fn(db.transaction(STORE, modo).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

type Estado = { pendentes: string[]; enviando: string | null; progresso: number; online: boolean };

let estado: Estado = {
  pendentes: [],
  enviando: null,
  progresso: 0,
  online: typeof navigator === "undefined" ? true : navigator.onLine,
};
const ouvintes = new Set<() => void>();
const aoConcluir = new Set<(path: string) => void>();
let processando = false;
let iniciando: Promise<void> | null = null;

function emitir(parcial: Partial<Estado>) {
  estado = { ...estado, ...parcial };
  ouvintes.forEach((l) => l());
}

function sincronizarLista() {
  emitir({ pendentes: [...memoria.keys()] });
}

async function guardar(item: ItemFila) {
  memoria.set(item.path, item);
  await idb("readwrite", (s) => s.put(item));
  sincronizarLista();
}

async function remover(path: string) {
  memoria.delete(path);
  await idb("readwrite", (s) => s.delete(path));
  sincronizarLista();
}

export async function processarFila(): Promise<void> {
  if (processando) return;
  processando = true;
  try {
    for (const item of [...memoria.values()]) {
      emitir({ enviando: item.path, progresso: 0 });
      try {
        await xhrUpload(item.path, item.blob, item.contentType, (p) => emitir({ progresso: p }));
        await remover(item.path);
        aoConcluir.forEach((cb) => cb(item.path));
      } catch (e) {
        if (ehErroDeRede(e)) break; // tenta de novo mais tarde
        await remover(item.path); // erro permanente: não adianta repetir
      }
    }
  } finally {
    emitir({ enviando: null, progresso: 0 });
    processando = false;
  }
}

function iniciar(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  iniciando ??= carregarFila();
  return iniciando;
}

/** Resolve quando a fila salva no aparelho já foi carregada (antes de decidir o que enviar ao servidor). */
export const filaPronta = iniciar;

async function carregarFila() {
  const itens = (await idb<ItemFila[]>("readonly", (s) => s.getAll() as IDBRequest<ItemFila[]>)) ?? [];
  for (const i of itens) memoria.set(i.path, i);
  sincronizarLista();
  window.addEventListener("online", () => {
    emitir({ online: true });
    void processarFila();
  });
  window.addEventListener("offline", () => emitir({ online: false }));
  setInterval(() => {
    if (memoria.size > 0 && navigator.onLine !== false) void processarFila();
  }, 20_000);
  if (memoria.size > 0) void processarFila();
}

/**
 * Envia o arquivo; se faltar conexão, guarda no aparelho e reenvia sozinho.
 * Retorna "enfileirado" quando ficou pendente (o caminho já é definitivo).
 */
export async function enviarArquivo(opts: {
  path: string;
  blob: Blob;
  contentType: string;
  onProgress?: (pct: number) => void;
}): Promise<"enviado" | "enfileirado"> {
  void iniciar();
  try {
    if (navigator.onLine === false) throw new ErroRede();
    await xhrUpload(opts.path, opts.blob, opts.contentType, opts.onProgress);
    return "enviado";
  } catch (e) {
    if (!ehErroDeRede(e)) throw e;
    await guardar({ path: opts.path, blob: opts.blob, contentType: opts.contentType, criadoEm: Date.now() });
    return "enfileirado";
  }
}

/** Remoção best-effort de arquivo substituído (ignora falhas de permissão). */
export async function descartarArquivo(path: string | undefined): Promise<void> {
  if (!path || path === "preview") return;
  if (memoria.has(path)) {
    await remover(path);
    return;
  }
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    /* sem permissão ou offline: o arquivo órfão é inofensivo */
  }
}

export function aoUploadConcluir(cb: (path: string) => void): () => void {
  aoConcluir.add(cb);
  return () => aoConcluir.delete(cb);
}

export function caminhoPendente(path: string | undefined): boolean {
  return !!path && memoria.has(path);
}

function assinar(cb: () => void) {
  void iniciar();
  ouvintes.add(cb);
  return () => ouvintes.delete(cb);
}

const estadoServidor: Estado = { pendentes: [], enviando: null, progresso: 0, online: true };

/** Estado reativo da fila (pendentes, progresso e conexão). */
export function useFilaUploads(): Estado {
  return useSyncExternalStore(
    assinar,
    () => estado,
    () => estadoServidor,
  );
}

/** Mapa de URLs assinadas em lote: várias fotos viram uma única chamada. */
export function criarLoteadorUrls<K extends string>(
  buscar: (chave: K, paths: string[]) => Promise<Record<string, string>>,
) {
  const filas = new Map<K, { paths: Set<string>; esperando: Map<string, ((u: string | null) => void)[]> }>();
  let agendado = false;

  const executar = async () => {
    agendado = false;
    const lote = [...filas.entries()];
    filas.clear();
    for (const [chave, { paths, esperando }] of lote) {
      let mapa: Record<string, string> = {};
      try {
        const todos = [...paths];
        for (let i = 0; i < todos.length; i += 50) {
          mapa = { ...mapa, ...(await buscar(chave, todos.slice(i, i + 50))) };
        }
      } catch {
        mapa = {};
      }
      for (const [p, cbs] of esperando) cbs.forEach((cb) => cb(mapa[p] ?? null));
    }
  };

  return (chave: K, path: string) =>
    new Promise<string | null>((resolve) => {
      const f = filas.get(chave) ?? { paths: new Set<string>(), esperando: new Map() };
      f.paths.add(path);
      f.esperando.set(path, [...(f.esperando.get(path) ?? []), resolve]);
      filas.set(chave, f);
      if (!agendado) {
        agendado = true;
        setTimeout(() => void executar(), 40);
      }
    });
}
