import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { Button, Input, Label, Select } from "@/components/ui-bits";
import { DatePicker } from "@/components/ui/date-picker";
import { EstruturaEscopo } from "@/components/escopo/EstruturaEscopo";
import { atribuirAgenteAgendamento, reagendarVistoria } from "@/lib/casos.functions";
import { carregarEscopoEstrutura, salvarEscopoEstrutura } from "@/lib/escopo.functions";
import { supabase } from "@/integrations/supabase/client";
import { normalizarArvore, type ArvoreEscopo } from "@/lib/escopo/tipos";

type Irmao = { id: string; codigo: string };
type ComRespostas = { id: string; rotulo: string; tipo: string; respostas: number };

const STATUS_EDITAVEIS = ["rascunho", "agendado", "em_andamento"];

/** Mapeamentos em que ainda faz sentido alterar a estrutura do escopo e o responsável. */
export function podeEditarEstrutura(status: string) {
  return STATUS_EDITAVEIS.includes(status);
}

export type MapeamentoEditavel = {
  id: string;
  codigo: string;
  status: string;
  agendamento_id: string | null;
  agendado_em: string;
  duracao_min: number | null;
  endereco_vistoria: string | null;
  observacoes_agendamento: string | null;
  agente_id: string | null;
  agente: { nome: string } | null;
};

const pad = (n: number) => String(n).padStart(2, "0");
const dataLocal = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const horaLocal = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Edição única do mapeamento agendado: data/hora, responsável, endereço,
 * orientações e estrutura do escopo, com um só botão Salvar.
 *
 * Estrutura: parte SEMPRE da versão mais recente da unidade (o escopo evolui por
 * versões): salvar cria uma nova versão só se algo mudou, preserva os UUIDs e
 * nunca apaga; remover o que já tem respostas exige confirmação.
 */
