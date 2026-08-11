import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Layers, Loader2, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Badge, Button, Card, Input, Modal, Select } from "@/components/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import {
  aplicarBlocos,
  removerBloco,
  sugerirBlocos,
  type SugestaoBloco,
} from "@/lib/blocos.functions";

type BlocoExistente = {
  id: string;
  titulo: string;
  layout: string;
  secao_id: string;
  total: number;
};

export function BlocosModal({
  formularioId,
  open,
  onClose,
  onChanged,
}: {
  formularioId: string;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const sugerir = useServerFn(sugerirBlocos);
  const aplicar = useServerFn(aplicarBlocos);
  const remover = useServerFn(removerBloco);

  const [carregando, setCarregando] = useState(false);
  const [sugestoes, setSugestoes] = useState<SugestaoBloco[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [titulos, setTitulos] = useState<Record<number, string>>({});
  const [layouts, setLayouts] = useState<Record<number, SugestaoBloco["layout"]>>({});
  const [existentes, setExistentes] = useState<BlocoExistente[]>([]);
  const [salvando, setSalvando] = useState(false);

  const carregarExistentes = async () => {
    const { data: secs } = await supabase
      .from("secoes")
      .select("id")
      .eq("formulario_id", formularioId);
    const ids = (secs ?? []).map((s) => s.id);
    if (!ids.length) {
      setExistentes([]);
      return;
    }
    const { data: blocos } = await supabase
      .from("pergunta_blocos")
      .select("id, titulo, layout, secao_id")
      .in("secao_id", ids)
      .order("ordem");
    const { data: ps } = await supabase
      .from("perguntas")
      .select("bloco_id")
      .in("secao_id", ids);
    const contagem = new Map<string, number>();
    for (const p of ps ?? []) {
      if (!p.bloco_id) continue;
      contagem.set(p.bloco_id, (contagem.get(p.bloco_id) ?? 0) + 1);
    }
    setExistentes(
      (blocos ?? []).map((b: any) => ({
        id: b.id,
        titulo: b.titulo,
        layout: b.layout,
        secao_id: b.secao_id,
        total: contagem.get(b.id) ?? 0,
      })),
    );
  };

  const carregarSugestoes = async () => {
    setCarregando(true);
    try {
      const res = (await sugerir({ data: { formularioId } })) as SugestaoBloco[];
      setSugestoes(res);
      setSelecionadas(new Set(res.map((_, i) => i)));
      setTitulos(Object.fromEntries(res.map((s, i) => [i, s.titulo])));
      setLayouts(Object.fromEntries(res.map((s, i) => [i, s.layout])));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar sugestões.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void carregarExistentes();
    void carregarSugestoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, formularioId]);

  const toggle = (i: number) =>
    setSelecionadas((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const salvar = async () => {
    const escolhidas = sugestoes.filter((_, i) => selecionadas.has(i));
    if (escolhidas.length === 0) {
      toast.error("Selecione ao menos um bloco.");
      return;
    }
    setSalvando(true);
    try {
      const payload = sugestoes
        .map((s, i) => ({ s, i }))
        .filter(({ i }) => selecionadas.has(i))
        .map(({ s, i }) => ({
          secaoId: s.secaoId,
          titulo: titulos[i] ?? s.titulo,
          layout: layouts[i] ?? s.layout,
          perguntas: s.perguntas.map((p) => ({
            id: p.id,
            linha: (layouts[i] ?? s.layout) === "matriz" ? p.linha : null,
            coluna: p.coluna,
          })),
        }));
      const res = await aplicar({ data: { blocos: payload } });
      toast.success(`${res.criados} bloco(s) criado(s).`);
      onChanged();
      await carregarExistentes();
      await carregarSugestoes();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao aplicar blocos.");
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (blocoId: string) => {
    if (!confirm("Desfazer este bloco? As perguntas voltam a ser individuais.")) return;
    try {
      await remover({ data: { blocoId } });
      toast.success("Bloco desfeito.");
      onChanged();
      await carregarExistentes();
      await carregarSugestoes();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover.");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Agrupar perguntas em blocos">
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Blocos reúnem perguntas relacionadas em um único cartão no chat do agente técnico,
          reduzindo o número de interações.
        </p>

        {existentes.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Blocos já configurados
            </p>
            <div className="space-y-2">
              {existentes.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{b.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.total} pergunta(s) · {b.layout}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void excluir(b.id)}
                    className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Desfazer bloco"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sugestões automáticas
            </p>
            <Button variant="outline" onClick={() => void carregarSugestoes()} disabled={carregando}>
              {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Recalcular
            </Button>
          </div>

          {carregando ? (
            <Card>
              <p className="text-sm text-muted-foreground">Analisando as perguntas…</p>
            </Card>
          ) : sugestoes.length === 0 ? (
            <Card>
              <p className="text-sm text-muted-foreground">
                Nenhum agrupamento óbvio encontrado. Use prefixos comuns nas perguntas
                (ex.: "Bomba: marca", "Bomba: vazão") para que sejam agrupadas.
              </p>
            </Card>
          ) : (
            <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
              {sugestoes.map((s, i) => (
                <div
                  key={`${s.secaoId}-${i}`}
                  className={`rounded-md border px-3 py-3 ${
                    selecionadas.has(i) ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selecionadas.has(i)}
                      onChange={() => toggle(i)}
                      className="mt-1 h-4 w-4"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={titulos[i] ?? s.titulo}
                          onChange={(e) => setTitulos((t) => ({ ...t, [i]: e.target.value }))}
                          className="h-8 max-w-[220px]"
                        />
                        <Select
                          value={layouts[i] ?? s.layout}
                          onChange={(e) =>
                            setLayouts((l) => ({
                              ...l,
                              [i]: e.target.value as SugestaoBloco["layout"],
                            }))
                          }
                          className="h-8 w-auto"
                        >
                          <option value="cartao">Cartão</option>
                          <option value="matriz">Matriz</option>
                          <option value="fotos">Fotos em lote</option>
                        </Select>
                        <Badge>{s.secaoTitulo}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{s.motivo}</p>
                      <ul className="mt-2 space-y-0.5">
                        {s.perguntas.map((p) => (
                          <li key={p.id} className="truncate text-xs text-foreground">
                            • {p.texto}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando || sugestoes.length === 0}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
            Aplicar selecionados
          </Button>
        </div>
      </div>
    </Modal>
  );
}
