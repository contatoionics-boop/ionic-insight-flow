import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X } from "lucide-react";

/** A câmera dentro do app precisa de contexto seguro (HTTPS/localhost) e de getUserMedia. */
export function cameraDoAppDisponivel(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

type Face = "environment" | "user";

/**
 * Câmera dentro do app (prévia ao vivo + capturar). Usada no lugar do `capture` do
 * navegador, que alguns celulares e navegadores embutidos ignoram. Se a câmera não
 * puder ser aberta (permissão negada, sem câmera...), chama `onErro` para o chamador
 * recorrer ao seletor nativo.
 */
export function CameraCaptura({
  onCapturar,
  onFechar,
  onErro,
}: {
  onCapturar: (arquivo: File) => void;
  onFechar: () => void;
  onErro: (motivo: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [face, setFace] = useState<Face>("environment");
  const [pronta, setPronta] = useState(false);
  const [temOutraCamera, setTemOutraCamera] = useState(false);

  const parar = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let vivo = true;
    setPronta(false);
    parar();
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: face },
            width: { ideal: 4096 },
            height: { ideal: 2160 },
          },
        });
        if (!vivo) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => undefined);
        }
        const dispositivos = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (vivo) setTemOutraCamera(dispositivos.filter((d) => d.kind === "videoinput").length > 1);
        if (vivo) setPronta(true);
      } catch (e) {
        if (!vivo) return;
        const nome = (e as DOMException)?.name ?? "";
        onErro(
          nome === "NotAllowedError" || nome === "SecurityError"
            ? "Permissão da câmera negada. Libere o acesso à câmera nas configurações do navegador."
            : nome === "NotFoundError" || nome === "OverconstrainedError"
              ? "Nenhuma câmera encontrada neste aparelho."
              : "Não foi possível abrir a câmera.",
        );
      }
    })();
    return () => {
      vivo = false;
      parar();
    };
    // `onErro` não entra nas dependências: o efeito só deve rodar ao trocar de câmera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [face, parar]);

  const capturar = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          onErro("Não foi possível capturar a foto.");
          return;
        }
        const arquivo = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
        parar();
        onCapturar(arquivo);
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Câmera">
      <div className="relative min-h-0 flex-1">
        <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-contain" />
        {!pronta && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-white/80">Abrindo a câmera…</p>
        )}
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar câmera"
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex items-center justify-between gap-4 bg-black px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <span className="w-11" />
        <button
          type="button"
          onClick={capturar}
          disabled={!pronta}
          aria-label="Capturar foto"
          className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 text-white disabled:opacity-40"
        >
          <Camera className="h-6 w-6" />
        </button>
        {temOutraCamera ? (
          <button
            type="button"
            onClick={() => setFace((f) => (f === "environment" ? "user" : "environment"))}
            aria-label="Trocar de câmera"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        ) : (
          <span className="w-11" />
        )}
      </div>
    </div>
  );
}
