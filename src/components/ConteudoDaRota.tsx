import { useEffect, useRef } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";

/** Preserva a mesma área de conteúdo e só anima quando muda a página. */
export function ConteudoDaRota() {
  const caminho = useRouterState({ select: (s) => s.resolvedLocation?.pathname ?? s.location.pathname });
  const anterior = useRef(caminho);
  const conteudo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (anterior.current === caminho) return;
    anterior.current = caminho;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const animacao = conteudo.current?.animate?.(
      [{ opacity: 0.92 }, { opacity: 1 }],
      { duration: 140, easing: "ease-out" },
    );
    return () => animacao?.cancel();
  }, [caminho]);

  return <div ref={conteudo}><Outlet /></div>;
}
