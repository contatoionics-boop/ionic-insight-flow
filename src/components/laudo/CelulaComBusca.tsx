import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";

import { Input } from "@/components/ui-bits";
import { buscarProdutosCatalogo, type ProdutoCatalogo } from "@/lib/produtos-catalogo.functions";

/**
 * Célula de tabela (Código ou Descrição) que sugere produtos do catálogo enquanto o usuário digita.
 * O texto continua livre: escolher uma sugestão é opcional.
 */
export function CelulaComBusca({
  value,
  onChange,
  onEscolher,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onEscolher: (p: ProdutoCatalogo) => void;
  placeholder?: string;
}) {
  const buscar = useServerFn(buscarProdutosCatalogo);
  const [pos, setPos] = useState<{ x: number; y: number; w: number } | null>(null);
  const [itens, setItens] = useState<ProdutoCatalogo[]>([]);
  const aberto = pos !== null;
  const campo = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!aberto || value.trim().length < 2) {
      setItens([]);
      return;
    }
    let vivo = true;
    const espera = setTimeout(async () => {
      try {
        const r = await buscar({ data: { q: value, limite: 8 } });
        if (vivo) setItens(r);
      } catch {
        if (vivo) setItens([]);
      }
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(espera);
    };
  }, [aberto, value, buscar]);

  // a lista é fixa na tela: acompanha o campo quando a página rola ou muda de tamanho
  useEffect(() => {
    if (!aberto) return;
    const reposicionar = () => {
      const el = campo.current;
      if (!el?.isConnected) return setPos(null);
      const r = el.getBoundingClientRect();
      setPos({ x: r.left, y: r.bottom + 2, w: Math.max(r.width, 340) });
    };
    window.addEventListener("scroll", reposicionar, true);
    window.addEventListener("resize", reposicionar);
    return () => {
      window.removeEventListener("scroll", reposicionar, true);
      window.removeEventListener("resize", reposicionar);
    };
  }, [aberto]);

  return (
    <>
      <Input
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          campo.current = e.currentTarget;
          const r = e.currentTarget.getBoundingClientRect();
          setPos({ x: r.left, y: r.bottom + 2, w: Math.max(r.width, 340) });
        }}
        onBlur={() => setPos(null)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setPos(null);
        }}
      />
      {pos &&
        itens.length > 0 &&
        createPortal(
          <ul
            style={{ position: "fixed", left: pos.x, top: pos.y, width: pos.w, zIndex: 80 }}
            className="max-h-64 overflow-y-auto rounded-md border border-border bg-card text-sm shadow-lg"
          >
            {itens.map((p) => (
              <li key={p.codigo}>
                {/* onMouseDown (e não onClick) para escolher antes de o campo perder o foco */}
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onEscolher(p);
                    setPos(null);
                  }}
                  className="flex w-full items-start gap-3 px-3 py-1.5 text-left hover:bg-muted"
                >
                  <span className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground">{p.codigo}</span>
                  <span className="text-foreground">{p.nome}</span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}