export function EditarMapeamentoModal({
  mapeamento,
  agentes,
  onClose,
  onSalvo,
}: {
  mapeamento: MapeamentoEditavel;
  agentes: { id: string; nome: string }[];
  onClose: () => void;
  onSalvo: () => void;
}) {
  const reagendar = useServerFn(reagendarVistoria);
  const atribuir = useServerFn(atribuirAgenteAgendamento);
  const carregar = useServerFn(carregarEscopoEstrutura);
  const salvarEstrutura = useServerFn(salvarEscopoEstrutura);

  const editavel = podeEditarEstrutura(mapeamento.status);
  const [aba, setAba] = useState<"agendamento" | "estrutura">("agendamento");

  // Agendamento: valores iniciais (atualizados à medida que cada parte é gravada).
  const [inicial, setInicial] = useState(() => ({
    data: dataLocal(mapeamento.agendado_em),
    hora: horaLocal(mapeamento.agendado_em),
    endereco: mapeamento.endereco_vistoria ?? "",
    obs: mapeamento.observacoes_agendamento ?? "",
    agenteId: mapeamento.agente_id ?? "",
  }));
  const [data, setData] = useState(inicial.data);
  const [hora, setHora] = useState(inicial.hora);
  const [endereco, setEndereco] = useState(inicial.endereco);
  const [obs, setObs] = useState(inicial.obs);
  const [agenteId, setAgenteId] = useState(inicial.agenteId);

  // Estrutura
  const [carregandoEstrutura, setCarregandoEstrutura] = useState(editavel);
  const [arvore, setArvore] = useState<ArvoreEscopo | null>(null);
  const [arvoreInicial, setArvoreInicial] = useState<string>("");
  const [numeroDoCaso, setNumeroDoCaso] = useState<number | null>(null);
  const [numeroAtual, setNumeroAtual] = useState<number | null>(null);
  const [irmaos, setIrmaos] = useState<Irmao[]>([]);
  const [aplicarIrmaos, setAplicarIrmaos] = useState(true);
  const [descricao, setDescricao] = useState("");
  const [confirmacao, setConfirmacao] = useState<ComRespostas[] | null>(null);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!editavel) return;
    let vivo = true;
    (async () => {
      try {
        const r = await carregar({ data: { casoId: mapeamento.id, maisRecente: true } });
        if (!vivo) return;
        const a = normalizarArvore(r.arvore as ArvoreEscopo);
        setArvore(a);
        setArvoreInicial(JSON.stringify(a));
        setNumeroAtual(r.numero ?? null);
        setNumeroDoCaso(r.numeroDoCaso ?? null);
        // Outros mapeamentos do mesmo agendamento (mesma visita, vários formulários).
        if (mapeamento.agendamento_id) {
          const { data: outros } = await supabase
            .from("casos")
            .select("id, codigo, status")
            .eq("agendamento_id", mapeamento.agendamento_id)
            .neq("id", mapeamento.id);
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
        if (vivo) setCarregandoEstrutura(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [mapeamento.id, mapeamento.agendamento_id, editavel, carregar]);

  const mudouAgenda =
    data !== inicial.data || hora !== inicial.hora || endereco !== inicial.endereco || obs !== inicial.obs;
  const mudouAgente = !!agenteId && agenteId !== inicial.agenteId;
  const mudouEstrutura = !!arvore && JSON.stringify(normalizarArvore(arvore)) !== arvoreInicial;
  const algoMudou = mudouAgenda || mudouAgente || mudouEstrutura;

  const listaAgentes = useMemo(() => {
    const base = [...agentes];
    if (mapeamento.agente_id && !base.some((a) => a.id === mapeamento.agente_id)) {
      base.unshift({ id: mapeamento.agente_id, nome: mapeamento.agente?.nome ?? "Responsável atual" });
    }
    return base;
  }, [agentes, mapeamento.agente_id, mapeamento.agente]);

  async function salvar(confirmarRemocao: boolean) {
    setSalvando(true);
    setErro(null);
    setAviso(null);
    try {
      // 1) responsável (vale para todos os mapeamentos do agendamento; o novo agente precisa aceitar)
      if (mudouAgente && !confirmarRemocao) {
        if (!mapeamento.agendamento_id) throw new Error("Mapeamento sem agendamento vinculado.");
        await atribuir({ data: { agendamentoId: mapeamento.agendamento_id, agenteId } });
        setInicial((i) => ({ ...i, agenteId }));
      }
      // 2) data, hora, endereço e orientações
      if (mudouAgenda && !confirmarRemocao) {
        await reagendar({
          data: {
            casoId: mapeamento.id,
            agendadoEm: new Date(`${data}T${hora}:00`).toISOString(),
            duracaoMin: mapeamento.duracao_min ?? 60,
            enderecoVistoria: endereco || null,
            observacoes: obs || null,
          },
        });
        setInicial((i) => ({ ...i, data, hora, endereco, obs }));
      }
      // 3) estrutura do escopo
      if (mudouEstrutura && arvore) {
        const casoIds = [mapeamento.id, ...(aplicarIrmaos ? irmaos.map((i) => i.id) : [])];
        const r = await salvarEstrutura({
          data: {
            casoIds,
            arvore: normalizarArvore(arvore) as never,
            tipo: "alteracao",
            descricao: descricao.trim() || `Alteração da estrutura (${mapeamento.codigo})`,
            confirmarRemocao,
          },
        });
        if (r.status === "precisa_confirmacao") {
          setConfirmacao(r.comRespostas as ComRespostas[]);
          setAba("estrutura");
          // agenda/responsável já foram gravados: o que sobra é só a estrutura
          setInicial((i) => ({ ...i, data, hora, endereco, obs, agenteId: agenteId || i.agenteId }));
          return;
        }
      }
      onSalvo();
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  const desatualizado = numeroDoCaso != null && numeroAtual != null && numeroDoCaso !== numeroAtual;

  const abaClasse = (ativa: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${
      ativa ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <h3 className="text-base font-semibold text-foreground">Editar mapeamento</h3>
            <p className="text-xs text-muted-foreground">{mapeamento.codigo}</p>
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

        {editavel && (
          <div className="flex gap-1 border-b border-border px-5 py-2" role="tablist">
            <button type="button" role="tab" aria-selected={aba === "agendamento"} className={abaClasse(aba === "agendamento")} onClick={() => setAba("agendamento")}>
              Agendamento{mudouAgenda || mudouAgente ? " •" : ""}
            </button>
            <button type="button" role="tab" aria-selected={aba === "estrutura"} className={abaClasse(aba === "estrutura")} onClick={() => setAba("estrutura")}>
              Estrutura do escopo{mudouEstrutura ? " •" : ""}
            </button>
          </div>
        )}

        <div className="space-y-4 overflow-y-auto p-5">
          {erro && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</div>
          )}
          {aviso && <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">{aviso}</div>}

          {aba === "agendamento" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Label>Data</Label>
                  <DatePicker value={data} onChange={setData} />
                </div>
                <div>
                  <Label>Hora</Label>
                  <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} required />
                </div>
              </div>

              {editavel && (
                <div>
                  <Label>Responsável pelo mapeamento</Label>
                  <Select value={agenteId} onChange={(e) => setAgenteId(e.target.value)}>
                    {!agenteId && <option value="">Selecione…</option>}
                    {listaAgentes.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome}
                      </option>
                    ))}
                  </Select>
                  {mudouAgente && (
                    <p className="mt-1 text-xs text-amber-700">
                      Ao salvar, o novo responsável recebe o pedido de aceite. A troca vale para todos os mapeamentos deste agendamento.
                    </p>
                  )}
                </div>
              )}

              <div>
                <Label>Endereço</Label>
                <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} />
              </div>
              <div>
                <Label>Orientações para o agente</Label>
                <textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  rows={5}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {aba === "estrutura" && (
            <>
              {carregandoEstrutura && <p className="text-sm text-muted-foreground">Carregando a estrutura…</p>}
              {arvore && !confirmacao && (
                <>
                  <p className="text-xs text-muted-foreground">
                    {numeroAtual ? `Editando a V${numeroAtual} (mais recente da unidade).` : ""}
                  </p>
                  {desatualizado && (
                    <div className="flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-500/10 p-3 text-sm text-amber-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        Este mapeamento usa a V{numeroDoCaso}, mas a estrutura mais recente da unidade é a V{numeroAtual}. Ao salvar, ele passa a usar a versão nova.
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
                      placeholder="Ex.: incluído 2º comboio e RFID"
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
                        <span>Aplicar também aos outros mapeamentos desta visita ({irmaos.map((i) => i.codigo).join(", ")})</span>
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
                    As respostas <strong>são preservadas</strong> (nada é apagado), mas estes itens deixam de aparecer no mapeamento:
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
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">
          {confirmacao ? (
            <>
              <Button variant="outline" onClick={() => setConfirmacao(null)} disabled={salvando}>
                Voltar e ajustar
              </Button>
              <Button onClick={() => void salvar(true)} disabled={salvando}>
                {salvando ? "Salvando…" : "Confirmar e salvar"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={salvando}>
                Cancelar
              </Button>
              <Button
                onClick={() => (algoMudou ? void salvar(false) : setAviso("Nenhuma alteração para salvar."))}
                disabled={salvando}
              >
                {salvando ? "Salvando…" : "Salvar"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
