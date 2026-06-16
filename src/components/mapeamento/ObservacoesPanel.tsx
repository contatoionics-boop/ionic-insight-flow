import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, Button, Textarea } from "@/components/ui-bits";
import { MessageSquarePlus, User } from "lucide-react";
import { toast } from "sonner";
import {
  listarObservacoes,
  adicionarObservacao,
  type ObservacaoRow,
} from "@/lib/mapeamento.functions";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ObservacoesPanel({ casoId }: { casoId: string }) {
  const listar = useServerFn(listarObservacoes);
  const adicionar = useServerFn(adicionarObservacao);
  const [rows, setRows] = useState<ObservacaoRow[]>([]);
  const [texto, setTexto] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await listar({ data: { casoId } });
      setRows(r);
    } catch (e: any) {
      console.error(e);
    }
  }, [casoId, listar]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    const t = texto.trim();
    if (!t) return;
    setWorking(true);
    try {
      await adicionar({ data: { casoId, texto: t } });
      setTexto("");
      await load();
      toast.success("Observação registrada");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-foreground">
        Observações e Intercorrências
      </h3>
      <div className="mb-4 space-y-2">
        <Textarea
          rows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Registre situações atípicas, pedidos de ajuda, itens faltantes, contatos realizados..."
        />
        <div className="flex justify-end">
          <Button onClick={submit} disabled={working || !texto.trim()}>
            <MessageSquarePlus className="mr-1 h-4 w-4" /> Adicionar
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma observação registrada.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-md border border-border bg-muted/20 px-3 py-2"
            >
              <p className="whitespace-pre-wrap text-sm text-foreground">{r.texto}</p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <User className="h-3 w-3" />
                <span>{r.usuario_nome ?? "Usuário"}</span>
                <span>·</span>
                <span>{fmt(r.criado_em)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
