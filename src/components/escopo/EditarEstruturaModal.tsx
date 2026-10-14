import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui-bits";
import { EstruturaEscopo } from "@/components/escopo/EstruturaEscopo";
import { carregarEscopoEstrutura, salvarEscopoEstrutura } from "@/lib/escopo.functions";
import { supabase } from "@/integrations/supabase/client";
import { normalizarArvore, type ArvoreEscopo } from "@/lib/escopo/tipos";

type Irmao = { id: string; codigo: string };
type ComRespostas = { id: string; rotulo: string; tipo: string; respostas: number };

const STATUS_EDITAVEIS = ["rascunho", "agendado", "em_andamento"];

/** Mapeamentos em que ainda faz sentido alterar a estrutura do escopo. */
export function podeEditarEstrutura(status: string) {
  return STATUS_EDITAVEIS.includes(status);
}

/**
 * Edita a estrutura do Escopo de um mapeamento já agendado. Parte SEMPRE da versão
 * mais recente da unidade (o escopo evolui por versões): salvar cria uma nova versão
 * só se algo mudou, preserva os UUIDs e nunca apaga; remover o que já tem respostas
 * exige confirmação.
 */
export function EditarEstruturaModal({
  casoId,
  codigo,
  onClose,
  onSalvo,
}: {
  casoId: string;
  codigo: string;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const carregar = useServerFn(carregarEscopoEstrutura);
  const salvar = useServerFn(salvarEscopoEstrutura);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [arvore, setArvore] = useState<ArvoreEscopo | null>(null);
  const [numeroDoCaso, setNumeroDoCaso] = useState<number | null>(null);
  const [numeroAtual, setNumeroAtual] = useState<number | null>(null);
  const [irmaos, setIrmaos] = useState<Irmao[]>([]);
  const [aplicarIrmaos, setAplicarIrmaos] = useState(true);
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [confirmacao, setConfirmacao] = useState<ComRespostas[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await carregar({ data: { casoId, maisRecente: true } });
        if (!vivo) return;
        setArvore(normalizarArvore(r.arvore as ArvoreEscopo));
        setNumeroAtual(r.numero ?? null);
        setNumeroDoCaso(r.numeroDoCaso ?? null);
        // Outros mapeamentos do mesmo agendamento (mesma visita, vários formulários).
        const { data: c } = await supabase.from("casos").select("agendamento_id").eq("id", casoId).maybeSingle();
        const agId = (c as { agendamento_id?: string | null } | null)?.agendamento_id;
        if (agId) {
          const { data: outros } = await supabase
            .from("casos")
            .select("id, codigo, status")
            .eq("agendamento_id", agId)
            .neq("id", casoId);
          if (vivo)
            setIrmaos(
              ((outros ?? []) as { id: string; codigo: string; status: string }[])
                .filter((o) => podeEditarEstrutura(o.status))
                .map((o) => ({ id: o.id, codigo: o.codigo })),
            );
        }
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : "Não foi possível carregar o escopo.");
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [casoId, carregar]);

  async function gravar(confirmarRemocao: boolean) {
    if (!arvore) return;
    setSalvando(true);
    setErro(null);
    setAviso(null);
    try {
      const casoIds = [casoId, ...(aplicarIrmaos ? irmaos.map((i) => i.id) : [])];
      const r = await salvar({
        data: {
          casoIds,
          arvore: normalizarArvore(arvore) as never,
          tipo: "alteracao",
          descricao: descricao.trim() || `Alteração da estrutura (${codigo})`,
          confirmarRemocao,
        },
      });
      if (r.status === "precisa_confirmacao") {
        setConfirmacao(r.comRespostas as ComRespostas[]);
        return;
      }
      if (!r.criada) {
        setAviso("Nada mudou: a estrutura é igual à versão mais recente.");
        return;
      }
      onSalvo();
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a estrutura.");
    } finally {
      setSalvando(false);
    }
  }

  const desatualizado = numeroDoCaso != null && numeroAtual != null && numeroDoCaso !== numeroAtual;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <h3 className="text-base font-semibold text-foreground">Editar estrutura do escopo</h3>
            <p className="text-xs text-muted-foreground">
              {codigo}
              {numeroAtual ? ` · editando a V${numeroAtual} (mais recente da unidade)` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          {carregando && <p className="text-sm text-muted-foreground">Carregando a estrutura…</p>}
          {erro && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erro}
            </div>
          )}
          {aviso && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">{aviso}</div>
          )}

          {arvore && !confirmacao && (
            <>
              {desatualizado && (
                <div className="flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-500/10 p-3 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Este mapeamento usa a V{numeroDoCaso}, mas a estrutura mais recente da unidade é a V{numeroAtual}.
                    Ao salvar, ele passa a usar a versão nova.
                  </p>
                </div>
              )}

              <EstruturaEscopo value={arvore} onChange={setArvore} disabled={salvando} />

              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground" htmlFor="desc-estrutura">
                  O que mudou (opcional)
                </label>
                <input
                  id="desc-estrutura"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  maxLength={500}
                  placeholder="Ex.: incluído 2º comboio e RFID Milexes"
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                />
                {irmaos.length > 0 && (
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4"
                      checked={aplicarIrmaos}
                      onChange={(e) => setAplicarIrmaos(e.target.checked)}
                    />
                    <span>
                      Aplicar também aos outros mapeamentos desta visita ({irmaos.map((i) => i.codigo).join(", ")})
                    </span>
                  </label>
                )}
              </div>
            </>
          )}

          {confirmacao && (
            <div className="space-y-3 rounded-md border border-amber-300/50 bg-amber-500/10 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                <AlertTriangle className="h-4 w-4" /> Itens com respostas serão desativados
              </p>
              <p className="text-sm text-amber-900">
                As respostas <strong>são preservadas</strong> (nada é apagado), mas estes itens deixam de aparecer no
                mapeamento:
              </p>
              <ul className="list-disc space-y-0.5 pl-5 text-sm text-amber-900">
                {confirmacao.map((c) => (
                  <li key={c.id}>
                    {c.rotulo} — {c.respostas} resposta(s)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">
          {confirmacao ? (
            <>
              <Button variant="outline" onClick={() => setConfirmacao(null)} disabled={salvando}>
                Voltar e ajustar
              </Button>
              <Button onClick={() => void gravar(true)} disabled={salvando}>
                {salvando ? "Salvando…" : "Confirmar e salvar"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={salvando}>
                Cancelar
              </Button>
              <Button onClick={() => void gravar(false)} disabled={salvando || !arvore}>
                {salvando ? "Salvando…" : "Salvar estrutura"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
