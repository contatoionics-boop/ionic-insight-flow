import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { Button, Modal } from "@/components/ui-bits";
import { sugerirMateriaisLaudo } from "@/lib/laudo.functions";
import type { MaterialCatalogo } from "@/lib/laudo/regras";
import { motivoDaSugestao } from "@/lib/laudo/sugestoes";

/** Lista os materiais que as regras do catálogo indicam; nada entra no documento sem o especialista marcar e confirmar. */
export function SugestaoMateriaisModal({
  aberto,
  casoId,
  tipo = "materiais",
  codigosNaTabela,
  onFechar,
  onAdicionar,
}: {
  aberto: boolean;
  casoId: string;
  /** "materiais" = catálogo de materiais; "produtos" = equipamentos marcados para sugestão */
  tipo?: "materiais" | "produtos";
  /** códigos já presentes na tabela (não são sugeridos de novo) */
  codigosNaTabela: string[];
  onFechar: () => void;
  onAdicionar: (escolhidos: MaterialCatalogo[]) => void;
}) {
  const buscar = useServerFn(sugerirMateriaisLaudo);
  const [itens, setItens] = useState<MaterialCatalogo[]>([]);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    setCarregando(true);
    setErro(null);
    buscar({ data: { casoId, tipo } })
      .then((r) => {
        if (!vivo) return;
        setItens(r.materiais as MaterialCatalogo[]);
        setMarcados(new Set());
      })
      .catch((e: any) => vivo && setErro(e?.message ?? "Não foi possível carregar as sugestões."))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [aberto, casoId, tipo, buscar]);

  const jaTem = useMemo(() => new Set(codigosNaTabela.map((c) => c.trim().toLowerCase()).filter(Boolean)), [codigosNaTabela]);
  const disponiveis = itens.filter((m) => !jaTem.has(m.codigo.trim().toLowerCase()));
  const alternar = (id: string) =>
    setMarcados((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <Modal open={aberto} onClose={onFechar} title={tipo === "produtos" ? "Sugestões de equipamentos do escopo" : "Sugestões de materiais do escopo"}>
      <p className="mb-3 text-xs text-muted-foreground">
        Itens do catálogo cujas regras se aplicam a este mapeamento. Marque os que fazem sentido; nada é inserido sem a sua confirmação.
      </p>
      <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border">
        {erro ? (
          <p className="p-3 text-sm text-destructive">{erro}</p>
        ) : carregando ? (
          <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculando sugestões…
          </p>
        ) : disponiveis.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">{tipo === "produtos" ? "Nenhum equipamento a sugerir para este mapeamento (cadastre regras na tela Catálogo de equipamentos)." : "Nenhum material novo a sugerir para este mapeamento."}</p>
        ) : (
          <ul className="divide-y divide-border">
            {disponiveis.map((m) => (
              <li key={m.id}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-muted/60">
                  <input type="checkbox" className="mt-1" checked={marcados.has(m.id)} onChange={() => alternar(m.id)} />
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground">
                      <span className="mr-2 font-mono text-xs text-muted-foreground">{m.codigo}</span>
                      {m.descricao}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {m.quantidade_padrao} {m.unidade} · {motivoDaSugestao(m)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="secondary" onClick={onFechar}>
          Cancelar
        </Button>
        <Button
          disabled={marcados.size === 0}
          onClick={() => onAdicionar(disponiveis.filter((m) => marcados.has(m.id)))}
        >
          Adicionar {marcados.size || ""} selecionado{marcados.size === 1 ? "" : "s"}
        </Button>
      </div>
    </Modal>
  );
}
