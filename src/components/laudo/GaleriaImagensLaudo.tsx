import type { ComponentProps, ReactNode } from "react";
import { imagemAlternativaLaudo } from "@/lib/laudo/figuras";
import { FIGURAS_TEXTO, type ImagemBiblioteca, type NomeFigura } from "@/lib/laudo/textos-padrao";

export type ImagemDaGaleria =
  | { origem: "sistema"; chave: NomeFigura; imagem: ImagemBiblioteca }
  | { origem: "enviada"; chave: string; imagem: ImagemBiblioteca };

export function colecaoDeImagens(enviadas: ImagemBiblioteca[]): ImagemDaGaleria[] {
  const padroes = (Object.keys(FIGURAS_TEXTO) as NomeFigura[]).map((nome) => {
    const figura = FIGURAS_TEXTO[nome];
    return {
      origem: "sistema" as const,
      chave: nome,
      imagem: {
        id: nome,
        nome: figura.legendaBase,
        url: figura.url,
        alt: figura.alt,
        legenda: figura.legendaBase,
        larguraMax: figura.larguraMax,
      },
    };
  });
  return [...padroes, ...enviadas.map((imagem) => ({ origem: "enviada" as const, chave: imagem.id, imagem }))];
}

export function ImagemLaudo({ src, ...props }: Omit<ComponentProps<"img">, "onError">) {
  return (
    <img
      {...props}
      src={src}
      onError={(event) => {
        const alternativa = src && imagemAlternativaLaudo(src);
        const elemento = event.currentTarget;
        if (alternativa && elemento.getAttribute("src") !== alternativa) elemento.src = alternativa;
      }}
    />
  );
}

export function GaleriaImagensLaudo({
  imagens,
  onInserir,
  acoes,
}: {
  imagens: ImagemDaGaleria[];
  onInserir?: (item: ImagemDaGaleria) => void;
  acoes?: (item: ImagemDaGaleria) => ReactNode;
}) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-3">
      {imagens.map((item) => {
        const { imagem, origem } = item;
        const conteudo = (
          <>
            <ImagemLaudo src={imagem.url} alt={imagem.alt} loading="lazy" className="h-28 w-full border-b border-border bg-white object-contain" />
            <span className="block space-y-1 px-3 py-2.5">
              <span className="block break-words text-sm font-medium leading-snug">{imagem.nome}</span>
              <span className="block text-xs text-muted-foreground">{origem === "sistema" ? "Padrão do sistema" : "Imagem enviada"}</span>
            </span>
          </>
        );
        return (
          <li key={origem + "-" + item.chave} className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
            {onInserir ? (
              <button type="button" aria-label={"Inserir imagem: " + imagem.nome} className="flex h-full w-full flex-col text-left hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring" onClick={() => onInserir(item)}>
                {conteudo}
              </button>
            ) : (
              <>{conteudo}<div className="mt-auto space-y-2 px-3 pb-3">{acoes?.(item)}</div></>
            )}
          </li>
        );
      })}
    </ul>
  );
}
