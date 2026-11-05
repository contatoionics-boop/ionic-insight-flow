import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search } from "lucide-react";

import { toast } from "sonner";
import { Button, Input, Modal } from "@/components/ui-bits";
import { salvarEquipamento } from "@/lib/equipamentos-catalogo.functions";
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
  const cadastrar = useServerFn(salvarEquipamento);
  const [novo, setNovo] = useState(false);
  const [codigoNovo, setCodigoNovo] = useState("");
  const [nomeNovo, setNomeNovo] = useState("");
  const [salvando, setSalvando] = useState(false);
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
      <div className="mt-3 border-t border-border pt-3">
        {!novo ? (
          <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => { setNovo(true); setNomeNovo(texto); }}>
            Não achou? Cadastrar equipamento novo
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Use o código do Protheus; se o equipamento ainda não tem código, informe um provisório (ex.: NOVO-001). Ele fica no catálogo para os próximos mapeamentos.
            </p>
            <div className="grid grid-cols-[9rem_1fr] gap-2">
              <Input placeholder="Código" value={codigoNovo} onChange={(e) => setCodigoNovo(e.target.value)} />
              <Input placeholder="Nome do equipamento" value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setNovo(false)}>Cancelar</Button>
              <Button
                disabled={salvando || codigoNovo.trim().length < 2 || nomeNovo.trim().length < 2}
                onClick={async () => {
                  setSalvando(true);
                  try {
                    const r = await cadastrar({ data: { codigo: codigoNovo.trim(), nome: nomeNovo.trim(), somenteNovo: true } });
                    toast.success(`${r.codigo} cadastrado no catálogo.`);
                    setNovo(false);
                    setCodigoNovo("");
                    setNomeNovo("");
                    onEscolher({ codigo: r.codigo, nome: r.nome });
                  } catch (e: any) {
                    toast.error(e?.message ?? "Não foi possível cadastrar o equipamento.");
                  } finally {
                    setSalvando(false);
                  }
                }}
              >
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Cadastrar e usar
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
