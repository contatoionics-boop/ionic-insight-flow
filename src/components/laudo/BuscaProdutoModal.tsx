import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search } from "lucide-react";

import { Input, Modal } from "@/components/ui-bits";
import { buscarProdutosCatalogo, type ProdutoCatalogo } from "@/lib/produtos-catalogo.functions";

/** Busca no catálogo de produtos ativos (código + nome) para preencher uma linha de tabela do documento. */
export function BuscaProdutoModal({
  aberto,
  onFechar,
  onEscolher,
}: {
  aberto: boolean;
  onFechar: () => void;
  onEscolher: (p: ProdutoCatalogo) => void;
}) {
  const buscar = useServerFn(buscarProdutosCatalogo);
  const [texto, setTexto] = useState("");
  const [itens, setItens] = useState<ProdutoCatalogo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    setCarregando(true);
    const espera = setTimeout(async () => {
      try {
        const r = await buscar({ data: { q: texto, limite: 30 } });
        if (!vivo) return;
        setItens(r);
        setErro(null);
      } catch (e: any) {
        if (vivo) setErro(e?.message ?? "Não foi possível buscar os produtos.");
      } finally {
        if (vivo) setCarregando(false);
      }
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(espera);
    };
  }, [aberto, texto, buscar]);

  return (
    <Modal open={aberto} onClose={onFechar} title="Buscar produto no catálogo">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Digite parte do código ou do nome (ex.: niple 3/4)"
          className="pl-9"
        />
      </div>
      <div className="mt-3 max-h-[50vh] overflow-y-auto rounded-md border border-border">
        {erro ? (
          <p className="p-3 text-sm text-destructive">{erro}</p>
        ) : carregando && itens.length === 0 ? (
          <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
          </p>
        ) : itens.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">Nenhum produto encontrado para “{texto}”.</p>
        ) : (
          <ul className="divide-y divide-border">
            {itens.map((p) => (
              <li key={p.codigo}>
                <button
                  type="button"
                  onClick={() => onEscolher(p)}
                  className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-muted/60"
                >
                  <span className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground">{p.codigo}</span>
                  <span className="text-sm text-foreground">{p.nome}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {itens.length >= 30 ? "Mostrando os 30 primeiros; refine a busca para ver outros. " : ""}
        Lista carregada do relatório de produtos ativos, até a integração com o Protheus.
      </p>
    </Modal>
  );
}
