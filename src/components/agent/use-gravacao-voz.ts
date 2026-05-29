import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { transcreverAudio } from "@/lib/agent-ai.functions";

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/**
 * Hook reutilizável para gravar voz e obter transcrição via Lovable AI.
 * onTranscricao recebe o texto final transcrito.
 */
export function useGravacaoVoz({
  token,
  onTranscricao,
}: {
  token: string;
  onTranscricao: (texto: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transcreverFn = useServerFn(transcreverAudio);

  useEffect(() => {
    if (recording) {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recording]);

  const start = async () => {
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setTranscrevendo(true);
        try {
          const base64 = await blobToBase64(blob);
          const r = (await transcreverFn({
            data: { token, audioBase64: base64, mime: blob.type || "audio/webm" },
          })) as { transcricao: string };
          onTranscricao((r.transcricao || "").trim());
        } catch (e) {
          setErro(e instanceof Error ? e.message : "Falha na transcrição.");
        } finally {
          setTranscrevendo(false);
        }
      };
      recorderRef.current = rec;
      setSeconds(0);
      rec.start();
      setRecording(true);
    } catch {
      setErro("Permissão de microfone negada ou indisponível.");
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return { recording, transcrevendo, erro, start, stop, mmss };
}
