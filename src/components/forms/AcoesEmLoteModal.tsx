import { useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Select } from "@/components/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import { APLICA_A_OPCOES } from "@/lib/escopo/tipos";

type PerguntaLote = {
  id: string;
  secao_id: string;
  texto: string;
  tipo: string;
  ordem: number;
  entidade_tipo?: string | null;
  condicional_pergunta_id?: string | null;
};
type SecaoLote = { id: string; titulo: string; ordem: number };

export type PatchLote = {
  entidade_tipo?: string;
  condicional_pergunta_id?: string | null;
  condicional_operador?: string | null;
  condicional_valor?: string | null;
};

/**
 * Ações em lote sobre as perguntas de uma seção: "Aplica-se a" (repetição por
 * bomba/bico/comboio...) e "Mostrar somente se" (condição) de uma vez só.
 */
export function AcoesEmLoteModal({
  open,
  onClose,
  secoes,
  perguntas,
  onAplicado,
}: {
  open: boolean;
  onClose: () => void;
  secoes: SecaoLote[];
  perguntas: PerguntaLote[];
  onAplicado: (ids: string[], patch: PatchLote) => void;
}) {
  const [secaoId, setSecaoId] = useState("");
  const [marcadas, setMarcadas] = useState<Record<string, boolean>>({});
  const [aplicaA, setAplicaA] = useState("bomba");
  const [gatilhoId, setGatilhoId] = useState("");
  const [operador, setOperador] = useState("igual");
  const [valor, setValor] = useState("");
  const [opcoes, setOpcoes] = useState<string[]>([]);
  const [trabalhando, setTrabalhando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const secoesOrdenadas = useMemo(() => [...secoes].sort((a, b) => a.ordem - b.ordem), [secoes]);
  const daSecao = useMemo(
    () => perguntas.filter((p) => p.secao_id === secaoId).sort((a, b) => a.ordem - b.ordem),
    [perguntas, secaoId],
  );

  // Ao trocar de seção, todas as perguntas vêm marcadas.
  useEffect(() => {
    setMarcadas(Object.fromEntries(daSecao.map((p) => [p.id, true])));
    setMsg(null);
  }, [secaoId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    if (!secaoId && secoesOrdenadas.length) setSecaoId(secoesOrdenadas[0].id);
  }, [open, secoesOrdenadas, secaoId]);

  // Opções de resposta do gatilho (quando é de seleção).
  useEffect(() => {
    setOpcoes([]);
    setValor("");
    if (!gatilhoId) return;
    let vivo = true;
    supabase
      .from("opcoes_pergunta")
      .select("texto, ordem")
      .eq("pergunta_id", gatilhoId)
      .order("ordem")
      .then(({ data }) => vivo && setOpcoes((data ?? []).map((o: { texto: string }) => o.texto)));
    return () => {
      vivo = false;
    };
  }, [gatilhoId]);

  const ids = daSecao.filter((p) => marcadas[p.id]).map((p) => p.id);
  const gatilho = perguntas.find((p) => p.id === gatilhoId);

  async function aplicar(patch: PatchLote, alvo: string[], rotulo: string) {
    if (!alvo.length) {
      setMsg({ ok: false, texto: "Marque ao menos uma pergunta." });
      return;
    }
    setTrabalhando(true);
    setMsg(null);
    const { error } = await supabase.from("perguntas").update(patch as never).in("id", alvo);
    setTrabalhando(false);
    if (error) {
      setMsg({ ok: false, texto: `Não foi possível aplicar: ${error.message}` });
      return;
    }
    onAplicado(alvo, patch);
    setMsg({ ok: true, texto: `${rotulo} em ${alvo.length} pergunta(s).` });
  }

  const alvoCondicao = ids.filter((id) => id !== gatilhoId);

  return (
    <Modal open={open} onClose={onClose} title="Aplicar em lote">
      <div className="space-y-5">
        <div>
          <p className="mb-1 text-sm font-medium text-foreground">1. Escolha a seção e as perguntas</p>
          <Select value={secaoId} onChange={(e) => setSecaoId(e.target.value)}>
            {secoesOrdenadas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.titulo}
              </option>
            ))}
          </Select>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {ids.length} de {daSecao.length} perguntas marcadas
            </span>
            <span className="flex gap-3">
              <button
                type="button"
                className="underline"
                onClick={() => setMarcadas(Object.fromEntries(daSecao.map((p) => [p.id, true])))}
              >
                Marcar todas
              </button>
              <button
                type="button"
                className="underline"
                onClick={() => setMarcadas(Object.fromEntries(daSecao.map((p) => [p.id, false])))}
              >
                Desmarcar
              </button>
            </span>
          </div>
          <div className="mt-1 max-h-44 space-y-0.5 overflow-y-auto rounded-md border border-border p-1.5">
            {daSecao.length === 0 && <p className="px-1 py-1 text-xs text-muted-foreground">Seção sem perguntas.</p>}
            {daSecao.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted/50">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4"
                  checked={!!marcadas[p.id]}
                  onChange={(e) => setMarcadas((m) => ({ ...m, [p.id]: e.target.checked }))}
                />
                <span className="min-w-0 flex-1">
                  {p.texto || "(sem título)"}
                  <span className="ml-1 text-[11px] text-muted-foreground">
                    · {APLICA_A_OPCOES.find((o) => o.value === (p.entidade_tipo ?? "geral"))?.label ?? "Geral"}
                    {p.condicional_pergunta_id ? " · com condição" : ""}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-border p-3">
          <p className="text-sm font-medium text-foreground">2. Repetir por entidade do escopo (Aplica-se a)</p>
          <p className="mb-2 text-xs text-muted-foreground">
            Ex.: marcar as perguntas da seção como <strong>Bomba</strong> faz cada pergunta se repetir por bomba do escopo.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[12rem] flex-1">
              <Select value={aplicaA} onChange={(e) => setAplicaA(e.target.value)}>
                {APLICA_A_OPCOES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              type="button"
              disabled={trabalhando || ids.length === 0}
              onClick={() => void aplicar({ entidade_tipo: aplicaA }, ids, `"Aplica-se a" atualizado`)}
            >
              Aplicar às {ids.length} marcadas
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-border p-3">
          <p className="text-sm font-medium text-foreground">3. Mostrar somente se (condição)</p>
          <p className="mb-2 text-xs text-muted-foreground">
            Ex.: mostrar o registrador mecânico só se <strong>Tipo de bomba</strong> for igual a <strong>Mecânica</strong>.
            Em perguntas repetidas por bomba/bico, a condição vale para a mesma bomba.
          </p>
          <div className="space-y-2">
            <Select value={gatilhoId} onChange={(e) => setGatilhoId(e.target.value)}>
              <option value="">Escolha a pergunta que decide…</option>
              {[...perguntas]
                .sort((a, b) => a.ordem - b.ordem)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {(p.texto || "(sem título)").slice(0, 70)}
                  </option>
                ))}
            </Select>
            {gatilhoId && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr]">
                <Select value={operador} onChange={(e) => setOperador(e.target.value)}>
                  <option value="igual">for igual a</option>
                  <option value="diferente">for diferente de</option>
                  <option value="contem">contiver</option>
                </Select>
                {opcoes.length > 0 ? (
                  <Select value={valor} onChange={(e) => setValor(e.target.value)}>
                    <option value="">Selecione…</option>
                    {opcoes.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder={gatilho?.tipo === "toggle" ? "sim ou nao" : "valor esperado"}
                  />
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={trabalhando || !gatilhoId || !valor.trim() || alvoCondicao.length === 0}
                onClick={() =>
                  void aplicar(
                    {
                      condicional_pergunta_id: gatilhoId,
                      condicional_operador: operador,
                      condicional_valor: valor.trim(),
                    },
                    alvoCondicao,
                    "Condição aplicada",
                  )
                }
              >
                Aplicar condição às {alvoCondicao.length} marcadas
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={trabalhando || ids.length === 0}
                onClick={() =>
                  void aplicar(
                    { condicional_pergunta_id: null, condicional_operador: null, condicional_valor: null },
                    ids,
                    "Condição removida",
                  )
                }
              >
                Remover condição das marcadas
              </Button>
            </div>
          </div>
        </div>

        {msg && (
          <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-destructive"}`} role="status">
            {msg.texto}
          </p>
        )}
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
