import { cn } from "@/lib/utils";

// O PNG tem o aro no centro de uma imagem 2000x2000 com margem transparente. O recorte
// abaixo (quadrado de 760 px com início em x=608, y=633) encaixa o aro no contêiner,
// sem precisar de uma imagem recortada.
const LADO = 760 / 2000;
const ESCALA = 100 / LADO;
const ESQUERDA = -(608 / 2000) * ESCALA;
const TOPO = -(633 / 2000) * ESCALA;

/**
 * Carregamento de página: o ícone de bomba de combustível gira no eixo X (efeito de
 * tombamento / flip vertical) enquanto a tela carrega. Veja `bico-flip` em styles.css.
 * Respeita `prefers-reduced-motion` (fica parado).
 */
export function BicoLoading({
  tela = false,
  texto = "Carregando…",
  className,
}: {
  /** Ocupa a tela inteira (carregamento entre telas). Sem isso, vira um bloco compacto. */
  tela?: boolean;
  texto?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={texto}
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        tela ? "min-h-screen bg-background" : "min-h-[40vh] py-10",
        className,
      )}
    >
      <div className="bico-flip relative h-20 w-20 overflow-hidden">
        <img
          src="/bico-abastecendo.png"
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none select-none dark:brightness-[1.8] dark:saturate-[1.15]"
          style={{ width: `${ESCALA}%`, left: `${ESQUERDA}%`, top: `${TOPO}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{texto}</span>
    </div>
  );
}

export default BicoLoading;
