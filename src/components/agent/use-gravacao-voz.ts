import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { transcreverAudio } from "@/lib/agent-ai.functions";
import { traduzirErroRede } from "@/lib/midia-upload";

export const MAX_SEGUNDOS_GRAVACAO = 5 * 60;

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** Reamostra por interpolação linear (fala em 16 kHz basta para transcrição). */
function reamostrar(mono: Float32Array, de: number, para: number): Float32Array {
  if (de <= para) return mono;
  const razao = de / para;
  const saida = new Float32Array(Math.floor(mono.length / razao));
  for (let i = 0; i < saida.length; i++) {
    const pos = i * razao;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, mono.length - 1);
    const frac = pos - i0;
    saida[i] = mono[i0] * (1 - frac) + mono[i1] * frac;
  }
  return saida;
}

/** Decodifica qualquer áudio gravado (webm/mp4/ogg) e devolve WAV mono 16 kHz (~1,9 MB/min). */
export async function blobToWav16k(blob: Blob): Promise<Blob> {
  const arrayBuf = await blob.arrayBuffer();
  const AC: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AC();
  try {
    const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
    const ch = audioBuf.numberOfChannels;
    const len = audioBuf.length;
    const mono = new Float32Array(len);
    for (let c = 0; c < ch; c++) {
      const data = audioBuf.getChannelData(c);
      for (let i = 0; i < len; i++) mono[i] += data[i] / ch;
    }
    return encodeWav(reamostrar(mono, audioBuf.sampleRate, 16000), Math.min(audioBuf.sampleRate, 16000));
  } finally {
    ctx.close().catch(() => {});
  }
}

/** Escolhe o formato que o navegador realmente grava (Safari/iOS usa mp4, Chrome usa webm). */
export function escolherMimeGravacao(): { mime: string; ext: string } {
  const candidatos: [string, string][] = [
    ["audio/webm;codecs=opus", "webm"],
    ["audio/webm", "webm"],
    ["audio/mp4", "m4a"],
    ["audio/ogg;codecs=opus", "ogg"],
  ];
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported) {
    for (const [mime, ext] of candidatos) if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  }
  return { mime: "", ext: "webm" };
}

function mensagemMicrofone(e: unknown): string {
  const nome = (e as { name?: string })?.name ?? "";
  if (nome === "NotAllowedError" || nome === "SecurityError")
    return "Permissão do microfone negada. Libere o microfone nas configurações do navegador.";
  if (nome === "NotFoundError") return "Nenhum microfone encontrado neste aparelho.";
  if (nome === "NotReadableError") return "O microfone está em uso por outro aplicativo.";
  if (typeof MediaRecorder === "undefined") return "Este navegador não suporta gravação de áudio.";
  return "Não foi possível acessar o microfone.";
}

/**
 * Gravador de áudio de baixo nível: libera o microfone ao parar, ao atingir o
 * limite de duração e quando o componente é desmontado.
 */
export function useGravador({
  onGravado,
  maxSegundos = MAX_SEGUNDOS_GRAVACAO,
}: {
  onGravado: (blob: Blob, info: { mime: string; ext: string }) => void | Promise<void>;
  maxSegundos?: number;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const descartarRef = useRef(false);
  const onGravadoRef = useRef(onGravado);
  onGravadoRef.current = onGravado;

  const liberar = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    setRecording(false);
  }, []);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  useEffect(() => {
    if (recording && seconds >= maxSegundos) stop();
  }, [recording, seconds, maxSegundos, stop]);

  // Sair da tela gravando descarta a gravação e solta o microfone.
  useEffect(
    () => () => {
      descartarRef.current = true;
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
      liberar();
    },
    [liberar],
  );

  const start = useCallback(async () => {
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const { mime, ext } = escolherMimeGravacao();
      const rec = new MediaRecorder(stream, {
        ...(mime ? { mimeType: mime } : {}),
        audioBitsPerSecond: 32000,
      });
      chunksRef.current = [];
      descartarRef.current = false;
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onerror = () => {
        setErro("A gravação foi interrompida. Tente novamente.");
        setRecording(false);
        liberar();
      };
      rec.onstop = () => {
        liberar();
        if (descartarRef.current) return;
        const tipo = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: tipo });
        if (blob.size === 0) {
          setErro("Nenhum áudio foi captado. Tente novamente.");
          return;
        }
        void onGravadoRef.current(blob, { mime: tipo, ext: tipo.includes("mp4") ? "m4a" : tipo.includes("ogg") ? "ogg" : ext });
      };
      recorderRef.current = rec;
      setSeconds(0);
      rec.start(1000);
      setRecording(true);
    } catch (e) {
      liberar();
      setErro(mensagemMicrofone(e));
    }
  }, [liberar]);

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return { recording, seconds, mmss, erro, setErro, start, stop };
}

/**
 * Hook reutilizável para gravar voz e obter transcrição.
 * onTranscricao recebe o texto final transcrito.
 */
export function useGravacaoVoz({
  token,
  onTranscricao,
}: {
  token: string;
  onTranscricao: (texto: string) => void;
}) {
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [erroTrans, setErroTrans] = useState<string | null>(null);
  const transcreverFn = useServerFn(transcreverAudio);

  const gravador = useGravador({
    onGravado: async (raw) => {
      setTranscrevendo(true);
      setErroTrans(null);
      try {
        const wav = await blobToWav16k(raw);
        const base64 = await blobToBase64(wav);
        const r = (await transcreverFn({
          data: { token, audioBase64: base64, mime: "audio/wav" },
        })) as { transcricao: string };
        onTranscricao((r.transcricao || "").trim());
      } catch (e) {
        setErroTrans(traduzirErroRede(e, "Falha na transcrição. Você pode digitar o texto."));
      } finally {
        setTranscrevendo(false);
      }
    },
  });

  return {
    recording: gravador.recording,
    transcrevendo,
    erro: gravador.erro ?? erroTrans,
    start: () => {
      setErroTrans(null);
      return gravador.start();
    },
    stop: gravador.stop,
    mmss: gravador.mmss,
  };
}
