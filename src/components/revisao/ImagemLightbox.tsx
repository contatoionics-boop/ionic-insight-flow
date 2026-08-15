import { useCallback, useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";

export type ImagemAmpliada = { url: string; legenda: string };

/** Visualização ampliada compartilhada (leitura e edição de respostas). */
export function ImagemLightbox({
  imagem,
  onClose,
}: {
  imagem: ImagemAmpliada | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!imagem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [imagem, onClose]);

  if (!imagem) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={imagem.legenda || "Imagem ampliada"}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-[min(96vw,1400px)] flex-col gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 flex-1 text-sm font-medium text-white/90">{imagem.legenda}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 rounded-md bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <img
          src={imagem.url}
          alt={imagem.legenda || "Imagem do mapeamento"}
          className="mx-auto max-h-[82vh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
        />
      </div>
    </div>
  );
}

/** Hook utilitário: devolve `abrir` e o elemento do lightbox já montado. */
export function useImagemLightbox(): {
  abrir: (url: string, legenda: string) => void;
  elemento: ReactNode;
} {
  const [imagem, setImagem] = useState<ImagemAmpliada | null>(null);
  const abrir = useCallback((url: string, legenda: string) => setImagem({ url, legenda }), []);
  const fechar = useCallback(() => setImagem(null), []);
  return { abrir, elemento: <ImagemLightbox imagem={imagem} onClose={fechar} /> };
}
